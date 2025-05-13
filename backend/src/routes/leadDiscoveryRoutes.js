import express from 'express'
import {
  searchOrganizations,
  getOrganizationDetails,
  listDiscoveryServices
} from '../controllers/leadDiscoveryController.js'
import { authenticateToken } from '../middleware/authMiddleware.js'

const router = express.Router()

// Apply authentication middleware to all lead discovery routes
router.use(authenticateToken)

// GET /api/lead-discovery/services - List available lead discovery services
router.get('/services', listDiscoveryServices)

// GET /api/lead-discovery/search - Search for organizations by keywords
router.get('/search', searchOrganizations)

// GET /api/lead-discovery/organizations/:id - Get detailed information about an organization
router.get('/organizations/:id', getOrganizationDetails)

export default router 