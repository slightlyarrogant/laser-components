import { BaseOrganizationService } from './BaseOrganizationService.js';

/**
 * Mock implementation of an external organization search service.
 * This simulates API calls to an external service for development and testing.
 */
export class MockExternalService extends BaseOrganizationService {
  constructor(config = {}) {
    super(config);
    this.name = 'MockExternalService';
    this.delayMs = config.delayMs || 1000; // Simulate network delay
    this.errorRate = config.errorRate || 0.1; // Simulate occasional errors (10% by default)
  }

  /**
   * Generate a mock organization based on keywords and other parameters
   * @param {string} id - Unique identifier
   * @param {string[]} keywords - Keywords to incorporate into the org data
   * @param {Object} regionInfo - Region/country info
   * @returns {Object} - A mock organization in the external API's format
   */
  _generateMockOrganization(id, keywords = [], regionInfo = {}) {
    const keyword = keywords.length > 0 ? keywords[Math.floor(Math.random() * keywords.length)] : 'tech';
    
    return {
      external_id: `org_${id}`,
      name: `${keyword.charAt(0).toUpperCase() + keyword.slice(1)} Organization ${id}`,
      description: `A leading organization in ${keywords.join(', ')}`,
      website: `https://www.${keyword.toLowerCase()}org${id}.com`,
      industry: this._getRandomIndustry(),
      employee_count: Math.floor(Math.random() * 10000) + 10,
      founded_year: Math.floor(Math.random() * 30) + 1990,
      headquarters: {
        city: regionInfo.city || 'New York',
        state: regionInfo.state || 'NY',
        country: regionInfo.country || 'US',
        country_code: regionInfo.countryCode || 'US'
      },
      social_profiles: {
        linkedin: `https://www.linkedin.com/company/${keyword.toLowerCase()}org${id}`,
        twitter: `https://twitter.com/${keyword.toLowerCase()}org${id}`
      },
      keywords: [...keywords, this._getRandomIndustry(), this._getRandomIndustry()],
      revenue_range: this._getRandomRevenueRange(),
      last_updated: new Date().toISOString()
    };
  }

  /**
   * Get a random industry for mock data
   */
  _getRandomIndustry() {
    const industries = [
      'Aerospace', 'Agriculture', 'Automotive', 'Biotechnology', 'Chemicals',
      'Construction', 'Defense', 'Education', 'Electronics', 'Energy',
      'Entertainment', 'Environmental', 'Finance', 'Food & Beverage', 'Healthcare',
      'Hospitality', 'Information Technology', 'Insurance', 'Manufacturing',
      'Media', 'Mining', 'Pharmaceuticals', 'Real Estate', 'Retail', 
      'Telecommunications', 'Transportation', 'Utilities'
    ];
    return industries[Math.floor(Math.random() * industries.length)];
  }

  /**
   * Get a random revenue range for mock data
   */
  _getRandomRevenueRange() {
    const ranges = [
      'Less than $1M', '$1M-$10M', '$10M-$50M', '$50M-$100M', 
      '$100M-$500M', '$500M-$1B', '$1B-$10B', 'More than $10B'
    ];
    return ranges[Math.floor(Math.random() * ranges.length)];
  }

  /**
   * Simulate a delay to mimic network latency
   */
  async _simulateDelay() {
    return new Promise(resolve => setTimeout(resolve, this.delayMs));
  }

  /**
   * Randomly determine if this request should error (for testing error handling)
   */
  _shouldError() {
    return Math.random() < this.errorRate;
  }

  /**
   * Search organizations based on keywords and region
   * @param {Object} searchParams - Search parameters
   * @returns {Promise<Object>} - Search results
   */
  async searchOrganizations(searchParams) {
    // Extract params with defaults
    const { 
      keywords = [], 
      regionId = null, 
      countryId = null,
      page = 1,
      limit = 20
    } = searchParams;

    await this._simulateDelay();

    // Simulate an error occasionally
    if (this._shouldError()) {
      throw new Error('External API request failed with status 500');
    }

    // Get mock region info based on IDs (in a real service, this would come from the DB)
    const regionInfo = await this._getMockRegionInfo(regionId, countryId);

    // Generate results
    const totalResults = Math.floor(Math.random() * 100) + keywords.length * 10;
    const startIndex = (page - 1) * limit;
    const results = [];

    for (let i = 0; i < Math.min(limit, totalResults - startIndex); i++) {
      const id = startIndex + i + 1;
      results.push(this._generateMockOrganization(id, keywords, regionInfo));
    }

    // Return in the external API's format
    return {
      status: 'success',
      meta: {
        total: totalResults,
        page,
        limit,
        pages: Math.ceil(totalResults / limit)
      },
      data: results
    };
  }

