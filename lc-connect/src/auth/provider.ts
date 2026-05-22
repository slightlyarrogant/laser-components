import { createRequire } from 'module'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { randomUUID } from 'crypto'
import type { Response } from 'express'
import type {
  OAuthServerProvider,
  AuthorizationParams,
} from '@modelcontextprotocol/sdk/server/auth/provider.js'
import type { OAuthRegisteredClientsStore } from '@modelcontextprotocol/sdk/server/auth/clients.js'
import type {
  OAuthClientInformationFull,
  OAuthTokens,
} from '@modelcontextprotocol/sdk/shared/auth.js'
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js'
import { prisma } from '../db/client.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const require = createRequire(import.meta.url)
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')

const JWT_SECRET = process.env.LC_JWT_SECRET || 'lc-connect-secret-key-change-in-production'
const PUBLIC_URL = process.env.PUBLIC_URL || 'https://lasercomponents.ngrok.app'

// ---------------------------------------------------------------------------
// In-memory stores
// ---------------------------------------------------------------------------

const clients = new Map<string, OAuthClientInformationFull>()

const pendingCodes = new Map<string, {
  userId: number
  email: string
  codeChallenge: string
  redirectUri: string
  clientId: string
  state?: string
  expiresAt: Date
}>()

// Pre-register a default client so Claude.ai can connect without dynamic registration
const DEFAULT_CLIENT_ID = 'lc-connect-default'
clients.set(DEFAULT_CLIENT_ID, {
  client_id: DEFAULT_CLIENT_ID,
  client_id_issued_at: Math.floor(Date.now() / 1000),
  client_name: 'LC Connect Default Client',
  redirect_uris: ['https://claude.ai/api/mcp/auth_callback'],
  grant_types: ['authorization_code', 'refresh_token'],
  response_types: ['code'],
  token_endpoint_auth_method: 'none',
})

// Cleanup expired codes every minute
setInterval(() => {
  const now = new Date()
  for (const [code, data] of pendingCodes.entries()) {
    if (data.expiresAt < now) pendingCodes.delete(code)
  }
}, 60_000)

// ---------------------------------------------------------------------------
// Login form HTML
// ---------------------------------------------------------------------------

export function renderLoginForm(opts: {
  clientId: string
  redirectUri: string
  state?: string
  codeChallenge: string
  codeChallengeMethod: string
  error?: string
}): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
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
    ${opts.error ? `<div class="error">${opts.error}</div>` : ''}
    <form method="POST" action="/authorize">
      <input type="hidden" name="client_id" value="${opts.clientId}">
      <input type="hidden" name="redirect_uri" value="${opts.redirectUri}">
      <input type="hidden" name="state" value="${opts.state ?? ''}">
      <input type="hidden" name="code_challenge" value="${opts.codeChallenge}">
      <input type="hidden" name="code_challenge_method" value="${opts.codeChallengeMethod}">
      <label for="email">Email</label>
      <input type="email" id="email" name="email" required placeholder="you@example.com" autocomplete="email">
      <label for="password">Password</label>
      <input type="password" id="password" name="password" required placeholder="••••••••" autocomplete="current-password">
      <button type="submit">Sign in</button>
    </form>
  </div>
