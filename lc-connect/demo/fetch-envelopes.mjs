// Fetch REAL tool-result envelopes from the live LC Connect MCP server.
//
// For each widget type we call the live tool that emits it and capture the
// full JSON-RPC `result` (content + structuredContent + _meta). The `_meta`
// carries the widget payload (views / kpiStrip / values / rows / messages...).
//
// The action widget is NOT driven by a read tool (create_lead_note is a write),
// so we synthesize a representative envelope client-side via buildActionEnvelope.
//
// Output: demo/envelopes/<type>.json  (each = the captured CallToolResult)
//
// Run: node demo/fetch-envelopes.mjs

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildActionEnvelope } from '@cfi/mcp-widgets';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, 'envelopes');
const MCP_URL = process.env.LC_MCP_URL || 'http://localhost:3003/mcp';
const SECRET = process.env.LC_JWT_SECRET || 'lc-connect-secret-key-change-in-production';

function mintJwt() {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const h = b64({ alg: 'HS256', typ: 'JWT' });
  const p = b64({ sub: '1', iat: Math.floor(Date.now() / 1000) });
  const sig = crypto.createHmac('sha256', SECRET).update(`${h}.${p}`).digest('base64url');
  return `${h}.${p}.${sig}`;
}

// Parse a JSON-RPC result out of either a plain JSON body or an SSE stream.
function parseRpc(text) {
  text = text.trim();
  if (text.startsWith('{')) return JSON.parse(text);
  // SSE: lines like `event: message` / `data: {...}`. Take the last data: line.
  const dataLines = text
    .split('\n')
    .filter((l) => l.startsWith('data:'))
    .map((l) => l.slice(5).trim())
    .filter(Boolean);
  if (!dataLines.length) throw new Error('No SSE data line found in response');
  return JSON.parse(dataLines[dataLines.length - 1]);
}

async function rpc(jwt, method, params, tag) {
  const res = await fetch(MCP_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${jwt}`,
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${tag} -> HTTP ${res.status}: ${text.slice(0, 300)}`);
  const r = parseRpc(text);
  if (r.error) throw new Error(`${tag} -> RPC error: ${JSON.stringify(r.error)}`);
  if (!r.result) throw new Error(`${tag} -> no result: ${text.slice(0, 300)}`);
  return r.result;
}

async function callTool(jwt, name, args) {
  return rpc(jwt, 'tools/call', { name, arguments: args }, name);
}

// Fetch the CONFIG-baked widget HTML the server actually serves (locale/theme
// applied via window.__CFG__), so captures match the live ChatGPT/Claude render.
async function readWidgetHtml(jwt, uri) {
  const result = await rpc(jwt, 'resources/read', { uri }, uri);
  const c = (result.contents || []).find((x) => typeof x.text === 'string');
  if (!c) throw new Error(`${uri} -> no text content`);
  return c.text;
}

// Map widget type -> how to obtain its envelope.
const TOOLS = {
  analytics: { tool: 'leads_analytics', args: {} },
  map: { tool: 'leads_by_country', args: { scope: 'europe' } },
  kpi: { tool: 'get_statistics', args: {} },
  dataset: { tool: 'get_products', args: { limit: 50 } },
  messages: { tool: 'get_lead_notes', args: { leadId: 394 } },
  // action: synthesized below (no read tool emits it).
};

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const jwt = mintJwt();
  const summary = {};

  for (const [type, { tool, args }] of Object.entries(TOOLS)) {
    try {
      const result = await callTool(jwt, tool, args);
      const file = path.join(OUT_DIR, `${type}.json`);
      fs.writeFileSync(file, JSON.stringify(result, null, 2));
      const metaKeys = Object.keys(result._meta || {});
      summary[type] = `OK (${tool}) _meta keys: ${metaKeys.join(', ')}`;
    } catch (err) {
      summary[type] = `FAIL: ${err.message}`;
    }
  }

  // Action widget: synthesize a representative envelope. Mirrors what
  // create_lead_note would emit on success (status + title + detail + id).
  // No `icon` override -> the widget draws its native green checkmark SVG for
  // status:'success' (passing icon:'check' would render the literal text).
  const action = buildActionEnvelope({
    status: 'success',
    title: 'Note added',
    detail: 'Note saved for lead "Hamamatsu Photonics".',
    id: '394',
    idLabel: 'Lead ID',
  });
  fs.writeFileSync(path.join(OUT_DIR, 'action.json'), JSON.stringify(action, null, 2));
  summary.action = `OK (synthesized) _meta keys: ${Object.keys(action._meta || {}).join(', ')}`;

  // Pull the config-baked widget HTML from the live server (English + theme).
  const HTML_DIR = path.join(__dirname, 'widget-html');
  fs.mkdirSync(HTML_DIR, { recursive: true });
  const URIS = {
    analytics: 'ui://cfi-widgets/analytics-v1',
    map: 'ui://cfi-widgets/map-v1',
    kpi: 'ui://cfi-widgets/kpi-v1',
    dataset: 'ui://cfi-widgets/dataset-v1',
    messages: 'ui://cfi-widgets/messages-v1',
    action: 'ui://cfi-widgets/action-v1',
  };
  for (const [type, uri] of Object.entries(URIS)) {
    try {
      const html = await readWidgetHtml(jwt, uri);
      fs.writeFileSync(path.join(HTML_DIR, `${type}.html`), html);
      summary[`html:${type}`] = `OK (${html.length}b, __CFG__=${html.includes('__CFG__')})`;
    } catch (err) {
      summary[`html:${type}`] = `FAIL: ${err.message}`;
    }
  }

  console.log('Envelope capture summary:');
  for (const [k, v] of Object.entries(summary)) console.log(`  ${k.padEnd(10)} ${v}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