  /**
   * Get details for a specific organization
   * @param {string} organizationId - External ID of the organization
   * @returns {Promise<Object>} - Organization details
   */
  async getOrganizationDetails(organizationId) {
    await this._simulateDelay();

    // Simulate an error occasionally
    if (this._shouldError()) {
      throw new Error(`Could not retrieve organization with ID ${organizationId}`);
    }

    // Extract ID from format 'org_123'
    const id = organizationId.replace('org_', '');
    
    // Generate a consistent organization based on the ID
    const org = this._generateMockOrganization(id, ['optical', 'photonics', 'laser']);

    // Add more detailed fields for the single org view
    return {
      status: 'success',
      data: {
        ...org,
        contacts: [
          {
            name: 'John Smith',
            title: 'Chief Technology Officer',
            email: 'john.smith@example.com',
            phone: '+1-555-123-4567'
          },
          {
            name: 'Jane Doe',
            title: 'Procurement Manager',
            email: 'jane.doe@example.com',
            phone: '+1-555-987-6543'
          }
        ],
        technologies: ['AI', 'Machine Learning', 'Cloud Computing', 'Robotics'],
        recent_news: [
          {
            title: `${org.name} Announces New Product Line`,
            date: '2023-12-01',
            url: 'https://example.com/news/1'
          },
          {
            title: `${org.name} Expands Operations to Europe`,
            date: '2023-10-15',
            url: 'https://example.com/news/2'
          }
        ]
      }
    };
  }

  /**
   * Get mock region information based on IDs
   * In a real implementation, this would query the database
   */
  async _getMockRegionInfo(regionId, countryId) {
    // Simple mock implementation - in real app would fetch from database
    const mockRegions = {
      1: { name: 'North America', code: 'NA' },
      2: { name: 'Europe', code: 'EU' },
      3: { name: 'Asia Pacific', code: 'APAC' },
      4: { name: 'Latin America', code: 'LATAM' },
      5: { name: 'Middle East and Africa', code: 'MEA' }
    };

    const mockCountries = {
      1: { name: 'United States', code: 'US', regionId: 1 },
      2: { name: 'Canada', code: 'CA', regionId: 1 },
      3: { name: 'United Kingdom', code: 'GB', regionId: 2 },
      4: { name: 'Germany', code: 'DE', regionId: 2 },
      5: { name: 'Japan', code: 'JP', regionId: 3 },
      6: { name: 'Australia', code: 'AU', regionId: 3 },
      7: { name: 'Brazil', code: 'BR', regionId: 4 },
      8: { name: 'Mexico', code: 'MX', regionId: 4 },
      9: { name: 'South Africa', code: 'ZA', regionId: 5 },
      10: { name: 'United Arab Emirates', code: 'AE', regionId: 5 }
    };

    let regionInfo = {};
    
    if (regionId && mockRegions[regionId]) {
      regionInfo.region = mockRegions[regionId].name;
      regionInfo.regionCode = mockRegions[regionId].code;
    }

    if (countryId && mockCountries[countryId]) {
      regionInfo.country = mockCountries[countryId].name;
      regionInfo.countryCode = mockCountries[countryId].code;
    }

    return regionInfo;
  }

  /**
   * Map external API data format to our standardized format
   * @param {Object} externalData - Data from the external API
   * @returns {Object} - Data in our standardized format
   */
  mapToStandardFormat(externalData) {
    // If we're mapping a single organization
    if (externalData.data && !Array.isArray(externalData.data)) {
      return this._mapSingleOrganization(externalData.data);
    }
    
    // If we're mapping search results
    return {
      organizations: externalData.data.map(org => this._mapSingleOrganization(org)),
      meta: externalData.meta
    };
  }

  /**
   * Map a single organization to standardized format
   * @param {Object} org - External organization data
   * @returns {Object} - Standardized organization object
   */
  _mapSingleOrganization(org) {
    return {
      externalId: org.external_id,
      name: org.name,
      description: org.description,
      website: org.website,
      industry: org.industry,
      employeeCount: org.employee_count,
      foundedYear: org.founded_year,
      location: {
        city: org.headquarters?.city,
        state: org.headquarters?.state,
        country: org.headquarters?.country,
        countryCode: org.headquarters?.country_code
      },
      socialProfiles: org.social_profiles,
      relevantKeywords: org.keywords,
      revenueRange: org.revenue_range,
      contacts: org.contacts,
      technologies: org.technologies,
      recentNews: org.recent_news,
      lastUpdated: org.last_updated
    };
  }

  /**
   * Handle errors from this service
   * @param {Error} error - Original error
   * @returns {Error} - Enhanced error
   */
  handleError(error) {
    const enhancedError = super.handleError(error);
    // Add service-specific error handling if needed
    enhancedError.retryable = true; // Mock service errors are always retryable
    return enhancedError;
  }
} 