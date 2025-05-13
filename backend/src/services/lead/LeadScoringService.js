import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

/**
 * Service for calculating lead scores based on enriched data
 * Implements Task 6.2: Develop Lead Scoring Algorithm
 */
export class LeadScoringService {
  /**
   * Create a new lead scoring service
   * @param {Object} config - Configuration options
   * @param {Object} [config.weights] - Custom weights for scoring factors
   */
  constructor(config = {}) {
    // Default weights for different scoring factors (out of 100 total)
    this.weights = config.weights || {
      // Organization attribute scores (60% of total)
      industry: 15,         // Industry relevance
      employeeCount: 10,    // Organization size
      annualRevenue: 15,    // Annual revenue
      foundedYear: 5,       // Age of company
      completeness: 15,     // Data completeness
      
      // Application match scores (40% of total)
      applicationMatch: 40  // Match between organization and target application
    }
  }

  /**
   * Calculate score for a single lead
   * @param {number} leadId - Lead ID to score
   * @returns {Promise<Object>} - Scoring result with detailed breakdown
   */
  async scoreLead(leadId) {
    // First check if there is a manual override
    const override = await this.getScoreOverride(leadId);
    
    // If there's a complete score override, use it
    if (override && override.score !== null && override.score !== undefined) {
      // Get the standard calculated score for breakdown
      const calculatedScore = await this._calculateLeadScore(leadId);
      
      // Prepare breakdown data
      const breakdown = { ...calculatedScore.breakdown };
      
      // Apply component overrides if they exist
      if (override.componentOverrides) {
        for (const [key, value] of Object.entries(override.componentOverrides)) {
          if (breakdown[key]) {
            breakdown[key].score = value;
            breakdown[key].isOverridden = true;
          }
        }
      }
      
      return {
        leadId: Number(leadId),
        score: override.score,
        breakdown,
        isOverridden: true,
        overrideMetadata: override.metadata,
        scoredAt: new Date()
      };
    }
    
    // No full score override, but we might have component overrides
    else if (override && override.componentOverrides) {
      // Get standard score as base
      const calculatedScore = await this._calculateLeadScore(leadId);
      
      // Deep copy the breakdown
      const breakdown = JSON.parse(JSON.stringify(calculatedScore.breakdown));
      
      // Apply component overrides
      for (const [key, value] of Object.entries(override.componentOverrides)) {
        if (breakdown[key]) {
          breakdown[key].score = value;
          breakdown[key].isOverridden = true;
        }
      }
      
      // Recalculate total score with overridden components
      const scoreComponents = {};
      for (const key of Object.keys(this.weights)) {
        if (breakdown[key]) {
          scoreComponents[key] = breakdown[key].score;
        }
      }
      
      const recalculatedScore = this.calculateTotalScore(scoreComponents);
      
      return {
        leadId: Number(leadId),
        score: recalculatedScore,
        breakdown,
        hasComponentOverrides: true,
        overrideMetadata: override.metadata,
        scoredAt: new Date()
      };
    }
    
    // No overrides at all, calculate standard score
    return this._calculateLeadScore(leadId);
  }

  /**
   * Calculate scores for multiple leads
   * @param {Array<number>} leadIds - Array of lead IDs to score
   * @returns {Promise<Array<Object>>} - Array of scoring results
   */
  async scoreLeads(leadIds) {
    const results = []

    for (const leadId of leadIds) {
      try {
        const scoringResult = await this.scoreLead(leadId)
        results.push(scoringResult)
      } catch (error) {
        results.push({
          leadId,
          error: error.message,
          success: false
        })
      }
    }

    return results
  }

