import { PrismaClient } from '@prisma/client'
import Papa from 'papaparse' // Import papaparse
import asyncHandler from 'express-async-handler'; // Import for handling async errors
import { discoverApplicationsForProduct } from '../services/research/aiResearchService.js'; // Import the AI service function

const prisma = new PrismaClient()

// Get all products
export async function getAllProducts (req, res, next) {
  try {
    const products = await prisma.product.findMany({
      // Include subcategory and its parent category
      include: {
        subcategory: {
          include: {
            category: true
          }
        }
      }
    })
    res.json(products)
  } catch (error) {
    console.error('Error fetching products:', error)
    next(error)
  }
}

// Get a single product by ID
export async function getProductById (req, res, next) {
  const { id } = req.params
  try {
    const product = await prisma.product.findUnique({
      where: { id: parseInt(id) },
      // Include subcategory and its parent category
      include: {
        subcategory: {
          include: {
            category: true
          }
        }
      }
    })
    if (!product) {
      return res.status(404).json({ message: 'Product not found' })
    }
    res.json(product)
  } catch (error) {
    console.error(`Error fetching product ${id}:`, error)
    next(error)
  }
}

// Create a new product
export async function createProduct (req, res, next) {
  // Destructure all relevant fields from body
  const { name, description, subcategoryId, sku, price, specifications, datasheetUrl } = req.body
  try {
    const product = await prisma.product.create({
      data: {
        name,
        description,
        subcategoryId: parseInt(subcategoryId), // Use subcategoryId
        sku,
        price: price ? parseFloat(price) : undefined, // Handle optional price
        specifications: specifications || undefined, // Handle optional JSON specs
        datasheetUrl
      }
    })
    res.status(201).json(product)
  } catch (error) {
    console.error('Error creating product:', error)
    if (error.code === 'P2003') { // FK constraint failed (likely invalid subcategoryId)
      return res.status(400).json({ message: 'Invalid subcategoryId provided' })
    }
    if (error.code === 'P2002' && error.meta?.target?.includes('sku')) { // Unique constraint failed on sku
      return res.status(409).json({ message: `SKU '${sku}' already exists` })
    }
    next(error)
  }
}

// Update an existing product
export async function updateProduct (req, res, next) {
  const { id } = req.params
  const { name, description, subcategoryId, sku, price, specifications, datasheetUrl } = req.body
  try {
    const product = await prisma.product.update({
      where: { id: parseInt(id) },
      data: {
        name,
        description,
        subcategoryId: subcategoryId ? parseInt(subcategoryId) : undefined,
        sku,
        price: price ? parseFloat(price) : undefined,
        specifications,
        datasheetUrl
      }
    })
    res.json(product)
  } catch (error) {
    console.error(`Error updating product ${id}:`, error)
    if (error.code === 'P2025') {
      return res.status(404).json({ message: 'Product not found' })
    }
    if (error.code === 'P2003') {
      return res.status(400).json({ message: 'Invalid subcategoryId provided' })
    }
    if (error.code === 'P2002' && error.meta?.target?.includes('sku')) {
      return res.status(409).json({ message: `SKU '${sku}' already exists` })
    }
    next(error)
  }
}

// Delete a product
export async function deleteProduct (req, res, next) {
  const { id } = req.params
  try {
    await prisma.product.delete({
      where: { id: parseInt(id) }
    })
    res.status(204).send()
  } catch (error) {
    console.error(`Error deleting product ${id}:`, error)
    if (error.code === 'P2025') {
      return res.status(404).json({ message: 'Product not found' })
    }
    next(error)
  }
}

