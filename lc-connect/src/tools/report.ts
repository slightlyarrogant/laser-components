import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const fetch = require('node-fetch')

const WHATSAPP_URL = process.env.WHATSAPP_URL || 'http://localhost:8092'
const WHATSAPP_RECIPIENT = process.env.WHATSAPP_RECIPIENT || '256422885490913@lid'

export const reportToolDefinitions = [
  {
    name: 'report_issue',
    description:
      'USE WHEN: user explicitly asks to report/send a bug, data problem, or connector issue to the system administrator. EXTERNAL SIDE EFFECT; should require confirmation because it sends a WhatsApp message. DO NOT USE WHEN: user is merely discussing a possible issue or asking for analysis. REQUIRED FIELDS: title and description.',
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
    inputSchema: {
      type: 'object',
      required: ['title', 'description'],
      properties: {
        title: {
          type: 'string',
          description: 'Short title summarizing the issue',
        },
        description: {
          type: 'string',
          description: 'Detailed description of the issue, including steps to reproduce if applicable',
        },
        severity: {
          type: 'string',
          enum: ['low', 'medium', 'high', 'critical'],
          description: 'Severity level of the issue (default: medium)',
        },
        category: {
          type: 'string',
          enum: ['data', 'tool', 'auth', 'performance', 'other'],
          description: 'Category of the issue (default: other)',
        },
      },
    },
  },
]

export async function handleReportTool(
  name: string,
  args: Record<string, any>
): Promise<{ content: Array<{ type: string; text: string }> }> {
  if (name !== 'report_issue') throw new Error(`Unknown report tool: ${name}`)

  const title = args.title as string
  const description = args.description as string
  const severity = (args.severity as string) || 'medium'
  const category = (args.category as string) || 'other'

  const severityEmoji: Record<string, string> = {
    low: '🟡',
    medium: '🟠',
    high: '🔴',
    critical: '🚨',
  }

  const categoryEmoji: Record<string, string> = {
    data: '🗄️',
    tool: '🔧',
    auth: '🔐',
    performance: '⚡',
    other: '📋',
  }

  const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC'

  const message =
    `${severityEmoji[severity] || '🟠'} *LC Connect — Issue Report*\n\n` +
    `*Title:* ${title}\n` +
    `*Severity:* ${severity.toUpperCase()}\n` +
    `*Category:* ${categoryEmoji[category] || '📋'} ${category}\n` +
    `*Time:* ${timestamp}\n\n` +
    `*Description:*\n${description}`

  try {
    const response = await fetch(`${WHATSAPP_URL}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: WHATSAPP_RECIPIENT, text: message }),
    })

    const result = await response.json() as { ok: boolean; error?: string }

    if (!result.ok) {
      throw new Error(result.error || 'WhatsApp delivery failed')
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: true,
            message: 'Issue reported successfully and sent to the administrator via WhatsApp.',
            title,
            severity,
            category,
            timestamp,
          }),
        },
      ],
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: `Failed to send WhatsApp notification: ${errorMsg}`,
            note: 'Issue was recorded but notification delivery failed.',
          }),
        },
      ],
    }
  }
}
