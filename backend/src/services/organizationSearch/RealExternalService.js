import { BaseOrganizationService } from './BaseOrganizationService.js';
import axios from 'axios';

/**
 * Real implementation of an external organization search service.
 * This connects to a real third-party API for organization data.
 */
export class RealExternalService extends BaseOrganizationService {
  constructor(config = {}) {
    super(config);
    this.name = 'RealExternalService';
    
    // Ensure required config is provided
    if (!config.apiKey) {
      throw new Error('API key is required for RealExternalService');
    }
    if (!config.baseUrl) {
      throw new Error('Base URL is required for RealExternalService');
    }
    
    // Configure axios instance with auth headers and base URL
    this.api = axios.create({
      baseURL: config.baseUrl,
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      timeout: config.timeout || 10000 // Default timeout: 10 seconds
    });
    
    // Additional config
    this.retryAttempts = config.retryAttempts || 3;
    this.retryDelay = config.retryDelay || 1000; // milliseconds
  }
  
  /**
   * Retry a function multiple times with exponential backoff
   * @param {Function} fn - Async function to retry
   * @param {number} maxAttempts - Maximum number of attempts
   * @param {number} baseDelay - Base delay between attempts (ms)
   * @returns {Promise<any>} - Result of the function
   */
  async _retry(fn, maxAttempts = this.retryAttempts, baseDelay = this.retryDelay) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        
        // Don't retry if it's a 4xx error (client error) except for 429 (rate limit)
        if (error.response && error.response.status >= 400 && error.response.status < 500 && error.response.status !== 429) {
          break;
        }
        
        // If this was the last attempt, don't wait
        if (attempt === maxAttempts) {
          break;
        }
        
        // Exponential backoff with jitter
        const delay = baseDelay * Math.pow(2, attempt - 1) + Math.random() * 200;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw this.handleError(lastError);
  }
  
  /**
   * Search organizations based on keywords and region
   * @param {Object} searchParams - Search parameters
   * @returns {Promise<Object>} - Search results
   */
  async searchOrganizations(searchParams) {
    // Extract and format params for the external API
    const { 
      keywords = [], 
      regionId = null, 
      countryId = null,
      page = 1, 
      limit = 20
    } = searchParams;
    
    // Convert keywords array to comma-separated string if needed
    const keywordsString = Array.isArray(keywords) ? keywords.join(',') : keywords;
    
    // Prepare query parameters for the external API
    const params = {
      q: keywordsString,
      page,
      limit
    };
    
    // Add optional parameters if provided
    if (regionId) params.region_id = regionId;
    if (countryId) params.country_id = countryId;
    
    // Make API call with retry logic
    return this._retry(async () => {
      try {
        const response = await this.api.get('/organizations/search', { params });
        return response.data;
      } catch (error) {
        // Enhance error with API-specific details
        if (error.response) {
          error.message = `API responded with status ${error.response.status}: ${error.response.data?.message || 'Unknown error'}`;
        }
        throw error;
      }
    });
  }

  /**
   * Get details for a specific organization
   * @param {string} organizationId - External ID of the organization
   * @returns {Promise<Object>} - Organization details
   */
  async getOrganizationDetails(organizationId) {
    return this._retry(async () => {
      try {
        const response = await this.api.get(`/organizations/${organizationId}`);
        return response.data;
      } catch (error) {
        // Enhance error with API-specific details
        if (error.response) {
          error.message = `API responded with status ${error.response.status}: ${error.response.data?.message || 'Unknown error'}`;
        }
        throw error;
      }
    });
  }
  
  /**
   * Map external API data format to our standardized format
   * @param {Object} externalData - Data from the external API
   * @returns {Object} - Data in our standardized format
   */
  mapToStandardFormat(externalData) {
    // Check if it's a single organization or search results
    if (externalData.data && !Array.isArray(externalData.data)) {
      return this._mapSingleOrganization(externalData.data);
    }
    
    // Otherwise, map search results
    return {
      organizations: externalData.data.map(org => this._mapSingleOrganization(org)),
      meta: {
        total: externalData.meta.total,
        page: externalData.meta.page,
        limit: externalData.meta.limit,
        pages: externalData.meta.pages
      }
    };
  }
  
  /**
   * Map a single organization from external API format to our standardized format
   * @param {Object} org - Organization data from external API
   * @returns {Object} - Standardized organization object
   */
  _mapSingleOrganization(org) {
    // Implement mapping from the real API format to our standardized format
    // This would need to be adjusted based on the actual API response structure
    return {
      externalId: org.id.toString(),
      name: org.name,
      description: org.description || '',
      website: org.website || '',
      industry: org.industry || '',
      employeeCount: org.employee_count || org.employees || 0,
      foundedYear: org.founded_year || org.founded || null,
      location: {
        city: org.headquarters?.city || org.city || '',
        state: org.headquarters?.state || org.state || '',
        country: org.headquarters?.country || org.country || '',
        countryCode: org.headquarters?.country_code || org.country_code || ''
      },
      socialProfiles: org.social_profiles || {
        linkedin: org.linkedin_url || '',
        twitter: org.twitter_url || ''
      },
      relevantKeywords: org.keywords || org.tags || [],
      revenueRange: org.revenue_range || org.revenue || '',
      contacts: org.contacts || [],
      technologies: org.technologies || [],
      recentNews: org.recent_news || [],
      lastUpdated: org.updated_at || org.last_updated || new Date().toISOString()
    };
  }
  
  /**
   * Handle errors from the external API in a consistent way
   * @param {Error} error - Original error object
   * @returns {Error} - Standardized error with additional context
   */
  handleError(error) {
    const enhancedError = new Error(`${this.name} Error: ${error.message}`);
    enhancedError.originalError = error;
    enhancedError.service = this.name;
    
    // Add response details if available
    if (error.response) {
      enhancedError.statusCode = error.response.status;
      enhancedError.responseData = error.response.data;
    }
    
    // Add request details if available for debugging
    if (error.config) {
      enhancedError.endpoint = `${error.config.method.toUpperCase()} ${error.config.url}`;
      enhancedError.params = error.config.params;
    }
    
    return enhancedError;
  }
}