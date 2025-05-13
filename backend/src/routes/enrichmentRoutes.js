import express from 'express'
import {
  getEnrichmentStatus,
  enrichLead,
  testEnrichment,
  createEnrichmentBatch,
  getEnrichmentBatches,
  getEnrichmentBatchById,
  cancelEnrichmentBatch,
  restartEnrichmentJob
} from '../controllers/enrichmentController.js'
import { authenticateToken } from '../middleware/authMiddleware.js'

const router = express.Router()

// Apply authentication middleware to all enrichment routes
router.use(authenticateToken)

// GET /api/enrichment/status - Get enrichment service status
router.get('/status', getEnrichmentStatus)

// POST /api/enrichment/lead/:id - Enrich a single lead
router.post('/lead/:id', enrichLead)

// POST /api/enrichment/test - Test enrichment with sample data
router.post('/test', testEnrichment)

// Batch Processing System Routes (Task 6.5)

// Create a new enrichment batch
router.post('/batch', createEnrichmentBatch)

// Get all enrichment batches with optional filtering
router.get('/batch', getEnrichmentBatches)

// Get enrichment batch by ID with detailed stats
router.get('/batch/:id', getEnrichmentBatchById)

// Cancel an in-progress batch
router.post('/batch/:id/cancel', cancelEnrichmentBatch)

// Restart a failed job
router.post('/job/:jobId/restart', restartEnrichmentJob)

export default router 