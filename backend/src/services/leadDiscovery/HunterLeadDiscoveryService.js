import { LeadDiscoveryService } from './LeadDiscoveryService.js'
import axios from 'axios'

/**
 * Lead discovery service implementation using Hunter.io API
 * Provides company data and email addresses through Hunter's Domain Search API
 */
export class HunterLeadDiscoveryService extends LeadDiscoveryService {
  /**
   * Create a new Hunter lead discovery service
   * @param {Object} config - Configuration options
   * @param {string} config.apiKey - Hunter API key
   * @param {string} [config.baseUrl='https://api.hunter.io/v2'] - API base URL
   * @param {number} [config.timeout=5000] - Request timeout in milliseconds
   */
  constructor(config) {
    super()
    
    if (!config || !config.apiKey) {
      throw new Error('Hunter API key is required')
    }
    
    this.apiKey = config.apiKey
    this.baseUrl = config.baseUrl || 'https://api.hunter.io/v2'
    this.timeout = config.timeout || 5000
    
    // Create axios instance with common configuration
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: this.timeout,
      params: {
        api_key: this.apiKey
      },
      headers: {
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
      page = 1,
      limit = 20
    } = params
    
    if (!keywords || keywords.length === 0) {
      throw new Error('At least one keyword is required for search')
    }
    
    try {
      // Hunter doesn't have a direct company search API by name,
      // so we'll use domain search for the primary keyword and assume it's a domain or company name
      
      // First, try to find a domain for the primary keyword
      const primaryKeyword = keywords[0]
      
      // Remove spaces, special characters, and add .com to create a potential domain
      const domainGuess = `${primaryKeyword.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`
      
      // Search for the domain and related emails
      const response = await this.client({
        method: 'get',
        url: '/domain-search',
        params: {
          domain: domainGuess,
          limit: limit,
          offset: (page - 1) * limit
        }
      })
      
      const { data } = response.data
      
      if (!data || !data.domain) {
        // If not found, return empty results
        return {
          data: [],
          pagination: {
            totalCount: 0,
            page,
            totalPages: 0,
            hasMore: false
          },
          source: this.getName()
        }
      }
      
      // Format the company data
      const company = this.formatCompanyData(data)
      
      return {
        data: company ? [company] : [],
        pagination: {
          totalCount: company ? 1 : 0,
          page,
          totalPages: company ? 1 : 0,
          hasMore: false
        },
        source: this.getName()
      }
    } catch (error) {
      console.error('Hunter search error:', error)
      
      // Special handling for common errors
      if (error.response) {
        if (error.response.status === 401) {
          throw new Error('Invalid Hunter API key')
        }
        if (error.response.status === 429) {
          throw new Error('Hunter API rate limit exceeded')
        }
      }
      
      throw new Error(`Hunter search failed: ${error.message}`)
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
      if (!isDomain && id.startsWith('hunter-')) {
        // Extract domain from our ID format
        domain = id.replace('hunter-', '')
      }
      
      // Call Hunter API to get domain details and email addresses
      const response = await this.client({
        method: 'get',
        url: '/domain-search',
        params: {
          domain,
          limit: 20 // Get up to 20 email addresses
        }
      })
      
      const { data } = response.data
      
      if (!data || !data.domain) {
        throw new Error(`Domain ${domain} not found`)
      }
      
      // Format the result with detailed info
      return this.formatCompanyData(data, true)
    } catch (error) {
      console.error('Hunter domain lookup error:', error)
      
      // Special handling for common errors
      if (error.response) {
        if (error.response.status === 401) {
          throw new Error('Invalid Hunter API key')
        }
        if (error.response.status === 429) {
          throw new Error('Hunter API rate limit exceeded')
        }
        if (error.response.status === 404) {
          throw new Error(`Domain ${id} not found`)
        }
      }
      
      throw new Error(`Hunter domain lookup failed: ${error.message}`)
    }
  }

  /**
   * Format Hunter company data to our standard format
   * @param {Object} data - Hunter domain search data
   * @param {boolean} [detailed=false] - Whether to include detailed information
   * @returns {Object} - Standardized company data
   */
  formatCompanyData(data, detailed = false) {
    if (!data || !data.domain) return null
    
    // Extract domain and organization info
    const { domain, organization, emails, country, state, city } = data
    
    // Base company information
    const formattedCompany = {
      id: `hunter-${domain}`,
      name: organization || domain.split('.')[0],
      website: `https://${domain}`,
      location: [city, state, country].filter(Boolean).join(', ') || null,
      source: this.getName(),
      sourceId: domain,
      confidence: 0.8
    }
    
    // Calculate estimated employee count based on emails found
    if (emails && emails.length > 0) {
      // This is a very rough estimate, assuming the API returned only a sample
      formattedCompany.employeeCount = emails.length * 5
    }
    
    // Add emails as contacts if detailed info requested
    if (detailed && emails && emails.length > 0) {
      formattedCompany.contacts = emails.map(email => ({
        firstName: email.first_name || null,
        lastName: email.last_name || null,
        email: email.value,
        position: email.position || null,
        confidence: email.confidence || null,
        department: email.department || null,
        linkedInUrl: null // Hunter doesn't provide this
      }))
      
      // Try to set primary contact email
      const primaryEmail = emails.find(email => email.position && 
        (email.position.toLowerCase().includes('ceo') || 
         email.position.toLowerCase().includes('founder') ||
         email.position.toLowerCase().includes('owner')))
      
      if (primaryEmail) {
        formattedCompany.email = primaryEmail.value
      } else if (emails.length > 0) {
        formattedCompany.email = emails[0].value
      }
      
      // Add social media links if available
      formattedCompany.socialMedia = {}
      const twitterPattern = emails.find(email => email.twitter)
      if (twitterPattern && twitterPattern.twitter) {
        formattedCompany.socialMedia.twitter = `https://twitter.com/${twitterPattern.twitter}`
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
    return 'Hunter'
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
        url: '/account',
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