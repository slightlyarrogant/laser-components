import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import {
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'
import { registerAllTools } from './tools/index.js'
import { prisma } from './db/client.js'

export function createMCPServer(): Server {
  const server = new Server(
    { name: 'lc-connect', version: '1.0.0' },
    { capabilities: { tools: {}, resources: {}, prompts: {} } }
  )

  registerAllTools(server)
  registerResources(server)
  registerPrompts(server)

  return server
}

function registerResources(server: Server): void {
  // List all active resources
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    const resources = await prisma.resource.findMany({
      where: { isActive: true },
      orderBy: { category: 'asc' },
    })

    return {
      resources: resources.map((r: any) => ({
        uri: `lc://resources/${r.slug}`,
        name: r.title,
        description: `[${r.category}] v${r.version} — ${r.content.slice(0, 120)}...`,
        mimeType: 'text/plain',
      })),
    }
  })

  // Read a specific resource by URI
  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const slug = (request.params.uri as string).replace('lc://resources/', '')
    const resource = await prisma.resource.findUnique({ where: { slug } })

    if (!resource) throw new Error(`Resource not found: ${slug}`)

    return {
      contents: [
        {
          uri: request.params.uri,
          mimeType: 'text/plain',
          text:
            `# ${resource.title}\n` +
            `_Category: ${(resource as any).category} | Version: ${(resource as any).version} | Updated: ${(resource as any).updatedAt.toISOString().slice(0, 10)}_\n\n` +
            `${(resource as any).content}`,
        },
      ],
    }
  })
}

function registerPrompts(server: Server): void {
  // List available prompts
  server.setRequestHandler(ListPromptsRequestSchema, async () => {
    return {
      prompts: [
        {
          name: 'lc_session_start',
          description:
            'Initialize an LC Connect session — loads all domain knowledge and configures intelligent learning behaviour',
          arguments: [],
        },
      ],
    }
  })

  // Return the session start prompt with all knowledge loaded
  server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    if (request.params.name !== 'lc_session_start') {
      throw new Error(`Unknown prompt: ${request.params.name}`)
    }

    const resources = await prisma.resource.findMany({
      where: { isActive: true },
      orderBy: [{ category: 'asc' }, { slug: 'asc' }],
    })

    // Pull session_instructions out to use as the learning protocol section
    const sessionInstructions = resources.find((r: any) => r.slug === 'session_instructions')
    const knowledgeResources = resources.filter((r: any) => r.slug !== 'session_instructions')

    let fullContext =
      'You are connected to LC Connect — the Laser Components B2B intelligence system.\n\n'
    fullContext += '## Your Knowledge Base (loaded from LC Connect)\n\n'

    for (const r of knowledgeResources) {
      fullContext += `### ${(r as any).title}\n`
      fullContext += `${(r as any).content}\n\n`
      fullContext += '---\n\n'
    }

    fullContext += '## Learning Protocol\n\n'
    if (sessionInstructions) {
      fullContext += (sessionInstructions as any).content
    } else {
      fullContext +=
        'Suggest save_learning when the user wants the connector to remember a reusable correction, ' +
        'confirmation, or market insight. Do not call it for casual conversation; it is a write action.'
    }

    return {
      messages: [
        {
          role: 'user',
          content: { type: 'text', text: fullContext },
        },
      ],
    }
  })
}
