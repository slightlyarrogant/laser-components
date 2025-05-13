import { DataEnrichmentService } from './DataEnrichmentService.js'
import axios from 'axios'

/**
 * Data enrichment service implementation using Clearbit API
 */
export class ClearbitEnrichmentService extends DataEnrichmentService {
  /**
   * Create a new Clearbit enrichment service
   * @param {Object} config - Configuration options
   * @param {string} config.apiKey - Clearbit API key
   * @param {string} [config.baseUrl='https://company.clearbit.com/v2'] - API base URL
   * @param {number} [config.timeout=10000] - Request timeout in milliseconds
   * @param {number} [config.rateLimitDelay=1000] - Delay between requests in milliseconds
   */
  constructor(config) {
    super()
    
    if (!config || !config.apiKey) {
      throw new Error('Clearbit API key is required')
    }
    
    this.apiKey = config.apiKey
    this.baseUrl = config.baseUrl || 'https://company.clearbit.com/v2'
    this.timeout = config.timeout || 10000
    this.rateLimitDelay = config.rateLimitDelay || 1000
    
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
   * Enrich lead data with additional information
   * @param {Object} lead - Lead data to enrich
   * @param {Object} [options] - Additional options
   * @returns {Promise<Object>} - Enriched lead data
   */
  async enrichLeadData(lead, options = {}) {
    // Determine best enrichment method based on available data
    if (lead.website) {
      const domain = this.extractDomain(lead.website)
      return this.enrichByDomain(domain, options)
    } else if (lead.email) {
      return this.enrichByEmail(lead.email, options)
    } else if (lead.name) {
      return this.enrichByName(lead.name, options)
    } else {
      throw new Error('Insufficient data for enrichment: need website, email, or company name')
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
      
      // Call Clearbit API to get company details
      const response = await this.client({
        method: 'get',
        url: `/companies/find?domain=${cleanDomain}`
      })
      
      // Transform Clearbit data to our enrichment format
      return this.transformToLeadData(response.data)
    } catch (error) {
      console.error(`Clearbit enrichment error for domain ${domain}:`, error)
      
      // Handle API-specific errors
      if (error.response) {
        const { status } = error.response
        
        if (status === 404) {
          throw new Error(`Company with domain ${domain} not found`)
        } else if (status === 429) {
          throw new Error('Clearbit rate limit exceeded')
        } else if (status === 401 || status === 403) {
          throw new Error('Clearbit authentication error')
        }
      }
      
      throw new Error(`Clearbit enrichment failed: ${error.message}`)
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
      // First, try to find the domain from the name
      const nameToDomainUrl = 'https://company.clearbit.com/v1/domains/find'
      const nameResponse = await axios({
        method: 'get',
        url: nameToDomainUrl,
        params: { name },
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      })
      
      // If we found a domain, enrich using that
      if (nameResponse.data && nameResponse.data.domain) {
        return this.enrichByDomain(nameResponse.data.domain, options)
      } else {
        throw new Error(`Domain not found for company name: ${name}`)
      }
    } catch (error) {
      console.error(`Clearbit name lookup error for ${name}:`, error)
      
      // Handle API-specific errors
      if (error.response) {
        const { status } = error.response
        
        if (status === 404) {
          throw new Error(`Company with name ${name} not found`)
        } else if (status === 429) {
          throw new Error('Clearbit rate limit exceeded')
        }
      }
      
      throw new Error(`Clearbit name lookup failed: ${error.message}`)
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
      console.error(`Clearbit email enrichment error for ${email}:`, error)
      throw new Error(`Clearbit email enrichment failed: ${error.message}`)
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
   * Transform Clearbit API data to our lead data format
   * @param {Object} clearbitData - Data from Clearbit API
   * @returns {Object} - Transformed lead data
   */
  transformToLeadData(clearbitData) {
    if (!clearbitData) return null
    
    // Base enrichment data
    const enrichedData = {
      name: clearbitData.name || clearbitData.legalName,
      website: clearbitData.domain ? `https://${clearbitData.domain}` : null,
      industry: clearbitData.category || clearbitData.industry,
      description: clearbitData.description,
      location: null,
      employeeCount: clearbitData.metrics?.employees,
      annualRevenue: clearbitData.metrics?.estimatedAnnualRevenue,
      foundedYear: clearbitData.foundedYear,
      linkedInUrl: null,
      tags: clearbitData.tags || [],
      lastEnriched: new Date().toISOString(),
      confidence: 0.9, // High confidence for direct API data
      enrichmentSource: this.getName()
    }
    
    // Build location string if components are available
    if (clearbitData.geo) {
      const locationParts = []
      if (clearbitData.geo.city) locationParts.push(clearbitData.geo.city)
      if (clearbitData.geo.state) locationParts.push(clearbitData.geo.state)
      if (clearbitData.geo.country) locationParts.push(clearbitData.geo.country)
      
      if (locationParts.length > 0) {
        enrichedData.location = locationParts.join(', ')
      }
    }
    
    // Add LinkedIn URL if available
    if (clearbitData.linkedin && clearbitData.linkedin.handle) {
      enrichedData.linkedInUrl = `https://www.linkedin.com/company/${clearbitData.linkedin.handle}`
    }
    
    // Additional metadata
    enrichedData.metadata = {
      phone: clearbitData.phone,
      ticker: clearbitData.ticker,
      technologies: clearbitData.tech,
      socialProfiles: {}
    }
    
    // Add social profiles
    if (clearbitData.facebook && clearbitData.facebook.handle) {
      enrichedData.metadata.socialProfiles.facebook = `https://facebook.com/${clearbitData.facebook.handle}`
    }
    if (clearbitData.twitter && clearbitData.twitter.handle) {
      enrichedData.metadata.socialProfiles.twitter = `https://twitter.com/${clearbitData.twitter.handle}`
    }
    
    return enrichedData
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