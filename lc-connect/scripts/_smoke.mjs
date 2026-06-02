import 'dotenv/config'
import { createRequire } from 'module'
import { PrismaClient } from '@prisma/client'

const require = createRequire(import.meta.url)
console.log('@prisma/client resolved from:', require.resolve('@prisma/client'))
console.log('.prisma/client resolved from:', require.resolve('.prisma/client'))

const prisma = new PrismaClient()

try {
  const [leads, products, applications] = await Promise.all([
    prisma.lead.count(),
    prisma.product.count(),
    prisma.application.count(),
  ])
  console.log('leads        =', leads)
  console.log('products     =', products)
  console.log('applications =', applications)
} finally {
  await prisma.$disconnect()
}
