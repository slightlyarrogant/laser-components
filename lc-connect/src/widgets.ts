import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  registerAnalyticsWidget,
  registerDatasetWidget,
  registerActionWidget,
} from "@cfi/mcp-widgets";
import { config } from "./config.js";

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
  registerAnalyticsWidget(server, baseUrl);
  registerDatasetWidget(server, baseUrl);
  registerActionWidget(server, baseUrl);
}