</body>
</html>`
}

// ---------------------------------------------------------------------------
// Clients store
// ---------------------------------------------------------------------------

const clientsStore: OAuthRegisteredClientsStore = {
  getClient(clientId: string) {
    return clients.get(clientId)
  },
  registerClient(client) {
    const newClient: OAuthClientInformationFull = {
      ...client,
      client_id: randomUUID(),
      client_id_issued_at: Math.floor(Date.now() / 1000),
    }
    clients.set(newClient.client_id, newClient)
    return newClient
  },
}

// ---------------------------------------------------------------------------
// OAuthServerProvider implementation
// ---------------------------------------------------------------------------

export const lcOAuthProvider: OAuthServerProvider = {
  clientsStore,

  async authorize(
    client: OAuthClientInformationFull,
    params: AuthorizationParams,
    res: Response
  ): Promise<void> {
    // Show login form — POST handler is wired separately in index.ts
    res.send(
      renderLoginForm({
        clientId: client.client_id,
        redirectUri: params.redirectUri,
        state: params.state,
        codeChallenge: params.codeChallenge,
        codeChallengeMethod: 'S256',
      })
    )
  },

  async challengeForAuthorizationCode(
    _client: OAuthClientInformationFull,
    authorizationCode: string
  ): Promise<string> {
    const entry = pendingCodes.get(authorizationCode)
    if (!entry) throw new Error('Invalid or expired authorization code')
    return entry.codeChallenge
  },

  async exchangeAuthorizationCode(
    _client: OAuthClientInformationFull,
    authorizationCode: string,
    _codeVerifier?: string,
    _redirectUri?: string
  ): Promise<OAuthTokens> {
    const entry = pendingCodes.get(authorizationCode)
    if (!entry) throw new Error('Invalid or expired authorization code')
    if (entry.expiresAt < new Date()) {
      pendingCodes.delete(authorizationCode)
      throw new Error('Authorization code has expired')
    }
    pendingCodes.delete(authorizationCode)

    const accessToken = jwt.sign(
      { userId: entry.userId, email: entry.email, sub: String(entry.userId) },
      JWT_SECRET,
      { expiresIn: '24h' }
    ) as string

    const refreshToken = jwt.sign(
      { userId: entry.userId, type: 'refresh' },
      JWT_SECRET,
      { expiresIn: '30d' }
    ) as string

    return {
      access_token: accessToken,
      token_type: 'bearer',
      expires_in: 86400,
      refresh_token: refreshToken,
    }
  },

  async exchangeRefreshToken(
    _client: OAuthClientInformationFull,
    refreshToken: string
  ): Promise<OAuthTokens> {
    let payload: { userId: number; type: string }
    try {
      payload = jwt.verify(refreshToken, JWT_SECRET) as { userId: number; type: string }
    } catch {
      throw new Error('Invalid refresh token')
    }
    if (payload.type !== 'refresh') throw new Error('Invalid refresh token type')

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, email: true },
    })
    if (!user) throw new Error('User not found')

    const accessToken = jwt.sign(
      { userId: user.id, email: user.email, sub: String(user.id) },
      JWT_SECRET,
      { expiresIn: '24h' }
    ) as string

    const newRefreshToken = jwt.sign(
      { userId: user.id, type: 'refresh' },
      JWT_SECRET,
      { expiresIn: '30d' }
    ) as string

    return {
      access_token: accessToken,
      token_type: 'bearer',
      expires_in: 86400,
      refresh_token: newRefreshToken,
    }
  },

  async verifyAccessToken(token: string): Promise<AuthInfo> {
    let payload: { userId: number; email: string; sub: string }
    try {
      payload = jwt.verify(token, JWT_SECRET) as { userId: number; email: string; sub: string }
    } catch {
      throw new Error('Invalid access token')
    }
    return {
      token,
      clientId: DEFAULT_CLIENT_ID,
      scopes: [],
      expiresAt: undefined,
    }
  },
}

// ---------------------------------------------------------------------------
// Handler for the login form POST (called from index.ts)
// ---------------------------------------------------------------------------

export async function handleLoginPost(req: any, res: Response): Promise<void> {
  const { email, password, client_id, redirect_uri, state, code_challenge, code_challenge_method } = req.body

  const sendError = (msg: string) =>
    res.send(
      renderLoginForm({
        clientId: client_id ?? '',
        redirectUri: redirect_uri ?? '',
        state,
        codeChallenge: code_challenge ?? '',
        codeChallengeMethod: code_challenge_method ?? 'S256',
        error: msg,
      })
    )

  if (!email || !password) { sendError('Email and password are required'); return }

  try {
    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) { sendError('Invalid email or password'); return }

    const valid = await bcrypt.compare(password, user.password_hash)
    if (!valid) { sendError('Invalid email or password'); return }

    const code = randomUUID()
    pendingCodes.set(code, {
      userId: user.id,
      email: user.email,
      codeChallenge: code_challenge ?? '',
      redirectUri: redirect_uri ?? '',
      clientId: client_id ?? DEFAULT_CLIENT_ID,
      state,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    })

    const sep = (redirect_uri ?? '').includes('?') ? '&' : '?'
    const stateParam = state ? `&state=${encodeURIComponent(state)}` : ''
    res.redirect(`${redirect_uri}${sep}code=${code}${stateParam}`)
  } catch (err) {
    console.error('[LC Auth] login error:', err)
    sendError('Internal error — please try again')
  }
}