// Bulk upload products from CSV
export async function bulkUploadProducts (req, res, next) {
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded.' })
  }

  // Ensure it's a CSV file (basic check)
  if (req.file.mimetype !== 'text/csv') {
    return res.status(400).json({ message: 'Invalid file type. Please upload a CSV file.' })
  }

  const fileContent = req.file.buffer.toString('utf8')
  let parseErrors = []
  let productsToCreate = []

  try {
    Papa.parse(fileContent, {
      header: true, // Assumes first row is header
      skipEmptyLines: true,
      dynamicTyping: true, // Attempts to convert numbers/booleans
      step: function (row, parser) {
        const productData = row.data
        // Basic validation (can be expanded significantly)
        if (!productData.name || !productData.subcategoryId) {
          parseErrors.push({ row: parser.streamer.i + 2, error: 'Missing required fields (name, subcategoryId)', data: productData })
          return // Skip this row
        }
        // TODO: Add more robust validation (data types, formats, existence of subcategoryId)
        productsToCreate.push({
          name: productData.name,
          description: productData.description,
          subcategoryId: parseInt(productData.subcategoryId), // Ensure integer
          sku: productData.sku,
          price: productData.price ? parseFloat(productData.price) : undefined,
          specifications: productData.specifications ? JSON.parse(productData.specifications) : undefined, // Assuming specs are JSON strings in CSV
          datasheetUrl: productData.datasheetUrl
        })
      },
      complete: async function () {
        if (parseErrors.length > 0) {
          // Return errors if parsing/validation failed
          return res.status(400).json({ 
            message: 'Errors found during parsing. No products were created.', 
            errors: parseErrors 
          })
        }

        if (productsToCreate.length === 0) {
          return res.status(400).json({ message: 'CSV file was empty or contained no valid product rows.' })
        }

        try {
          // Use Prisma transaction for bulk create
          // Note: createMany does not return the created records by default
          // If you need returned records, loop and use create (less efficient)
          const result = await prisma.product.createMany({
            data: productsToCreate,
            skipDuplicates: true // Important: Decide how to handle duplicate SKUs if uniqueness is enforced
          })

          res.status(201).json({ 
            message: `Successfully created ${result.count} products.`, 
            count: result.count 
          })
        } catch (dbError) {
          console.error('Database error during bulk insert:', dbError)
          // Handle potential DB errors (e.g., invalid subcategoryId during insert)
          if (dbError.code === 'P2003') { 
            return res.status(400).json({ message: 'Database error: One or more provided subcategoryIds do not exist.' })
          } 
          if (dbError.code === 'P2002') { // Unique constraint failed (likely SKU)
             return res.status(409).json({ message: 'Database error: One or more SKUs already exist (if skipDuplicates=false).' })
          }
          next(dbError) // Pass to global error handler
        }
      }
    })
  } catch (error) {
    console.error('Error processing CSV file:', error)
    next(error)
  }
}

// --- Category Functions ---

// Get all categories (with subcategories)
export async function getAllCategories (req, res, next) {
  try {
    const categories = await prisma.category.findMany({
      include: {
        subcategories: true
      }
    });
    res.json(categories);
  } catch (error) {
    console.error('Error fetching categories:', error);
    next(error);
  }
}

// Get category by ID (with subcategories)
export async function getCategoryById (req, res, next) {
  const { id } = req.params;
  try {
    const category = await prisma.category.findUnique({
      where: { id: parseInt(id) },
      include: {
        subcategories: true
      }
    });
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }
    res.json(category);
  } catch (error) {
    console.error(`Error fetching category ${id}:`, error);
    next(error);
  }
}

// Create a new category
export async function createCategory (req, res, next) {
  const { name, description } = req.body;
  try {
    const category = await prisma.category.create({
      data: { name, description }
    });
    res.status(201).json(category);
  } catch (error) {
    console.error('Error creating category:', error);
    if (error.code === 'P2002') { // Unique constraint failed on name
      return res.status(409).json({ message: `Category name '${name}' already exists` });
    }
    next(error);
  }
}

// Update a category
export async function updateCategory (req, res, next) {
  const { id } = req.params;
  const { name, description } = req.body;
  try {
    const category = await prisma.category.update({
      where: { id: parseInt(id) },
      data: { name, description }
    });
    res.json(category);
  } catch (error) {
    console.error(`Error updating category ${id}:`, error);
    if (error.code === 'P2025') {
      return res.status(404).json({ message: 'Category not found' });
    }
    if (error.code === 'P2002') {
      return res.status(409).json({ message: `Category name '${name}' already exists` });
    }
    next(error);
  }
}

