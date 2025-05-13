/**
 * Base interface for external organization search services.
 * All concrete implementations should extend this class and implement its methods.
 */
export class BaseOrganizationService {
  constructor(config = {}) {
    // Common configuration properties (API keys, URLs, etc.)
    this.config = config;
    this.name = 'BaseOrganizationService'; // Service identifier
  }

  /**
   * Perform a search for organizations by application keywords and region
   * @param {Object} searchParams - Search parameters
   * @param {string[]} searchParams.keywords - Array of keywords (e.g., application names or topics)
   * @param {number} searchParams.regionId - ID of the region to search in (or null for global)
   * @param {number} searchParams.countryId - ID of the country to search in (or null for all countries)
   * @param {number} searchParams.page - Page number for pagination (starting from 1)
   * @param {number} searchParams.limit - Number of results per page
   * @returns {Promise<Object>} - Search results in the standardized format
   */
  async searchOrganizations(searchParams) {
    throw new Error('Method searchOrganizations must be implemented by concrete service');
  }

  /**
   * Get detailed information about a specific organization
   * @param {string} organizationId - External ID of the organization
   * @returns {Promise<Object>} - Organization details in the standardized format
   */
  async getOrganizationDetails(organizationId) {
    throw new Error('Method getOrganizationDetails must be implemented by concrete service');
  }

  /**
   * Transform external API response into a standardized organization object format
   * @param {Object} externalData - Raw external API data
   * @returns {Object} - Standardized organization object
   */
  mapToStandardFormat(externalData) {
    throw new Error('Method mapToStandardFormat must be implemented by concrete service');
  }

  /**
   * Handle errors from the external API in a consistent way
   * @param {Error} error - Original error object
   * @returns {Error} - Standardized error with additional context
   */
  handleError(error) {
    // Basic implementation - should be enhanced in concrete services
    const enhancedError = new Error(`${this.name} Error: ${error.message}`);
    enhancedError.originalError = error;
    enhancedError.service = this.name;
    return enhancedError;
  }
} 