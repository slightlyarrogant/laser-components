import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { createRequire } from "node:module";
import { getConnInfo } from "@hono/node-server/conninfo";
import { Hono, type Context, type MiddlewareHandler } from "hono";
import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { config } from "../config.js";
import { prisma } from "../db/client.js";
import { emitAuthRequest } from "../core/session-log.js";
import { child, errMessage, errStack, hashId } from "../core/log.js";
import {
  consumeAuthCode,
  consumeRefreshToken,
  createAuthCode,
  getClient,
  isAbsoluteHttpUrl,
  issueRefreshToken,
  registerClient,
  touchClient,
  type StoredClient,
} from "./store.js";

// Re-exported so the shape of this module's public surface is unchanged for
// callers; the implementation now lives with the rest of the store helpers.
export { isAbsoluteHttpUrl };

const require = createRequire(import.meta.url);
const bcrypt = require("bcryptjs") as typeof import("bcryptjs");

// Every line from this module carries `mod:"oauth"`. The client_id is ALWAYS
// passed through hashId(): it is correlatable across lines but, paired with a
// registered redirect_uri, a verbatim one is enough to start a flow — and this
// log is read by more people than the client registry is.
const log = child({ mod: "oauth" });

// ---------------------------------------------------------------------------
// Request IP — first X-Forwarded-For entry (the live deploy sits behind ngrok),
// socket address as the fallback for direct connections.
// ---------------------------------------------------------------------------

export function clientIp(c: Context): string {
  const forwarded = c.req.header("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  try {
    return getConnInfo(c as never).remote.address ?? "unknown";
  } catch {
    return "unknown";
  }
}

// ---------------------------------------------------------------------------
// Rejection logging
//
// EVERY refusal on /authorize and /token logs one `oauth-rejected` line. Before
// this, an unknown client_id was answered with a bare 400 and nothing else, so a
// customer's connector could be locked out while monitoring saw nothing.
// deploy/watchdog.sh counts the unknown_client / redirect_mismatch reasons.
// The full redirect_uri is deliberately NOT logged — only its host.
// ---------------------------------------------------------------------------

export type RejectReason =
  | "unknown_client"
  | "redirect_mismatch"
  | "missing_param"
  | "malformed_body"
  | "unsupported_response_type"
  | "unsupported_grant_type"
  | "pkce_method"
  | "pkce_format"
  | "pkce_missing_verifier"
  | "pkce_mismatch"
  | "client_mismatch"
  | "invalid_grant";

function hostOf(uri: string | undefined): string | undefined {
  if (!uri) return undefined;
  try {
    return new URL(uri).host;
  } catch {
    return "(unparseable)";
  }
}

function logRejection(
  c: Context,
  endpoint: "authorize" | "token",
  reason: RejectReason,
  clientId: string | undefined,
  redirectUri: string | undefined,
  detail?: string
): void {
  log.warn({
    evt: "oauth-rejected",
    endpoint,
    method: c.req.method,
    reason,
    ...(detail ? { detail } : {}),
    client: clientId ? hashId(clientId) : undefined,
    redirectHost: hostOf(redirectUri),
    ip: clientIp(c),
  });
}

// ---------------------------------------------------------------------------
// Auto-registration for trusted assistant hosts
//
// A connector keeps the client_id it registered via /register. If the registry
// loses that row (re-clone, DB restore), /authorize used to refuse the client
// forever and the customer had to delete and re-add the connector. For the
// hosted assistants we serve, /authorize now re-creates the registration on the
// fly, bound to the ONE redirect_uri presented.
//
// Why this does not reopen audit C3 (open redirect / code theft):
//  - The client_id was never a secret: token_endpoint_auth_method is "none" and
//    anyone can mint one via POST /register. Knowing or inventing a client_id
//    grants nothing.
//  - What protects the code is WHERE it is delivered. Auto-registration only
//    happens for an https redirect_uri whose host is EXACTLY one of
//    TRUSTED_REDIRECT_HOSTS (no subdomains, no http, no non-default port, no
//    userinfo), so the code can only ever land on the assistant's own callback,
//    never on an attacker-chosen URL.
//  - The code stays bound to that exact redirect_uri (re-checked at /token) and
//    to the PKCE challenge, so it cannot be redeemed by anyone who did not start
//    the flow.
//  - An EXISTING client is never widened: a known client_id presented with an
//    unregistered redirect_uri is still rejected as redirect_mismatch.
// ---------------------------------------------------------------------------

