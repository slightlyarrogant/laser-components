import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { createRequire } from "node:module";
import { Hono, type Context, type MiddlewareHandler } from "hono";
import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { config } from "../config.js";
import { prisma } from "../db/client.js";
import { emitAuthRequest } from "../core/session-log.js";

const require = createRequire(import.meta.url);
const bcrypt = require("bcryptjs") as typeof import("bcryptjs");

// ---------------------------------------------------------------------------
// Auth-code store (in-memory, single-use, short-lived)
// ---------------------------------------------------------------------------

interface AuthCode {
  sub: string;
  email: string;
  clientId: string;
  redirectUri: string;
  /** PKCE S256 challenge, when the client sent one at /authorize. */
  codeChallenge?: string;
  expiresAt: number;
}

const authCodes = new Map<string, AuthCode>();

function issueAuthCode(
  sub: string,
  email: string,
  clientId: string,
  redirectUri: string,
  codeChallenge?: string
): string {
  const code = randomUUID();
  authCodes.set(code, {
    sub,
    email,
    clientId,
    redirectUri,
    ...(codeChallenge ? { codeChallenge } : {}),
    expiresAt: Date.now() + config.AUTH_CODE_TTL_SECONDS * 1000,
  });
  return code;
}

function consumeAuthCode(code: string): AuthCode | undefined {
  const entry = authCodes.get(code);
  authCodes.delete(code); // single-use
  if (!entry || Date.now() > entry.expiresAt) return undefined;
  return entry;
}

// Sweep expired codes every minute
setInterval(() => {
  const now = Date.now();
  for (const [code, entry] of authCodes) {
    if (now > entry.expiresAt) authCodes.delete(code);
  }
}, 60_000).unref?.();

// ---------------------------------------------------------------------------
// Refresh token store (long-lived, single-use rotation, disk-persisted)
// ---------------------------------------------------------------------------

interface RefreshToken {
  sub: string;
  email: string;
  clientId: string;
  expiresAt: number;
}

const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
// State lives under config.STATE_DIR (created at boot). An explicit
// REFRESH_TOKENS_PATH env still wins, so existing deploys that pin a path keep
// working; the default no longer depends on process.cwd() — resolving against
// cwd is what silently dropped the whole registry when the repo was re-cloned.
const REFRESH_TOKENS_PATH = path.resolve(
  process.env.REFRESH_TOKENS_PATH ?? path.join(config.STATE_DIR, "refresh_tokens.json")
);

const refreshTokens = new Map<string, RefreshToken>();

function loadRefreshTokens(): void {
  try {
    const raw = fs.readFileSync(REFRESH_TOKENS_PATH, "utf8");
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return;
    const now = Date.now();
    for (const [tok, entry] of parsed as [string, RefreshToken][]) {
      if (typeof tok === "string" && entry?.expiresAt > now) {
        refreshTokens.set(tok, entry);
      }
    }
  } catch {
    // missing or corrupt file is fine on first run
  }
}

// Persisted off the request path: the token grant does not wait for the disk
// write. Writes are serialised through a single promise chain so two concurrent
// grants cannot interleave and truncate the file.
let refreshWriteChain: Promise<void> = Promise.resolve();

function saveRefreshTokens(): void {
  refreshWriteChain = refreshWriteChain.then(async () => {
    try {
      const now = Date.now();
      const active = [...refreshTokens.entries()].filter(([, e]) => e.expiresAt > now);
      await fsp.writeFile(REFRESH_TOKENS_PATH, JSON.stringify(active), {
        encoding: "utf8",
        mode: 0o600,
      });
      await fsp.chmod(REFRESH_TOKENS_PATH, 0o600);
    } catch {
      console.error("[oauth] Failed to persist refresh tokens to", REFRESH_TOKENS_PATH);
    }
  });
}

loadRefreshTokens();

function issueRefreshToken(sub: string, email: string, clientId: string): string {
  const token = randomUUID();
  refreshTokens.set(token, {
    sub,
    email,
    clientId,
    expiresAt: Date.now() + REFRESH_TOKEN_TTL_MS,
  });
  saveRefreshTokens();
  return token;
}

function consumeRefreshToken(token: string): RefreshToken | undefined {
  const entry = refreshTokens.get(token);
  if (!entry) return undefined; // unknown token — nothing changed, no write
  refreshTokens.delete(token); // single-use rotation
  saveRefreshTokens();
  if (Date.now() > entry.expiresAt) return undefined;
  return entry;
}

setInterval(() => {
  const now = Date.now();
  let changed = false;
  for (const [tok, entry] of refreshTokens) {
    if (now > entry.expiresAt) {
      refreshTokens.delete(tok);
      changed = true;
    }
  }
  if (changed) saveRefreshTokens();
}, 60 * 60_000).unref?.();

// ---------------------------------------------------------------------------
// Dynamic client registry (RFC 7591) — persisted to DYNAMIC_CLIENTS_PATH
// ---------------------------------------------------------------------------

