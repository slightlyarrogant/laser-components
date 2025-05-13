import { DataEnrichmentService } from './DataEnrichmentService.js'
import axios from 'axios'

/**
 * Data enrichment service implementation using LinkedIn API
 * Uses a third-party LinkedIn data provider API
 */
export class LinkedInEnrichmentService extends DataEnrichmentService {
  /**
   * Create a new LinkedIn enrichment service
   * @param {Object} config - Configuration options
   * @param {string} config.apiKey - API key for the LinkedIn data provider
   * @param {string} [config.baseUrl='https://api.linkedin-data.com/v1'] - API base URL (this is an example)
   * @param {number} [config.timeout=10000] - Request timeout in milliseconds
   * @param {number} [config.rateLimitDelay=1000] - Delay between requests in milliseconds
   */
  constructor(config) {
    super()
    
    if (!config || !config.apiKey) {
      throw new Error('LinkedIn API key is required')
    }
    
    this.apiKey = config.apiKey
    this.baseUrl = config.baseUrl || 'https://api.linkedin-data.com/v1'
    this.timeout = config.timeout || 10000
    this.rateLimitDelay = config.rateLimitDelay || 1000
    
    // Create axios instance with common configuration
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: this.timeout,
      headers: {
        'X-Api-Key': this.apiKey,
        'Content-Type': 'application/json'
      }
    })
  }

  /**
   * Enrich lead data with additional information
   * @param {Object} lead - Lead data to enrich
   * @param {Object} [options] - Additional options
   * @returns {Promise<Object>} - Enriched lead data
   */
  async enrichLeadData(lead, options = {}) {
    if (lead.linkedInUrl) {
      return this.enrichByLinkedInUrl(lead.linkedInUrl, options)
    } else if (lead.website) {
      const domain = this.extractDomain(lead.website)
      return this.enrichByDomain(domain, options)
    } else if (lead.name) {
      return this.enrichByName(lead.name, options)
    } else {
      throw new Error('Insufficient data for LinkedIn enrichment: need LinkedIn URL, website, or company name')
    }
  }

  /**
   * Enrich lead data by domain
   * @param {string} domain - Company domain
   * @param {Object} [options] - Additional options
   * @returns {Promise<Object>} - Enriched data
   */
  async enrichByDomain(domain, options = {}) {
    try {
      // Clean up domain (remove protocol, www, and path)
      const cleanDomain = this.extractDomain(domain)
      
      // Call API to get LinkedIn company data by domain
      const response = await this.client({
        method: 'get',
        url: '/company/search',
        params: { domain: cleanDomain }
      })
      
      if (!response.data || !response.data.companies || response.data.companies.length === 0) {
        throw new Error(`No LinkedIn data found for domain: ${domain}`)
      }
      
      // Use the most relevant company (usually the first one)
      const companyData = response.data.companies[0]
      
      // Transform to our data format
      return this.transformToLeadData(companyData)
    } catch (error) {
      console.error(`LinkedIn enrichment error for domain ${domain}:`, error)
      
      // Handle API-specific errors
      if (error.response) {
        const { status } = error.response
        
        if (status === 404) {
          throw new Error(`LinkedIn data for domain ${domain} not found`)
        } else if (status === 429) {
          throw new Error('LinkedIn API rate limit exceeded')
        } else if (status === 401 || status === 403) {
          throw new Error('LinkedIn API authentication error')
        }
      }
      
      throw new Error(`LinkedIn enrichment failed: ${error.message}`)
    }
  }

  /**
   * Enrich lead data by company name
   * @param {string} name - Company name
   * @param {Object} [options] - Additional options
   * @returns {Promise<Object>} - Enriched data
   */
  async enrichByName(name, options = {}) {
    try {
      // Call API to search LinkedIn for company data by name
      const response = await this.client({
        method: 'get',
        url: '/company/search',
        params: { 
          name,
          // Add location if available for better matching
          location: options.location || undefined,
          // Limit results, we'll use the most relevant
          limit: 1
        }
      })
      
      if (!response.data || !response.data.companies || response.data.companies.length === 0) {
        throw new Error(`No LinkedIn data found for company name: ${name}`)
      }
      
      // Use the most relevant company (first result)
      const companyData = response.data.companies[0]
      
      // Transform to our data format
      return this.transformToLeadData(companyData)
    } catch (error) {
      console.error(`LinkedIn company search error for ${name}:`, error)
      
      // Handle API-specific errors
      if (error.response) {
        const { status } = error.response
        
        if (status === 404) {
          throw new Error(`LinkedIn data for company ${name} not found`)
        } else if (status === 429) {
          throw new Error('LinkedIn API rate limit exceeded')
        }
      }
      
      throw new Error(`LinkedIn company search failed: ${error.message}`)
    }
  }

  /**
   * Enrich lead data by LinkedIn URL
   * @param {string} linkedInUrl - LinkedIn company URL
   * @param {Object} [options] - Additional options
   * @returns {Promise<Object>} - Enriched data
   */
  async enrichByLinkedInUrl(linkedInUrl, options = {}) {
    try {
      // Extract company identifier from LinkedIn URL
      const companyIdentifier = this.extractLinkedInIdentifier(linkedInUrl)
      
      if (!companyIdentifier) {
        throw new Error(`Invalid LinkedIn URL: ${linkedInUrl}`)
      }
      
      // Call API to get LinkedIn company data by identifier
      const response = await this.client({
        method: 'get',
        url: '/company/profile',
        params: { identifier: companyIdentifier }
      })
      
      if (!response.data || !response.data.company) {
        throw new Error(`No data found for LinkedIn URL: ${linkedInUrl}`)
      }
      
      // Transform to our data format
      return this.transformToLeadData(response.data.company)
    } catch (error) {
      console.error(`LinkedIn URL enrichment error for ${linkedInUrl}:`, error)
      throw new Error(`LinkedIn URL enrichment failed: ${error.message}`)
    }
  }

  /**
   * Enrich lead data by email
   * @param {string} email - Email address
   * @param {Object} [options] - Additional options
   * @returns {Promise<Object>} - Enriched data
   */
  async enrichByEmail(email, options = {}) {
    try {
      // Extract domain from email
      const emailDomain = email.split('@')[1]
      
      if (!emailDomain) {
        throw new Error(`Invalid email address: ${email}`)
      }
      
      // Use domain enrichment
      return this.enrichByDomain(emailDomain, options)
    } catch (error) {
      console.error(`LinkedIn email enrichment error for ${email}:`, error)
      throw new Error(`LinkedIn email enrichment failed: ${error.message}`)
    }
  }

  /**
   * Extract LinkedIn company identifier from URL
   * @param {string} url - LinkedIn URL
   * @returns {string|null} - Company identifier
   */
  extractLinkedInIdentifier(url) {
    if (!url) return null
    
    // Common URL patterns for LinkedIn company pages
    // Examples:
    // https://www.linkedin.com/company/microsoft/
    // https://www.linkedin.com/company/1035/
    
    try {
      // Try URL parsing first
      const urlObj = new URL(url)
      
      // Check if it's a company page
      if (urlObj.pathname.includes('/company/')) {
        // Extract the company identifier (name or ID)
        const pathParts = urlObj.pathname.split('/')
        const companyIndex = pathParts.indexOf('company')
        
        if (companyIndex >= 0 && companyIndex < pathParts.length - 1) {
          return pathParts[companyIndex + 1]
        }
      }
      
      return null
    } catch (error) {
      // Fallback to regex if URL parsing fails
      const regex = /linkedin\.com\/company\/([^\/]+)/
      const match = url.match(regex)
      return match ? match[1] : null
    }
  }

  /**
   * Extract clean domain from URL or email
   * @param {string} input - URL, email, or domain
   * @returns {string} - Clean domain
   */
  extractDomain(input) {
    if (!input) return null
    
    let domain = input
    
    // Handle URLs
    if (domain.startsWith('http://') || domain.startsWith('https://')) {
      try {
        const url = new URL(domain)
        domain = url.hostname
      } catch (error) {
        // If URL parsing fails, use simple string manipulation
        domain = domain.replace(/^https?:\/\//, '')
        domain = domain.split('/')[0]
      }
    }
    
    // Handle email addresses
    if (domain.includes('@')) {
      domain = domain.split('@')[1]
    }
    
    // Remove 'www.' prefix
    domain = domain.replace(/^www\./, '')
    
    return domain
  }

  /**
   * Transform LinkedIn API data to our lead data format
   * @param {Object} linkedInData - Data from LinkedIn API
   * @returns {Object} - Transformed lead data
   */
  transformToLeadData(linkedInData) {
    if (!linkedInData) return null
    
    // Base enrichment data
    const enrichedData = {
      name: linkedInData.name,
      website: linkedInData.website,
      industry: linkedInData.industry,
      description: linkedInData.description,
      location: linkedInData.location,
      employeeCount: linkedInData.employeeCount,
      foundedYear: linkedInData.foundedYear,
      linkedInUrl: linkedInData.linkedInUrl || `https://www.linkedin.com/company/${linkedInData.linkedInId}`,
      lastEnriched: new Date().toISOString(),
      confidence: 0.85, // Confidence score for LinkedIn data
      enrichmentSource: this.getName()
    }
    
    // Additional metadata
    enrichedData.metadata = {
      specialties: linkedInData.specialties,
      followers: linkedInData.followers,
      headquartersLocation: linkedInData.headquartersLocation,
      companyType: linkedInData.companyType,
      founded: linkedInData.founded,
      socialProfiles: {}
    }
    
    // Add other social profiles if available
    if (linkedInData.socialProfiles) {
      enrichedData.metadata.socialProfiles = linkedInData.socialProfiles
    }
    
    return enrichedData
  }

  /**
   * Get service name
   * @returns {string} - Service name
   */
  getName() {
    return 'LinkedIn'
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
        url: '/company/search',
        params: { domain: 'microsoft.com' },
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