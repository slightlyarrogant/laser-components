import express from 'express'
import {
  getAllApplications,
  getApplicationById,
  createApplication,
  updateApplication,
  deleteApplication,
  getMappedProducts,
  mapProductsToApplication,
  unmapProductFromApplication
} from '../controllers/applicationController.js'
import {
  authenticateToken,
  authorizeRoles
} from '../middleware/authMiddleware.js'
import { body, param } from 'express-validator'

// Use dynamic import for the CJS module
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { handleValidationErrors } = require('../middleware/validationMiddleware.cjs')

const router = express.Router()

// --- Validation Rules ---
const applicationIdValidation = [
  param('id').isInt({ min: 1 }).withMessage('Application ID must be a positive integer')
]

const productIdParamValidation = [
  param('productId').isInt({ min: 1 }).withMessage('Product ID must be a positive integer')
]

const applicationBodyValidation = [
  body('name').trim().notEmpty().withMessage('Application name is required'),
  body('status').optional().isIn(['ACTIVE', 'INACTIVE']).withMessage('Status must be ACTIVE or INACTIVE')
]

const mappingBodyValidation = [
  body('productIds').isArray({ min: 1 }).withMessage('productIds must be a non-empty array'),
  body('productIds.*').isInt({ min: 1 }).withMessage('Each product ID must be a positive integer')
]

// --- Application CRUD Routes ---
// GET /api/applications
router.get('/', /* authenticateToken, */ getAllApplications) // Temporarily allow public access

// GET /api/applications/:id
router.get(
  '/:id',
  // authenticateToken, // Temporarily allow public access
  applicationIdValidation,
  handleValidationErrors,
  getApplicationById
)

// POST /api/applications (Admin/Researcher)
router.post(
  '/',
  authenticateToken,
  authorizeRoles('ADMIN', 'RESEARCHER'),
  applicationBodyValidation,
  handleValidationErrors,
  createApplication
)

// PUT /api/applications/:id (Admin/Researcher)
router.put(
  '/:id',
  authenticateToken,
  authorizeRoles('ADMIN', 'RESEARCHER'),
  applicationIdValidation,
  applicationBodyValidation,
  handleValidationErrors,
  updateApplication
)

// DELETE /api/applications/:id (Admin only)
router.delete(
  '/:id',
  authenticateToken,
  authorizeRoles('ADMIN'),
  applicationIdValidation,
  handleValidationErrors,
  deleteApplication
)

// --- Product Mapping Routes --- 

// GET /api/applications/:id/products (Get products mapped to this application)
router.get(
  '/:id/products',
  // authenticateToken, // Temporarily allow public access
  applicationIdValidation,
  handleValidationErrors,
  getMappedProducts
)

// POST /api/applications/:id/products (Map products to this application - batch) (Admin/Researcher)
router.post(
  '/:id/products',
  authenticateToken,
  authorizeRoles('ADMIN', 'RESEARCHER'),
  applicationIdValidation,
  mappingBodyValidation,
  handleValidationErrors,
  mapProductsToApplication
)

// DELETE /api/applications/:id/products/:productId (Unmap a specific product) (Admin/Researcher)
router.delete(
  '/:id/products/:productId',
  authenticateToken,
  authorizeRoles('ADMIN', 'RESEARCHER'),
  applicationIdValidation,
  productIdParamValidation,
  handleValidationErrors,
  unmapProductFromApplication
)

export default router 