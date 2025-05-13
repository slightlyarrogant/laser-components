import { EnrichmentService } from '../services/enrichment/EnrichmentService.js'
import dotenv from 'dotenv'
import { LeadEnrichmentService } from '../services/lead/LeadEnrichmentService.js'

// Load environment variables if not already loaded
dotenv.config()

// Create the enrichment service with configuration from environment variables
const enrichmentService = new EnrichmentService({
  // Common configuration
  mockDelayMs: 800,
  mockErrorRate: 0.05,
  
  // Clearbit configuration
  clearbitApiKey: process.env.CLEARBIT_API_KEY,
  clearbitTimeout: parseInt(process.env.CLEARBIT_TIMEOUT || '10000', 10),
  clearbitRateLimitDelay: parseInt(process.env.CLEARBIT_RATE_LIMIT_DELAY || '1000', 10),
  useClearbitAsDefault: process.env.DEFAULT_ENRICHMENT_SERVICE === 'clearbit',
  
  // LinkedIn configuration
  linkedinApiKey: process.env.LINKEDIN_API_KEY,
  linkedinBaseUrl: process.env.LINKEDIN_API_URL,
  linkedinTimeout: parseInt(process.env.LINKEDIN_TIMEOUT || '10000', 10),
  linkedinRateLimitDelay: parseInt(process.env.LINKEDIN_RATE_LIMIT_DELAY || '1000', 10),
  useLinkedInAsDefault: process.env.DEFAULT_ENRICHMENT_SERVICE === 'linkedin'
})

const leadEnrichmentService = new LeadEnrichmentService()

/**
 * Get enrichment service status
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const getEnrichmentStatus = async (req, res) => {
  try {
    const status = await enrichmentService.getStatus()
    
    res.json({
      success: true,
      data: status
    })
  } catch (error) {
    console.error('Error getting enrichment status:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to get enrichment service status'
    })
  }
}

/**
 * Enrich a single lead
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const enrichLead = async (req, res) => {
  try {
    const { id } = req.params
    
    // Get options from query params
    const options = {
      serviceName: req.query.service,
      overwriteExisting: req.query.overwrite === 'true',
      saveResult: req.query.save !== 'false'
    }
    
    const result = await enrichmentService.enrichLead(id, options)
    
    res.json({
      success: result.status === 'success',
      data: result
    })
  } catch (error) {
    console.error('Error enriching lead:', error)
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to enrich lead'
    })
  }
}

/**
 * Enrich multiple leads in batch
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const enrichLeadsBatch = async (req, res) => {
  try {
    const { leadIds } = req.body
    
    if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or empty leadIds array'
      })
    }
    
    // Get options from request body or query params
    const options = {
      serviceName: req.body.service || req.query.service,
      overwriteExisting: req.body.overwrite === true || req.query.overwrite === 'true',
      saveResult: req.body.save !== false && req.query.save !== 'false',
      concurrency: parseInt(req.body.concurrency || req.query.concurrency || '3', 10),
      delayBetweenRequests: parseInt(req.body.delay || req.query.delay || '1000', 10)
    }
    
    // Start the batch job asynchronously
    const batchJob = enrichmentService.enrichLeadsBatch(leadIds, options)
    
    // Return an immediate response
    res.json({
      success: true,
      message: `Started batch enrichment of ${leadIds.length} leads`,
      jobInfo: {
        leadsCount: leadIds.length,
        options: {
          serviceName: options.serviceName || 'default',
          overwriteExisting: options.overwriteExisting,
          concurrency: options.concurrency,
          delayBetweenRequests: options.delayBetweenRequests
        }
      }
    })
    
    // Log completion (but don't hold up the response)
    batchJob.then(result => {
      console.log(`Batch enrichment complete: ${result.success} succeeded, ${result.failed} failed, ${result.skipped} skipped`)
    }).catch(error => {
      console.error('Batch enrichment error:', error)
    })
  } catch (error) {
    console.error('Error starting batch enrichment:', error)
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to start batch enrichment'
    })
  }
}

/**
 * Test enrichment with a sample lead
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const testEnrichment = async (req, res) => {
  try {
    const { name, website, email, location } = req.body
    
    if (!name && !website && !email) {
      return res.status(400).json({
        success: false,
        error: 'At least one of name, website, or email is required'
      })
    }
    
    // Create a test lead object
    const testLead = {
      id: -1, // Use -1 for testing as it won't be saved
      name: name || '',
      website: website || '',
      email: email || '',
      location: location || ''
    }
    
    // Get options from query params
    const options = {
      serviceName: req.query.service,
      saveResult: false // Don't save test results
    }
    
    // Get service to use
    const service = options.serviceName 
      ? enrichmentService.factory.getService(options.serviceName) 
      : enrichmentService.factory.getDefaultService()
    
    if (!service) {
      return res.status(400).json({
        success: false,
        error: 'No enrichment service available'
      })
    }
    
    // Perform enrichment directly to avoid database access
    const enrichmentData = await service.enrichLeadData(testLead, options)
    
    res.json({
      success: true,
      data: {
        original: testLead,
        enriched: enrichmentData,
        serviceName: service.getName()
      }
    })
  } catch (error) {
    console.error('Error testing enrichment:', error)
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to test enrichment'
    })
  }
}

/**
 * Create a new enrichment batch
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const createEnrichmentBatch = async (req, res, next) => {
  try {
    const { leadIds, name, description } = req.body;
    
    if (!Array.isArray(leadIds) || leadIds.length === 0) {
      return res.status(400).json({
        message: 'leadIds array is required and must contain at least one ID'
      });
    }
    
    // Create batch with user info
    const batch = await leadEnrichmentService.createBatch(leadIds, {
      name,
      description,
      createdBy: req.user?.email || 'system'
    });
    
    res.status(201).json({
      message: `Enrichment batch created with ${leadIds.length} leads`,
      batch
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all enrichment batches with pagination and filtering
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const getEnrichmentBatches = async (req, res, next) => {
  try {
    const batches = await leadEnrichmentService.getBatches({
      page: req.query.page,
      limit: req.query.limit,
      status: req.query.status
    });
    
    res.json(batches);
  } catch (error) {
    next(error);
  }
};

/**
 * Get a single enrichment batch with detailed statistics
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const getEnrichmentBatchById = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const batch = await leadEnrichmentService.getBatchById(id);
    
    res.json(batch);
  } catch (error) {
    if (error.message.includes('not found')) {
      return res.status(404).json({ message: error.message });
    }
    next(error);
  }
};

/**
 * Cancel an enrichment batch
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const cancelEnrichmentBatch = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const batch = await leadEnrichmentService.cancelBatch(id);
    
    res.json({
      message: `Batch ${id} canceled successfully`,
      batch
    });
  } catch (error) {
    if (error.message.includes('not found')) {
      return res.status(404).json({ message: error.message });
    }
    if (error.message.includes('cannot be canceled')) {
      return res.status(400).json({ message: error.message });
    }
    next(error);
  }
};

/**
 * Restart a failed enrichment job
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const restartEnrichmentJob = async (req, res, next) => {
  try {
    const { jobId } = req.params;
    
    const job = await leadEnrichmentService.restartJob(jobId);
    
    res.json({
      message: `Job ${jobId} restarted successfully`,
      job
    });
  } catch (error) {
    if (error.message.includes('not found')) {
      return res.status(404).json({ message: error.message });
    }
    if (error.message.includes('cannot be restarted')) {
      return res.status(400).json({ message: error.message });
    }
    next(error);
  }
}; 