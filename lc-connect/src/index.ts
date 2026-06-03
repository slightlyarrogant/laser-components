import "node:process";
import { createReadStream, statSync } from "node:fs";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";
import { dirname, join, normalize, extname } from "node:path";
import { serve } from "@hono/node-server";
import { Hono, type Context } from "hono";
import { cors } from "hono/cors";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import {
  getWidgetSdkJs,
  WIDGET_SDK_PATH,
  WIDGET_SDK_CONTENT_TYPE,
} from "@cfi/mcp-widgets";
import { config } from "./config.js";
import { VERSION } from "./version.js";
import { oauthRouter, requireBearerToken } from "./auth/oauth.js";
import { createMcpServer, tenantContext } from "./server.js";
import { datasetCsvHandler } from "./datasets.js";
import { getRecentEvents, logEmitter, type SessionLogEvent } from "./core/session-log.js";

// The MCP Apps SDK browser bundle (app-with-deps.js, bundled/self-contained),
// resolved through the shared @cfi/mcp-widgets helper against LC's own ext-apps
// dependency so the served SDK matches the version the widgets expect. Served
// verbatim at /widget-sdk/app.js so widget HTML can `import(window.__SDK_URL__)`.
const APP_SDK_JS = getWidgetSdkJs();

// ---------------------------------------------------------------------------
// Application
// ---------------------------------------------------------------------------

const app = new Hono();

// Request/error logging so 500 causes are visible in stdout.
app.use("*", async (c, next) => {
  try {
    await next();
    console.log(`[http] ${c.req.method} ${c.req.path} → ${c.res.status}`);
  } catch (err) {
    console.error(`[http] ${c.req.method} ${c.req.path} → 500`, err);
    throw err;
  }
});

// Permissive CORS — required for Claude.ai and ChatGPT to reach the MCP endpoint.
app.use(
  "*",
  cors({
    origin: "*",
    allowMethods: ["GET", "POST", "DELETE", "OPTIONS"],
    allowHeaders: [
      "Content-Type",
      "Authorization",
      "mcp-session-id",
      "Last-Event-ID",
      "mcp-protocol-version",
    ],
    exposeHeaders: ["mcp-session-id", "mcp-protocol-version"],
  })
);

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------

app.get("/health", (c) =>
  c.json({ status: "ok", service: "lc-connect", version: VERSION })
);

// ---------------------------------------------------------------------------
// OAuth discovery metadata — root variants + /mcp-path variants so both
// Claude.ai and ChatGPT connectors can discover the authorization server.
// ---------------------------------------------------------------------------

function authServerMetadata() {
  const base = config.PUBLIC_BASE_URL.replace(/\/$/, "");
  return {
    issuer: config.JWT_ISSUER,
    authorization_endpoint: `${base}/authorize`,
    token_endpoint: `${base}/token`,
    registration_endpoint: `${base}/register`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    scopes_supported: ["lc:read", "lc:write"],
  };
}

function protectedResourceMetadata(resource: string) {
  return {
    resource,
    authorization_servers: [config.PUBLIC_BASE_URL],
    bearer_methods_supported: ["header"],
    resource_registration_endpoint: `${config.PUBLIC_BASE_URL}/register`,
  };
}

// Root protected-resource + OpenID alias (the authorization-server doc itself is
// served by oauthRouter, mounted below).
app.get("/.well-known/oauth-protected-resource", (c) =>
  c.json(protectedResourceMetadata(config.PUBLIC_BASE_URL))
);
app.get("/.well-known/openid-configuration", (c) => c.json(authServerMetadata()));

// /mcp-path variants (ChatGPT connectors look here).
app.get("/mcp/.well-known/oauth-authorization-server", (c) => c.json(authServerMetadata()));
app.get("/mcp/.well-known/openid-configuration", (c) => c.json(authServerMetadata()));
app.get("/mcp/.well-known/oauth-protected-resource", (c) =>
  c.json(protectedResourceMetadata(`${config.PUBLIC_BASE_URL}/mcp`))
);

// OAuth endpoints (authorization-server discovery, /authorize, /token,
// /register, legacy /oauth/authorize aliases).
app.route("/", oauthRouter);

// ---------------------------------------------------------------------------
// Session log — live terminal view at /session-log
// ---------------------------------------------------------------------------

