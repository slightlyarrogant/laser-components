import { PrismaClient, LeadStatus } from '@prisma/client'
import { LeadService } from '../services/lead/LeadService.js'

const prisma = new PrismaClient()
const leadService = new LeadService()

/**
 * Get all leads with optional filtering
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const getLeads = async (req, res, next) => {
  try {
    const result = await leadService.getLeads({
      status: req.query.status,
      productId: req.query.productId,
      applicationId: req.query.applicationId,
      regionId: req.query.regionId,
      countryId: req.query.countryId,
      industry: req.query.industry,
      page: req.query.page,
      limit: req.query.limit,
      sortBy: req.query.sortBy,
      sortDir: req.query.sortDir
    })

    res.json(result)
  } catch (error) {
    next(error)
  }
}

/**
 * Get a single lead by ID
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const getLeadById = async (req, res, next) => {
  try {
    const { id } = req.params
    const lead = await leadService.getLeadById(id)

    if (!lead) {
      return res.status(404).json({ message: 'Lead not found' })
    }

    res.json(lead)
  } catch (error) {
    next(error)
  }
}

/**
 * Create a new lead
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const createLead = async (req, res, next) => {
  try {
    const leadData = req.body
    const { skipDuplicateCheck } = req.query

    // Validate required fields
    if (!leadData.name || !leadData.productId || !leadData.applicationId) {
      return res.status(400).json({
        message: 'Required fields missing: name, productId, and applicationId are required'
      })
    }

    // Create the lead (with or without duplicate checking)
    const result = await leadService.createLead(leadData, {
      checkDuplicates: skipDuplicateCheck !== 'true',
      returnDuplicates: true
    })

    if (result.isDuplicate) {
      // Return 409 Conflict with duplicate information
      return res.status(409).json({
        message: 'Duplicate lead detected',
        duplicates: result.duplicates
      })
    }

    res.status(201).json(result.lead)
  } catch (error) {
    // Check for validation errors
    if (error.code === 'P2002') {
      return res.status(400).json({ message: 'A lead with this information already exists' })
    }
    if (error.code === 'P2003') {
      return res.status(400).json({ message: 'Invalid foreign key reference' })
    }
    next(error)
  }
}

/**
 * Update an existing lead
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const updateLead = async (req, res, next) => {
  try {
    const { id } = req.params
    const leadData = req.body

    const updatedLead = await leadService.updateLead(id, leadData)
    res.json(updatedLead)
  } catch (error) {
    // Check for validation errors
    if (error.code === 'P2002') {
      return res.status(400).json({ message: 'A lead with this information already exists' })
    }
    if (error.code === 'P2003') {
      return res.status(400).json({ message: 'Invalid foreign key reference' })
    }
    if (error.message.includes('not found')) {
      return res.status(404).json({ message: error.message })
    }
    next(error)
  }
}

/**
 * Delete a lead
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const deleteLead = async (req, res, next) => {
  try {
    const { id } = req.params
    await leadService.deleteLead(id)
    res.status(204).send()
  } catch (error) {
    if (error.message.includes('not found')) {
      return res.status(404).json({ message: error.message })
    }
    next(error)
  }
}

/**
 * Save search results as leads
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const saveSearchResultsAsLeads = async (req, res, next) => {
  try {
    const { organizations, productId, applicationId, skipDuplicateCheck } = req.body

    if (!Array.isArray(organizations) || !productId || !applicationId) {
      return res.status(400).json({
        message: 'Required data missing: organizations array, productId, and applicationId are required'
      })
    }

    // Validate product and application exist
    const [product, application] = await Promise.all([
      prisma.product.findUnique({ where: { id: parseInt(productId, 10) } }),
      prisma.application.findUnique({ where: { id: parseInt(applicationId, 10) } })
    ])

    if (!product || !application) {
      return res.status(400).json({
        message: 'Invalid product or application ID'
      })
    }

    // Use the lead service to create leads with duplicate detection
    const result = await leadService.createLeadsFromSearchResults(
      organizations,
      productId,
      applicationId,
      {
        checkDuplicates: skipDuplicateCheck !== true
      }
    )

    res.status(201).json({
      message: `Created ${result.created} leads from ${organizations.length} organizations`,
      created: result.created,
      skipped: result.skipped,
      errors: result.errors.length > 0 ? result.errors : undefined
    })
  } catch (error) {
    next(error)
  }
}

/**
 * Bulk tag leads
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const tagLeads = async (req, res, next) => {
  try {
    const { leadIds, tags, operation = 'add' } = req.body

    if (!Array.isArray(leadIds) || leadIds.length === 0 || !Array.isArray(tags) || tags.length === 0) {
      return res.status(400).json({
        message: 'Required data missing: leadIds and tags arrays are required'
      })
    }

    // Update tags using lead service
    const results = await leadService.updateLeadTags(leadIds, tags, operation)
    
    res.json({
      message: `Updated tags for ${results.success} leads`,
      notFound: results.notFound,
      failed: results.failed
    })
  } catch (error) {
    next(error)
  }
}

/**
 * Bulk update lead status
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const updateLeadStatus = async (req, res, next) => {
  try {
    const { leadIds, status } = req.body

    if (!Array.isArray(leadIds) || leadIds.length === 0 || !status) {
      return res.status(400).json({
        message: 'Required data missing: leadIds array and status are required'
      })
    }

    // Validate status
    if (!Object.values(LeadStatus).includes(status)) {
      return res.status(400).json({
        message: `Invalid status. Must be one of: ${Object.values(LeadStatus).join(', ')}`
      })
    }

    // Update status using lead service
    const result = await leadService.updateLeadStatus(leadIds, status)

    res.json({
      message: `Updated status to ${status} for ${result.count} leads`
    })
  } catch (error) {
    next(error)
  }
}

/**
 * Find potential duplicate leads
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const findDuplicateLeads = async (req, res, next) => {
  try {
    const leadData = req.body
    const { threshold, includeScores } = req.query

    // Validate required fields
    if (!leadData.name) {
      return res.status(400).json({
        message: 'Name is required for duplicate detection'
      })
    }

    // Find potential duplicates
    const duplicates = await leadService.findDuplicates(leadData, {
      threshold: threshold ? parseFloat(threshold) : undefined,
      includeScores: includeScores === 'true'
    })

    res.json({
      duplicates,
      count: duplicates.length
    })
  } catch (error) {
    next(error)
  }
}

/**
 * Score a lead
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const scoreLead = async (req, res, next) => {
  try {
    const { id } = req.params
    
    const scoreResult = await leadService.scoreLead(id)
    
    res.json(scoreResult)
  } catch (error) {
    if (error.message.includes('not found')) {
      return res.status(404).json({ message: error.message })
    }
    next(error)
  }
}

/**
 * Score multiple leads
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const scoreLeads = async (req, res, next) => {
  try {
    const { leadIds } = req.body
    
    if (!Array.isArray(leadIds) || leadIds.length === 0) {
      return res.status(400).json({
        message: 'leadIds array is required'
      })
    }
    
    const results = await leadService.scoreLeads(leadIds)
    
    res.json({
      results,
      count: results.length
    })
  } catch (error) {
    next(error)
  }
}

/**
 * Get scored leads with filtering and pagination
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const getScoredLeads = async (req, res, next) => {
  try {
    const results = await leadService.getScoredLeads({
      minScore: req.query.minScore ? Number(req.query.minScore) : undefined,
      maxScore: req.query.maxScore ? Number(req.query.maxScore) : undefined,
      productId: req.query.productId,
      applicationId: req.query.applicationId,
      page: req.query.page,
      limit: req.query.limit,
      sortBy: req.query.sortBy || 'score',
      sortDir: req.query.sortDir || 'desc'
    })
    
    res.json(results)
  } catch (error) {
    next(error)
  }
}

/**
 * Override a lead's score or score components
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const overrideLeadScore = async (req, res, next) => {
  try {
    const { id } = req.params;
    const overrideData = req.body;
    
    // Validate required fields
    if (!overrideData || (overrideData.score === undefined && !overrideData.componentOverrides)) {
      return res.status(400).json({
        message: 'At least one of score or componentOverrides must be provided'
      });
    }
    
    // Apply the score override
    const result = await leadService.overrideLeadScore(id, overrideData);
    
    res.json(result);
  } catch (error) {
    if (error.message.includes('not found')) {
      return res.status(404).json({ message: error.message });
    }
    next(error);
  }
};

/**
 * Remove a lead's score override
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const removeLeadScoreOverride = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const result = await leadService.removeScoreOverride(id);
    
    res.json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * Get a lead's score override information
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const getLeadScoreOverride = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const override = await leadService.getScoreOverride(id);
    
    if (!override) {
      return res.status(404).json({
        message: 'No score override found for this lead'
      });
    }
    
    res.json(override);
  } catch (error) {
    next(error);
  }
};

/**
 * Override lead enrichment data fields
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const overrideLeadData = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    // Get the lead first to check if it exists
    const lead = await leadService.getLeadById(id);
    
    if (!lead) {
      return res.status(404).json({
        message: `Lead with ID ${id} not found`
      });
    }

    // Add audit information to track this is a manual override
    const auditInfo = {
      manuallyUpdated: true,
      updatedBy: req.user?.email || 'system', // Assuming authentication middleware adds user to req
      updatedAt: new Date().toISOString()
    };
    
    // Update the lead with override data and audit info
    const updatedLead = await prisma.lead.update({
      where: { id: Number(id) },
      data: {
        ...updateData,
        // Store the audit information in a field or as a separate record
        // This example assumes you have a metadata field or will add one
        metadata: JSON.stringify(auditInfo)
      }
    });
    
    res.json({
      message: 'Lead data successfully overridden',
      lead: updatedLead
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Merge two leads
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const mergeLeads = async (req, res, next) => {
  try {
    const { primaryId, secondaryId, keepSecondary } = req.body;

    if (!primaryId || !secondaryId) {
      return res.status(400).json({
        message: 'Both primaryId and secondaryId are required'
      });
    }

    // Merge leads
    const mergedLead = await leadService.mergeLeads(primaryId, secondaryId, {
      deleteSecondary: keepSecondary !== true
    });

    res.json({
      message: `Successfully merged lead ${secondaryId} into lead ${primaryId}`,
      lead: mergedLead
    });
  } catch (error) {
    if (error.message.includes('not found')) {
      return res.status(404).json({ message: error.message });
    }
    next(error);
  }
}

/**
 * Export leads to CSV/Excel
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const exportLeads = async (req, res, next) => {
  try {
    const { leadIds, format = 'csv', includeFields } = req.body;
    
    if (!Array.isArray(leadIds) || leadIds.length === 0) {
      return res.status(400).json({
        message: 'leadIds array is required'
      });
    }
    
    if (format !== 'csv' && format !== 'excel') {
      return res.status(400).json({
        message: 'Format must be either "csv" or "excel"'
      });
    }
    
    // Get the leads data
    const leads = await prisma.lead.findMany({
      where: {
        id: { in: leadIds.map(id => parseInt(id, 10)) }
      },
      include: {
        product: true,
        application: true,
        tags: true
      }
    });
    
    if (leads.length === 0) {
      return res.status(404).json({
        message: 'No leads found with the provided IDs'
      });
    }
    
    // For demo purposes, just return the data that would be exported
    // In a real implementation, this would generate a CSV or Excel file
    res.json({
      message: `Successfully prepared ${leads.length} leads for export in ${format} format`,
      format,
      count: leads.length,
      // Include a sample of the data
      sample: leads.slice(0, 3).map(lead => ({
        id: lead.id,
        name: lead.name,
        product: lead.product.name,
        application: lead.application.name,
        status: lead.status,
        createdAt: lead.created_at
      }))
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all leads with optional filtering
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const getAllLeads = async (req, res, next) => {
  try {
    const { page, limit, sortBy, sortDir, filters, search } = req.query;

    const where = buildWhereClause(filters, search); // Use helper function

    const leads = await prisma.lead.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: {
        [sortBy]: sortDir,
      },
      // Include related data needed for display
      include: {
        product: { select: { name: true } }, // Get product name
        application: { select: { name: true } }, // Get linked application name (if exists)
        sourceResearch: { select: { applicationName: true } }, // Get source research name (if exists)
        // Add other necessary includes like region, country if needed for display
      }
    });

    const totalLeads = await prisma.lead.count({ where });

    res.json({
      data: leads,
      pagination: {
        total: totalLeads,
        page,
        limit,
        totalPages: Math.ceil(totalLeads / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching leads:", error);
    res.status(500).json({ message: "Server error while fetching leads." });
  }
}; 