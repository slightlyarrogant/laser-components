import "node:process";
import { createReadStream, statSync } from "node:fs";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";
import { dirname, join, normalize, extname } from "node:path";
import { serve } from "@hono/node-server";
import { getConnInfo } from "@hono/node-server/conninfo";
import { Hono, type Context, type MiddlewareHandler } from "hono";
import { bodyLimit } from "hono/body-limit";
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
import { prisma } from "./db/client.js";
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
    // …except on /datasets/*: that CSV is fetched by the browser as a plain
    // download from the widget's link, so no page needs cross-origin READ
    // access to lead PII. Returning null omits Access-Control-Allow-Origin.
    origin: (_origin, c) => (c.req.path.startsWith("/datasets/") ? null : "*"),
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

// Global body cap. Every endpoint here takes either a small form post or a
// JSON-RPC message; nothing legitimately uploads. Without it, `parseBody` on
// the public /authorize form is an unauthenticated memory-exhaustion primitive.
const MAX_BODY_BYTES = 1024 * 1024;
app.use("*", bodyLimit({ maxSize: MAX_BODY_BYTES }));

// ---------------------------------------------------------------------------
// Rate limiting — in-memory per-IP sliding window.
//
// Deliberately process-local: one process serves this connector, and the thing
// being protected (POST /authorize) is a bcrypt(12) oracle costing ~250 ms of
// the single thread per attempt, so even a crude cap changes the economics.
// Keyed by the first X-Forwarded-For entry because the live deploy sits behind
// ngrok; the socket address is the fallback for direct connections.
// ---------------------------------------------------------------------------

const RATE_WINDOW_MS = 60_000;
const rateBuckets = new Map<string, number[]>();

setInterval(() => {
  const cutoff = Date.now() - RATE_WINDOW_MS;
  for (const [key, hits] of rateBuckets) {
    const kept = hits.filter((t) => t > cutoff);
    if (kept.length === 0) rateBuckets.delete(key);
    else rateBuckets.set(key, kept);
  }
}, RATE_WINDOW_MS).unref?.();

function clientIp(c: Context): string {
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

function rateLimit(bucket: string, limit: number): MiddlewareHandler {
  return async (c, next) => {
    // Only the write side is throttled; GET /authorize renders a form and
    // legitimately gets re-fetched (favicon, back button, reload).
    if (c.req.method !== "POST") return next();
    const key = `${bucket}:${clientIp(c)}`;
    const now = Date.now();
    const hits = (rateBuckets.get(key) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
    if (hits.length >= limit) {
      rateBuckets.set(key, hits);
      console.warn(`[rate-limit] ${bucket} blocked ${key} (${hits.length}/${limit} per minute)`);
      return c.json({ error: "rate_limited" }, 429, {
        "Retry-After": String(Math.ceil(RATE_WINDOW_MS / 1000)),
      });
    }
    hits.push(now);
    rateBuckets.set(key, hits);
    return next();
  };
}

// Registered BEFORE app.route("/", oauthRouter): Hono composes handlers in
// registration order, so middleware added after the route would never run.
app.use("/authorize", rateLimit("authorize", 10));
app.use("/oauth/authorize", rateLimit("authorize", 10));
app.use("/token", rateLimit("token", 30));
app.use("/register", rateLimit("register", 10));

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

// Bearer-gated: the stream carries every tool call plus live authorize URLs
// (client_id, redirect_uri, state), which is enough to hijack an in-flight
// login. Browsers cannot send an Authorization header from the URL bar, so this
// view is now a curl/fetch-with-token tool, not a bookmark.
app.get("/session-log", requireBearerToken, (c) => c.html(SESSION_LOG_HTML));

app.get("/session-log/stream", requireBearerToken, (c) => {
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

/**
 * Attach per-request cleanup to a transport response.
 *
 * The transport fills an SSE body AFTER `handleRequest` resolves, so closing in
 * a plain `finally` would truncate the JSON-RPC response. Instead the body is
 * pumped through a wrapper stream and the transport/server are closed when that
 * stream ends — normally, on error, or when the client disconnects.
 *
 * `keepAlive` additionally emits an SSE comment every 15 s: the standalone GET
 * stream sends zero bytes until the server has something to push, and ngrok
 * drops a silent stream.
 */
function finalizeMcpResponse(
  response: Response,
  cleanup: () => void,
  keepAlive: boolean
): Response {
  if (!response.body) {
    cleanup();
    return response;
  }
  const reader = response.body.getReader();
  const encoder = new TextEncoder();
  let timer: ReturnType<typeof setInterval> | undefined;
  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    if (timer) clearInterval(timer);
    cleanup();
  };

  const wrapped = new ReadableStream<Uint8Array>({
    start(controller) {
      if (keepAlive) {
        timer = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(": ping\n\n"));
          } catch {
            finish();
          }
        }, 15_000);
        timer.unref?.();
      }
      void (async () => {
        try {
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            controller.enqueue(value);
          }
          controller.close();
        } catch (err) {
          try {
            controller.error(err);
          } catch {
            /* already errored/closed */
          }
        } finally {
          finish();
        }
      })();
    },
    cancel(reason) {
      finish();
      return reader.cancel(reason);
    },
  });

  return new Response(wrapped, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}

