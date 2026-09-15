import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAppTool } from "@modelcontextprotocol/ext-apps/server";
import { ACTION_WIDGET_URI, buildActionEnvelope } from "@cfi/mcp-widgets";
import { config } from "../config.js";
import { audit } from "../core/audit.js";

/**
 * report_issue — forwards a bug/data/connector issue to the administrator via
 * the WhatsApp bridge.
 *
 * Env names preserved from the old LC server:
 *   WHATSAPP_URL        — bridge base URL (POST {URL}/send), body {chatId, message} (hermes bridge :3092)
 *   WHATSAPP_RECIPIENT  — target JID/lid
 */

// Read through the validated config rather than process.env so the bridge URL
// is URL-checked at boot and has a single documented default (the live bridge
// listens on 3092; the old 8092 default pointed at a dead port).
const WHATSAPP_URL = config.WHATSAPP_URL;
const WHATSAPP_RECIPIENT = config.WHATSAPP_RECIPIENT;
const WHATSAPP_TIMEOUT_MS = 30_000;

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
        "report_issue — send a bug / data problem / connector issue report about LC Connect itself",
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
        title: z
          .string()
          .min(1)
          .max(200)
          .describe("Short title summarizing the issue (required, max 200 characters)."),
        description: z
          .string()
          .min(1)
          .max(4000)
          .describe(
            "Detailed description of the issue, including steps to reproduce if applicable (required, max 4000 characters)."
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

      // Audited BEFORE the WhatsApp round trip: the report was made whether or
      // not the bridge delivered it, and the trail is the durable record.
      await audit({
        action: "issue.reported",
        resourceType: "issue",
        resourceId: null,
        details: { title, category, severity },
      });

      try {
        const response = await fetch(`${WHATSAPP_URL}/send`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chatId: WHATSAPP_RECIPIENT, message }),
          signal: AbortSignal.timeout(WHATSAPP_TIMEOUT_MS),
        });

        const result = (await response.json().catch(() => ({}))) as {
          ok?: boolean; success?: boolean; error?: string;
        };

        // hermes bridge answers {success:true,messageId}; the old bridge answered {ok:true}.
        if (!response.ok || !(result.ok || result.success)) {
          throw new Error(result.error || `WhatsApp delivery failed (HTTP ${response.status})`);
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
        // Delivery failed — a warning card, not success. The raw error stays in
        // the server log: it can carry the bridge URL, upstream hostnames and
        // stack detail, none of which belongs in a model-visible string.
        console.error("[report_issue] WhatsApp delivery failed:", err);
        return buildActionEnvelope(
          {
            status: "warning",
            title: "Issue recorded, delivery failed",
            detail: "Delivery failed, please retry.",
          },
          `[PRESENTATION] Issue recorded, but the notification did not get through. Tell the user delivery failed and to please retry — do not speculate about the cause.`
        ) as any;
      }
    }
  );
}
