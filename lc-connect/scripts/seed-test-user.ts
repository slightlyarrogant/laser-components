import 'dotenv/config'
import { createRequire } from 'module'
import { PrismaClient } from '@prisma/client'

const require = createRequire(import.meta.url)
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } })

async function main() {
  const email = 'test@lasercomponents.local'
  const password = 'Test1234!'

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    console.log('Test user already exists:', email)
    return
  }

  const passwordHash = await bcrypt.hash(password, 12)
  const user = await prisma.user.create({
    data: { email, passwordHash, role: 'ADMIN' },
  })

  console.log('Test user created:')
  console.log('  Email:   ', email)
  console.log('  Password:', password)
  console.log('  Role:    ', user.role)
}

main().catch(console.error).finally(() => prisma.$disconnect())
