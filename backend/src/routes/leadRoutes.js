import express from 'express'
import {
  getLeads,
  getLeadById,
  createLead,
  updateLead,
  deleteLead,
  saveSearchResultsAsLeads,
  tagLeads,
  updateLeadStatus,
  findDuplicateLeads,
  mergeLeads,
  scoreLead,
  scoreLeads,
  getScoredLeads,
  overrideLeadScore,
  getLeadScoreOverride,
  removeLeadScoreOverride,
  overrideLeadData,
  exportLeads
} from '../controllers/leadController.js'
import { 
  authenticateToken,
  authorizePermission,
  authorizeOwnerOrAdmin 
} from '../middleware/authMiddleware.js'
import { activityLogMiddleware } from '../middleware/activityLogMiddleware.js'

const router = express.Router()

// router.use(authenticateToken) // REMOVED: Apply auth individually

// GET /api/leads - Get all leads with optional filtering (Public for now)
router.get('/', 
  // authenticateToken, // Removed for public access
  // authorizePermission('leads', 'read'), // Also remove permission check for public access
  activityLogMiddleware.list('lead'),
  getLeads
)

// GET /api/leads/:id - Get lead by ID (Public for now)
router.get('/:id', 
  // authenticateToken, // Removed for public access
  // authorizePermission('leads', 'read'), // Also remove permission check for public access
  activityLogMiddleware.view('lead', 'id'),
  getLeadById
)

// POST /api/leads - Create a new lead (Protected)
router.post('/', 
  authenticateToken, // Added
  authorizePermission('leads', 'create'), 
  activityLogMiddleware.create('lead'),
  createLead
)

// PUT /api/leads/:id - Update a lead (Protected)
router.put('/:id', 
  authenticateToken, // Added
  authorizePermission('leads', 'update'), 
  activityLogMiddleware.update('lead', 'id'),
  updateLead
)

// DELETE /api/leads/:id - Delete a lead (Protected)
router.delete('/:id', 
  authenticateToken, // Added
  authorizePermission('leads', 'delete'), 
  activityLogMiddleware.delete('lead', 'id'),
  deleteLead
)

// POST /api/leads/from-search - Save search results as leads (Protected)
router.post('/from-search', 
  authenticateToken, // Added
  authorizePermission('leads', 'create'),
  activityLogMiddleware.custom('create_from_search', 'lead', null, 
    (req) => ({ searchParams: req.body.searchParams, count: req.body.results?.length })
  ),
  saveSearchResultsAsLeads
)

// POST /api/leads/tag - Tag multiple leads (Protected)
router.post('/tag', 
  authenticateToken, // Added
  authorizePermission('leads', 'update'),
  activityLogMiddleware.custom('tag', 'lead', 
    (req) => req.body.leadIds?.join(','),
    (req) => ({ tags: req.body.tags })
  ),
  tagLeads
)

// POST /api/leads/status - Bulk update lead status (Protected)
router.post('/status', 
  authenticateToken, // Added
  authorizePermission('leads', 'update'),
  activityLogMiddleware.custom('update_status', 'lead',
    (req) => req.body.leadIds?.join(','),
    (req) => ({ status: req.body.status })
  ),
  updateLeadStatus
)

// GET /api/leads/duplicates - Find duplicate leads (Protected)
router.get('/duplicates', 
  authenticateToken, // Added
  authorizePermission('leads', 'read'),
  activityLogMiddleware.custom('find_duplicates', 'lead', null, 
    (req) => ({ criteria: req.query })
  ),
  findDuplicateLeads
)

// POST /api/leads/merge - Merge multiple leads (Protected)
router.post('/merge', 
  authenticateToken, // Added
  authorizePermission('leads', 'update'),
  activityLogMiddleware.custom('merge', 'lead',
    (req) => req.body.leadIds?.join(','),
    (req) => ({ primaryLeadId: req.body.primaryLeadId })
  ),
  mergeLeads
)

// Lead Scoring Routes (Protected)

// GET /api/leads/scoring/scored - Get leads with scores
router.get('/scoring/scored', 
  // authenticateToken, // Commented out for testing
  // authorizePermission('leads', 'read'), // Commented out for testing
  activityLogMiddleware.custom('view_scored', 'lead', null, 
    (req) => ({ filters: req.query })
  ),
  getScoredLeads
)

// POST /api/leads/:id/score - Score a single lead
router.post('/:id/score', 
  authenticateToken, // Added
  authorizePermission('leads', 'update'),
  activityLogMiddleware.custom('score', 'lead', 'id'),
  scoreLead
)

// POST /api/leads/score/batch - Score multiple leads
router.post('/score/batch', 
  authenticateToken, // Added
  authorizePermission('leads', 'update'),
  activityLogMiddleware.custom('score_batch', 'lead',
    (req) => req.body.leadIds?.join(',')
  ),
  scoreLeads
)

// Manual Override Routes (Protected)

// POST /api/leads/:id/score/override - Override a lead's score
router.post('/:id/score/override', 
  authenticateToken, // Added
  authorizePermission('leads', 'update'),
  activityLogMiddleware.custom('override_score', 'lead', 'id',
    (req) => ({ score: req.body.score, components: req.body.componentOverrides })
  ),
  overrideLeadScore
)

// GET /api/leads/:id/score/override - Get a lead's score override information
router.get('/:id/score/override', 
  authenticateToken, // Added
  authorizePermission('leads', 'read'),
  activityLogMiddleware.custom('view_score_override', 'lead', 'id'),
  getLeadScoreOverride
)

// DELETE /api/leads/:id/score/override - Remove a lead's score override
router.delete('/:id/score/override', 
  authenticateToken, // Added
  authorizePermission('leads', 'update'),
  activityLogMiddleware.custom('remove_score_override', 'lead', 'id'),
  removeLeadScoreOverride
)

// POST /api/leads/:id/data/override - Override lead data fields
router.post('/:id/data/override', 
  authenticateToken, // Added
  authorizePermission('leads', 'update'),
  activityLogMiddleware.custom('override_data', 'lead', 'id',
    (req) => ({ fields: Object.keys(req.body.data) })
  ),
  overrideLeadData
)

// POST /api/leads/export - Export leads to CSV/Excel (Protected)
router.post('/export', 
  authenticateToken, // Added
  authorizePermission('leads', 'export'),
  activityLogMiddleware.custom('export', 'lead', null,
    (req) => ({ format: req.body.format, count: req.body.leadIds?.length })
  ),
  exportLeads
)

export default router 