  /**
   * Calculate industry relevance score (0-100)
   * @param {Object} lead - Lead data
   * @param {Object} application - Application data
   * @returns {number} - Industry score (0-100)
   */
  calculateIndustryScore(lead, application) {
    // Check if application exists before accessing its name
    if (!application || !application.name) {
      console.warn(`Lead ID ${lead.id}: Cannot calculate industry score, application data is missing.`);
      return 30; // Return default score if application data is unavailable
    }
    if (!lead.industry) {
      return 30 // Default score if lead industry is missing
    }

    // Define industry relevance for different applications
    // This would be customized based on actual application data
    const industryRelevanceMap = {
      // Example: Semiconductor Manufacturing
      'Semiconductor Manufacturing': {
        highRelevance: ['Electronics Manufacturing', 'Integrated Circuit Design', 'Computing Hardware'],
        mediumRelevance: ['Research & Development', 'Technology Hardware', 'Manufacturing'],
        lowRelevance: ['Software Development', 'IT Services']
      },
      // Example: Laboratory Equipment
      'Laboratory Equipment': {
        highRelevance: ['Pharmaceuticals', 'Biotechnology', 'Research & Development', 'Healthcare'],
        mediumRelevance: ['Chemicals', 'Education', 'Environmental Services'],
        lowRelevance: ['Manufacturing', 'Technology']
      },
      // Default fallback when application isn't specifically mapped
      'default': {
        highRelevance: [],
        mediumRelevance: [],
        lowRelevance: []
      }
    }

    // Get relevance map for this application (or use default)
    const relevanceMap = industryRelevanceMap[application.name] || industryRelevanceMap.default

    // Determine score based on industry relevance to application
    if (relevanceMap.highRelevance.includes(lead.industry)) {
      return 100 // High relevance
    } else if (relevanceMap.mediumRelevance.includes(lead.industry)) {
      return 70  // Medium relevance
    } else if (relevanceMap.lowRelevance.includes(lead.industry)) {
      return 40  // Low relevance
    }

    // Default score for unmapped industries
    return 30
  }

  /**
   * Calculate company size score based on employee count (0-100)
   * @param {Object} lead - Lead data
   * @returns {number} - Size score (0-100)
   */
  calculateSizeScore(lead) {
    if (!lead.employeeCount) {
      return 50 // Default score when data is missing
    }

    const employeeCount = lead.employeeCount

    // Score based on employee count ranges
    if (employeeCount >= 1000) {
      return 100 // Large enterprise
    } else if (employeeCount >= 500) {
      return 90  // Medium-large company
    } else if (employeeCount >= 100) {
      return 80  // Medium company
    } else if (employeeCount >= 50) {
      return 65  // Small-medium company
    } else if (employeeCount >= 10) {
      return 50  // Small company
    } else {
      return 30  // Micro company or startup
    }
  }

  /**
   * Calculate revenue score based on annual revenue (0-100)
   * @param {Object} lead - Lead data
   * @returns {number} - Revenue score (0-100)
   */
  calculateRevenueScore(lead) {
    if (!lead.annualRevenue) {
      return 50 // Default score when data is missing
    }

    const revenue = Number(lead.annualRevenue)

    // Score based on revenue ranges (USD)
    if (revenue >= 1000000000) {
      return 100 // $1B+ revenue
    } else if (revenue >= 500000000) {
      return 90  // $500M-1B revenue
    } else if (revenue >= 100000000) {
      return 80  // $100-500M revenue
    } else if (revenue >= 50000000) {
      return 70  // $50-100M revenue
    } else if (revenue >= 10000000) {
      return 60  // $10-50M revenue
    } else if (revenue >= 1000000) {
      return 50  // $1-10M revenue
    } else {
      return 30  // <$1M revenue
    }
  }

  /**
   * Calculate company age score based on founded year (0-100)
   * @param {Object} lead - Lead data
   * @returns {number} - Age score (0-100)
   */
  calculateAgeScore(lead) {
    if (!lead.foundedYear) {
      return 50 // Default score when data is missing
    }

    const currentYear = new Date().getFullYear()
    const age = currentYear - lead.foundedYear

    // Score based on company age
    if (age >= 50) {
      return 100 // Established for 50+ years
    } else if (age >= 25) {
      return 90  // Established for 25-50 years
    } else if (age >= 10) {
      return 80  // Established for 10-25 years
    } else if (age >= 5) {
      return 70  // Established for 5-10 years
    } else if (age >= 2) {
      return 50  // Early-stage company
    } else {
      return 30  // Very new company or startup
    }
  }