async function handleMcp(c: Context) {
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
  let server: ReturnType<typeof createMcpServer> | undefined;
  let closed = false;
  const closeAll = () => {
    if (closed) return;
    closed = true;
    void (async () => {
      try {
        await server?.close?.();
      } catch (err) {
        console.error("[mcp] server close failed", err);
      }
      try {
        await transport.close();
      } catch (err) {
        console.error("[mcp] transport close failed", err);
      }
    })();
  };

  try {
    return await tenantContext.run(tenantSub, async () => {
      server = createMcpServer();
      await server.connect(transport);
      const response = await transport.handleRequest(c.req.raw);
      if (toolName) console.log(`[tool] ← ${toolName} done`);
      return finalizeMcpResponse(response, closeAll, c.req.method === "GET");
    });
  } catch (err) {
    closeAll();
    throw err;
  }
}

app.all("/mcp", requireBearerToken, (c) => handleMcp(c));
// Root alias — ChatGPT web connectors POST to the base URL, not /mcp.
app.all("/", requireBearerToken, (c) => handleMcp(c));

// ---------------------------------------------------------------------------
// Start HTTP server
// ---------------------------------------------------------------------------

const port = config.PORT;

const server = serve({ fetch: app.fetch, port }, () => {
  console.log(`[lc-connect] listening on port ${port}`);
  console.log(
    `[lc-connect] OAuth discovery: ${config.PUBLIC_BASE_URL}/.well-known/oauth-authorization-server`
  );
  console.log(`[lc-connect] MCP endpoint: ${config.PUBLIC_BASE_URL}/mcp`);
  console.log(`[lc-connect] state dir: ${config.STATE_DIR}`);
  console.log(`[lc-connect] NODE_ENV: ${config.NODE_ENV}`);
});

// ---------------------------------------------------------------------------
// Process lifecycle
//
// Node 22 makes an unhandled rejection fatal by default, so a single stray
// promise anywhere in 45 tool handlers would kill in-flight requests. We log
// and keep serving instead; an uncaught exception is genuinely unrecoverable
// state, so that one still exits (and systemd restarts us).
// ---------------------------------------------------------------------------

process.on("unhandledRejection", (reason) => {
  console.error("[lc-connect] unhandledRejection (continuing):", reason);
});

process.on("uncaughtException", (err) => {
  console.error("[lc-connect] uncaughtException — exiting:", err);
  process.exit(1);
});

let shuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[lc-connect] ${signal} received — draining`);

  // Failsafe: long-lived SSE streams (/mcp GET, /session-log/stream) keep
  // sockets open, so server.close() may never resolve. Unref'd so a clean
  // drain still lets the process exit early.
  const failsafe = setTimeout(() => {
    console.error("[lc-connect] drain timed out after 10s — forcing exit");
    process.exit(1);
  }, 10_000);
  failsafe.unref?.();

  try {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  } catch (err) {
    console.error("[lc-connect] error closing HTTP server:", err);
  }
  try {
    await prisma.$disconnect();
  } catch (err) {
    console.error("[lc-connect] error disconnecting Prisma:", err);
  }
  clearTimeout(failsafe);
  console.log("[lc-connect] shutdown complete");
  process.exit(0);
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
