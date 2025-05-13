import { PrismaClient } from '@prisma/client'
import { OrganizationServiceFactory } from '../services/organizationSearch/OrganizationServiceFactory.js'
import dotenv from 'dotenv'

// Load environment variables if not already loaded
dotenv.config()

const prisma = new PrismaClient()

// Create the service factory with configuration from environment variables
const serviceFactory = OrganizationServiceFactory.createDefault({
  mockDelayMs: 800,
  mockErrorRate: 0.05,
  realApiKey: process.env.ORG_SEARCH_API_KEY,
  realBaseUrl: process.env.ORG_SEARCH_API_URL,
  useRealAsDefault: process.env.USE_REAL_ORG_SEARCH === 'true'
})

// Get the default search service
const externalService = serviceFactory.getService()

/**
 * Search for organizations based on application keywords and region
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const searchOrganizations = async (req, res, next) => {
  try {
    const {
      applicationId,
      keywords,
      regionId,
      countryId,
      page = 1,
      limit = 20
    } = req.query

    // If applicationId is provided, get the application details to use as keywords
    let searchKeywords = keywords ? keywords.split(',') : []
    
    if (applicationId) {
      const application = await prisma.application.findUnique({
        where: { id: parseInt(applicationId) }
      })
      
      if (application) {
        // Add application name as a keyword
        searchKeywords.push(application.name)
        
        // If application has a description, extract key terms
        if (application.description) {
          // Simple keyword extraction - split by spaces and filter out common words
          // In a production system, this would use NLP for better keyword extraction
          const commonWords = ['and', 'or', 'the', 'in', 'on', 'at', 'to', 'for', 'with', 'by', 'of']
          const descriptionWords = application.description
            .toLowerCase()
            .split(/\s+/)
            .filter(word => word.length > 3 && !commonWords.includes(word))
            .slice(0, 5) // Take up to 5 terms from description
          
          searchKeywords = [...searchKeywords, ...descriptionWords]
        }
      }
    }

    // Remove duplicates and empty values
    searchKeywords = [...new Set(searchKeywords.filter(k => k.trim()))]

    // If no keywords were provided or extracted, return an error
    if (searchKeywords.length === 0) {
      return res.status(400).json({ 
        message: 'No search keywords provided. Please specify keywords or an applicationId.' 
      })
    }

    // Parse numeric parameters
    const searchParams = {
      keywords: searchKeywords,
      page: parseInt(page),
      limit: parseInt(limit)
    }

    // Add optional parameters if they exist
    if (regionId) searchParams.regionId = parseInt(regionId)
    if (countryId) searchParams.countryId = parseInt(countryId)

    // Perform the search
    const results = await externalService.searchOrganizations(searchParams)
    
    // Transform to standardized format
    const standardizedResults = externalService.mapToStandardFormat(results)

    // Return results
    res.json(standardizedResults)
  } catch (error) {
    console.error('Organization search error:', error)
    
    // If it's a known error from the external service, pass it through
    if (error.service) {
      return res.status(502).json({
        message: `External service error: ${error.message}`,
        service: error.service
      })
    }
    
    // Otherwise, pass to the global error handler
    next(error)
  }
}

/**
 * Get details for a specific organization
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const getOrganizationDetails = async (req, res, next) => {
  try {
    const { id } = req.params

    if (!id) {
      return res.status(400).json({ message: 'Organization ID is required' })
    }

    // Fetch organization details from external service
    const result = await externalService.getOrganizationDetails(id)
    
    // Transform to standardized format
    const standardizedResult = externalService.mapToStandardFormat(result)

    // Return results
    res.json(standardizedResult)
  } catch (error) {
    console.error('Organization details error:', error)
    
    // If it's a known error from the external service, pass it through
    if (error.service) {
      return res.status(502).json({
        message: `External service error: ${error.message}`,
        service: error.service
      })
    }
    
    // Otherwise, pass to the global error handler
    next(error)
  }
} 