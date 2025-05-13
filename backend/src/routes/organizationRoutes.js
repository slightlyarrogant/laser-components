import express from 'express'
import {
  searchOrganizations,
  getOrganizationDetails
} from '../controllers/organizationController.js'
import {
  authenticateToken,
  authorizeRoles
} from '../middleware/authMiddleware.js'
import { query, param } from 'express-validator'

// Use dynamic import for the CJS module
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { handleValidationErrors } = require('../middleware/validationMiddleware.cjs')

import { cacheMiddleware } from '../middleware/cacheMiddleware.js'

const router = express.Router()

// --- Validation Rules ---
const searchValidation = [
  query('applicationId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Application ID must be a positive integer'),
  query('regionId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Region ID must be a positive integer'),
  query('countryId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Country ID must be a positive integer'),
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
]

const organizationIdValidation = [
  param('id')
    .isString()
    .notEmpty()
    .withMessage('Organization ID is required')
]

// Cache configuration for organization routes
const searchCacheOptions = {
  ttl: 1800000, // 30 minutes in milliseconds
  maxSize: 200 // Store up to 200 different search results
};

const detailsCacheOptions = {
  ttl: 3600000, // 1 hour in milliseconds
  maxSize: 500 // Store up to 500 different organization details
};

// --- Organization Routes ---

// GET /api/organizations/search
// Search for organizations by application keywords and region
router.get(
  '/search',
  authenticateToken,
  searchValidation,
  handleValidationErrors,
  cacheMiddleware('organizationSearch', searchCacheOptions),
  searchOrganizations
)

// GET /api/organizations/:id
// Get details for a specific organization
router.get(
  '/:id',
  authenticateToken,
  organizationIdValidation,
  handleValidationErrors,
  cacheMiddleware('organizationDetails', detailsCacheOptions),
  getOrganizationDetails
)

export default router 