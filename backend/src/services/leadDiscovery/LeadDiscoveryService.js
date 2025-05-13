/**
 * Interface for lead discovery services
 * This is an abstract class that defines the methods each lead discovery service must implement
 */
export class LeadDiscoveryService {
  /**
   * Search for organizations by keyword and region
   * @param {Object} params - Search parameters
   * @param {string[]} params.keywords - Keywords to search for
   * @param {number} [params.regionId] - Region ID to filter by
   * @param {number} [params.countryId] - Country ID to filter by
   * @param {string} [params.industry] - Industry to filter by
   * @param {number} [params.page=1] - Page number for pagination
   * @param {number} [params.limit=20] - Results per page
   * @returns {Promise<Object>} - Object containing search results and pagination info
   */
  async searchByKeywords(params) {
    throw new Error('Method not implemented')
  }

  /**
   * Get detailed information about an organization
   * @param {string} id - Organization ID
   * @param {Object} [options] - Additional options
   * @returns {Promise<Object>} - Organization details
   */
  async getOrganizationDetails(id, options = {}) {
    throw new Error('Method not implemented')
  }

  /**
   * Get name of the service
   * @returns {string} - Service name
   */
  getName() {
    throw new Error('Method not implemented')
  }

  /**
   * Check if the service is available
   * @returns {Promise<boolean>} - True if available
   */
  async isAvailable() {
    throw new Error('Method not implemented')
  }
} 