// Delete a category
export async function deleteCategory (req, res, next) {
  const { id } = req.params;
  try {
    // Check if category has subcategories first
    const subcategoryCount = await prisma.subcategory.count({
      where: { categoryId: parseInt(id) }
    });
    if (subcategoryCount > 0) {
      return res.status(400).json({ message: 'Cannot delete category with existing subcategories' });
    }
    await prisma.category.delete({
      where: { id: parseInt(id) }
    });
    res.status(204).send();
  } catch (error) {
    console.error(`Error deleting category ${id}:`, error);
    if (error.code === 'P2025') {
      return res.status(404).json({ message: 'Category not found' });
    }
    next(error);
  }
}

// --- Subcategory Functions ---

// Get subcategories for a specific category
export async function getSubcategoriesForCategory (req, res, next) {
  const { categoryId } = req.params;
  try {
    const subcategories = await prisma.subcategory.findMany({
      where: { categoryId: parseInt(categoryId) }
    });
    res.json(subcategories);
  } catch (error) {
    console.error(`Error fetching subcategories for category ${categoryId}:`, error);
    next(error);
  }
}

// Get all subcategories (optional)
export async function getAllSubcategories (req, res, next) {
  try {
    const subcategories = await prisma.subcategory.findMany();
    res.json(subcategories);
  } catch (error) {
    console.error('Error fetching all subcategories:', error);
    next(error);
  }
}

// Get subcategory by ID
export async function getSubcategoryById (req, res, next) {
  const { id } = req.params;
  try {
    const subcategory = await prisma.subcategory.findUnique({
      where: { id: parseInt(id) }
    });
    if (!subcategory) {
      return res.status(404).json({ message: 'Subcategory not found' });
    }
    res.json(subcategory);
  } catch (error) {
    console.error(`Error fetching subcategory ${id}:`, error);
    next(error);
  }
}

// Create a new subcategory
export async function createSubcategory (req, res, next) {
  const { name, description, categoryId } = req.body;
  try {
    const subcategory = await prisma.subcategory.create({
      data: {
        name,
        description,
        categoryId: parseInt(categoryId)
      }
    });
    res.status(201).json(subcategory);
  } catch (error) {
    console.error('Error creating subcategory:', error);
    if (error.code === 'P2003') { // FK constraint failed (invalid categoryId)
      return res.status(400).json({ message: 'Invalid categoryId provided' });
    }
    if (error.code === 'P2002') { // Unique constraint failed on name (assuming unique within category)
       return res.status(409).json({ message: `Subcategory name '${name}' already exists in this category` });
    }
    next(error);
  }
}

// Update a subcategory
export async function updateSubcategory (req, res, next) {
  const { id } = req.params;
  const { name, description, categoryId } = req.body;
  try {
    const subcategory = await prisma.subcategory.update({
      where: { id: parseInt(id) },
      data: {
        name,
        description,
        categoryId: categoryId ? parseInt(categoryId) : undefined
      }
    });
    res.json(subcategory);
  } catch (error) {
    console.error(`Error updating subcategory ${id}:`, error);
    if (error.code === 'P2025') {
      return res.status(404).json({ message: 'Subcategory not found' });
    }
     if (error.code === 'P2003') {
      return res.status(400).json({ message: 'Invalid categoryId provided' });
    }
    if (error.code === 'P2002') {
      return res.status(409).json({ message: `Subcategory name '${name}' already exists in this category` });
    }
    next(error);
  }
}

// Delete a subcategory
export async function deleteSubcategory (req, res, next) {
  const { id } = req.params;
  try {
    // Check if subcategory has products first
    const productCount = await prisma.product.count({
      where: { subcategoryId: parseInt(id) }
    });
    if (productCount > 0) {
      return res.status(400).json({ message: 'Cannot delete subcategory with existing products' });
    }
    await prisma.subcategory.delete({
      where: { id: parseInt(id) }
    });
    res.status(204).send();
  } catch (error) {
    console.error(`Error deleting subcategory ${id}:`, error);
    if (error.code === 'P2025') {
      return res.status(404).json({ message: 'Subcategory not found' });
    }
    next(error);
  }
}

