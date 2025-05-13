import express from 'express';
import {
  createResearch,
  getAllResearch,
  getResearchById,
  updateResearch,
  deleteResearch,
  addCollaborator,
  removeCollaborator,
  addAttachment,
  removeAttachment,
  generateResearchSummary,
  generateResearchRecommendations,
  getOnlineResearch,
  createResearchFromTopic,
  getResearchHistory,
  exportResearchCsv,
  getResearchStatusCounts,
  approveResearch,
  rejectResearch,
  discoverLeadsForResearch
} from '../controllers/industrialResearchController.js';
import { authenticateToken, authorizePermission } from '../middleware/authMiddleware.js'; // Import auth middleware

const router = express.Router();

// --- Public Research Routes (Temporarily Public for Dashboard Stats) ---
// Route for Stats
// NOTE: Moved above authenticateToken to make it public temporarily
router.get('/stats/status-counts', getResearchStatusCounts);

// Apply authentication middleware to all routes below
// router.use(authenticateToken); // <-- Commented out temporarily

// --- Protected Research Routes (Temporarily PUBLIC) ---

// Routes for IndustrialApplicationResearch
router.route('/')
  .post(/* authenticateToken, authorizePermission('research', 'create'), */ createResearch)
  .get(/* authenticateToken, authorizePermission('research', 'read'), */ getAllResearch);

router.route('/:id')
  .get(/* authenticateToken, authorizePermission('research', 'read'), */ getResearchById)
  .put(/* authenticateToken, authorizePermission('research', 'update'), */ updateResearch)
  .delete(/* authenticateToken, authorizePermission('research', 'delete'), */ deleteResearch);

// Routes for Collaborators
router.route('/:id/collaborators')
  .post(/* authenticateToken, authorizePermission('research', 'update'), */ addCollaborator);

// Routes for Attachments
router.post('/:id/attachments', /* authorizePermission('research', 'manage_attachments'), */ addAttachment);             // Add an attachment
router.delete('/:id/attachments/:attachmentId', /* authorizePermission('research', 'manage_attachments'), */ removeAttachment); // Remove an attachment

// Routes for AI Integration
router.post('/online-search', /* authorizePermission('research', 'use_ai'), */ getOnlineResearch);

// Reuse existing AI endpoints for summary/recommendations if they exist in controller
router.post('/:id/generate-summary', /* authorizePermission('research', 'use_ai'), */ generateResearchSummary);
router.post('/:id/generate-recommendations', /* authorizePermission('research', 'use_ai'), */ generateResearchRecommendations);

router.post('/ai-create', /* authorizePermission('research', 'create'), */ createResearchFromTopic);

// Route for Version History
router.get('/:id/history', /* authenticateToken, authorizePermission('research', 'read'), */ getResearchHistory);

// Route for Export
router.get('/export/csv', /* authenticateToken, authorizePermission('research', 'read'), */ exportResearchCsv);

// --- Review Action Routes ---
router.route('/:id/approve')
  .put(/* authenticateToken, authorizePermission('research', 'update'), */ approveResearch);

router.route('/:id/reject')
  .put(/* authenticateToken, authorizePermission('research', 'update'), */ rejectResearch);

// --- Lead Discovery Route ---
router.post('/:researchId/discover-leads',
    // authenticateToken, // Add auth middleware back later
    // authorizePermission('lead', 'create'), // Add permission check later
    discoverLeadsForResearch
);

// TODO: Add routes for attachments

export default router; 