  /**
   * Calculate data completeness score (0-100)
   * @param {Object} lead - Lead data
   * @returns {number} - Completeness score (0-100)
   */
  calculateCompletenessScore(lead) {
    // Fields to check for completeness
    const fields = [
      'name', 'industry', 'website', 'location', 
      'employeeCount', 'annualRevenue', 'foundedYear',
      'email', 'phone', 'description', 'linkedInUrl'
    ]
    
    // Count how many fields have data
    const filledFields = fields.filter(field => 
      lead[field] !== null && 
      lead[field] !== undefined && 
      lead[field] !== ''
    ).length
    
    // Calculate percentage of completeness
    const completenessPercentage = (filledFields / fields.length) * 100
    
    return Math.round(completenessPercentage)
  }

  /**
   * Calculate application match score (0-100)
   * @param {Object} lead - Lead data
   * @param {Object} product - Product data
   * @param {Object} application - Application data
   * @returns {number} - Application match score (0-100)
   */
  calculateApplicationMatchScore(lead, product, application) {
    // This would typically involve analyzing the lead's industry, size,
    // and other attributes in relation to the specific application
    
    // For this implementation, we'll use a simplified approach based on
    // industry relevance and company attributes that suggest good fit
    
    // Get base industry score as a starting point
    const industryRelevance = this.calculateIndustryScore(lead, application)
    
    // Factor in company size and revenue as indicators of fit for this application
    const sizeRelevance = this.calculateSizeScore(lead)
    const revenueRelevance = this.calculateRevenueScore(lead)
    
    // Combine factors to determine overall match score
    // Weighted based on the importance of each factor for application matching
    const matchScore = (
      (industryRelevance * 0.6) + 
      (sizeRelevance * 0.2) + 
      (revenueRelevance * 0.2)
    )
    
    return Math.round(matchScore)
  }

  /**
   * Calculate total weighted score from individual components
   * @param {Object} scores - Individual component scores
   * @returns {number} - Total weighted score (0-100)
   */
  calculateTotalScore(scores) {
    let totalWeightedScore = 0
    
    // Apply weight to each score component and sum
    Object.keys(this.weights).forEach(key => {
      const weight = this.weights[key]
      const score = scores[key] || 0
      totalWeightedScore += (score * weight) / 100
    })
    
    // Round to nearest integer
    return Math.round(totalWeightedScore)
  }
  
  /**
   * Get lead scores with filtering and pagination
   * @param {Object} options - Query options
   * @returns {Promise<Object>} - Lead scores with pagination metadata
   */
  async getLeadScores(options = {}) {
    const {
      minScore,
      maxScore,
      productId,
      applicationId,
      page = 1,
      limit = 20,
      sortBy = 'score',
      sortDir = 'desc'
    } = options
    
    // Start with all leads
    let query = prisma.lead.findMany({
      include: {
        product: true,
        application: true
      }
    })
    
    // Get the leads
    const leads = await query
    
    // Score all leads
    const scoredLeads = await Promise.all(
      leads.map(async (lead) => {
        const scoreResult = await this.scoreLead(lead.id)
        return {
          ...lead,
          score: scoreResult.score,
          scoreBreakdown: scoreResult.breakdown
        }
      })
    )
    
    // Filter by score if specified
    let filteredLeads = scoredLeads
    if (minScore !== undefined) {
      filteredLeads = filteredLeads.filter(lead => lead.score >= minScore)
    }
    if (maxScore !== undefined) {
      filteredLeads = filteredLeads.filter(lead => lead.score <= maxScore)
    }
    
    // Filter by product/application if specified
    if (productId) {
      filteredLeads = filteredLeads.filter(lead => lead.productId === Number(productId))
    }
    if (applicationId) {
      filteredLeads = filteredLeads.filter(lead => lead.applicationId === Number(applicationId))
    }
    
    // Sort results
    const sortMultiplier = sortDir.toLowerCase() === 'asc' ? 1 : -1
    filteredLeads.sort((a, b) => {
      if (sortBy === 'score') {
        return (a.score - b.score) * sortMultiplier
      }
      // Add other sorting options as needed
      return 0
    })
    
    // Apply pagination
    const pageNum = Number(page)
    const limitNum = Number(limit)
    const startIndex = (pageNum - 1) * limitNum
    const endIndex = startIndex + limitNum
    const paginatedLeads = filteredLeads.slice(startIndex, endIndex)
    
    return {
      data: paginatedLeads,
      pagination: {
        total: filteredLeads.length,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(filteredLeads.length / limitNum)
      }
    }
  }