const SESSION_LOG_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>LC Connect — Session Log</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #0d1117; color: #c9d1d9; font-family: 'Cascadia Code', 'Fira Mono', monospace; font-size: 13px; }
    header { padding: 12px 16px; background: #161b22; border-bottom: 1px solid #30363d; display: flex; align-items: center; gap: 12px; }
    header h1 { font-size: 14px; font-weight: 600; color: #e6edf3; }
    #status { font-size: 11px; color: #8b949e; }
    #status.connected { color: #3fb950; }
    #log { padding: 8px; height: calc(100vh - 45px); overflow-y: auto; }
    .row { display: flex; gap: 10px; padding: 3px 6px; border-radius: 4px; align-items: baseline; }
    .ts { color: #8b949e; min-width: 90px; font-size: 11px; }
    .sid { color: #58a6ff; min-width: 80px; font-size: 11px; }
    .tag { min-width: 60px; }
    .tool .tag { color: #79c0ff; }
    .auth .tag { color: #f0c040; font-weight: 700; }
    .auth { background: #2d2200; border: 1px solid #f0c040; border-radius: 4px; margin: 4px 0; padding: 6px; }
    .detail { color: #e6edf3; word-break: break-all; }
  </style>
</head>
<body>
  <header><h1>LC Connect — Session Log</h1><span id="status">connecting…</span></header>
  <div id="log"></div>
  <script>
    const log = document.getElementById('log');
    const status = document.getElementById('status');
    function fmt(ts){ return new Date(ts).toLocaleTimeString('en-GB',{hour12:false}); }
    function addRow(ev){
      const row = document.createElement('div');
      row.className = 'row ' + ev.type;
      row.innerHTML =
        '<span class="ts">' + fmt(ev.ts) + '</span>' +
        '<span class="sid">' + (ev.sessionId||'').slice(0,8) + '</span>' +
        '<span class="tag">' + ev.type + '</span>' +
        '<span class="detail">' + (ev.detail||'').replace(/</g,'&lt;') + '</span>';
      if (ev.type === 'auth') {
        row.querySelector('.detail').innerHTML =
          '👉 <a href="' + (ev.detail||'').replace(/"/g,'&quot;') + '" target="_blank" style="color:#f0c040">' +
          (ev.detail||'').replace(/</g,'&lt;') + '</a>';
      }
      log.appendChild(row);
      log.scrollTop = log.scrollHeight;
    }
    const es = new EventSource('/session-log/stream');
    es.onopen = () => { status.textContent='live'; status.className='connected'; };
    es.onerror = () => { status.textContent='disconnected'; status.className=''; };
    es.onmessage = (e) => addRow(JSON.parse(e.data));
  </script>
</body>
</html>`;

app.get("/session-log", (c) => c.html(SESSION_LOG_HTML));

app.get("/session-log/stream", (c) => {
  const encoder = new TextEncoder();
  const recent = getRecentEvents();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(": connected\n\n"));
      for (const ev of recent) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(ev)}\n\n`));
      }
      const handler = (ev: SessionLogEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(ev)}\n\n`));
      };
      logEmitter.on("event", handler);
      c.req.raw.signal.addEventListener("abort", () => {
        logEmitter.off("event", handler);
        controller.close();
      });
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
});

// ---------------------------------------------------------------------------
// Widget SDK bundle — served as a static asset for widget HTML to import.
// Path/Content-Type come from @cfi/mcp-widgets so they stay in lockstep with
// the URL the widgets bake into their HTML + CSP.
// ---------------------------------------------------------------------------

app.get(WIDGET_SDK_PATH, () =>
  new Response(APP_SDK_JS, {
    headers: {
      "Content-Type": WIDGET_SDK_CONTENT_TYPE,
      "Cache-Control": "public, max-age=86400",
      "Access-Control-Allow-Origin": "*",
    },
  })
);

// ---------------------------------------------------------------------------
// Dataset CSV download — backs the DATASET widget's `exportUrl` toolbar button.
// The route param carries the ".csv" suffix (Hono can't put a literal suffix
// after a plain param), so we match "<id>.csv" and strip the extension. Returns
// 404 for an unknown/expired dataset id.
// ---------------------------------------------------------------------------

app.get("/datasets/:name{[a-zA-Z0-9_-]+\\.csv}", (c) => {
  const id = c.req.param("name").replace(/\.csv$/, "");
  const res = datasetCsvHandler(id);
  if (!res) return c.text("Dataset not found or expired", 404);
  return res;
});

// ---------------------------------------------------------------------------
// Customer landing page — the discovery-phase presentation (video + install
// credentials), served from the SAME origin as the connector at /demo so it
// shares the existing tunnel. Static files only; no bearer auth. Range support
// so the embedded film streams/seeks. Distinct paths — does not touch /mcp.
// ---------------------------------------------------------------------------

const LANDING_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "demo",
  "presentation",
  "landing"
);
const LANDING_MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".mp4": "video/mp4",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".css": "text/css",
  ".js": "text/javascript",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

function serveLanding(c: Context) {
  const sub = c.req.path.replace(/^\/demo\/?/, "") || "index.html";
  const full = normalize(join(LANDING_DIR, sub));
  if (full !== LANDING_DIR && !full.startsWith(LANDING_DIR + "/")) {
    return c.text("forbidden", 403);
  }
  let size: number;
  try {
    const st = statSync(full);
    if (!st.isFile()) return c.text("not found", 404);
    size = st.size;
  } catch {
    return c.text("not found", 404);
  }
  const type = LANDING_MIME[extname(full).toLowerCase()] ?? "application/octet-stream";
  const range = c.req.header("range");
  if (range) {
    const m = /bytes=(\d*)-(\d*)/.exec(range);
    let start = m && m[1] ? parseInt(m[1], 10) : 0;
    let end = m && m[2] ? parseInt(m[2], 10) : size - 1;
    if (Number.isNaN(start) || start < 0) start = 0;
    if (Number.isNaN(end) || end >= size) end = size - 1;
    if (start > end) {
      return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    }
    const body = Readable.toWeb(createReadStream(full, { start, end })) as ReadableStream;
    return new Response(body, {
      status: 206,
      headers: {
        "Content-Type": type,
        "Content-Range": `bytes ${start}-${end}/${size}`,
        "Accept-Ranges": "bytes",
        "Content-Length": String(end - start + 1),
        "Cache-Control": "public, max-age=3600",
      },
    });
  }
  const body = Readable.toWeb(createReadStream(full)) as ReadableStream;
  return new Response(body, {
    headers: {
      "Content-Type": type,
      "Content-Length": String(size),
      "Accept-Ranges": "bytes",
      "Cache-Control": "public, max-age=3600",
    },
  });
}

app.get("/demo", serveLanding);
app.get("/demo/*", serveLanding);

// ---------------------------------------------------------------------------
// MCP endpoint — stateless, one fresh transport + server per request.
// ---------------------------------------------------------------------------

async function handleMcp(c: { get: (k: string) => string; req: { raw: Request } }) {
  const tenantSub = c.get("tenantSub");

  // Best-effort tool-call logging without consuming the transport's body.
  let toolName: string | undefined;
  try {
    const body = (await c.req.raw.clone().json()) as {
      method?: string;
      params?: { name?: string; arguments?: unknown };
    };
    if (body?.method === "tools/call") {
      toolName = body.params?.name ?? "unknown";
      const args = JSON.stringify(body.params?.arguments ?? {});
      console.log(`[tool] → ${toolName} ${args.slice(0, 200)}`);
    }
  } catch {
    /* not JSON — ping, initialize, etc. */
  }

  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });
  return tenantContext.run(tenantSub, async () => {
    const server = createMcpServer();
    await server.connect(transport);
    const response = await transport.handleRequest(c.req.raw);
    if (toolName) console.log(`[tool] ← ${toolName} done`);
    return response;
  });
}

app.all("/mcp", requireBearerToken, (c) => handleMcp(c));
// Root alias — ChatGPT web connectors POST to the base URL, not /mcp.
app.all("/", requireBearerToken, (c) => handleMcp(c));

// ---------------------------------------------------------------------------
// Start HTTP server
// ---------------------------------------------------------------------------

const port = config.PORT;

serve({ fetch: app.fetch, port }, () => {
  console.log(`[lc-connect] listening on port ${port}`);
  console.log(
    `[lc-connect] OAuth discovery: ${config.PUBLIC_BASE_URL}/.well-known/oauth-authorization-server`
  );
  console.log(`[lc-connect] MCP endpoint: ${config.PUBLIC_BASE_URL}/mcp`);
  console.log(`[lc-connect] NODE_ENV: ${config.NODE_ENV}`);
});
