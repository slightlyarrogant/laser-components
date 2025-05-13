import { LeadDiscoveryService } from './LeadDiscoveryService.js'
import axios from 'axios'

/**
 * Lead discovery service implementation using Clearbit API
 * Provides company data through Clearbit's Company API and Name to Domain API
 */
export class ClearbitLeadDiscoveryService extends LeadDiscoveryService {
  /**
   * Create a new Clearbit lead discovery service
   * @param {Object} config - Configuration options
   * @param {string} config.apiKey - Clearbit API key
   * @param {string} [config.baseUrl='https://company.clearbit.com/v2'] - API base URL
   * @param {number} [config.timeout=5000] - Request timeout in milliseconds
   */
  constructor(config) {
    super()
    
    if (!config || !config.apiKey) {
      throw new Error('Clearbit API key is required')
    }
    
    this.apiKey = config.apiKey
    this.baseUrl = config.baseUrl || 'https://company.clearbit.com/v2'
    this.nameToDomainUrl = 'https://company.clearbit.com/v1/domains/find'
    this.timeout = config.timeout || 5000
    
    // Create axios instance with common configuration
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: this.timeout,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      }
    })
  }

  /**
   * Search for organizations by keywords
   * @param {Object} params - Search parameters
   * @returns {Promise<Object>} - Search results
   */
  async searchByKeywords(params) {
    const { 
      keywords = [],
      industry,
      page = 1,
      limit = 20
    } = params
    
    if (!keywords || keywords.length === 0) {
      throw new Error('At least one keyword is required for search')
    }
    
    try {
      // Clearbit doesn't have a native search API, so we'll use their Name to Domain API
      // for each keyword and combine the results
      
      // We'll collect promises for all search requests
      const searchPromises = []
      
      // For each keyword, try to find companies
      for (const keyword of keywords) {
        // Skip keywords that are too short
        if (keyword.length < 3) continue
        
        // Create a search promise for this keyword
        const searchPromise = this.client({
          method: 'get',
          url: this.nameToDomainUrl,
          params: { name: keyword }
        })
        .then(response => response.data)
        .catch(error => {
          // If not found or other error, return null
          if (error.response && error.response.status === 404) {
            return null
          }
          
          // For rate limits, let's not fail the whole operation
          if (error.response && error.response.status === 429) {
            console.warn(`Clearbit rate limit hit for keyword: ${keyword}`)
            return null
          }
          
          // Log other errors but don't fail the whole search
          console.error(`Clearbit search error for keyword ${keyword}:`, error.message)
          return null
        })
        
        searchPromises.push(searchPromise)
      }
      
      // Wait for all searches to complete
      const searchResults = await Promise.all(searchPromises)
      
      // Filter out null results and flatten the array
      let companies = searchResults.filter(Boolean)
      
      // Apply industry filter if provided
      if (industry && companies.length > 0) {
        companies = companies.filter(company => {
          return company.category && 
                (company.category.toLowerCase().includes(industry.toLowerCase()) ||
                 (company.sector && company.sector.toLowerCase().includes(industry.toLowerCase())))
        })
      }
      
      // Handle pagination (manual since we're combining results)
      const totalResults = companies.length
      const totalPages = Math.ceil(totalResults / limit)
      const startIndex = (page - 1) * limit
      const endIndex = startIndex + limit
      
      // Get the slice of companies for the current page
      const paginatedCompanies = companies.slice(startIndex, endIndex)
      
      // Map to standard format
      const formattedResults = paginatedCompanies.map(company => this.formatCompanyData(company))
      
      return {
        data: formattedResults,
        pagination: {
          totalCount: totalResults,
          page,
          totalPages,
          hasMore: page < totalPages
        },
        source: this.getName()
      }
    } catch (error) {
      console.error('Clearbit search error:', error)
      throw new Error(`Clearbit search failed: ${error.message}`)
    }
  }

  /**
   * Get detailed information about an organization by domain
   * @param {string} id - Organization ID (domain)
   * @returns {Promise<Object>} - Organization details
   */
  async getOrganizationDetails(id, options = {}) {
    try {
      // Check if id is a domain name
      const isDomain = id.includes('.')
      let domain = id
      
      // If id is not a domain (e.g., it's our internal ID), try to extract domain
      if (!isDomain && id.startsWith('clearbit-')) {
        // Extract domain from our ID format
        domain = id.replace('clearbit-', '')
      }
      
      // Call Clearbit API to get company details by domain
      const response = await this.client({
        method: 'get',
        url: `/companies/find?domain=${domain}`
      })
      
      // Format the result
      return this.formatCompanyData(response.data, true)
    } catch (error) {
      console.error('Clearbit company lookup error:', error)
      
      // Special handling for 404 (not found)
      if (error.response && error.response.status === 404) {
        throw new Error(`Company with domain ${id} not found`)
      }
      
      throw new Error(`Clearbit company lookup failed: ${error.message}`)
    }
  }

  /**
   * Format Clearbit company data to our standard format
   * @param {Object} company - Clearbit company data
   * @param {boolean} [detailed=false] - Whether to include detailed information
   * @returns {Object} - Standardized company data
   */
  formatCompanyData(company, detailed = false) {
    if (!company) return null
    
    // Base company information
    const formattedCompany = {
      id: `clearbit-${company.domain}`,
      name: company.name || company.legalName || 'Unknown',
      website: company.domain ? `https://${company.domain}` : null,
      industry: company.category || company.industry || null,
      location: company.location ? `${company.location}` : (
        company.geo ? `${company.geo.city || ''}, ${company.geo.country || ''}` : null
      ),
      description: company.description || null,
      employeeCount: company.metrics ? company.metrics.employees : null,
      foundedYear: company.foundedYear || null,
      linkedInUrl: company.linkedin ? company.linkedin.handle ? 
        `https://www.linkedin.com/company/${company.linkedin.handle}` : null : null,
      source: this.getName(),
      sourceId: company.domain,
      confidence: 0.9 // High confidence since this is direct data
    }
    
    // Add detailed information if requested
    if (detailed && company.metrics) {
      formattedCompany.annualRevenue = company.metrics.estimatedAnnualRevenue || null
      formattedCompany.phoneNumber = company.phone || null
      
      // Add address information
      if (company.geo) {
        formattedCompany.address = {
          street: company.geo.streetNumber ? 
            `${company.geo.streetNumber} ${company.geo.streetName || ''}` : null,
          city: company.geo.city || null,
          state: company.geo.state || null,
          country: company.geo.country || null,
          postalCode: company.geo.postalCode || null
        }
      }
      
      // Add social media information
      formattedCompany.socialMedia = {}
      if (company.facebook && company.facebook.handle) {
        formattedCompany.socialMedia.facebook = `https://facebook.com/${company.facebook.handle}`
      }
      if (company.twitter && company.twitter.handle) {
        formattedCompany.socialMedia.twitter = `https://twitter.com/${company.twitter.handle}`
      }
      
      // Add people information if available
      if (company.tech) {
        formattedCompany.technologies = company.tech
      }
      
      formattedCompany.lastUpdated = new Date().toISOString()
    }
    
    return formattedCompany
  }

  /**
   * Get service name
   * @returns {string} - Service name
   */
  getName() {
    return 'Clearbit'
  }

  /**
   * Check if the service is available
   * @returns {Promise<boolean>} - True if available
   */
  async isAvailable() {
    try {
      // Make a simple request to check if the API is accessible
      await this.client({
        method: 'get',
        url: '/companies/find?domain=google.com',
        timeout: 2000 // Short timeout for availability check
      })
      return true
    } catch (error) {
      // Consider 401 (unauthorized) as "available" since it means the service exists
      // but credentials might be wrong
      if (error.response && error.response.status === 401) {
        return true
      }
      return false
    }
  }
} 