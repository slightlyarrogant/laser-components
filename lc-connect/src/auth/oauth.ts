import { createRequire } from 'module'
import { randomBytes } from 'node:crypto'
import { prisma } from '../db/client.js'
import type { Request, Response } from 'express'

const require = createRequire(import.meta.url)
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')

const PUBLIC_URL = process.env.PUBLIC_URL || 'https://lasercomponents.ngrok.app'
const JWT_SECRET = process.env.LC_JWT_SECRET || 'lc-connect-secret-key-change-in-production'

// ---------------------------------------------------------------------------
// In-memory code store — single-use, 5-minute TTL
// ---------------------------------------------------------------------------

interface PendingCode {
  userId: number
  email: string
  redirectUri: string
  state: string
  expiresAt: number
}

const pendingCodes = new Map<string, PendingCode>()

function purgeExpired(): void {
  const now = Date.now()
  for (const [code, entry] of pendingCodes) {
    if (entry.expiresAt < now) pendingCodes.delete(code)
  }
}

function generateCode(): string {
  return randomBytes(16).toString('hex')
}

// ---------------------------------------------------------------------------
// Login form HTML
// ---------------------------------------------------------------------------

function loginForm(params: {
  clientId: string
  redirectUri: string
  state: string
  error?: string
}): string {
  const errorHtml = params.error
    ? `<div class="error">${params.error}</div>`
    : ''
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
    <form method="POST" action="/oauth/authorize">
      <input type="hidden" name="client_id" value="${params.clientId}">
      <input type="hidden" name="redirect_uri" value="${params.redirectUri}">
      <input type="hidden" name="state" value="${params.state}">
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
// GET /oauth/authorize — show login form
// ---------------------------------------------------------------------------

export function handleAuthorizeGet(req: Request, res: Response): void {
  const clientId = (req.query.client_id as string) ?? ''
  const redirectUri = (req.query.redirect_uri as string) ?? ''
  const state = (req.query.state as string) ?? ''
  res.send(loginForm({ clientId, redirectUri, state }))
}

// ---------------------------------------------------------------------------
// POST /oauth/authorize — process credentials
// ---------------------------------------------------------------------------

export async function handleAuthorizePost(req: Request, res: Response): Promise<void> {
  const { email, password, client_id, redirect_uri, state } = req.body as Record<string, string>

  const sendError = (msg: string) =>
    res.status(401).send(loginForm({ clientId: client_id ?? '', redirectUri: redirect_uri ?? '', state: state ?? '', error: msg }))

  if (!email || !password) { sendError('Email and password are required'); return }

  try {
    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) { sendError('Invalid email or password'); return }

    const valid: boolean = await bcrypt.compare(password, user.passwordHash)
    if (!valid) { sendError('Invalid email or password'); return }

    purgeExpired()
    const code = generateCode()
    pendingCodes.set(code, {
      userId: user.id,
      email: user.email,
      redirectUri: redirect_uri ?? '',
      state: state ?? '',
      expiresAt: Date.now() + 5 * 60 * 1000,
    })

    const target = new URL(redirect_uri)
    target.searchParams.set('code', code)
    if (state) target.searchParams.set('state', state)
    res.redirect(302, target.toString())
  } catch (err) {
    console.error('[LC OAuth] authorize error:', err)
    sendError('Internal error — please try again')
  }
}

// ---------------------------------------------------------------------------
// POST /token — exchange code for access token
// ---------------------------------------------------------------------------

export async function handleTokenPost(req: Request, res: Response): Promise<void> {
  let grantType: string, code: string, redirectUri: string

  const contentType = req.headers['content-type'] ?? ''
  if (contentType.includes('application/json')) {
    grantType = req.body?.grant_type ?? ''
    code = req.body?.code ?? ''
    redirectUri = req.body?.redirect_uri ?? ''
  } else {
    grantType = req.body?.grant_type ?? ''
    code = req.body?.code ?? ''
    redirectUri = req.body?.redirect_uri ?? ''
  }

  if (grantType !== 'authorization_code') {
    res.status(400).json({ error: 'unsupported_grant_type' })
    return
  }

  const entry = pendingCodes.get(code)
  if (!entry) {
    res.status(400).json({ error: 'invalid_grant', error_description: 'Code not found or already used' })
    return
  }
  if (entry.expiresAt < Date.now()) {
    pendingCodes.delete(code)
    res.status(400).json({ error: 'invalid_grant', error_description: 'Code expired' })
    return
  }

  pendingCodes.delete(code)

  const accessToken = jwt.sign(
    { userId: entry.userId, email: entry.email, sub: String(entry.userId) },
    JWT_SECRET,
    { expiresIn: '24h' }
  ) as string

  res.json({ access_token: accessToken, token_type: 'Bearer', expires_in: 86400 })
}

// ---------------------------------------------------------------------------
// Verify token — used by MCP bearer middleware
// ---------------------------------------------------------------------------

export function verifyAccessToken(token: string): { userId: number; email: string } {
  const payload = jwt.verify(token, JWT_SECRET) as { userId: number; email: string }
  return payload
}
