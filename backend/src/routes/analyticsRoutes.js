import express from 'express'
import {
  getMetricValues,
  getAggregatedMetrics,
  calculateProductCoverage,
  calculateLeadConversion,
  calculateTimeToLead,
  aggregateMetrics,
  getActivityLogs,
  getUserActivitySummary,
  getDashboardOverview
} from '../controllers/analyticsController.js'
import { authenticateToken, authorizeRoles } from '../middleware/authMiddleware.js'

const router = express.Router()

// Apply authentication middleware to all analytics routes
// router.use(authenticateToken) // REMOVED: Apply auth individually

// Dashboard overview - available to all users (Public for now)
router.get('/dashboard', getDashboardOverview)

// Metrics endpoints - Admin and Researcher only (Protected)
router.get('/metrics/:metricName', authenticateToken, authorizeRoles(['ADMIN', 'RESEARCHER']), getMetricValues) // Added authenticateToken
router.get('/metrics/:metricName/aggregated', authenticateToken, authorizeRoles(['ADMIN', 'RESEARCHER']), getAggregatedMetrics) // Added authenticateToken

// Calculation endpoints - Admin only (Protected)
router.post('/calculate/product-coverage', authenticateToken, authorizeRoles(['ADMIN']), calculateProductCoverage) // Added authenticateToken
router.post('/calculate/lead-conversion', authenticateToken, authorizeRoles(['ADMIN']), calculateLeadConversion) // Added authenticateToken
router.post('/calculate/time-to-lead/:leadId', authenticateToken, authorizeRoles(['ADMIN']), calculateTimeToLead) // Added authenticateToken
router.post('/calculate/time-to-lead/:leadId/:applicationId', authenticateToken, authorizeRoles(['ADMIN']), calculateTimeToLead) // Added authenticateToken
router.post('/aggregate/:metricName', authenticateToken, authorizeRoles(['ADMIN']), aggregateMetrics) // Added authenticateToken

// Activity logs - Admin only (Protected)
router.get('/activity-logs', authenticateToken, authorizeRoles(['ADMIN']), getActivityLogs) // Added authenticateToken
router.get('/activity-logs/user/:userId', authenticateToken, authorizeRoles(['ADMIN']), getUserActivitySummary) // Added authenticateToken

// Allow users to see their own activity (Protected)
router.get('/my-activity', authenticateToken, (req, res, next) => { // Added authenticateToken and next
  // Ensure user object exists from authenticateToken
  if (!req.user || !req.user.id) {
    return res.status(401).json({ message: 'Authentication required' });
  }
  req.params.userId = req.user.id;
  // Call the controller function
  getUserActivitySummary(req, res, next); 
})

export default router 