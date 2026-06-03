// Playwright capture harness for LC Connect MCP widget cards.
//
// For each widget type we:
//   1. Serve the widget HTML (exported by @cfi/mcp-widgets as <TYPE>_WIDGET_HTML(baseUrl))
//      from a tiny local HTTP server, and a HOST page that embeds it in an iframe.
//      The widget's window.__SDK_URL__ points at <BASE>/widget-sdk/app.js (live).
//   2. The HOST page implements the MCP-UI postMessage bridge the SDK expects
//      (reverse-engineered from @modelcontextprotocol/ext-apps app-with-deps.js):
//
//        iframe -> host : {jsonrpc,id,method:"ui/initialize",params:{appInfo,appCapabilities,protocolVersion}}
//        host -> iframe : {jsonrpc,id,result:{protocolVersion,hostInfo,hostCapabilities,hostContext}}
//        iframe -> host : {jsonrpc,method:"ui/notifications/initialized"}   (notification)
//        host -> iframe : {jsonrpc,method:"ui/notifications/tool-result",params:<CallToolResult>}
//
//      The CallToolResult params carry _meta/structuredContent/content; the
//      widget's app.ontoolresult reads result._meta to render.
//      The transport posts to window.parent and listens on window 'message'.
//
//   3. Wait for the widget's #status to vanish (render complete), settle, and
//      screenshot the widget card.
//
// We serve over a real HTTP origin (not srcdoc) so the large widget HTML and
// its inline <script> blocks are delivered verbatim with no escaping hazards.
//
// Run: node demo/capture.mjs

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import * as widgets from '@cfi/mcp-widgets';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENV_DIR = path.join(__dirname, 'envelopes');
const SHOTS_DIR = path.join(__dirname, 'shots');

// Base origin that serves /widget-sdk/app.js. Local is preferred (no network);
// the ngrok URL is the documented fallback. Override with LC_WIDGET_BASE.
const BASE = process.env.LC_WIDGET_BASE || 'http://localhost:3003';

const HTML_FN = {
  analytics: 'ANALYTICS_WIDGET_HTML',
  map: 'MAP_WIDGET_HTML',
  kpi: 'KPI_WIDGET_HTML',
  dataset: 'DATASET_WIDGET_HTML',
  messages: 'MESSAGES_WIDGET_HTML',
  action: 'ACTION_WIDGET_HTML',
};

const VIEWPORT = {
  analytics: { width: 1040, height: 900 },
  map: { width: 1040, height: 760 },
  kpi: { width: 760, height: 360 },
  dataset: { width: 1100, height: 900 },
  messages: { width: 860, height: 820 },
  action: { width: 620, height: 320 },
};

const HTML_DIR = path.join(__dirname, 'widget-html');

function widgetHtml(type) {
  // Prefer the CONFIG-baked HTML the live server serves (locale 'en' + theme via
  // window.__CFG__), saved by fetch-envelopes.mjs. Fall back to the package's
  // default (Polish, no theme) only if the served copy is missing.
  const served = path.join(HTML_DIR, `${type}.html`);
  if (fs.existsSync(served)) return fs.readFileSync(served, 'utf8');
  const fn = widgets[HTML_FN[type]];
  if (typeof fn !== 'function') throw new Error(`Missing exported HTML builder ${HTML_FN[type]}`);
  return fn(BASE);
}

