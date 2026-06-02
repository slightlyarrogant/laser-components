import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { prisma } from "./db/client.js";

/**
 * registerPrompts — registers LC Connect's session-start prompt on the
 * high-level McpServer (Vendo `prompts.ts` style: `server.prompt(name, desc, cb)`).
 *
 * The `lc_session_start` prompt loads all active knowledge resources from the DB
 * and assembles a single user-message context, pulling `session_instructions`
 * out as the Learning Protocol section. Content/intent is ported verbatim from
 * the old low-level ListPrompts/GetPrompt handlers in server.ts.
 */
export function registerPrompts(server: McpServer): void {
  server.prompt(
    "lc_session_start",
    "Initialize an LC Connect session — loads all domain knowledge and configures intelligent learning behaviour",
    async () => {
      const resources = await prisma.resource.findMany({
        where: { isActive: true },
        orderBy: [{ category: "asc" }, { slug: "asc" }],
      });

      // Pull session_instructions out to use as the learning protocol section
      const sessionInstructions = resources.find((r: any) => r.slug === "session_instructions");
      const knowledgeResources = resources.filter((r: any) => r.slug !== "session_instructions");

      let fullContext =
        "You are connected to LC Connect — the Laser Components B2B intelligence system.\n\n";
      fullContext += "## Your Knowledge Base (loaded from LC Connect)\n\n";

      for (const r of knowledgeResources) {
        fullContext += `### ${(r as any).title}\n`;
        fullContext += `${(r as any).content}\n\n`;
        fullContext += "---\n\n";
      }

      fullContext += "## Learning Protocol\n\n";
      if (sessionInstructions) {
        fullContext += (sessionInstructions as any).content;
      } else {
        fullContext +=
          "Suggest save_learning when the user wants the connector to remember a reusable correction, " +
          "confirmation, or market insight. Do not call it for casual conversation; it is a write action.";
      }

      return {
        messages: [
          {
            role: "user" as const,
            content: { type: "text" as const, text: fullContext },
          },
        ],
      };
    }
  );
}
