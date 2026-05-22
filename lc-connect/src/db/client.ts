import { createRequire } from 'module'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Find the laser_components project root, which holds the generated @prisma/client
const pathParts = __dirname.split('/')
const lcIndex = pathParts.indexOf('laser_components')
if (lcIndex === -1) {
  throw new Error('Could not find laser_components in path: ' + __dirname)
}
const projectRoot = pathParts.slice(0, lcIndex + 1).join('/')
const prismaClientPath = join(projectRoot, 'node_modules', '@prisma', 'client')

const require = createRequire(import.meta.url)
const { PrismaClient } = require(prismaClientPath)

export const prisma = new PrismaClient() as import('@prisma/client').PrismaClient