function hostPage(type) {
  // Host bridge. The widget iframe is loaded from /widget/<type> on this same
  // server. The envelope is fetched from /envelope/<type> and delivered over
  // the MCP-UI postMessage protocol.
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/>
<style>
  html,body{margin:0;padding:0;background:#f6f7f9}
  #frame{display:block;border:0;width:100%;height:100vh}
</style></head>
<body>
<iframe id="frame" src="/widget/${type}"></iframe>
<script>
  let TOOL_RESULT = null;
  const frame = document.getElementById('frame');

  window.addEventListener('message', (ev) => {
    const msg = ev.data;
    if (!msg || msg.jsonrpc !== '2.0') return;
    const post = (m) => frame.contentWindow.postMessage(m, '*');

    if (msg.method === 'ui/initialize') {
      post({
        jsonrpc: '2.0', id: msg.id,
        result: {
          protocolVersion: (msg.params && msg.params.protocolVersion) || '2026-01-26',
          hostInfo: { name: 'LC Connect Capture Host', version: '1.0' },
          hostCapabilities: { openLinks:{}, downloadFile:{}, serverTools:{}, serverResources:{}, logging:{} },
          hostContext: {
            theme: 'light', displayMode: 'inline', availableDisplayModes: ['inline'],
            locale: 'en-GB', timeZone: 'Europe/Warsaw', userAgent: 'lc-connect-capture', platform: 'web',
          },
        },
      });
      return;
    }
    if (msg.method === 'ui/notifications/initialized') {
      post({ jsonrpc: '2.0', method: 'ui/notifications/tool-result', params: TOOL_RESULT });
      return;
    }
    if (msg.method === 'ui/request-display-mode') {
      post({ jsonrpc: '2.0', id: msg.id, result: { displayMode: (msg.params && msg.params.displayMode) || 'inline' } });
      return;
    }
    if (msg.method === 'ui/notifications/size-changed') {
      const p = msg.params || {};
      if (p.height) frame.style.height = Math.ceil(p.height) + 'px';
      return;
    }
    if (typeof msg.id !== 'undefined' && msg.method) {
      post({ jsonrpc: '2.0', id: msg.id, result: {} });
    }
  });

  // Load the envelope before the iframe finishes its handshake.
  window.__ready = fetch('/envelope/${type}').then(r => r.json()).then(j => { TOOL_RESULT = j; window.__envReady = true; });
</script>
</body></html>`;
}

function startServer() {
  const server = http.createServer((req, res) => {
    const url = req.url || '/';
    try {
      if (url.startsWith('/host/')) {
        const type = url.slice('/host/'.length);
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(hostPage(type));
        return;
      }
      if (url.startsWith('/widget/')) {
        const type = url.slice('/widget/'.length);
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(widgetHtml(type));
        return;
      }
      if (url.startsWith('/envelope/')) {
        const type = url.slice('/envelope/'.length);
        const file = path.join(ENV_DIR, `${type}.json`);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(fs.readFileSync(file, 'utf8'));
        return;
      }
      res.writeHead(404); res.end('not found');
    } catch (e) {
      res.writeHead(500); res.end(String(e));
    }
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

async function waitForRender(frame) {
  await frame.waitForFunction(() => {
    const s = document.getElementById('status');
    const statusGone = !s || s.style.display === 'none' ||
      (s.textContent || '').trim() === '' || getComputedStyle(s).display === 'none';
    const hasContent = (document.body && document.body.children.length > 1) ||
      !!document.querySelector('.card, table, svg, .kpi-grid, .kitem, .msg, .grid, .conf, .title, .detail');
    return statusGone && hasContent;
  }, { timeout: 20000 });
}

async function main() {
  fs.mkdirSync(SHOTS_DIR, { recursive: true });
  const server = await startServer();
  const port = server.address().port;
  const origin = `http://127.0.0.1:${port}`;

  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const results = [];

  for (const type of Object.keys(HTML_FN)) {
    if (!fs.existsSync(path.join(ENV_DIR, `${type}.json`))) {
      results.push({ type, ok: false, note: 'missing envelope (run fetch-envelopes.mjs)' });
      continue;
    }
    const vp = VIEWPORT[type];
    const context = await browser.newContext({ viewport: vp, deviceScaleFactor: 2 });
    const page = await context.newPage();
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(String(e)));

    try {
      await page.goto(`${origin}/host/${type}`, { waitUntil: 'load' });
      await page.waitForFunction(() => window.__envReady === true, { timeout: 10000 });

      const frameEl = await page.waitForSelector('#frame');
      const frame = await frameEl.contentFrame();

      try {
        await waitForRender(frame);
      } catch (e) {
        const statusTxt = await frame.evaluate(() => {
          const s = document.getElementById('status');
          return s ? (s.textContent || '').trim() : '(no #status)';
        }).catch(() => '(frame eval failed)');
        throw new Error(`render timeout; #status="${statusTxt}"; consoleErrors=${JSON.stringify(errors.slice(0, 3))}`);
      }

      await page.waitForTimeout(1200);

      const h = await page.evaluate(() => {
        const f = document.getElementById('frame');
        const inner = f.contentDocument ? f.contentDocument.body.scrollHeight : 0;
        const need = Math.max(inner + 24, f.getBoundingClientRect().height);
        f.style.height = need + 'px';
        return need;
      });
      await page.setViewportSize({ width: vp.width, height: Math.ceil(h) + 24 });
      await page.waitForTimeout(300);

      const shot = path.join(SHOTS_DIR, `${type}.png`);
      const el = await page.$('#frame');
      await el.screenshot({ path: shot });
      const size = fs.statSync(shot).size;
      results.push({ type, ok: size > 10000, bytes: size, errors: errors.slice(0, 2) });
    } catch (e) {
      results.push({ type, ok: false, note: e.message, errors: errors.slice(0, 3) });
    } finally {
      await context.close();
    }
  }

  await browser.close();
  server.close();

  console.log('\nCapture results:');
  for (const r of results) {
    const kb = r.bytes ? `${(r.bytes / 1024).toFixed(1)}KB` : '-';
    console.log(`  ${r.type.padEnd(10)} ${r.ok ? 'OK ' : 'BAD'} ${kb}${r.note ? '  ' + r.note : ''}${r.errors && r.errors.length ? '  err=' + JSON.stringify(r.errors) : ''}`);
  }
  process.exit(results.every((r) => r.ok) ? 0 : 2);
}

main().catch((e) => { console.error(e); process.exit(1); });