const DYNAMIC_CLIENTS_PATH = path.resolve(
  process.env.DYNAMIC_CLIENTS_PATH ?? path.join(config.STATE_DIR, "dynamic_clients.json")
);

interface RegisteredClient {
  /** Exact redirect URIs supplied at registration — the /authorize allow-list. */
  redirectUris: string[];
  createdAt: number;
}

const dynamicClients = new Map<string, RegisteredClient>();

/** An absolute http(s) URL — the only redirect target shape we register. */
export function isAbsoluteHttpUrl(value: unknown): value is string {
  if (typeof value !== "string" || value.length === 0) return false;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  return url.protocol === "http:" || url.protocol === "https:";
}

function loadDynamicClients(): void {
  try {
    const raw = fs.readFileSync(DYNAMIC_CLIENTS_PATH, "utf8");
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return;
    for (const item of parsed) {
      // Legacy on-disk format: a bare array of client_id strings, with no
      // redirect URIs recorded. Such a client keeps an empty allow-list, so
      // /authorize rejects it until the connector re-registers — which is
      // exactly the protection this change adds.
      if (typeof item === "string") {
        dynamicClients.set(item, { redirectUris: [], createdAt: 0 });
        continue;
      }
      if (Array.isArray(item) && typeof item[0] === "string") {
        const meta = item[1] as Partial<RegisteredClient> | undefined;
        dynamicClients.set(item[0], {
          redirectUris: Array.isArray(meta?.redirectUris)
            ? meta.redirectUris.filter(isAbsoluteHttpUrl)
            : [],
          createdAt: typeof meta?.createdAt === "number" ? meta.createdAt : 0,
        });
      }
    }
  } catch {
    // missing or corrupt file is fine on first run
  }
}

function saveDynamicClients(): void {
  try {
    fs.writeFileSync(
      DYNAMIC_CLIENTS_PATH,
      JSON.stringify([...dynamicClients.entries()]),
      { encoding: "utf8", mode: 0o600 }
    );
    fs.chmodSync(DYNAMIC_CLIENTS_PATH, 0o600);
  } catch {
    console.error("[oauth] Failed to persist dynamic clients to", DYNAMIC_CLIENTS_PATH);
  }
}

loadDynamicClients();

// LC accepts any registered client. Claude.ai registers dynamically via /register;
// we do not maintain a static allow-list, so an unknown client_id that has gone
// through registration is trusted. (VC kept a static list + dynamic set; LC has
// no static OAUTH_CLIENT_IDS env, so registration is the sole gate.)
function isKnownClient(clientId: string): boolean {
  return dynamicClients.has(clientId);
}

/**
 * Exact-match redirect_uri check. Without it, anyone who can call the
 * unauthenticated /register can point a login at their own callback and
 * harvest the authorization code of whoever signs in.
 */
function isRegisteredRedirectUri(clientId: string, redirectUri: string): boolean {
  return dynamicClients.get(clientId)?.redirectUris.includes(redirectUri) ?? false;
}

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
  console.warn(
    `[oauth] client ${clientId} authorized without PKCE (no code_challenge) — permitted for now, will be rejected in Phase 1`
  );
}