// --- AI Application Discovery --- 

// @desc    Trigger AI discovery of applications for a specific product
// @route   POST /api/products/:productId/discover-applications
// @access  Private (Requires permission, e.g., 'research:create' or 'discover_applications')
export const triggerProductApplicationDiscovery = asyncHandler(async (req, res) => {
  const { productId: productIdString } = req.params;
  const productId = parseInt(productIdString, 10);
  let userId = req.user?.id; // Get user ID from authenticated request (e.g., set by authenticateToken)

  if (isNaN(productId)) {
    res.status(400);
    throw new Error('Invalid Product ID format.');
  }

  // Authentication check (even though middleware might be disabled temporarily)
  /* // Temporarily comment out the check since middleware is also commented out
  if (!userId) {
      res.status(401);
      // NOTE: This will fail if auth middleware is commented out in routes.
      //       We keep it here for when auth is re-enabled.
      throw new Error('User authentication required to discover applications.');
  }
  */

  try {
    // --- TEMPORARY FIX for disabled auth --- 
    // If userId is not available (because auth is off), fetch a default user ID
    let effectiveUserId = userId;
    if (!effectiveUserId) {
        // Attempt to find the first user (adjust logic if needed, e.g., find first admin)
        const defaultUser = await prisma.user.findFirst({
            orderBy: { id: 'asc' } // Or find where role = 'ADMIN'
        });
        if (!defaultUser) {
            // This should not happen in a populated system, but handle it
            res.status(500);
            throw new Error('Could not find a default user to assign ownership when authentication is disabled.');
        }
        effectiveUserId = defaultUser.id; 
        console.warn(`Authentication is disabled for discover-applications. Using default user ID ${effectiveUserId} for createdByUserId.`);
    }
    // --- END TEMPORARY FIX --- 

    // 1. Call the AI service to get potential applications
    const discoveredApplications = await discoverApplicationsForProduct(productId);

    if (!discoveredApplications || discoveredApplications.length === 0) {
      return res.status(200).json({ message: 'AI discovery process completed, but no new applications were identified or validated.', discoveredCount: 0 });
    }

    // 2. Prepare data for bulk creation
    const applicationsToCreate = discoveredApplications.map(app => ({
      applicationName: app.applicationName || 'Untitled Application', // Ensure required fields have defaults
      industrySector: app.industrySector,
      useCaseDescription: app.useCaseDescription,
      marketPotential: app.marketPotential,
      technicalRequirements: app.technicalRequirements,
      competitiveLandscape: app.competitiveLandscape,
      status: 'AI_DISCOVERED', // Set status to AI_DISCOVERED
      discoveredFromProductId: productId, // Link back to the product
      createdByUserId: effectiveUserId // Use the effectiveUserId (real or default)
      // Note: subcategoryId and productId (the general link) are not set here
    }));

    // 3. Create new research items in the database
    const creationResult = await prisma.industrialApplicationResearch.createMany({
      data: applicationsToCreate,
      skipDuplicates: true, // Skip if an identical AI_DISCOVERED item somehow already exists (optional)
    });

    res.status(201).json({ 
      message: `Successfully triggered AI discovery. ${creationResult.count} new research applications created with status AI_DISCOVERED.`, 
      discoveredCount: applicationsToCreate.length, // Total discovered by AI
      createdCount: creationResult.count // Actually created (after skipping duplicates)
    });

  } catch (error) {
    console.error(`Error during AI application discovery for product ${productId}:`, error);
    // Pass specific errors from AI service or DB
    if (error.message.includes('Product with ID') || error.message.includes('Failed to fetch product')) {
        res.status(404); 
    } else if (error.message.includes('AI response did not contain') || error.message.includes('Failed to parse AI response')) {
        res.status(502); // Bad Gateway - Error communicating with AI
    } else if (error.message.includes('Failed to discover applications via AI')) {
        res.status(500); // General AI service failure
    }
     else {
        res.status(500); // Default to server error
    }
    // Re-throw the error for the global error handler
    throw error; 
  }
}); 