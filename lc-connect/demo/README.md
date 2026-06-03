# LC Connect widget capture harness

Renders the 6 MCP widget cards with **real** data from the live LC Connect MCP
server and saves PNG screenshots to `demo/shots/`.

## Regenerate

```bash
# 1. live MCP server must be running on http://localhost:3003/mcp
# 2. capture real tool-result envelopes -> demo/envelopes/*.json
node demo/fetch-envelopes.mjs
# 3. render each widget in headless chromium -> demo/shots/*.png
node demo/capture.mjs
```

Or in one line:

```bash
node demo/fetch-envelopes.mjs && node demo/capture.mjs
```

## How it works

`fetch-envelopes.mjs` mints an HS256 JWT (`sub:"1"`, secret = `LC_JWT_SECRET`)
and calls the live tools, capturing each full `CallToolResult` (`content` +
`structuredContent` + `_meta`, where `_meta` carries the widget payload). The
`action` envelope is synthesized via `buildActionEnvelope` (no read tool emits
it — `create_lead_note` is a write).

`capture.mjs` serves each widget HTML (`@cfi/mcp-widgets` `<TYPE>_WIDGET_HTML(baseUrl)`)
plus a host page from a throwaway local HTTP server, then drives headless
chromium. The host page implements the **MCP-UI postMessage bridge** the
ext-apps SDK expects:

```
iframe -> host : {jsonrpc,id,method:"ui/initialize",params:{appInfo,appCapabilities,protocolVersion}}
host -> iframe : {jsonrpc,id,result:{protocolVersion,hostInfo,hostCapabilities,hostContext}}
iframe -> host : {jsonrpc,method:"ui/notifications/initialized"}        (notification)
host -> iframe : {jsonrpc,method:"ui/notifications/tool-result",params:<CallToolResult>}
```

The widget's `app.ontoolresult` reads `params._meta` to render. The transport
posts to `window.parent` and listens on `window` `message`.

## Env overrides

- `LC_MCP_URL` (default `http://localhost:3003/mcp`)
- `LC_JWT_SECRET` (default from `.env`)
- `LC_WIDGET_BASE` (default `http://localhost:3003`) — origin serving
  `/widget-sdk/app.js`. Use `https://lasercomponents.ngrok.app` to load the SDK
  over the public tunnel instead of locally.