  /**
   * Override a lead's score or score components manually
   * @param {number} leadId - Lead ID to override score for
   * @param {Object} overrideData - Data to override
   * @param {number} [overrideData.score] - Manual overall score override
   * @param {Object} [overrideData.componentOverrides] - Individual component overrides
   * @param {string} [overrideData.reason] - Reason for the override
   * @param {string} [overrideData.overriddenBy] - User who performed the override
   * @returns {Promise<Object>} - Result of the override operation
   */
  async overrideLeadScore(leadId, overrideData) {
    // Get lead with existing score data
    const lead = await prisma.lead.findUnique({
      where: { id: Number(leadId) }
    });

    if (!lead) {
      throw new Error(`Lead with ID ${leadId} not found`);
    }

    // Validate override data
    if (overrideData.score !== undefined && (overrideData.score < 0 || overrideData.score > 100)) {
      throw new Error('Score must be between 0 and 100');
    }

    // Check if component overrides are valid
    if (overrideData.componentOverrides) {
      const validComponents = [
        'industry',
        'employeeCount',
        'annualRevenue',
        'foundedYear',
        'completeness',
        'applicationMatch'
      ];

      for (const key of Object.keys(overrideData.componentOverrides)) {
        if (!validComponents.includes(key)) {
          throw new Error(`Invalid component: ${key}`);
        }

        const value = overrideData.componentOverrides[key];
        if (value < 0 || value > 100) {
          throw new Error(`Component score must be between 0 and 100: ${key}`);
        }
      }
    }

    // Format metadata for the override
    const metadata = {
      overriddenAt: new Date(),
      overriddenBy: overrideData.overriddenBy || 'system',
      reason: overrideData.reason || 'Manual override',
      previousScore: null
    };

    // Calculate current score to store the previous value
    try {
      const currentScore = await this.scoreLead(leadId);
      metadata.previousScore = currentScore.score;
    } catch (error) {
      console.warn(`Could not retrieve previous score for lead ${leadId}:`, error);
    }

    // Store the override in the database
    // Here we're using the 'prisma.scoreOverride' model which you may need to add to your schema
    try {
      // Check if there's an existing override
      const existingOverride = await prisma.scoreOverride.findFirst({
        where: { leadId: Number(leadId) }
      });

      if (existingOverride) {
        // Update existing override
        await prisma.scoreOverride.update({
          where: { id: existingOverride.id },
          data: {
            score: overrideData.score,
            componentOverrides: overrideData.componentOverrides ? JSON.stringify(overrideData.componentOverrides) : undefined,
            metadata: JSON.stringify(metadata)
          }
        });
      } else {
        // Create new override
        await prisma.scoreOverride.create({
          data: {
            leadId: Number(leadId),
            score: overrideData.score,
            componentOverrides: overrideData.componentOverrides ? JSON.stringify(overrideData.componentOverrides) : null,
            metadata: JSON.stringify(metadata)
          }
        });
      }

      return {
        leadId: Number(leadId),
        status: 'success',
        message: 'Score override applied successfully',
        overriddenAt: metadata.overriddenAt
      };
    } catch (error) {
      console.error(`Error saving score override for lead ${leadId}:`, error);
      throw new Error('Failed to save score override');
    }
  }