/** base64url(sha256(verifier)) === challenge, compared in constant time. */
function verifyPkceChallenge(verifier: string, challenge: string): boolean {
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
  dynamicClients.set(clientId, { redirectUris, createdAt: Date.now() });
  saveDynamicClients();
  console.log(
    `[oauth] registered client ${clientId} with redirect_uris ${redirectUris.join(" ")}`
  );

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
function handleAuthorizeGet(c: Context) {
  const { client_id, redirect_uri, response_type, state, code_challenge, code_challenge_method } =
    c.req.query();

  if (response_type !== "code") {
    return c.text("unsupported_response_type: only 'code' is supported", 400);
  }
  if (!client_id || !isKnownClient(client_id)) {
    return c.text("unauthorized_client: unknown client_id", 400);
  }
  if (!redirect_uri) {
    return c.text("invalid_request: redirect_uri is required", 400);
  }
  // Checked BEFORE the login form is rendered: an unvalidated redirect_uri
  // turns this page into a credential-harvest / code-theft vector even if the
  // user never submits it.
  if (!isRegisteredRedirectUri(client_id, redirect_uri)) {
    console.warn(
      `[oauth] /authorize rejected: redirect_uri ${redirect_uri} is not registered for client ${client_id}`
    );
    return c.text(
      "invalid_request: redirect_uri does not match a redirect URI registered for this client",
      400
    );
  }
  const pkceError = validatePkceRequest(code_challenge, code_challenge_method, client_id);
  if (pkceError) return c.text(pkceError, 400);

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
 * the request must be refused, or undefined when it may proceed (including the
 * no-PKCE case, which only warns — Phase 1 turns that into a rejection).
 */
function validatePkceRequest(
  codeChallenge: string | undefined,
  codeChallengeMethod: string | undefined,
  clientId: string
): string | undefined {
  if (!codeChallenge) {
    warnMissingPkce(clientId);
    return undefined;
  }
  if (codeChallengeMethod !== "S256") {
    return "invalid_request: code_challenge_method must be S256";
  }
  if (!/^[A-Za-z0-9_-]{43,128}$/.test(codeChallenge)) {
    return "invalid_request: code_challenge must be a base64url-encoded SHA-256 digest";
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

  if (!client_id || !isKnownClient(client_id)) {
    return c.text("unauthorized_client", 400);
  }
  if (!redirect_uri) {
    return c.text("invalid_request: redirect_uri is required", 400);
  }
  // Re-checked on the POST: the hidden field is attacker-controllable, so the
  // GET-time check alone would not stop a forged form post.
  if (!isRegisteredRedirectUri(client_id, redirect_uri)) {
    console.warn(
      `[oauth] POST /authorize rejected: redirect_uri ${redirect_uri} is not registered for client ${client_id}`
    );
    return c.text(
      "invalid_request: redirect_uri does not match a redirect URI registered for this client",
      400
    );
  }
  const pkceError = validatePkceRequest(code_challenge, code_challenge_method, client_id);
  if (pkceError) return c.text(pkceError, 400);
  if (!email || !password) {
    return fail("Email and password are required", 400);
  }

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return fail("Invalid email or password");

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return fail("Invalid email or password");

    // A deactivated account is refused with the SAME message as a bad password:
    // "this account exists but is switched off" is an enumeration oracle.
    if (!user.isActive) return fail("Invalid email or password");

    const sub = String(user.id);
    const code = issueAuthCode(sub, user.email, client_id, redirect_uri, code_challenge);

    const target = new URL(redirect_uri);
    target.searchParams.set("code", code);
    if (state) target.searchParams.set("state", state);
    return c.redirect(target.toString(), 302);
  } catch (err) {
    console.error("[LC OAuth] authorize error:", err);
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
      return c.json({ error: "invalid_request", error_description: "malformed JSON body" }, 400);
    }
  } else {
    try {
      params = (await c.req.parseBody()) as Record<string, string>;
    } catch {
      return c.json({ error: "invalid_request", error_description: "malformed form body" }, 400);
    }
  }

  const { grant_type, code, redirect_uri, client_id, refresh_token, code_verifier } = params;

  if (!client_id || !isKnownClient(client_id)) {
    return c.json({ error: "unauthorized_client" }, 401);
  }

  // -- Refresh token grant --
  if (grant_type === "refresh_token") {
    if (!refresh_token) {
      return c.json({ error: "invalid_request", error_description: "refresh_token is required" }, 400);
    }
    const entry = consumeRefreshToken(refresh_token);
    if (!entry) {
      return c.json({ error: "invalid_grant", error_description: "refresh_token is invalid or expired" }, 400);
    }
    if (entry.clientId !== client_id) {
      return c.json({ error: "invalid_grant", error_description: "client_id mismatch" }, 400);
    }
    // LC has no backend ERP session to refresh — the "ensure backend session"
    // hook is a no-op. Re-mint the JWT directly from the stored identity.
    const accessToken = await signAccessToken(entry.sub, Number(entry.sub), entry.email);
    const newRefreshToken = issueRefreshToken(entry.sub, entry.email, client_id);
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
    return c.json({ error: "unsupported_grant_type" }, 400);
  }
  if (!code) {
    return c.json({ error: "invalid_request", error_description: "code is required" }, 400);
  }

  // RFC 6749 §4.1.3: redirect_uri was present in the authorization request, so
  // it MUST be sent here and MUST match. It was previously optional, which let
  // a stolen code be redeemed without knowing the original callback.
  if (!redirect_uri) {
    return c.json(
      { error: "invalid_request", error_description: "redirect_uri is required" },
      400
    );
  }

  const entry = consumeAuthCode(code);
  if (!entry) {
    return c.json({ error: "invalid_grant", error_description: "code is invalid or expired" }, 400);
  }
  if (entry.clientId !== client_id) {
    return c.json({ error: "invalid_grant", error_description: "client_id mismatch" }, 400);
  }
  if (entry.redirectUri !== redirect_uri) {
    return c.json({ error: "invalid_grant", error_description: "redirect_uri mismatch" }, 400);
  }
  if (entry.codeChallenge) {
    if (!code_verifier) {
      return c.json(
        { error: "invalid_request", error_description: "code_verifier is required" },
        400
      );
    }
    if (!verifyPkceChallenge(code_verifier, entry.codeChallenge)) {
      return c.json(
        { error: "invalid_grant", error_description: "code_verifier does not match code_challenge" },
        400
      );
    }
  }

  const accessToken = await signAccessToken(entry.sub, Number(entry.sub), entry.email);
  const newRefreshToken = issueRefreshToken(entry.sub, entry.email, client_id);

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
