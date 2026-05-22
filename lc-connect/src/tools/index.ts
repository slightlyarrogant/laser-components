import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { productToolDefinitions, handleProductTool } from './products.js'
import { leadToolDefinitions, handleLeadTool } from './leads.js'
import { applicationToolDefinitions, handleApplicationTool } from './applications.js'
import { aiToolDefinitions, handleAITool } from './ai.js'
import { reportToolDefinitions, handleReportTool } from './report.js'
import { knowledgeToolDefinitions, handleKnowledgeTool } from './knowledge.js'

// generate_lead_score is defined in aiToolDefinitions — remove from leads to avoid duplicate.
const pureLeadToolDefinitions = leadToolDefinitions.filter((t) => t.name !== 'generate_lead_score')

export function registerAllTools(server: Server): void {
  const allDefinitions = [
    ...productToolDefinitions,
    ...pureLeadToolDefinitions,
    ...applicationToolDefinitions,
    ...aiToolDefinitions,
    ...reportToolDefinitions,
    ...knowledgeToolDefinitions,
  ]

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: allDefinitions }))

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params

    try {
      // Dispatch to domain handlers
      if (productToolDefinitions.find((t) => t.name === name)) {
        return await handleProductTool(name, args)
      }
      if (pureLeadToolDefinitions.find((t) => t.name === name)) {
        return await handleLeadTool(name, args)
      }
      if (applicationToolDefinitions.find((t) => t.name === name)) {
        return await handleApplicationTool(name, args)
      }
      if (aiToolDefinitions.find((t) => t.name === name)) {
        return await handleAITool(name, args)
      }
      if (reportToolDefinitions.find((t) => t.name === name)) {
        return await handleReportTool(name, args as Record<string, any>)
      }
      if (knowledgeToolDefinitions.find((t) => t.name === name)) {
        return await handleKnowledgeTool(name, args as Record<string, any>)
      }

      throw new Error(`Unknown tool: ${name}`)
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      }
    }
  })
}
