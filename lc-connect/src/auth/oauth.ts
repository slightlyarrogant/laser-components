import fs from "fs";
import path from "path";
import { randomUUID } from "node:crypto";
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
  expiresAt: number;
}

const authCodes = new Map<string, AuthCode>();

function issueAuthCode(
  sub: string,
  email: string,
  clientId: string,
  redirectUri: string
): string {
  const code = randomUUID();
  authCodes.set(code, {
    sub,
    email,
    clientId,
    redirectUri,
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
const REFRESH_TOKENS_PATH = path.resolve(
  process.env.REFRESH_TOKENS_PATH ?? path.join(process.cwd(), "refresh_tokens.json")
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

function saveRefreshTokens(): void {
  try {
    const now = Date.now();
    const active = [...refreshTokens.entries()].filter(([, e]) => e.expiresAt > now);
    fs.writeFileSync(REFRESH_TOKENS_PATH, JSON.stringify(active), "utf8");
    fs.chmodSync(REFRESH_TOKENS_PATH, 0o600);
  } catch {
    console.error("[oauth] Failed to persist refresh tokens to", REFRESH_TOKENS_PATH);
  }
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
  refreshTokens.delete(token); // single-use rotation
  saveRefreshTokens();
  if (!entry || Date.now() > entry.expiresAt) return undefined;
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
  process.env.DYNAMIC_CLIENTS_PATH ?? path.join(process.cwd(), "dynamic_clients.json")
);

function loadDynamicClients(): Set<string> {
  try {
    const raw = fs.readFileSync(DYNAMIC_CLIENTS_PATH, "utf8");
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set<string>();
  }
}

function saveDynamicClients(set: Set<string>): void {
  try {
    fs.writeFileSync(DYNAMIC_CLIENTS_PATH, JSON.stringify([...set]), "utf8");
  } catch {
    console.error("[oauth] Failed to persist dynamic clients to", DYNAMIC_CLIENTS_PATH);
  }
}

const dynamicClients = loadDynamicClients();

// LC accepts any registered client. Claude.ai registers dynamically via /register;
// we do not maintain a static allow-list, so an unknown client_id that has gone
// through registration is trusted. (VC kept a static list + dynamic set; LC has
// no static OAUTH_CLIENT_IDS env, so registration is the sole gate.)
function isKnownClient(clientId: string): boolean {
  return dynamicClients.has(clientId);
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
    .setSubject(sub)
    .setIssuedAt()
    .setExpirationTime(`${config.JWT_ACCESS_TOKEN_TTL_SECONDS}s`)
    .sign(jwtSecret);
}

export async function verifyAccessToken(token: string): Promise<AccessTokenPayload> {
  // No issuer constraint on verify: tokens minted by the old jsonwebtoken-based
  // server carried no `iss`, so requiring one would reject still-valid tokens.
  const { payload } = await jwtVerify(token, jwtSecret);
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
  error?: string;
}): string {
  const errorHtml = params.error
    ? `<div class="error">${escapeHtml(params.error)}</div>`
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
  const clientId = randomUUID();
  dynamicClients.add(clientId);
  saveDynamicClients(dynamicClients);
  let body: Record<string, unknown> = {};
  try {
    body = (await c.req.json()) as Record<string, unknown>;
  } catch {
    /* no body required */
  }
  return c.json(
    {
      client_id: clientId,
      client_id_issued_at: Math.floor(Date.now() / 1000),
      client_secret_expires_at: 0,
      redirect_uris: body.redirect_uris ?? ["https://claude.ai/api/mcp/auth_callback"],
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
  const { client_id, redirect_uri, response_type, state } = c.req.query();

  if (response_type !== "code") {
    return c.text("unsupported_response_type: only 'code' is supported", 400);
  }
  if (!client_id || !isKnownClient(client_id)) {
    return c.text("unauthorized_client: unknown client_id", 400);
  }
  if (!redirect_uri) {
    return c.text("invalid_request: redirect_uri is required", 400);
  }

  const authUrl = new URL("/authorize", config.PUBLIC_BASE_URL);
  authUrl.searchParams.set("client_id", client_id);
  authUrl.searchParams.set("redirect_uri", redirect_uri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("state", state ?? "");
  emitAuthRequest(authUrl.toString());

  return c.html(
    loginFormHtml({ clientId: client_id, redirectUri: redirect_uri, state: state ?? "" })
  );
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

  const { client_id, redirect_uri, state, email, password } = body;

  const fail = (msg: string, status: 400 | 401 = 401) =>
    c.html(
      loginFormHtml({
        clientId: client_id ?? "",
        redirectUri: redirect_uri ?? "",
        state: state ?? "",
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
  if (!email || !password) {
    return fail("Email and password are required", 400);
  }

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return fail("Invalid email or password");

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return fail("Invalid email or password");

    const sub = String(user.id);
    const code = issueAuthCode(sub, user.email, client_id, redirect_uri);

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

  const { grant_type, code, redirect_uri, client_id, refresh_token } = params;

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

  const entry = consumeAuthCode(code);
  if (!entry) {
    return c.json({ error: "invalid_grant", error_description: "code is invalid or expired" }, 400);
  }
  if (entry.clientId !== client_id) {
    return c.json({ error: "invalid_grant", error_description: "client_id mismatch" }, 400);
  }
  if (redirect_uri && entry.redirectUri !== redirect_uri) {
    return c.json({ error: "invalid_grant", error_description: "redirect_uri mismatch" }, 400);
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
