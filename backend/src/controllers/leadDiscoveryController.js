import { PrismaClient } from '@prisma/client'
import { LeadDiscoveryFactory } from '../services/leadDiscovery/LeadDiscoveryFactory.js'
import dotenv from 'dotenv'

// Load environment variables if not already loaded
dotenv.config()

const prisma = new PrismaClient()

// Create the service factory with configuration from environment variables
const discoveryFactory = LeadDiscoveryFactory.createDefault({
  mockDelayMs: 800,
  mockErrorRate: 0.05,
  clearbitApiKey: process.env.CLEARBIT_API_KEY,
  hunterApiKey: process.env.HUNTER_API_KEY,
  useClearbitAsDefault: process.env.DEFAULT_LEAD_DISCOVERY_SERVICE === 'clearbit',
  useHunterAsDefault: process.env.DEFAULT_LEAD_DISCOVERY_SERVICE === 'hunter'
})

// Get the default discovery service
const defaultDiscoveryService = discoveryFactory.getDefaultService()

/**
 * Search for organizations to discover potential leads
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const searchOrganizations = async (req, res, next) => {
  try {
    const {
      keywords,
      applicationId,
      regionId,
      countryId,
      industry,
      page = 1,
      limit = 20,
      service = 'default'
    } = req.query

    // Get search keywords
    let searchKeywords = keywords ? keywords.split(',').map(k => k.trim()) : []

    // If applicationId is provided, get the application details to use as keywords
    if (applicationId) {
      const application = await prisma.application.findUnique({
        where: { id: parseInt(applicationId, 10) }
      })

      if (application) {
        // Add application name as a keyword if it's not already included
        if (application.name && !searchKeywords.includes(application.name)) {
          searchKeywords.push(application.name)
        }

        // Add words from description as keywords
        if (application.description) {
          const descriptionKeywords = application.description
            .split(/\s+/)
            .filter(word => word.length > 3) // Only include words longer than 3 chars
            .map(word => word.replace(/[.,;:?!]/g, '')) // Remove punctuation
          
          // Add unique keywords only
          searchKeywords = [...new Set([...searchKeywords, ...descriptionKeywords])]
        }
      }
    }

    // Validate that we have keywords to search with
    if (searchKeywords.length === 0) {
      return res.status(400).json({
        message: 'No search keywords provided. Please provide keywords or an applicationId.'
      })
    }

    // Get the requested discovery service
    let discoveryService = defaultDiscoveryService
    if (service !== 'default') {
      discoveryService = discoveryFactory.getService(service)
      if (!discoveryService) {
        return res.status(400).json({
          message: `Invalid service "${service}". Available services: ${discoveryFactory.getServiceNames().join(', ')}`
        })
      }
    }

    // Convert query parameters to numbers where needed
    const queryParams = {
      keywords: searchKeywords,
      regionId: regionId ? parseInt(regionId, 10) : undefined,
      countryId: countryId ? parseInt(countryId, 10) : undefined,
      industry,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10)
    }

    // Execute the search
    const results = await discoveryService.searchByKeywords(queryParams)

    res.json({
      ...results,
      keywords: searchKeywords,
      service: discoveryService.getName()
    })
  } catch (error) {
    console.error('Lead discovery search error:', error)
    next(error)
  }
}

/**
 * Get detailed information about an organization
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const getOrganizationDetails = async (req, res, next) => {
  try {
    const { id } = req.params
    const { service = 'default' } = req.query

    // Get the requested discovery service
    let discoveryService = defaultDiscoveryService
    if (service !== 'default') {
      discoveryService = discoveryFactory.getService(service)
      if (!discoveryService) {
        return res.status(400).json({
          message: `Invalid service "${service}". Available services: ${discoveryFactory.getServiceNames().join(', ')}`
        })
      }
    }

    // Get organization details
    const organizationDetails = await discoveryService.getOrganizationDetails(id)

    res.json({
      ...organizationDetails,
      service: discoveryService.getName()
    })
  } catch (error) {
    console.error('Lead discovery details error:', error)
    next(error)
  }
}

/**
 * List available lead discovery services
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const listDiscoveryServices = async (req, res, next) => {
  try {
    const services = discoveryFactory.getServiceNames()
    const defaultService = discoveryFactory.getDefaultServiceName()

    // Build service info with availability status
    const serviceInfo = await Promise.all(
      services.map(async (name) => {
        const service = discoveryFactory.getService(name)
        let available = false
        
        try {
          available = await service.isAvailable()
        } catch (error) {
          console.warn(`Error checking availability for ${name}:`, error.message)
        }
        
        return {
          name,
          available,
          isDefault: name === defaultService
        }
      })
    )

    res.json({
      services: serviceInfo,
      defaultService
    })
  } catch (error) {
    console.error('List discovery services error:', error)
    next(error)
  }
} 