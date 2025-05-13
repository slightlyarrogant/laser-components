import { LeadDiscoveryService } from './LeadDiscoveryService.js'

/**
 * Mock implementation of LeadDiscoveryService for testing and development
 * Provides synthetic data without actual API calls
 */
export class MockLeadDiscoveryService extends LeadDiscoveryService {
  constructor(config = {}) {
    super()
    this.delayMs = config.delayMs || 500 // Simulate network delay
    this.errorRate = config.errorRate || 0 // Simulate random errors
    this.industries = [
      'Manufacturing',
      'Healthcare',
      'Automotive',
      'Aerospace',
      'Electronics',
      'Research',
      'Defense',
      'Telecommunications',
      'Medical Devices',
      'Consumer Electronics'
    ]
  }

  /**
   * Generate a random integer between min and max (inclusive)
   * @param {number} min - Minimum value
   * @param {number} max - Maximum value
   * @returns {number} - Random integer
   */
  randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min
  }

  /**
   * Simulate network delay
   * @param {number} ms - Milliseconds to delay
   * @returns {Promise<void>}
   */
  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Generate a mock organization based on keywords
   * @param {string[]} keywords - Keywords to incorporate
   * @param {string} id - Organization ID
   * @returns {Object} - Mock organization data
   */
  generateMockOrganization(keywords, id) {
    // Use keywords to generate organization name
    const keyword = keywords[this.randomInt(0, keywords.length - 1) % keywords.length] || 'Tech'
    const suffixes = ['Inc', 'Corp', 'Systems', 'Technologies', 'Labs', 'Research', 'Solutions']
    const suffix = suffixes[this.randomInt(0, suffixes.length - 1)]
    const prefix = ['Advanced', 'Global', 'Precision', 'Innovative', 'Strategic', 'Integrated', 'Applied']
    const namePrefix = this.randomInt(0, 10) > 5 ? `${prefix[this.randomInt(0, prefix.length - 1)]} ` : ''

    const name = `${namePrefix}${keyword} ${suffix}`
    const industry = this.industries[this.randomInt(0, this.industries.length - 1)]
    const employeeCount = this.randomInt(10, 10000)
    const foundedYear = this.randomInt(1950, 2023)
    const website = `https://www.${keyword.toLowerCase().replace(/\s+/g, '')}${suffix.toLowerCase()}.com`

    return {
      id: id || `mock-${this.randomInt(10000, 99999)}`,
      name,
      industry,
      website,
      location: ['New York, USA', 'San Francisco, USA', 'London, UK', 'Tokyo, Japan', 'Berlin, Germany'][this.randomInt(0, 4)],
      description: `${name} is a leading provider of ${keyword.toLowerCase()} solutions for ${industry.toLowerCase()} applications.`,
      employeeCount,
      foundedYear,
      linkedInUrl: `https://www.linkedin.com/company/${name.toLowerCase().replace(/\s+/g, '-')}`,
      source: 'mock',
      confidence: this.randomInt(50, 99) / 100
    }
  }

  /**
   * Search for organizations by keywords
   * @param {Object} params - Search parameters
   * @returns {Promise<Object>} - Search results
   */
  async searchByKeywords(params) {
    // Simulate network delay
    await this.delay(this.delayMs)

    // Simulate random errors
    if (Math.random() < this.errorRate) {
      throw new Error('Mock API error: Request failed')
    }

    const { 
      keywords = [],
      regionId,
      countryId,
      industry,
      page = 1,
      limit = 20
    } = params

    // Generate between 1-100 organizations
    const totalCount = this.randomInt(keywords.length * 5, 100)
    const totalPages = Math.ceil(totalCount / limit)
    const currentPage = Math.min(page, totalPages)
    
    // Calculate how many items to return for this page
    const resultCount = currentPage < totalPages ? limit : (totalCount % limit) || limit
    
    // Generate the mock organizations
    const results = Array.from({ length: resultCount }).map((_, index) => {
      const id = `mock-${((currentPage - 1) * limit) + index + 1}`
      return this.generateMockOrganization(keywords, id)
    })

    // Filter by industry if provided
    const filteredResults = industry 
      ? results.filter(org => org.industry.toLowerCase().includes(industry.toLowerCase()))
      : results

    return {
      data: filteredResults,
      pagination: {
        totalCount,
        page: currentPage,
        totalPages,
        hasMore: currentPage < totalPages
      },
      source: this.getName()
    }
  }

  /**
   * Get detailed organization information
   * @param {string} id - Organization ID
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} - Organization details
   */
  async getOrganizationDetails(id, options = {}) {
    // Simulate network delay
    await this.delay(this.delayMs)

    // Simulate random errors
    if (Math.random() < this.errorRate) {
      throw new Error('Mock API error: Request failed')
    }

    // Parse the mock ID to extract keywords if present
    const idParts = id.split('-')
    const mockId = idParts[idParts.length - 1]
    
    // Use the ID to seed some randomization
    const seedNum = parseInt(mockId, 10) || this.randomInt(10000, 99999)
    const keywords = options.keywords || ['Laser', 'Optics', 'Photonics']
    
    // Generate a consistent organization for the same ID
    const organization = this.generateMockOrganization(keywords, id)
    
    // Add more detailed information
    return {
      ...organization,
      annualRevenue: this.randomInt(100000, 100000000),
      phoneNumber: `+1 (${this.randomInt(200, 999)}) ${this.randomInt(100, 999)}-${this.randomInt(1000, 9999)}`,
      address: {
        street: `${this.randomInt(100, 9999)} ${['Main St', 'Innovation Blvd', 'Tech Parkway', 'Research Way'][this.randomInt(0, 3)]}`,
        city: organization.location.split(',')[0],
        state: organization.location.includes('USA') ? ['CA', 'NY', 'TX', 'MA', 'WA'][this.randomInt(0, 4)] : undefined,
        country: organization.location.split(',')[1]?.trim() || 'USA',
        postalCode: `${this.randomInt(10000, 99999)}`
      },
      keyPeople: [
        {
          name: `${['John', 'Jane', 'Michael', 'Sarah', 'David'][this.randomInt(0, 4)]} ${['Smith', 'Johnson', 'Williams', 'Brown', 'Jones'][this.randomInt(0, 4)]}`,
          title: `${['CEO', 'CTO', 'President', 'VP of Engineering', 'Director of R&D'][this.randomInt(0, 4)]}`
        },
        {
          name: `${['Robert', 'Lisa', 'Thomas', 'Jennifer', 'Richard'][this.randomInt(0, 4)]} ${['Miller', 'Davis', 'Garcia', 'Rodriguez', 'Wilson'][this.randomInt(0, 4)]}`,
          title: `${['COO', 'CFO', 'Chief Scientist', 'Head of Innovation', 'VP of Sales'][this.randomInt(0, 4)]}`
        }
      ],
      socialMedia: {
        twitter: `https://twitter.com/${organization.name.toLowerCase().replace(/\s+/g, '')}`,
        facebook: `https://facebook.com/${organization.name.toLowerCase().replace(/\s+/g, '')}`
      },
      source: this.getName(),
      lastUpdated: new Date().toISOString()
    }
  }

  /**
   * Get service name
   * @returns {string} - Service name
   */
  getName() {
    return 'MockLeadDiscovery'
  }

  /**
   * Check if service is available
   * @returns {Promise<boolean>} - Always true for mock service
   */
  async isAvailable() {
    return true
  }
} 