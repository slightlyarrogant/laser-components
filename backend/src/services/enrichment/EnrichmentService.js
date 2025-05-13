import { PrismaClient } from '@prisma/client'
import { EnrichmentServiceFactory } from './EnrichmentServiceFactory.js'

const prisma = new PrismaClient()

/**
 * Main service for managing lead data enrichment operations
 */
export class EnrichmentService {
  /**
   * Create a new enrichment service
   * @param {Object} config - Configuration options
   */
  constructor(config = {}) {
    this.factory = config.factory || EnrichmentServiceFactory.createDefault(config)
    this.config = config
  }

  /**
   * Enrich a lead with additional data
   * @param {number} leadId - Lead ID to enrich
   * @param {Object} options - Enrichment options
   * @param {string} [options.serviceName] - Specific service to use, or default if not provided
   * @param {boolean} [options.overwriteExisting=false] - Whether to overwrite existing data
   * @param {boolean} [options.saveResult=true] - Whether to save the enrichment result to the database
   * @returns {Promise<Object>} - Enrichment result
   */
  async enrichLead(leadId, options = {}) {
    const {
      serviceName,
      overwriteExisting = false,
      saveResult = true
    } = options
    
    // Get service to use
    const service = serviceName 
      ? this.factory.getService(serviceName) 
      : this.factory.getDefaultService()
    
    if (!service) {
      throw new Error('No enrichment service available')
    }
    
    // Get the lead
    const lead = await prisma.lead.findUnique({
      where: { id: Number(leadId) }
    })
    
    if (!lead) {
      throw new Error(`Lead with ID ${leadId} not found`)
    }
    
    // Skip if already enriched and overwrite is false
    if (lead.lastEnriched && !overwriteExisting) {
      return {
        leadId,
        status: 'skipped',
        message: 'Lead already enriched and overwriteExisting is false',
        enriched: false
      }
    }
    
    try {
      // Perform enrichment
      const enrichmentData = await service.enrichLeadData(lead, options)
      
      // Calculate what fields are enriched
      const enrichedFields = this.determineEnrichedFields(lead, enrichmentData)
      
      // Calculate confidence score
      const confidence = enrichmentData.confidence || 0.7
      
      // Save enrichment data if requested
      if (saveResult) {
        await this.saveEnrichmentData(lead.id, enrichmentData, enrichedFields)
      }
      
      return {
        leadId: lead.id,
        status: 'success',
        serviceName: service.getName(),
        enrichedFields,
        confidence,
        enriched: true,
        data: enrichmentData
      }
    } catch (error) {
      // Log and return error
      console.error(`Lead enrichment error for lead ${leadId}:`, error)
      
      return {
        leadId: lead.id,
        status: 'error',
        message: error.message,
        serviceName: service.getName(),
        enriched: false
      }
    }
  }

  /**
   * Enrich multiple leads in batch
   * @param {Array<number>} leadIds - Lead IDs to enrich
   * @param {Object} options - Enrichment options
   * @param {string} [options.serviceName] - Specific service to use
   * @param {boolean} [options.overwriteExisting=false] - Whether to overwrite existing data
   * @param {boolean} [options.saveResult=true] - Whether to save the enrichment result
   * @param {number} [options.concurrency=3] - Number of concurrent enrichment operations
   * @param {number} [options.delayBetweenRequests=1000] - Delay between requests in milliseconds
   * @returns {Promise<Object>} - Batch enrichment result
   */
  async enrichLeadsBatch(leadIds, options = {}) {
    const {
      serviceName,
      overwriteExisting = false,
      saveResult = true,
      concurrency = 3,
      delayBetweenRequests = 1000
    } = options
    
    // Validate leadIds
    if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
      throw new Error('Invalid or empty leadIds array provided')
    }
    
    // Initialize results
    const results = {
      total: leadIds.length,
      success: 0,
      failed: 0,
      skipped: 0,
      details: []
    }
    
    // Create batches based on concurrency
    const batches = []
    for (let i = 0; i < leadIds.length; i += concurrency) {
      batches.push(leadIds.slice(i, i + concurrency))
    }
    
    // Process batches sequentially to avoid rate limiting
    for (const batch of batches) {
      // Process each batch in parallel up to concurrency limit
      const batchPromises = batch.map(async (leadId) => {
        const result = await this.enrichLead(leadId, {
          serviceName,
          overwriteExisting,
          saveResult
        })
        
        // Update results
        if (result.status === 'success') {
          results.success++
        } else if (result.status === 'skipped') {
          results.skipped++
        } else {
          results.failed++
        }
        
        // Add to details
        results.details.push({
          leadId,
          status: result.status,
          message: result.message,
          serviceName: result.serviceName,
          enrichedFields: result.enrichedFields
        })
        
        return result
      })
      
      // Wait for batch to complete
      await Promise.all(batchPromises)
      
      // Delay between batches to avoid rate limiting
      if (delayBetweenRequests > 0 && batches.indexOf(batch) < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, delayBetweenRequests))
      }
    }
    
    return results
  }

  /**
   * Get enrichment service status information
   * @returns {Promise<Object>} - Status of enrichment services
   */
  async getStatus() {
    return this.factory.getServicesStatus()
  }

  /**
   * Determine which fields were enriched
   * @param {Object} originalLead - Original lead data
   * @param {Object} enrichmentData - Enrichment data
   * @returns {Array<string>} - Array of enriched field names
   */
  determineEnrichedFields(originalLead, enrichmentData) {
    const enrichedFields = []
    
    // Fields to check
    const fieldsToCheck = [
      'industry',
      'website',
      'location',
      'description',
      'employeeCount',
      'annualRevenue',
      'foundedYear',
      'linkedInUrl'
    ]
    
    // Check each field
    for (const field of fieldsToCheck) {
      // If original is empty/null and enrichment has value
      if (
        (!originalLead[field] || originalLead[field] === '') && 
        enrichmentData[field] && 
        enrichmentData[field] !== ''
      ) {
        enrichedFields.push(field)
      }
    }
    
    return enrichedFields
  }

  /**
   * Save enrichment data to the database
   * @param {number} leadId - Lead ID
   * @param {Object} enrichmentData - Enrichment data
   * @param {Array<string>} enrichedFields - Fields that were enriched
   * @returns {Promise<Object>} - Updated lead
   */
  async saveEnrichmentData(leadId, enrichmentData, enrichedFields) {
    // Create update data object
    const updateData = {
      lastEnriched: new Date()
    }
    
    // Add enriched fields to update data
    for (const field of enrichedFields) {
      // Skip if field doesn't exist in enrichmentData
      if (enrichmentData[field] === undefined) continue
      
      // Handle special case - tags is an array
      if (field === 'tags' && Array.isArray(enrichmentData.tags)) {
        // Merge tags instead of replacing
        updateData.tags = {
          push: enrichmentData.tags
        }
      } else {
        updateData[field] = enrichmentData[field]
      }
    }
    
    // Update lead in database
    return prisma.lead.update({
      where: { id: Number(leadId) },
      data: updateData
    })
  }
} 