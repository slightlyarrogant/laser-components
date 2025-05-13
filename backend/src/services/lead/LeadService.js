import { PrismaClient } from '@prisma/client'
import { LeadDuplicateDetector } from './LeadDuplicateDetector.js'
import { LeadScoringService } from './LeadScoringService.js'

const prisma = new PrismaClient()

/**
 * Service for managing leads and duplicate detection
 */
export class LeadService {
  constructor(config = {}) {
    this.duplicateDetector = new LeadDuplicateDetector(config.duplicateDetectorConfig || {})
    this.scoringService = new LeadScoringService(config.scoringConfig || {})
  }

  /**
   * Get a lead by ID
   * @param {number} id - Lead ID
   * @returns {Promise<Object|null>} - Lead object or null if not found
   */
  async getLeadById(id) {
    return prisma.lead.findUnique({
      where: { id: Number(id) },
      include: {
        product: true,
        application: true,
        region: true,
        country: true
      }
    })
  }

  /**
   * Get leads with filtering and pagination
   * @param {Object} options - Query options
   * @returns {Promise<Object>} - Leads with pagination metadata
   */
  async getLeads(options = {}) {
    const {
      status,
      productId,
      applicationId,
      regionId,
      countryId,
      industry,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortDir = 'desc'
    } = options

    // Build where clause for filtering
    const where = {}

    // Add filters if provided
    if (status) where.status = status
    if (productId) where.productId = Number(productId)
    if (applicationId) where.applicationId = Number(applicationId)
    if (regionId) where.regionId = Number(regionId)
    if (countryId) where.countryId = Number(countryId)
    if (industry) where.industry = industry

    // Execute the query with pagination
    const pageNum = Number(page)
    const limitNum = Number(limit)
    const skip = (pageNum - 1) * limitNum

    const [leads, totalCount] = await Promise.all([
      prisma.lead.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { [sortBy]: sortDir.toLowerCase() },
        include: {
          product: { select: { name: true } },
          application: { select: { name: true } },
          sourceResearch: { select: { applicationName: true } }
        }
      }),
      prisma.lead.count({ where })
    ])

    return {
      data: leads,
      pagination: {
        total: totalCount,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(totalCount / limitNum)
      }
    }
  }

  /**
   * Create a new lead with duplicate detection
   * @param {Object} leadData - Lead data to create
   * @param {Object} options - Options for lead creation
   * @param {boolean} [options.checkDuplicates=true] - Whether to check for duplicates
   * @param {boolean} [options.returnDuplicates=false] - Whether to return duplicates instead of throwing error
   * @param {number} [options.threshold] - Custom threshold for duplicate detection
   * @returns {Promise<Object>} - Created lead or duplicate information
   */
  async createLead(leadData, options = {}) {
    const {
      checkDuplicates = true,
      returnDuplicates = false,
      threshold
    } = options

    // Check for duplicates if enabled
    if (checkDuplicates) {
      const potentialDuplicates = await this.findDuplicates(leadData, { threshold })

      if (potentialDuplicates.length > 0) {
        if (returnDuplicates) {
          return {
            isDuplicate: true,
            duplicates: potentialDuplicates
          }
        } else {
          throw new Error('Duplicate lead detected')
        }
      }
    }

    // Create the lead if no duplicates found or checking disabled
    const lead = await prisma.lead.create({
      data: leadData,
      include: {
        product: true,
        application: true,
        region: true,
        country: true
      }
    })

    return {
      isDuplicate: false,
      lead
    }
  }

  /**
   * Update an existing lead
   * @param {number} id - Lead ID to update
   * @param {Object} leadData - New lead data
   * @returns {Promise<Object>} - Updated lead
   */
  async updateLead(id, leadData) {
    const existingLead = await prisma.lead.findUnique({
      where: { id: Number(id) }
    })

    if (!existingLead) {
      throw new Error(`Lead with ID ${id} not found`)
    }

    return prisma.lead.update({
      where: { id: Number(id) },
      data: leadData,
      include: {
        product: true,
        application: true,
        region: true,
        country: true
      }
    })
  }

  /**
   * Delete a lead
   * @param {number} id - Lead ID to delete
   * @returns {Promise<Object>} - Deleted lead
   */
  async deleteLead(id) {
    const existingLead = await prisma.lead.findUnique({
      where: { id: Number(id) }
    })

    if (!existingLead) {
      throw new Error(`Lead with ID ${id} not found`)
    }

    return prisma.lead.delete({
      where: { id: Number(id) }
    })
  }

  /**
   * Find potential duplicates of a lead
   * @param {Object} leadData - Lead data to check
   * @param {Object} options - Options for duplicate detection
   * @param {number} [options.threshold] - Custom threshold for duplicate detection
   * @param {boolean} [options.includeScores=false] - Whether to include similarity scores
   * @returns {Promise<Array>} - Array of potential duplicates
   */
  async findDuplicates(leadData, options = {}) {
    // Normalize lead data for comparison
    const normalizedLead = {
      id: leadData.id,
      name: leadData.name || '',
      website: leadData.website || '',
      email: leadData.email || '',
      industry: leadData.industry || '',
      location: leadData.location || ''
    }

    // Build filters for initial database query to narrow down potential matches
    const filters = {}

    // If we have an industry, filter by it to reduce the result set
    if (leadData.industry) {
      filters.industry = leadData.industry
    }

    // Query for potential duplicates - first pass with basic database filtering
    const potentialMatches = await prisma.lead.findMany({
      where: filters,
      take: 100 // Limit the result set for performance
    })

    // Use the duplicate detector for more sophisticated matching
    const duplicates = this.duplicateDetector.findPotentialDuplicates(
      normalizedLead,
      potentialMatches,
      {
        threshold: options.threshold,
        includeScores: options.includeScores || false
      }
    )

    // Return the potential duplicates
    return duplicates
  }

  /**
   * Create leads from search results with duplicate detection
   * @param {Array} organizations - Organization data from search results
   * @param {number} productId - Product ID to associate with leads
   * @param {number} applicationId - Application ID to associate with leads
   * @param {Object} options - Options for creation
   * @returns {Promise<Object>} - Results of creation process
   */
  async createLeadsFromSearchResults(organizations, productId, applicationId, options = {}) {
    const results = {
      created: 0,
      skipped: 0,
      errors: []
    }

    // Process each organization
    for (const org of organizations) {
      try {
        // Map organization data to lead structure
        const leadData = {
          name: org.name,
          email: org.email,
          phone: org.phone,
          productId: Number(productId),
          applicationId: Number(applicationId),
          industry: org.industry,
          website: org.website,
          location: org.location,
          description: org.description,
          employeeCount: org.employeeCount ? Number(org.employeeCount) : null,
          source: org.source || 'search_result',
          sourceId: org.id?.toString(),
          regionId: org.regionId ? Number(org.regionId) : null,
          countryId: org.countryId ? Number(org.countryId) : null,
          status: 'NEW',
          confidence: org.confidence || null
        }

        // Create the lead with duplicate checking enabled
        const result = await this.createLead(leadData, {
          checkDuplicates: true,
          returnDuplicates: true,
          threshold: options.threshold || 0.8
        })

        if (result.isDuplicate) {
          results.skipped++
        } else {
          results.created++
        }
      } catch (error) {
        // Log error and continue with next organization
        results.errors.push({
          organization: org.name,
          error: error.message
        })
      }
    }

    return results
  }

  /**
   * Merge two leads
   * @param {number} primaryId - ID of the primary lead (will be kept)
   * @param {number} secondaryId - ID of the secondary lead (will be deleted after merge)
   * @param {Object} options - Merge options
   * @param {boolean} [options.deleteSecondary=true] - Whether to delete the secondary lead after merging
   * @returns {Promise<Object>} - Merged lead
   */
  async mergeLeads(primaryId, secondaryId, options = {}) {
    const { deleteSecondary = true } = options

    // Fetch both leads
    const [primaryLead, secondaryLead] = await Promise.all([
      prisma.lead.findUnique({ where: { id: Number(primaryId) } }),
      prisma.lead.findUnique({ where: { id: Number(secondaryId) } })
    ])

    if (!primaryLead) {
      throw new Error(`Primary lead with ID ${primaryId} not found`)
    }

    if (!secondaryLead) {
      throw new Error(`Secondary lead with ID ${secondaryId} not found`)
    }

    // Merge leads using the duplicate detector
    const mergedData = this.duplicateDetector.mergeLeads(primaryLead, secondaryLead)

    // Update the primary lead with merged data
    const updatedLead = await prisma.lead.update({
      where: { id: Number(primaryId) },
      data: mergedData
    })

    // Delete the secondary lead if requested
    if (deleteSecondary) {
      await prisma.lead.delete({
        where: { id: Number(secondaryId) }
      })
    }

    return updatedLead
  }

  /**
   * Update lead tags
   * @param {Array<number>} leadIds - Array of lead IDs to update
   * @param {Array<string>} tags - Tags to add/remove
   * @param {string} operation - Operation to perform ('add', 'remove', or 'set')
   * @returns {Promise<Object>} - Result of the operation
   */
  async updateLeadTags(leadIds, tags, operation = 'add') {
    const results = {
      success: 0,
      notFound: 0,
      failed: 0
    }

    // Process each lead
    for (const leadId of leadIds) {
      try {
        const lead = await prisma.lead.findUnique({
          where: { id: Number(leadId) },
          select: { id: true, tags: true }
        })

        if (!lead) {
          results.notFound++
          continue
        }

        let updatedTags
        if (operation === 'add') {
          // Add tags (avoiding duplicates)
          updatedTags = [...new Set([...(lead.tags || []), ...tags])]
        } else if (operation === 'remove') {
          // Remove tags
          updatedTags = (lead.tags || []).filter(tag => !tags.includes(tag))
        } else if (operation === 'set') {
          // Replace tags
          updatedTags = tags
        }

        await prisma.lead.update({
          where: { id: Number(leadId) },
          data: { tags: updatedTags }
        })

        results.success++
      } catch (error) {
        results.failed++
      }
    }

    return results
  }

  /**
   * Score a lead using the LeadScoringService
   * @param {number} leadId - ID of the lead to score
   * @returns {Promise<Object>} - Scoring result
   */
  async scoreLead(leadId) {
    return this.scoringService.scoreLead(leadId)
  }

  /**
   * Score multiple leads
   * @param {Array<number>} leadIds - Array of lead IDs to score
   * @returns {Promise<Array<Object>>} - Array of scoring results
   */
  async scoreLeads(leadIds) {
    return this.scoringService.scoreLeads(leadIds)
  }

  /**
   * Get leads with scores, filtered and paginated
   * @param {Object} options - Query options including score filters
   * @returns {Promise<Object>} - Scored leads with pagination metadata
   */
  async getScoredLeads(options = {}) {
    return this.scoringService.getLeadScores(options)
  }

  /**
   * Override a lead's score manually
   * @param {number} leadId - ID of the lead to override
   * @param {Object} overrideData - Data for the override
   * @returns {Promise<Object>} - Result of the override operation
   */
  async overrideLeadScore(leadId, overrideData) {
    return this.scoringService.overrideLeadScore(leadId, overrideData);
  }

  /**
   * Get a lead's score override information
   * @param {number} leadId - ID of the lead to get override for
   * @returns {Promise<Object|null>} - Override information or null if none exists
   */
  async getScoreOverride(leadId) {
    return this.scoringService.getScoreOverride(leadId);
  }

  /**
   * Remove a lead's score override
   * @param {number} leadId - ID of the lead to remove override for
   * @returns {Promise<Object>} - Result of the operation
   */
  async removeScoreOverride(leadId) {
    return this.scoringService.removeScoreOverride(leadId);
  }

  /**
   * Update lead status for multiple leads
   * @param {Array<number>} leadIds - Array of lead IDs to update
   * @param {string} status - New status value
   * @returns {Promise<Object>} - Result of the operation
   */
  async updateLeadStatus(leadIds, status) {
    const result = await prisma.lead.updateMany({
      where: { id: { in: leadIds.map(id => Number(id)) } },
      data: { status }
    })

    return {
      count: result.count
    }
  }
} 