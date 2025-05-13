import { DataEnrichmentService } from './DataEnrichmentService.js'

/**
 * Mock data enrichment service for development and testing
 */
export class MockEnrichmentService extends DataEnrichmentService {
  /**
   * Create a new mock enrichment service
   * @param {Object} config - Configuration options
   * @param {number} [config.delayMs=500] - Simulated API delay in milliseconds
   * @param {number} [config.errorRate=0.1] - Simulated error rate (0-1)
   * @param {boolean} [config.generateRandom=true] - Whether to generate random data when not found
   */
  constructor(config = {}) {
    super()
    
    this.delayMs = config.delayMs || 500
    this.errorRate = config.errorRate || 0.1
    this.generateRandom = config.generateRandom !== false
    
    // Mock data store
    this.mockDataStore = new Map([
      ['example.com', this.createMockData('Example Company')],
      ['acme.com', this.createMockData('Acme Corporation')],
      ['microsoft.com', this.createMockData('Microsoft Corporation', { 
        industry: 'Software',
        employeeCount: 181000,
        foundedYear: 1975,
        location: 'Redmond, Washington, United States'
      })],
      ['apple.com', this.createMockData('Apple Inc', { 
        industry: 'Consumer Electronics',
        employeeCount: 154000,
        foundedYear: 1976,
        location: 'Cupertino, California, United States'
      })],
      ['lasertronics.com', this.createMockData('LaserTronics Inc', { 
        industry: 'Laser Components',
        employeeCount: 230,
        foundedYear: 1995,
        location: 'San Jose, California, United States'
      })]
    ])
  }

  /**
   * Enrich lead data with additional information
   * @param {Object} lead - Lead data to enrich
   * @param {Object} [options] - Additional options
   * @returns {Promise<Object>} - Enriched lead data
   */
  async enrichLeadData(lead, options = {}) {
    await this.simulateApiDelay()
    this.simulateRandomError()
    
    if (lead.website) {
      const domain = this.extractDomain(lead.website)
      return this.enrichByDomain(domain, options)
    } else if (lead.name) {
      return this.enrichByName(lead.name, options)
    } else {
      throw new Error('Insufficient data for enrichment: need website or company name')
    }
  }

  /**
   * Enrich lead data by domain
   * @param {string} domain - Company domain
   * @param {Object} [options] - Additional options
   * @returns {Promise<Object>} - Enriched data
   */
  async enrichByDomain(domain, options = {}) {
    await this.simulateApiDelay()
    this.simulateRandomError()
    
    // Clean up domain
    const cleanDomain = this.extractDomain(domain)
    
    // Look for domain in mock data store
    let companyData = this.mockDataStore.get(cleanDomain)
    
    // Generate random data if not found and enabled
    if (!companyData && this.generateRandom) {
      const companyName = `${cleanDomain.charAt(0).toUpperCase() + cleanDomain.slice(1).replace('.com', '')} Inc`
      companyData = this.createMockData(companyName)
      this.mockDataStore.set(cleanDomain, companyData)
    } else if (!companyData) {
      throw new Error(`No data found for domain: ${cleanDomain}`)
    }
    
    return {
      ...companyData,
      lastEnriched: new Date().toISOString()
    }
  }

  /**
   * Enrich lead data by company name
   * @param {string} name - Company name
   * @param {Object} [options] - Additional options
   * @returns {Promise<Object>} - Enriched data
   */
  async enrichByName(name, options = {}) {
    await this.simulateApiDelay()
    this.simulateRandomError()
    
    // Look for a company in mock data store with this name
    for (const [domain, data] of this.mockDataStore.entries()) {
      if (data.name.toLowerCase() === name.toLowerCase()) {
        return {
          ...data,
          lastEnriched: new Date().toISOString()
        }
      }
    }
    
    // Generate random data if not found and enabled
    if (this.generateRandom) {
      const mockData = this.createMockData(name)
      const domain = this.generateDomainFromName(name)
      this.mockDataStore.set(domain, mockData)
      
      return {
        ...mockData,
        lastEnriched: new Date().toISOString()
      }
    } else {
      throw new Error(`No data found for company name: ${name}`)
    }
  }

  /**
   * Enrich lead data by email
   * @param {string} email - Email address
   * @param {Object} [options] - Additional options
   * @returns {Promise<Object>} - Enriched data
   */
  async enrichByEmail(email, options = {}) {
    await this.simulateApiDelay()
    this.simulateRandomError()
    
    // Extract domain from email
    const emailDomain = email.split('@')[1]
    
    if (!emailDomain) {
      throw new Error(`Invalid email address: ${email}`)
    }
    
    // Use domain enrichment
    return this.enrichByDomain(emailDomain, options)
  }

  /**
   * Simulate API delay
   * @returns {Promise<void>}
   */
  async simulateApiDelay() {
    return new Promise(resolve => setTimeout(resolve, this.delayMs))
  }

  /**
   * Simulate random API errors
   * @throws {Error} Randomly thrown error based on error rate
   */
  simulateRandomError() {
    if (Math.random() < this.errorRate) {
      const errors = [
        'API rate limit exceeded',
        'Service temporarily unavailable',
        'Network error',
        'Authentication failed'
      ]
      throw new Error(`Mock API error: ${errors[Math.floor(Math.random() * errors.length)]}`)
    }
  }

  /**
   * Create mock company data
   * @param {string} name - Company name
   * @param {Object} [override] - Data to override defaults
   * @returns {Object} - Mock company data
   */
  createMockData(name, override = {}) {
    const industries = [
      'Technology', 'Manufacturing', 'Healthcare', 'Finance', 
      'Education', 'Retail', 'Construction', 'Entertainment'
    ]
    
    const locations = [
      'San Francisco, California', 'New York, New York', 
      'Austin, Texas', 'Boston, Massachusetts',
      'Chicago, Illinois', 'Seattle, Washington'
    ]
    
    // Generate domain from name if not provided
    const domain = this.generateDomainFromName(name)
    
    // Base random data
    const data = {
      name,
      website: `https://${domain}`,
      industry: industries[Math.floor(Math.random() * industries.length)],
      description: `${name} is a leading provider of solutions in their industry.`,
      location: locations[Math.floor(Math.random() * locations.length)],
      employeeCount: Math.floor(Math.random() * 1000) + 10,
      annualRevenue: (Math.floor(Math.random() * 100) + 1) * 1000000,
      foundedYear: Math.floor(Math.random() * 30) + 1980,
      linkedInUrl: `https://www.linkedin.com/company/${name.toLowerCase().replace(/\s+/g, '-')}`,
      tags: ['mock-data'],
      confidence: 0.7,
      enrichmentSource: this.getName(),
      metadata: {
        specialties: ['Mock Specialty 1', 'Mock Specialty 2'],
        socialProfiles: {
          twitter: `https://twitter.com/${name.toLowerCase().replace(/\s+/g, '')}`
        }
      }
    }
    
    // Override with provided data
    return { ...data, ...override }
  }

  /**
   * Generate a domain name from a company name
   * @param {string} name - Company name
   * @returns {string} - Domain name
   */
  generateDomainFromName(name) {
    return name.toLowerCase()
      .replace(/\s+corporation$/i, '')
      .replace(/\s+inc$/i, '')
      .replace(/\s+llc$/i, '')
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, '')
      .concat('.com')
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
   * Get service name
   * @returns {string} - Service name
   */
  getName() {
    return 'MockEnrichment'
  }

  /**
   * Check if the service is available
   * @returns {Promise<boolean>} - True if available
   */
  async isAvailable() {
    await this.simulateApiDelay()
    return Math.random() >= this.errorRate
  }
} 