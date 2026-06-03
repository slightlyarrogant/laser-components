import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAppTool } from "@modelcontextprotocol/ext-apps/server";
import { ACTION_WIDGET_URI, buildActionEnvelope } from "@cfi/mcp-widgets";

/**
 * report_issue — forwards a bug/data/connector issue to the administrator via
 * the WhatsApp bridge.
 *
 * Env names preserved from the old LC server:
 *   WHATSAPP_URL        — bridge base URL (POST {URL}/send)
 *   WHATSAPP_RECIPIENT  — target JID/lid
 */

const WHATSAPP_URL = process.env.WHATSAPP_URL || "http://localhost:8092";
const WHATSAPP_RECIPIENT = process.env.WHATSAPP_RECIPIENT || "256422885490913@lid";

const SEVERITY_EMOJI: Record<string, string> = {
  low: "🟡",
  medium: "🟠",
  high: "🔴",
  critical: "🚨",
};

const CATEGORY_EMOJI: Record<string, string> = {
  data: "🗄️",
  tool: "🔧",
  auth: "🔐",
  performance: "⚡",
  other: "📋",
};

function ok(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data) }],
  };
}

export function registerReportTools(
  server: McpServer,
  getTenantSub: () => string
): void {
  registerAppTool(
    server,
    "report_issue",
    {
      title: "Report an issue",
      description: [
        "Send a bug / data problem / connector issue report about LC Connect itself",
        "to the administrator via WhatsApp.",
        "USE WHEN: the user explicitly asks to report a bug, a data problem, or a",
        "connector/tool failure to the admin; an LC Connect tool returned wrong data",
        "or failed unexpectedly and the user wants it escalated.",
        "DO NOT USE WHEN: the user is merely discussing a possible issue or asking for",
        "analysis — there is no reply channel, this is fire-and-forget.",
        "RETURNS: an ACTION confirmation widget — success when delivered, a warning",
        "card when WhatsApp delivery failed (the issue is still considered recorded).",
        "GOTCHAS: title and description are required; severity defaults to 'medium',",
        "category to 'other'. Delivery target is fixed (WHATSAPP_RECIPIENT) — the user",
        "cannot redirect it.",
      ].join("\n"),
      inputSchema: {
        title: z.string().describe("Short title summarizing the issue (required)."),
        description: z
          .string()
          .describe(
            "Detailed description of the issue, including steps to reproduce if applicable (required)."
          ),
        severity: z
          .enum(["low", "medium", "high", "critical"])
          .optional()
          .describe("Severity level of the issue. Defaults to 'medium'."),
        category: z
          .enum(["data", "tool", "auth", "performance", "other"])
          .optional()
          .describe("Category of the issue. Defaults to 'other'."),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
      _meta: {
        ui: { resourceUri: ACTION_WIDGET_URI },
        "openai/outputTemplate": ACTION_WIDGET_URI,
      },
    },
    async (args) => {
      void getTenantSub();

      const title = args.title as string;
      const description = args.description as string;
      const severity = (args.severity as string) || "medium";
      const category = (args.category as string) || "other";

      const timestamp =
        new Date().toISOString().replace("T", " ").slice(0, 16) + " UTC";

      const message =
        `${SEVERITY_EMOJI[severity] || "🟠"} *LC Connect — Issue Report*\n\n` +
        `*Title:* ${title}\n` +
        `*Severity:* ${severity.toUpperCase()}\n` +
        `*Category:* ${CATEGORY_EMOJI[category] || "📋"} ${category}\n` +
        `*Time:* ${timestamp}\n\n` +
        `*Description:*\n${description}`;

      try {
        const response = await fetch(`${WHATSAPP_URL}/send`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ to: WHATSAPP_RECIPIENT, text: message }),
        });

        const result = (await response.json()) as { ok: boolean; error?: string };

        if (!result.ok) {
          throw new Error(result.error || "WhatsApp delivery failed");
        }

        return buildActionEnvelope(
          {
            status: "success",
            title: "Issue sent",
            detail: `${title} — ${severity.toUpperCase()} / ${category}`,
            id: timestamp,
            idLabel: "Time",
          },
          `[PRESENTATION] Issue "${title}" sent to the administrator. Confirm briefly.`
        ) as any;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        // Delivery failed — a warning card, not success. The issue is still
        // recorded; the model should say delivery failed but it was noted.
        return buildActionEnvelope(
          {
            status: "warning",
            title: "Issue recorded, delivery failed",
            detail: `WhatsApp notification did not get through: ${errorMsg}`,
          },
          `[PRESENTATION] Issue recorded, but the WhatsApp notification did not get through. Inform the user of this.`
        ) as any;
      }
    }
  );
}
