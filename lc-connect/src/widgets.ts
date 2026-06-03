import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  registerAnalyticsWidget,
  registerDatasetWidget,
  registerActionWidget,
  registerKpiWidget,
  registerMessagesWidget,
  registerMapWidget,
  type WidgetConfig,
} from "@cfi/mcp-widgets";
import { config } from "./config.js";

// ---------------------------------------------------------------------------
// LC widget config (passed to EVERY registerXxxWidget).
//
// We no longer vendor a hand-patched English fork; instead the OFFICIAL
// @cfi/mcp-widgets@0.2.0 reads this config (injected as window.__CFG__ into the
// served widget HTML) at render time:
//   - locale 'en'  -> all library chrome is English (Search / ⬇ CSV / Total /
//     Europe-World scope / No data / etc.), replacing what the fork baked in.
//   - theme        -> amber accent (matches our deck) + deep-navy bars.
// Background/surface left default (light). Our own tool titles/labels are DATA
// and layer on top of this English chrome.
// ---------------------------------------------------------------------------
const WIDGET_CONFIG: WidgetConfig = {
  locale: "en",
  theme: { accent: "#e8a33d", barColor: "#1f3a5f" },
};

// ---------------------------------------------------------------------------
// Shared @cfi/mcp-widgets registration for LC Connect.
//
// A fresh McpServer is built per stateless request, so the widget RESOURCES
// (one ui://cfi-widgets/* HTML resource each) must be registered every time —
// but registering the same resource URI twice on one server throws. The library
// already guards each register* with its own module-level WeakSet keyed by
// server, so a double call within a single server is a safe no-op. We add a
// connector-level WeakSet too so `registerSharedWidgets` itself is idempotent
// (mirrors Vendo's analytics-widget guard).
//
// baseUrl = config.PUBLIC_BASE_URL (== PUBLIC_URL, https://lasercomponents.ngrok.app):
// the widgets load their SDK from `<baseUrl>/widget-sdk/app.js` and bake that
// host into their CSP, so it MUST match the origin LC actually serves from.
// ---------------------------------------------------------------------------

const registered = new WeakSet<McpServer>();

export function registerSharedWidgets(server: McpServer): void {
  if (registered.has(server)) return;
  registered.add(server);

  const baseUrl = config.PUBLIC_BASE_URL;
  registerAnalyticsWidget(server, baseUrl, WIDGET_CONFIG);
  registerDatasetWidget(server, baseUrl, WIDGET_CONFIG);
  registerActionWidget(server, baseUrl, WIDGET_CONFIG);
  registerKpiWidget(server, baseUrl, WIDGET_CONFIG);
  registerMessagesWidget(server, baseUrl, WIDGET_CONFIG);
  registerMapWidget(server, baseUrl, WIDGET_CONFIG);
}