  /**
   * Remove a manual override for a lead's score
   * @param {number} leadId - Lead ID to remove override for
   * @returns {Promise<Object>} - Result of the operation
   */
  async removeScoreOverride(leadId) {
    try {
      // Check if there's an existing override
      const existingOverride = await prisma.scoreOverride.findFirst({
        where: { leadId: Number(leadId) }
      });

      if (!existingOverride) {
        return {
          leadId: Number(leadId),
          status: 'skipped',
          message: 'No override exists for this lead'
        };
      }

      // Delete the override
      await prisma.scoreOverride.delete({
        where: { id: existingOverride.id }
      });

      return {
        leadId: Number(leadId),
        status: 'success',
        message: 'Score override removed successfully'
      };
    } catch (error) {
      console.error(`Error removing score override for lead ${leadId}:`, error);
      throw new Error('Failed to remove score override');
    }
  }

  /**
   * Check if a lead has a manual score override
   * @param {number} leadId - Lead ID to check
   * @returns {Promise<Object>} - Override information if it exists
   */
  async getScoreOverride(leadId) {
    try {
      const override = await prisma.scoreOverride.findFirst({
        where: { leadId: Number(leadId) }
      });

      if (!override) {
        return null;
      }

      // Parse stored JSON data
      return {
        ...override,
        componentOverrides: override.componentOverrides ? JSON.parse(override.componentOverrides) : null,
        metadata: override.metadata ? JSON.parse(override.metadata) : null
      };
    } catch (error) {
      console.error(`Error fetching score override for lead ${leadId}:`, error);
      throw new Error('Failed to fetch score override');
    }
  }

  /**
   * Internal method to calculate the standard lead score without overrides
   * @param {number} leadId - Lead ID to score
   * @returns {Promise<Object>} - Standard scoring result
   * @private
   */
  async _calculateLeadScore(leadId) {
    // Get lead with related data needed for scoring
    const lead = await prisma.lead.findUnique({
      where: { id: Number(leadId) },
      include: {
        product: true,
        application: true
      }
    });

    if (!lead) {
      throw new Error(`Lead with ID ${leadId} not found`);
    }

    // Get product and application info
    const { product, application } = lead;

    // Calculate individual score components
    const industryScore = this.calculateIndustryScore(lead, application);
    const sizeScore = this.calculateSizeScore(lead);
    const revenueScore = this.calculateRevenueScore(lead);
    const ageScore = this.calculateAgeScore(lead);
    const completenessScore = this.calculateCompletenessScore(lead);
    const applicationMatchScore = this.calculateApplicationMatchScore(lead, product, application);

    // Calculate weighted total score
    const totalScore = this.calculateTotalScore({
      industry: industryScore,
      employeeCount: sizeScore,
      annualRevenue: revenueScore,
      foundedYear: ageScore,
      completeness: completenessScore,
      applicationMatch: applicationMatchScore
    });

    // Score breakdown with normalized values (0-100 scale)
    const scoreBreakdown = {
      industry: {
        score: industryScore,
        weight: this.weights.industry,
        weightedScore: (industryScore * this.weights.industry) / 100
      },
      employeeCount: {
        score: sizeScore,
        weight: this.weights.employeeCount,
        weightedScore: (sizeScore * this.weights.employeeCount) / 100
      },
      annualRevenue: {
        score: revenueScore,
        weight: this.weights.annualRevenue,
        weightedScore: (revenueScore * this.weights.annualRevenue) / 100
      },
      foundedYear: {
        score: ageScore,
        weight: this.weights.foundedYear,
        weightedScore: (ageScore * this.weights.foundedYear) / 100
      },
      completeness: {
        score: completenessScore,
        weight: this.weights.completeness,
        weightedScore: (completenessScore * this.weights.completeness) / 100
      },
      applicationMatch: {
        score: applicationMatchScore,
        weight: this.weights.applicationMatch,
        weightedScore: (applicationMatchScore * this.weights.applicationMatch) / 100
      },
      total: totalScore
    };

    return {
      leadId: lead.id,
      score: totalScore,
      breakdown: scoreBreakdown,
      scoredAt: new Date()
    };
  }
} 