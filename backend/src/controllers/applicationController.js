import { PrismaClient, ApplicationStatus } from '@prisma/client'

const prisma = new PrismaClient()

// Get all applications
export async function getAllApplications (req, res, next) {
  try {
    const applications = await prisma.application.findMany()
    res.json(applications)
  } catch (error) {
    next(error)
  }
}

// Get a single application by ID
export async function getApplicationById (req, res, next) {
  const { id } = req.params
  try {
    const application = await prisma.application.findUnique({
      where: { id: parseInt(id) },
      include: {
        // Optionally include mapped products count or details
        // products: { select: { productId: true } }
      }
    })
    if (!application) {
      return res.status(404).json({ message: 'Application not found' })
    }
    res.json(application)
  } catch (error) {
    next(error)
  }
}

// Create a new application
export async function createApplication (req, res, next) {
  const { name, description, status } = req.body
  try {
    const application = await prisma.application.create({
      data: {
        name,
        description,
        status: status ? ApplicationStatus[status] : ApplicationStatus.ACTIVE // Use enum value
      }
    })
    res.status(201).json(application)
  } catch (error) {
    if (error.code === 'P2002' && error.meta?.target?.includes('name')) {
      return res.status(409).json({ message: `Application name '${name}' already exists` })
    }
    next(error)
  }
}

// Update an existing application
export async function updateApplication (req, res, next) {
  const { id } = req.params
  const { name, description, status } = req.body
  try {
    const application = await prisma.application.update({
      where: { id: parseInt(id) },
      data: {
        name,
        description,
        status: status ? ApplicationStatus[status] : undefined // Update status if provided
      }
    })
    res.json(application)
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ message: 'Application not found' })
    }
    if (error.code === 'P2002' && error.meta?.target?.includes('name')) {
      return res.status(409).json({ message: `Application name '${name}' already exists` })
    }
    next(error)
  }
}

// Delete an application
export async function deleteApplication (req, res, next) {
  const { id } = req.params
  try {
    // Need transaction to delete mappings first, then application
    await prisma.$transaction(async (tx) => {
      // Delete related mappings
      await tx.applicationProduct.deleteMany({
        where: { applicationId: parseInt(id) }
      })
      // Delete application itself
      await tx.application.delete({
        where: { id: parseInt(id) }
      })
    })
    res.status(204).send()
  } catch (error) {
    if (error.code === 'P2025') {
      // This might occur if the mapping delete succeeded but app delete failed (unlikely)
      // or if the app was deleted between the check and the delete.
      return res.status(404).json({ message: 'Application not found' })
    }
    next(error)
  }
}

// --- Mapping Functions ---

// Get products mapped to an application
export async function getMappedProducts (req, res, next) {
  const { id } = req.params // Application ID
  try {
    const mappings = await prisma.applicationProduct.findMany({
      where: { applicationId: parseInt(id) },
      include: { product: true } // Include product details
    })
    res.json(mappings.map(m => m.product)) // Return just the product objects
  } catch (error) {
    next(error)
  }
}

// Associate products with an application (batch)
export async function mapProductsToApplication (req, res, next) {
  const { id } = req.params // Application ID
  const { productIds } = req.body // Expect an array of product IDs
  const userId = req.user?.email || 'system' // Get user identifier from authenticated request

  if (!Array.isArray(productIds) || productIds.length === 0) {
    return res.status(400).json({ message: 'productIds must be a non-empty array.' })
  }

  const dataToCreate = productIds.map(productId => ({
    applicationId: parseInt(id),
    productId: parseInt(productId),
    assignedBy: userId
  }))

  try {
    // Use createMany and skip duplicates if a mapping already exists
    const result = await prisma.applicationProduct.createMany({
      data: dataToCreate,
      skipDuplicates: true
    })
    res.status(201).json({ message: `Associated ${result.count} products.`, count: result.count })
  } catch (error) {
     // Handle potential errors like invalid application/product IDs
    if (error.code === 'P2003') { 
        return res.status(400).json({ message: 'Database error: One or more provided application or product IDs do not exist.' })
    } 
    next(error)
  }
}

// Remove a specific product mapping from an application
export async function unmapProductFromApplication (req, res, next) {
  const { id, productId } = req.params // Application ID and Product ID

  try {
    const result = await prisma.applicationProduct.deleteMany({
      where: {
        applicationId: parseInt(id),
        productId: parseInt(productId)
      }
    })

    if (result.count === 0) {
      return res.status(404).json({ message: 'Mapping not found.' })
    }
    res.status(204).send()
  } catch (error) {
    next(error)
  }
} 