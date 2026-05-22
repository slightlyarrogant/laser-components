import 'dotenv/config'
import { createRequire } from 'module'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const require = createRequire(import.meta.url)
const bcrypt = require('bcryptjs')

const pathParts = __dirname.split('/')
const lcIndex = pathParts.indexOf('laser_components')
if (lcIndex === -1) throw new Error('Cannot find laser_components in path')
const projectRoot = pathParts.slice(0, lcIndex + 1).join('/')
const { PrismaClient } = require(join(projectRoot, 'node_modules', '@prisma', 'client'))

const prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } })

async function main() {
  const email = 'test@lasercomponents.local'
  const password = 'Test1234!'

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    console.log('Test user already exists:', email)
    return
  }

  const password_hash = await bcrypt.hash(password, 12)
  const user = await prisma.user.create({
    data: { email, password_hash, role: 'ADMIN' },
  })

  console.log('Test user created:')
  console.log('  Email:   ', email)
  console.log('  Password:', password)
  console.log('  Role:    ', user.role)
}

main().catch(console.error).finally(() => prisma.$disconnect())
