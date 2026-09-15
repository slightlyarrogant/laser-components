import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { AsyncLocalStorage } from "node:async_hooks";
import { bindTenantReader, errMessage, errStack, log } from "./core/log.js";
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

// The logger's `userId` mixin reads the tenant from here. Registered at module
// init (not imported the other way round) so src/core/log.ts stays free of the
// tool tree — see the note in that file.
bindTenantReader(() => tenantContext.getStore());

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

## Presentation rule (important)
Most tools return an interactive widget that already displays every figure, row,
and label. When a tool returns a widget, THE WIDGET IS THE ANSWER:
- Reply with AT MOST one short sentence — often none. Let the widget speak.
- Do NOT restate the numbers, re-list the rows, or rebuild the data as a Markdown
  table, bullet list, or React artifact — that duplicates the widget and adds noise.
- Do NOT write multi-paragraph commentary or "Facts and Evidence" write-ups.
Elaborate beyond one sentence ONLY when the user EXPLICITLY asks for analysis,
interpretation, comparison, a recommendation, or next steps. A plain request to
"show", "list", "break down", or "see" the data is fully satisfied by the widget alone.

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

// ---------------------------------------------------------------------------
// Tool-call ledger
//
// Every tool handler is timed and produces exactly ONE `evt:"tool-call"` line.
// This is the answer to "which tools does this connector actually get asked
// for, by whom, and how often does it refuse?" — a question no per-tool logging
// scattered through src/tools/** can answer consistently, because the next tool
// added would simply forget to log.
//
// It is installed by wrapping the two registration entry points on the McpServer
// INSTANCE (`tool` and `registerTool`). Both are needed and neither double-wraps
// the other: `tool()` reaches `_createRegisteredTool` directly rather than
// delegating to `registerTool()`. Wrapping at this level also covers the
// ext-apps `registerAppTool()` helper used across src/tools/**, which is a thin
// shim over `server.registerTool` — so the ledger cannot be bypassed by a tool
// choosing a different registration style.
//
// WHAT IS NEVER LOGGED: argument VALUES. Tool arguments routinely carry lead
// PII (names, emails, company records). The ledger records argument KEY NAMES
// only, which answers "was this call shaped like a filtered query or a bare
// one?" without putting a single customer field into the log.
// ---------------------------------------------------------------------------

/** Refusals are ordinary answers, not failures — they get their own outcome. */
const REFUSAL_PREFIXES = ["Requires role", "You can't edit"];

type ToolOutcome = "ok" | "error" | "refused";

interface ToolResultish {
  isError?: boolean;
  content?: Array<{ type?: string; text?: string }>;
}

/** First text block of a tool result, or "" — used only to classify refusals. */
function firstText(result: ToolResultish): string {
  const block = result.content?.find((b) => typeof b?.text === "string");
  return block?.text ?? "";
}

function classifyOutcome(result: unknown): ToolOutcome {
  if (!result || typeof result !== "object") return "ok";
  const r = result as ToolResultish;
  if (r.isError !== true) return "ok";
  const text = firstText(r);
  return REFUSAL_PREFIXES.some((p) => text.startsWith(p)) ? "refused" : "error";
}

/**
 * Argument key names, or [] when the handler took no arguments.
 *
 * The SDK invokes a handler as `(args, extra)` when the tool declared an input
 * schema and as `(extra)` when it did not, so arity — not the shape of the
 * first value — is what distinguishes them. Reading `Object.keys` of a value we
 * already know to be the argument object is safe; reading the `extra` bag would
 * leak request internals.
 */
function argKeys(callArgs: unknown[]): string[] {
  if (callArgs.length < 2) return [];
  const args = callArgs[0];
  if (!args || typeof args !== "object" || Array.isArray(args)) return [];
  return Object.keys(args as Record<string, unknown>);
}

function withLedger<T>(name: string, handler: T): T {
  if (typeof handler !== "function") return handler; // task handlers, etc.
  const original = handler as unknown as (...a: unknown[]) => unknown;
  const wrapped = async (...callArgs: unknown[]): Promise<unknown> => {
    const started = Date.now();
    const argsKeys = argKeys(callArgs);
    try {
      const result = await original(...callArgs);
      log.info({
        evt: "tool-call",
        tool: name,
        outcome: classifyOutcome(result),
        ms: Date.now() - started,
        argsKeys,
      });
      return result;
    } catch (err) {
      // A throw is the transport-level failure mode (the SDK turns it into a
      // JSON-RPC error); it still gets exactly one ledger line.
      log.info({
        evt: "tool-call",
        tool: name,
        outcome: "error",
        ms: Date.now() - started,
        argsKeys,
        err: errMessage(err),
      });
      log.debug({ evt: "tool-call", tool: name, stack: errStack(err) });
      throw err;
    }
  };
  return wrapped as unknown as T;
}

/**
 * Install the ledger on one McpServer instance. A fresh instance is built per
 * request, so this runs per request too — it is two property assignments.
 */
function installToolLedger(server: McpServer): void {
  const originalTool = server.tool.bind(server) as (...a: unknown[]) => unknown;
  const originalRegisterTool = server.registerTool.bind(server) as (
    ...a: unknown[]
  ) => unknown;

  // `tool(name, [description], [schema], [annotations], cb)` — the callback is
  // always last, whichever overload the caller picked.
  server.tool = ((name: string, ...rest: unknown[]) => {
    const last = rest.length - 1;
    if (last >= 0 && typeof rest[last] === "function") {
      rest[last] = withLedger(name, rest[last]);
    }
    return originalTool(name, ...rest);
  }) as typeof server.tool;

  server.registerTool = ((name: string, cfg: unknown, cb: unknown) =>
    originalRegisterTool(name, cfg, withLedger(name, cb))) as typeof server.registerTool;
}

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

  // BEFORE any registration: the ledger wraps handlers as they are registered,
  // so a tool registered earlier would be invisible to it.
  installToolLedger(server);

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
