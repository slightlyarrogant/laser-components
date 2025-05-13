/**
 * Interface for data enrichment services
 * This is an abstract class that defines methods each enrichment service must implement
 */
export class DataEnrichmentService {
  /**
   * Enrich lead data with additional information
   * @param {Object} lead - Lead data to enrich
   * @param {Object} [options] - Additional options
   * @returns {Promise<Object>} - Enriched lead data
   */
  async enrichLeadData(lead, options = {}) {
    throw new Error('Method not implemented')
  }

  /**
   * Enrich lead data by domain
   * @param {string} domain - Company domain
   * @param {Object} [options] - Additional options
   * @returns {Promise<Object>} - Enriched data
   */
  async enrichByDomain(domain, options = {}) {
    throw new Error('Method not implemented')
  }

  /**
   * Enrich lead data by company name
   * @param {string} name - Company name
   * @param {Object} [options] - Additional options
   * @returns {Promise<Object>} - Enriched data
   */
  async enrichByName(name, options = {}) {
    throw new Error('Method not implemented')
  }

  /**
   * Enrich lead data by email
   * @param {string} email - Email address
   * @param {Object} [options] - Additional options
   * @returns {Promise<Object>} - Enriched data
   */
  async enrichByEmail(email, options = {}) {
    throw new Error('Method not implemented')
  }

  /**
   * Get service name
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