export const TRUSTED_REDIRECT_HOSTS: ReadonlySet<string> = new Set([
  "claude.ai",
  "chatgpt.com",
  "chat.openai.com",
]);

/**
 * Returns the trusted host when `redirectUri` is an https URL on exactly one of
 * TRUSTED_REDIRECT_HOSTS (default port, no credentials), otherwise null. The
 * path and query are irrelevant.
 */
export function trustedRedirectHost(redirectUri: string): string | null {
  let url: URL;
  try {
    url = new URL(redirectUri);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  if (url.username || url.password || url.port) return null;
  const host = url.hostname.toLowerCase();
  return TRUSTED_REDIRECT_HOSTS.has(host) ? host : null;
}

// Client ids we issue are UUIDs; accept any conservative token so a connector
// holding some other id format still recovers, but never an arbitrary blob.
const AUTO_CLIENT_ID_RE = /^[A-Za-z0-9._~:-]{1,200}$/;

/**
 * Looks the client up; when unknown and the redirect_uri is on a trusted
 * assistant host, registers it with that single redirect_uri. Returns null when
 * the client is unknown and may not be auto-registered.
 */
async function resolveClient(clientId: string, redirectUri: string): Promise<StoredClient | null> {
  const existing = await getClient(clientId);
  if (existing) return existing;
  const host = trustedRedirectHost(redirectUri);
  if (!host || !AUTO_CLIENT_ID_RE.test(clientId)) return null;
  try {
    const created = await registerClient(clientId, [redirectUri], `auto-registered (${host})`);
    log.info({ evt: "oauth-client-autoregistered", client: hashId(clientId), host });
    return created;
  } catch (err) {
    // A concurrent request (GET + POST, or a double-click) may have inserted it.
    const again = await getClient(clientId);
    if (again) return again;
    throw err;
  }
}

// ---------------------------------------------------------------------------
// OAuth state
//
// Authorization codes, refresh tokens and the dynamic client registry all live
// in Postgres (src/auth/store.ts, tables created by
// db/migrations/2026-09-15-oauth-state.sql). There is no in-memory or on-disk
// copy: a restart, a re-clone or a second process all see the same state, which
// is exactly what the Map + JSON-file version could not do.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// PKCE (RFC 7636, S256 only)
// ---------------------------------------------------------------------------

// Phase 0 accepts a flow without PKCE (a saved connector may not send one) but
// warns once per client so Phase 1 can flip this to a hard rejection knowing
// who would break.
const pkceWarnedClients = new Set<string>();

function warnMissingPkce(clientId: string): void {
  if (pkceWarnedClients.has(clientId)) return;
  if (pkceWarnedClients.size > 1000) pkceWarnedClients.clear();
  pkceWarnedClients.add(clientId);
  log.warn({
    evt: "oauth-no-pkce",
    client: hashId(clientId),
    phase: "permitted-for-now",
  });
}

/** base64url(sha256(verifier)) === challenge, compared in constant time. */
export function verifyPkceChallenge(verifier: string, challenge: string): boolean {
  const computed = Buffer.from(
    createHash("sha256").update(verifier, "ascii").digest("base64url")
  );
  const expected = Buffer.from(challenge);
  if (computed.length !== expected.length) return false;
  return timingSafeEqual(computed, expected);
}

// ---------------------------------------------------------------------------
// JWT helpers — jose HS256 over LC_JWT_SECRET (identity-preserving).
// Claims mirror the old jsonwebtoken payload: { sub, userId, email }.
// ---------------------------------------------------------------------------

const jwtSecret = new TextEncoder().encode(config.JWT_SECRET);

export interface AccessTokenPayload extends JWTPayload {
  sub: string; // String(user.id)
  userId: number;
  email: string;
}

export async function signAccessToken(
  sub: string,
  userId: number,
  email: string
): Promise<string> {
  return new SignJWT({ userId, email })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(config.JWT_ISSUER)
    .setAudience(config.JWT_AUDIENCE)
    .setSubject(sub)
    .setIssuedAt()
    .setExpirationTime(`${config.JWT_ACCESS_TOKEN_TTL_SECONDS}s`)
    .sign(jwtSecret);
}

export async function verifyAccessToken(token: string): Promise<AccessTokenPayload> {
  // Issuer AND audience are both constrained: a signature-only check accepts
  // any HS256 token minted with this secret for any other service that happens
  // to share it. Tokens issued before this change carry no `aud` and are
  // rejected — the connector re-authorizes once.
  const { payload } = await jwtVerify(token, jwtSecret, {
    issuer: config.JWT_ISSUER,
    audience: config.JWT_AUDIENCE,
  });
  return payload as AccessTokenPayload;
}

// ---------------------------------------------------------------------------
// Login form HTML
// ---------------------------------------------------------------------------

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

function loginFormHtml(params: {
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge?: string;
  error?: string;
}): string {
  const errorHtml = params.error
    ? `<div class="error">${escapeHtml(params.error)}</div>`
    : "";
  // The PKCE challenge arrives on the GET and must survive the login POST so
  // the issued code stays bound to it. S256 is the only method we accept, so
  // the method field is a constant rather than client-echoed input.
  const pkceHtml = params.codeChallenge
    ? `<input type="hidden" name="code_challenge" value="${escapeHtml(params.codeChallenge)}">
      <input type="hidden" name="code_challenge_method" value="S256">`
    : "";
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>LC Connect – Sign in</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{background:#0d1117;min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
    .card{background:#161b22;border:1px solid #30363d;border-radius:12px;padding:40px;width:380px;box-shadow:0 16px 48px rgba(0,0,0,.5)}
    .logo{text-align:center;margin-bottom:28px}
    .logo h1{color:#58a6ff;font-size:24px;font-weight:700;letter-spacing:-.5px}
    .logo p{color:#8b949e;font-size:13px;margin-top:4px}
    .error{background:#3d1f1f;border:1px solid #f85149;color:#f85149;border-radius:6px;padding:10px 14px;font-size:13px;margin-bottom:20px}
    label{display:block;color:#c9d1d9;font-size:13px;font-weight:500;margin-bottom:6px}
    input[type=email],input[type=password]{width:100%;background:#0d1117;border:1px solid #30363d;border-radius:6px;color:#c9d1d9;font-size:14px;padding:10px 12px;margin-bottom:16px;outline:none;transition:border-color .15s}
    input:focus{border-color:#58a6ff}
    button{width:100%;background:#238636;border:1px solid #2ea043;border-radius:6px;color:#fff;font-size:14px;font-weight:600;padding:10px;cursor:pointer;transition:background .15s}
    button:hover{background:#2ea043}
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">
      <h1>LC Connect</h1>
      <p>Laser Components MCP Server</p>
    </div>
    ${errorHtml}
    <form method="POST" action="/authorize">
      <input type="hidden" name="client_id" value="${escapeHtml(params.clientId)}">
      <input type="hidden" name="redirect_uri" value="${escapeHtml(params.redirectUri)}">
      <input type="hidden" name="state" value="${escapeHtml(params.state)}">
      ${pkceHtml}
      <label for="email">Email</label>
      <input type="email" id="email" name="email" required placeholder="you@example.com" autocomplete="email">
      <label for="password">Password</label>
      <input type="password" id="password" name="password" required placeholder="••••••••" autocomplete="current-password">
      <button type="submit">Sign in</button>
    </form>
  </div>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// OAuth router
// ---------------------------------------------------------------------------

export const oauthRouter = new Hono();

/**
 * OAuth 2.0 Authorization Server Metadata (RFC 8414).
 * Advertises the canonical /authorize and /token endpoints.
 */
oauthRouter.get("/.well-known/oauth-authorization-server", (c) => {
  const base = config.PUBLIC_BASE_URL.replace(/\/$/, "");
  return c.json({
    issuer: config.JWT_ISSUER,
    authorization_endpoint: `${base}/authorize`,
    token_endpoint: `${base}/token`,
    registration_endpoint: `${base}/register`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    scopes_supported: ["lc:read", "lc:write"],
  });
});

/**
 * POST /register — RFC 7591 Dynamic Client Registration.
 * Accepts any client metadata and issues a new client_id.
 */
oauthRouter.post("/register", async (c) => {
  let body: Record<string, unknown> = {};
  try {
    body = (await c.req.json()) as Record<string, unknown>;
  } catch {
    /* handled by the redirect_uris check below */
  }

  // redirect_uris is what /authorize matches against, so it is mandatory and
  // must be absolute http(s). Previously it was echoed back but never stored,
  // which left /authorize with nothing to validate against.
  const rawUris = body.redirect_uris;
  if (!Array.isArray(rawUris) || rawUris.length === 0) {
    return c.json(
      {
        error: "invalid_redirect_uri",
        error_description: "redirect_uris is required and must be a non-empty array",
      },
      400
    );
  }
  const redirectUris = rawUris.filter(isAbsoluteHttpUrl);
  if (redirectUris.length !== rawUris.length) {
    return c.json(
      {
        error: "invalid_redirect_uri",
        error_description: "every redirect_uri must be an absolute http(s) URL",
      },
      400
    );
  }

  const clientId = randomUUID();
  const clientName = typeof body.client_name === "string" ? body.client_name : undefined;
  await registerClient(clientId, redirectUris, clientName);
  log.info({
    evt: "oauth-client-registered",
    client: hashId(clientId),
    clientName,
    redirectUris,
  });

  return c.json(
    {
      client_id: clientId,
      client_id_issued_at: Math.floor(Date.now() / 1000),
      client_secret_expires_at: 0,
      redirect_uris: redirectUris,
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
    },
    201
  );
});

/**
 * GET /authorize — display the LC login form.
 */
async function handleAuthorizeGet(c: Context) {
  const { client_id, redirect_uri, response_type, state, code_challenge, code_challenge_method } =
    c.req.query();

  if (response_type !== "code") {
    logRejection(c, "authorize", "unsupported_response_type", client_id, redirect_uri);
    return c.text("unsupported_response_type: only 'code' is supported", 400);
  }
  if (!client_id) {
    logRejection(c, "authorize", "missing_param", client_id, redirect_uri, "client_id");
    return c.text("invalid_request: client_id is required", 400);
  }
  if (!redirect_uri) {
    logRejection(c, "authorize", "missing_param", client_id, redirect_uri, "redirect_uri");
    return c.text("invalid_request: redirect_uri is required", 400);
  }
  // One lookup (plus auto-registration for trusted assistant hosts) serves both
  // the "is this client registered?" and the "is this redirect_uri registered
  // for it?" gates below.
  const client = await resolveClient(client_id, redirect_uri);
  if (!client) {
    logRejection(c, "authorize", "unknown_client", client_id, redirect_uri);
    return c.text("unauthorized_client: unknown client_id", 400);
  }
  // Checked BEFORE the login form is rendered: an unvalidated redirect_uri
  // turns this page into a credential-harvest / code-theft vector even if the
  // user never submits it.
  if (!client.redirectUris.includes(redirect_uri)) {
    logRejection(c, "authorize", "redirect_mismatch", client_id, redirect_uri);
    return c.text(
      "invalid_request: redirect_uri does not match a redirect URI registered for this client",
      400
    );
  }
  const pkceError = validatePkceRequest(code_challenge, code_challenge_method, client_id);
  if (pkceError) {
    logRejection(c, "authorize", pkceError.reason, client_id, redirect_uri);
    return c.text(pkceError.message, 400);
  }

  const authUrl = new URL("/authorize", config.PUBLIC_BASE_URL);
  authUrl.searchParams.set("client_id", client_id);
  authUrl.searchParams.set("redirect_uri", redirect_uri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("state", state ?? "");
  if (code_challenge) {
    authUrl.searchParams.set("code_challenge", code_challenge);
    authUrl.searchParams.set("code_challenge_method", "S256");
  }
  emitAuthRequest(authUrl.toString());

  return c.html(
    loginFormHtml({
      clientId: client_id,
      redirectUri: redirect_uri,
      state: state ?? "",
      codeChallenge: code_challenge,
    })
  );
}

/**
 * Shared PKCE gate for GET and POST /authorize. Returns an error string when
 * the request must be refused (with its log reason), or undefined when it may proceed (including the
 * no-PKCE case, which only warns — Phase 1 turns that into a rejection).
 */
function validatePkceRequest(
  codeChallenge: string | undefined,
  codeChallengeMethod: string | undefined,
  clientId: string
): { reason: RejectReason; message: string } | undefined {
  if (!codeChallenge) {
    warnMissingPkce(clientId);
    return undefined;
  }
  if (codeChallengeMethod !== "S256") {
    return { reason: "pkce_method", message: "invalid_request: code_challenge_method must be S256" };
  }
  if (!/^[A-Za-z0-9_-]{43,128}$/.test(codeChallenge)) {
    return {
      reason: "pkce_format",
      message: "invalid_request: code_challenge must be a base64url-encoded SHA-256 digest",
    };
  }
  return undefined;
}

/**
 * POST /authorize — authenticate against LC's Postgres `User` table with bcrypt.
 * On success: tenant sub = String(user.id), issue single-use auth code, redirect.
 */
async function handleAuthorizePost(c: Context) {
  let body: Record<string, string>;
  try {
    body = (await c.req.parseBody()) as Record<string, string>;
  } catch {
    logRejection(c, "authorize", "malformed_body", undefined, undefined);
    return c.text("invalid_request: could not parse form body", 400);
  }

  const { client_id, redirect_uri, state, email, password, code_challenge, code_challenge_method } =
    body;

  const fail = (msg: string, status: 400 | 401 = 401) =>
    c.html(
      loginFormHtml({
        clientId: client_id ?? "",
        redirectUri: redirect_uri ?? "",
        state: state ?? "",
        codeChallenge: code_challenge,
        error: msg,
      }),
      status
    );

  if (!client_id) {
    logRejection(c, "authorize", "missing_param", client_id, redirect_uri, "client_id");
    return c.text("invalid_request: client_id is required", 400);
  }
  if (!redirect_uri) {
    logRejection(c, "authorize", "missing_param", client_id, redirect_uri, "redirect_uri");
    return c.text("invalid_request: redirect_uri is required", 400);
  }
  const client = await resolveClient(client_id, redirect_uri);
  if (!client) {
    logRejection(c, "authorize", "unknown_client", client_id, redirect_uri);
    return c.text("unauthorized_client", 400);
  }
  // Re-checked on the POST: the hidden field is attacker-controllable, so the
  // GET-time check alone would not stop a forged form post.
  if (!client.redirectUris.includes(redirect_uri)) {
    logRejection(c, "authorize", "redirect_mismatch", client_id, redirect_uri);
    return c.text(
      "invalid_request: redirect_uri does not match a redirect URI registered for this client",
      400
    );
  }
  const pkceError = validatePkceRequest(code_challenge, code_challenge_method, client_id);
  if (pkceError) {
    logRejection(c, "authorize", pkceError.reason, client_id, redirect_uri);
    return c.text(pkceError.message, 400);
  }
  if (!email || !password) {
    return fail("Email and password are required", 400);
  }

  // A failed login logs the REASON but never the identity that was attempted:
  // the submitted email is an unauthenticated, attacker-chosen string, and
  // writing it here would turn the log into a list of guessed addresses (and,
  // when someone types their password into the email box, worse). The password
  // is never in scope for logging at all. A SUCCESSFUL login logs the email,
  // because at that point it is a verified account identity, not a guess.
  const clientHash = client_id ? hashId(client_id) : undefined;
  const loginFailed = (reason: string, status: 400 | 401 = 401) => {
    log.warn({ evt: "oauth-login-failed", reason, client: clientHash });
    return fail("Invalid email or password", status);
  };

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return loginFailed("unknown-email");

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return loginFailed("bad-password");

    // A deactivated account is refused with the SAME message as a bad password:
    // "this account exists but is switched off" is an enumeration oracle.
    if (!user.isActive) return loginFailed("inactive-account");

    const code = await createAuthCode({
      userId: user.id,
      clientId: client_id,
      redirectUri: redirect_uri,
      codeChallenge: code_challenge,
      ttlSeconds: config.AUTH_CODE_TTL_SECONDS,
    });

    log.info({
      evt: "oauth-login-ok",
      userId: String(user.id),
      email: user.email,
      client: clientHash,
      pkce: Boolean(code_challenge),
    });

    const target = new URL(redirect_uri);
    target.searchParams.set("code", code);
    if (state) target.searchParams.set("state", state);
    return c.redirect(target.toString(), 302);
  } catch (err) {
    log.error({ evt: "oauth-authorize-error", client: clientHash, err: errMessage(err) });
    log.debug({ evt: "oauth-authorize-error", stack: errStack(err) });
    return fail("Internal error — please try again", 400);
  }
}

// Canonical paths (advertised in discovery).
oauthRouter.get("/authorize", handleAuthorizeGet);
oauthRouter.post("/authorize", handleAuthorizePost);
// Legacy aliases — LC's old server exposed /oauth/authorize. Kept so existing
// bookmarks / in-flight flows still work.
oauthRouter.get("/oauth/authorize", handleAuthorizeGet);
oauthRouter.post("/oauth/authorize", handleAuthorizePost);

/**
 * POST /token — authorization_code and refresh_token grants.
 * Accepts application/x-www-form-urlencoded and application/json.
 */
async function handleTokenPost(c: Context) {
  let params: Record<string, string> = {};
  const contentType = c.req.header("content-type") ?? "";
  if (contentType.includes("application/json")) {
    try {
      params = (await c.req.json()) as Record<string, string>;
    } catch {
      logRejection(c, "token", "malformed_body", undefined, undefined);
      return c.json({ error: "invalid_request", error_description: "malformed JSON body" }, 400);
    }
  } else {
    try {
      params = (await c.req.parseBody()) as Record<string, string>;
    } catch {
      logRejection(c, "token", "malformed_body", undefined, undefined);
      return c.json({ error: "invalid_request", error_description: "malformed form body" }, 400);
    }
  }

  const { grant_type, code, redirect_uri, client_id, refresh_token, code_verifier } = params;

  const reject = (reason: RejectReason, detail?: string) =>
    logRejection(c, "token", reason, client_id, redirect_uri, detail);

  if (!client_id) {
    reject("missing_param", "client_id");
    return c.json({ error: "unauthorized_client" }, 401);
  }
  if (!(await getClient(client_id))) {
    reject("unknown_client");
    return c.json({ error: "unauthorized_client" }, 401);
  }

  // -- Refresh token grant --
  if (grant_type === "refresh_token") {
    if (!refresh_token) {
      reject("missing_param", "refresh_token");
      return c.json({ error: "invalid_request", error_description: "refresh_token is required" }, 400);
    }
    const entry = await consumeRefreshToken(refresh_token);
    if (!entry) {
      reject("invalid_grant", "refresh_token");
      return c.json({ error: "invalid_grant", error_description: "refresh_token is invalid or expired" }, 400);
    }
    if (entry.clientId !== client_id) {
      reject("client_mismatch", "refresh_token");
      return c.json({ error: "invalid_grant", error_description: "client_id mismatch" }, 400);
    }
    // LC has no backend ERP session to refresh — the "ensure backend session"
    // hook is a no-op. Re-mint the JWT directly from the stored identity.
    const accessToken = await signAccessToken(entry.sub, Number(entry.sub), entry.email);
    const newRefreshToken = await issueRefreshToken(Number(entry.sub), client_id);
    touchClient(client_id);
    return c.json({
      access_token: accessToken,
      refresh_token: newRefreshToken,
      token_type: "Bearer",
      expires_in: config.JWT_ACCESS_TOKEN_TTL_SECONDS,
      scope: "lc:read lc:write",
    });
  }

  // -- Authorization code grant --
  if (grant_type !== "authorization_code") {
    reject("unsupported_grant_type");
    return c.json({ error: "unsupported_grant_type" }, 400);
  }
  if (!code) {
    reject("missing_param", "code");
    return c.json({ error: "invalid_request", error_description: "code is required" }, 400);
  }

  // RFC 6749 §4.1.3: redirect_uri was present in the authorization request, so
  // it MUST be sent here and MUST match. It was previously optional, which let
  // a stolen code be redeemed without knowing the original callback.
  if (!redirect_uri) {
    reject("missing_param", "redirect_uri");
    return c.json(
      { error: "invalid_request", error_description: "redirect_uri is required" },
      400
    );
  }

  const entry = await consumeAuthCode(code);
  if (!entry) {
    reject("invalid_grant", "code");
    return c.json({ error: "invalid_grant", error_description: "code is invalid or expired" }, 400);
  }
  if (entry.clientId !== client_id) {
    reject("client_mismatch", "code");
    return c.json({ error: "invalid_grant", error_description: "client_id mismatch" }, 400);
  }
  if (entry.redirectUri !== redirect_uri) {
    reject("redirect_mismatch");
    return c.json({ error: "invalid_grant", error_description: "redirect_uri mismatch" }, 400);
  }
  if (entry.codeChallenge) {
    if (!code_verifier) {
      reject("pkce_missing_verifier");
      return c.json(
        { error: "invalid_request", error_description: "code_verifier is required" },
        400
      );
    }
    if (!verifyPkceChallenge(code_verifier, entry.codeChallenge)) {
      reject("pkce_mismatch");
      return c.json(
        { error: "invalid_grant", error_description: "code_verifier does not match code_challenge" },
        400
      );
    }
  }

  const accessToken = await signAccessToken(entry.sub, Number(entry.sub), entry.email);
  const newRefreshToken = await issueRefreshToken(Number(entry.sub), client_id);
  touchClient(client_id);

  return c.json({
    access_token: accessToken,
    refresh_token: newRefreshToken,
    token_type: "Bearer",
    expires_in: config.JWT_ACCESS_TOKEN_TTL_SECONDS,
    scope: "lc:read lc:write",
  });
}

oauthRouter.post("/token", handleTokenPost);

// ---------------------------------------------------------------------------
// Middleware: extract and verify Bearer token, attach tenant sub to context
// ---------------------------------------------------------------------------

declare module "hono" {
  interface ContextVariableMap {
    tenantSub: string;
  }
}

/**
 * Validates `Authorization: Bearer <jwt>` and attaches the tenant `sub`
 * (String(user.id)) to `c.var.tenantSub`. The per-request "ensure backend
 * session" hook present in VendoConnect is a no-op here — LC authenticates
 * purely against its own Postgres user table, with no external ERP session.
 */
export const requireBearerToken: MiddlewareHandler = async (c, next) => {
  const authServerUrl = config.PUBLIC_BASE_URL;
  const wwwAuthenticate = `Bearer realm="${authServerUrl}", authorization_uri="${authServerUrl}/authorize"`;

  const authHeader = c.req.header("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json(
      { error: "unauthorized", error_description: "Bearer token required" },
      401,
      { "WWW-Authenticate": wwwAuthenticate }
    );
  }

  const token = authHeader.slice("Bearer ".length);
  let payload: AccessTokenPayload;
  try {
    payload = await verifyAccessToken(token);
  } catch {
    return c.json(
      { error: "invalid_token", error_description: "Token is invalid or expired" },
      401,
      { "WWW-Authenticate": wwwAuthenticate }
    );
  }

  if (!payload.sub) {
    return c.json(
      { error: "invalid_token", error_description: "Token has no subject" },
      401,
      { "WWW-Authenticate": wwwAuthenticate }
    );
  }

  c.set("tenantSub", payload.sub);
  await next();
};
