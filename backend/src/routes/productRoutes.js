import express from 'express'
import {
  getAllProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  getAllCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
  getSubcategoriesForCategory,
  getAllSubcategories,
  getSubcategoryById,
  createSubcategory,
  updateSubcategory,
  deleteSubcategory,
  triggerProductApplicationDiscovery
} from '../controllers/productController.js'
import {
  authenticateToken,
  authorizeRoles,
  authorizePermission
} from '../middleware/authMiddleware.js'
import { body, param } from 'express-validator'

// Use dynamic import for the CJS module
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { handleValidationErrors } = require('../middleware/validationMiddleware.cjs')

import multer from 'multer'

const router = express.Router()

// Configure Multer for file uploads (store in memory for parsing)
const upload = multer({ storage: multer.memoryStorage() })

// Validation rules
const productIdValidation = [
  param('id').isInt({ min: 1 }).withMessage('Product ID must be a positive integer')
]

const productBodyValidation = [
  body('name').trim().notEmpty().withMessage('Product name is required'),
  body('subcategoryId').isInt({ min: 1 }).withMessage('Valid Subcategory ID is required'),
  body('sku').optional().trim().notEmpty().withMessage('SKU cannot be empty if provided'),
  body('price').optional().isFloat({ gt: 0 }).withMessage('Price must be a positive number'),
  body('specifications').optional().isJSON().withMessage('Specifications must be valid JSON'),
  body('datasheetUrl').optional().isURL().withMessage('Datasheet URL must be a valid URL')
]

// Category Validation
const categoryIdValidation = [
  param('id').isInt({ min: 1 }).withMessage('Category ID must be a positive integer')
];

const categoryBodyValidation = [
  body('name').trim().notEmpty().withMessage('Category name is required')
];

// Subcategory Validation
const subcategoryIdValidation = [
  param('id').isInt({ min: 1 }).withMessage('Subcategory ID must be a positive integer')
];

const subcategoryBodyValidation = [
  body('name').trim().notEmpty().withMessage('Subcategory name is required'),
  body('categoryId').isInt({ min: 1 }).withMessage('Valid Category ID is required')
];

// Validation rules
const productIdParamValidation = [
  param('productId').isInt({ min: 1 }).withMessage('Product ID must be a positive integer in the URL parameter')
];

// --- Public Product Routes ---
// GET /api/products - List all products
router.get(
  '/products',
  // authenticateToken, // Temporarily allow public access
  getAllProducts
)

// GET /api/products/:id - Get a single product
router.get(
  '/products/:id',
  // authenticateToken, // Temporarily allow public access
  productIdValidation,
  handleValidationErrors,
  getProductById
)

// --- Protected Product Routes ---
// POST /api/products - Create a new product (Admin/Researcher) - Stays protected
router.post(
  '/products',
  authenticateToken,
  authorizeRoles('ADMIN', 'RESEARCHER'),
  productBodyValidation,
  handleValidationErrors,
  createProduct
)

// POST /api/products/bulk-upload - Upload CSV for bulk import (Admin/Researcher)
// Commenting out since bulkUploadProducts function is not defined yet
// router.post(
//   '/bulk-upload',
//   authenticateToken,
//   authorizeRoles('ADMIN', 'RESEARCHER'),
//   upload.single('productFile'), // Expect a single file field named 'productFile'
//   bulkUploadProducts // New controller function needed
// )

// PUT /api/products/:id - Update a product (Admin/Researcher) - Stays protected
router.put(
  '/products/:id',
  authenticateToken,
  authorizeRoles('ADMIN', 'RESEARCHER'),
  productIdValidation,
  productBodyValidation,
  handleValidationErrors,
  updateProduct
)

// DELETE /api/products/:id - Delete a product (Admin only) - Stays protected
router.delete(
  '/products/:id',
  authenticateToken,
  authorizeRoles('ADMIN'),
  productIdValidation,
  handleValidationErrors,
  deleteProduct
)

// --- AI Application Discovery Route ---
// POST /api/products/:productId/discover-applications - Trigger AI discovery (Researcher/Admin)
router.post(
  '/products/:productId/discover-applications',
  // authenticateToken, // Add auth check (will be re-enabled later)
  // authorizeRoles('ADMIN', 'RESEARCHER'), // Alternative: Use roles
  // authorizePermission('research', 'create'), // Use permission-based check
  productIdParamValidation, // Validate the productId from the URL
  handleValidationErrors,
  triggerProductApplicationDiscovery
);

// --- Category Routes ---
// GET /api/categories - List all categories (Public)
router.get('/categories', /* authenticateToken, */ getAllCategories); // Temporarily allow public access

// GET /api/categories/:id - Get a single category (Public)
router.get('/categories/:id', /* authenticateToken, */ categoryIdValidation, handleValidationErrors, getCategoryById); // Temporarily allow public access

// POST /api/categories - Create a new category (Admin/Researcher) - Stays protected
router.post('/categories', authenticateToken, authorizeRoles('ADMIN', 'RESEARCHER'), categoryBodyValidation, handleValidationErrors, createCategory);

// PUT /api/categories/:id - Update a category (Admin/Researcher) - Stays protected
router.put('/categories/:id', authenticateToken, authorizeRoles('ADMIN', 'RESEARCHER'), categoryIdValidation, categoryBodyValidation, handleValidationErrors, updateCategory);

// DELETE /api/categories/:id - Delete a category (Admin only) - Stays protected
router.delete('/categories/:id', authenticateToken, authorizeRoles('ADMIN'), categoryIdValidation, handleValidationErrors, deleteCategory);

// GET /api/categories/:categoryId/subcategories - Get subcategories for a category (Public)
router.get('/categories/:categoryId/subcategories', /* authenticateToken, */ [param('categoryId').isInt({ min: 1 })], handleValidationErrors, getSubcategoriesForCategory); // Temporarily allow public access

// --- Subcategory Routes ---
// GET /api/subcategories - List all subcategories (Public)
router.get('/subcategories', /* authenticateToken, */ getAllSubcategories); // Temporarily allow public access

// GET /api/subcategories/:id - Get a single subcategory (Public)
router.get('/subcategories/:id', /* authenticateToken, */ subcategoryIdValidation, handleValidationErrors, getSubcategoryById); // Temporarily allow public access

// POST /api/subcategories - Create a new subcategory (Admin/Researcher) - Stays protected
router.post('/subcategories', authenticateToken, authorizeRoles('ADMIN', 'RESEARCHER'), subcategoryBodyValidation, handleValidationErrors, createSubcategory);

// PUT /api/subcategories/:id - Update a subcategory (Admin/Researcher) - Stays protected
router.put('/subcategories/:id', authenticateToken, authorizeRoles('ADMIN', 'RESEARCHER'), subcategoryIdValidation, subcategoryBodyValidation, handleValidationErrors, updateSubcategory);

// DELETE /api/subcategories/:id - Delete a subcategory (Admin only) - Stays protected
router.delete('/subcategories/:id', authenticateToken, authorizeRoles('ADMIN'), subcategoryIdValidation, handleValidationErrors, deleteSubcategory);

export default router 