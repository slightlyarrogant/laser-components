import 'dotenv/config'
import express from 'express'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import {
  handleAuthorizeGet,
  handleAuthorizePost,
  handleTokenPost,
} from './auth/oauth.js'
import { requireAuth } from './auth/middleware.js'
import { createMCPServer } from './server.js'

const PORT = parseInt(process.env.PORT || '3003', 10)
const PUBLIC_URL = process.env.PUBLIC_URL || 'https://lasercomponents.ngrok.app'

const app = express()
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// ---------------------------------------------------------------------------
// OAuth 2.0 Authorization Server Metadata  (RFC 8414)
// Claude.ai probes this first to discover all endpoints
// ---------------------------------------------------------------------------
const metadata = {
  issuer: PUBLIC_URL,
  authorization_endpoint: `${PUBLIC_URL}/oauth/authorize`,
  token_endpoint: `${PUBLIC_URL}/token`,
  registration_endpoint: `${PUBLIC_URL}/register`,
  response_types_supported: ['code'],
  grant_types_supported: ['authorization_code'],
  token_endpoint_auth_methods_supported: ['none'],
  code_challenge_methods_supported: ['S256'],
}

app.get('/.well-known/oauth-authorization-server', (_req, res) => res.json(metadata))
app.get('/.well-known/openid-configuration', (_req, res) => res.json(metadata))

// OAuth Protected Resource Metadata (RFC 9728) — Claude.ai reads this after 401
app.get('/.well-known/oauth-protected-resource', (_req, res) =>
  res.json({
    resource: PUBLIC_URL,
    authorization_servers: [PUBLIC_URL],
    bearer_methods_supported: ['header'],
    resource_registration_endpoint: `${PUBLIC_URL}/register`,
  })
)
app.get('/.well-known/oauth-protected-resource/mcp', (_req, res) =>
  res.json({
    resource: `${PUBLIC_URL}/mcp`,
    authorization_servers: [PUBLIC_URL],
    bearer_methods_supported: ['header'],
    resource_registration_endpoint: `${PUBLIC_URL}/register`,
  })
)

// ---------------------------------------------------------------------------
// Dynamic Client Registration (RFC 7591)
// Claude.ai registers itself before starting the OAuth flow
// ---------------------------------------------------------------------------
app.post('/register', (req, res) => {
  const body = req.body ?? {}
  const clientId: string =
    typeof body.client_id === 'string' && body.client_id
      ? body.client_id
      : Math.random().toString(36).slice(2)

  res.status(201).json({
    client_id: clientId,
    client_id_issued_at: Math.floor(Date.now() / 1000),
    redirect_uris: body.redirect_uris ?? [],
    grant_types: ['authorization_code'],
    response_types: ['code'],
    token_endpoint_auth_method: 'none',
  })
})

// ---------------------------------------------------------------------------
// OAuth routes
// ---------------------------------------------------------------------------
app.get('/oauth/authorize', handleAuthorizeGet)
app.post('/oauth/authorize', handleAuthorizePost)
app.post('/token', handleTokenPost)

// ---------------------------------------------------------------------------
// Static files for Łukasz (no auth required)
// ---------------------------------------------------------------------------
const PRESENTATION_DIR = '/home/bogdan/Desktop/Projects/laser_components/presentation'

app.get('/presentation', (_req, res) =>
  res.sendFile('laser-components-connect.html', { root: PRESENTATION_DIR })
)
app.get('/dashboard', (_req, res) =>
  res.sendFile('Laser-Components-Dashboard.html', { root: PRESENTATION_DIR })
)
app.get('/notes', (_req, res) =>
  res.sendFile('meeting-notes.html', { root: PRESENTATION_DIR })
)
app.get('/proposal', (_req, res) =>
  res.sendFile('proposal.html', { root: PRESENTATION_DIR })
)
app.get('/pitch', (_req, res) =>
  res.sendFile('lc-connect-pitch.html', { root: PRESENTATION_DIR })
)

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------
app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'lc-connect' }))

// ---------------------------------------------------------------------------
// MCP endpoint — requires valid Bearer token
// ---------------------------------------------------------------------------
app.post('/mcp', requireAuth, async (req, res) => {
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined })
  const server = createMCPServer()
  await server.connect(transport)
  await transport.handleRequest(req, res, req.body)
  res.on('finish', () => server.close().catch(() => {}))
})

app.get('/mcp', requireAuth, (_req, res) => res.status(405).json({ error: 'Use POST /mcp' }))
app.delete('/mcp', requireAuth, (_req, res) => res.status(405).json({ error: 'Use POST /mcp' }))

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
app.listen(PORT, () => {
  console.error(`[lc-connect] :${PORT}  ${PUBLIC_URL}`)
})

process.on('SIGINT', () => process.exit(0))
process.on('SIGTERM', () => process.exit(0))
