import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { AsyncLocalStorage } from "node:async_hooks";
import { registerAllTools } from "./tools/index.js";
import { registerKnowledgeResources } from "./tools/knowledge.js";
import { registerSharedWidgets } from "./widgets.js";
import { registerPrompts } from "./prompts.js";
import { VERSION } from "./version.js";

/**
 * AsyncLocalStorage carries the current request's tenant sub (String(user.id))
 * through the async call chain so tool handlers can retrieve it without
 * threading it through every signature.
 *
 *   tenantContext.run(sub, () => { ... tool call executes here ... })
 *   const sub = getTenantSub();  // inside a tool handler
 */
export const tenantContext = new AsyncLocalStorage<string>();

export function getTenantSub(): string {
  const sub = tenantContext.getStore();
  if (!sub) {
    throw new Error(
      "No tenant context found. The MCP request was not wrapped in tenantContext.run()."
    );
  }
  return sub;
}

const INSTRUCTIONS = `
You are connected to LC Connect — an MCP server over the Laser Components CRM and
knowledge base (PostgreSQL). It exposes products, applications, leads, market
research, knowledge resources, and reporting/analytics for a laser-components
sales operation.

## How to answer
- Prefer widget answers for any result set that is naturally tabular or large
  (product catalogs, lead lists, application mappings, analytics). When a tool
  returns a widget/dataset link, present that link as the visualization — do NOT
  rebuild it as a React artifact or a raw JSON dump. Summarize from the sample.
- Treat large result sets as datasets, not prose: profile, group, aggregate, and
  compare rather than reading row-by-row.

## Knowledge resources
- Knowledge/answers are DB-backed. When a knowledge or research tool exists,
  resolve facts from it rather than guessing. Only report confirmed facts; if a
  supplier/spec relationship is not in the data, say it is unknown rather than
  speculating.

## General rules
- Resolve names to IDs with lookup tools before calling action tools. Never guess IDs.
- Dates are YYYY-MM-DD unless a tool specifies otherwise.
- If a lookup returns multiple matches, present them and ask the user to confirm.
`.trim();

/**
 * Creates and configures a fresh MCP server. A new instance is built per request
 * (the SDK forbids reusing one server across stateless requests); registration is
 * just O(n) function calls. The tenant sub is resolved per-request via
 * AsyncLocalStorage (getTenantSub), not captured at construction time.
 */
export function createMcpServer(): McpServer {
  const server = new McpServer(
    { name: "lc-connect", version: VERSION },
    { instructions: INSTRUCTIONS }
  );

  registerAllTools(server, getTenantSub);

  // CHUNK 2c: register the shared @cfi/mcp-widgets resources (analytics,
  // dataset, action) ONCE on this server. Guarded internally + here so the
  // per-request server build never throws on a duplicate resource URI.
  registerSharedWidgets(server);

  // CHUNK 2b: DB-backed knowledge resources (lc://resources/<slug>) and the
  // session-start prompt (lc_session_start). Resources/prompts are global, not
  // tenant-scoped, so they are registered here rather than threaded through
  // getTenantSub.
  registerKnowledgeResources(server);
  registerPrompts(server);

  return server;
}
