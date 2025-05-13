import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

/**
 * Enrich a single lead by ID
 * @param {string|number} leadId - ID of the lead to enrich
 * @param {Object} options - Enrichment options
 * @returns {Promise} - Promise resolving to enrichment result
 */
export const enrichLead = async (leadId, options = {}) => {
  try {
    const queryParams = new URLSearchParams();
    if (options.service) queryParams.append('service', options.service);
    if (options.overwrite !== undefined) queryParams.append('overwrite', options.overwrite);
    if (options.save !== undefined) queryParams.append('save', options.save);
    
    const url = `${API_URL}/enrichment/leads/${leadId}${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    const response = await axios.post(url);
    return response.data;
  } catch (error) {
    console.error('Error enriching lead:', error);
    throw error;
  }
};

/**
 * Enrich multiple leads in a batch
 * @param {Array<number>} leadIds - Array of lead IDs to enrich
 * @param {Object} options - Enrichment options
 * @returns {Promise} - Promise resolving to batch job result
 */
export const enrichLeadsBatch = async (leadIds, options = {}) => {
  try {
    const response = await axios.post(`${API_URL}/enrichment/leads/batch`, {
      leadIds,
      ...options
    });
    return response.data;
  } catch (error) {
    console.error('Error starting batch enrichment:', error);
    throw error;
  }
};

/**
 * Test enrichment with sample lead data
 * @param {Object} leadData - Sample lead data to test enrichment
 * @param {Object} options - Enrichment options
 * @returns {Promise} - Promise resolving to test result
 */
export const testEnrichment = async (leadData, options = {}) => {
  try {
    const queryParams = new URLSearchParams();
    if (options.service) queryParams.append('service', options.service);
    
    const url = `${API_URL}/enrichment/test${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    const response = await axios.post(url, leadData);
    return response.data;
  } catch (error) {
    console.error('Error testing enrichment:', error);
    throw error;
  }
};

/**
 * Create a new enrichment batch
 * @param {Array<number>} leadIds - Array of lead IDs to include in batch
 * @param {Object} options - Batch options
 * @returns {Promise} - Promise resolving to created batch
 */
export const createEnrichmentBatch = async (leadIds, options = {}) => {
  try {
    const response = await axios.post(`${API_URL}/enrichment/batch`, {
      leadIds,
      name: options.name,
      description: options.description
    });
    return response.data;
  } catch (error) {
    console.error('Error creating enrichment batch:', error);
    throw error;
  }
};

/**
 * Get all enrichment batches
 * @param {Object} options - Query options
 * @returns {Promise} - Promise resolving to batches with pagination
 */
export const getEnrichmentBatches = async (options = {}) => {
  try {
    const queryParams = new URLSearchParams();
    if (options.page) queryParams.append('page', options.page);
    if (options.limit) queryParams.append('limit', options.limit);
    if (options.status) queryParams.append('status', options.status);
    
    const url = `${API_URL}/enrichment/batch${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    const response = await axios.get(url);
    return response.data;
  } catch (error) {
    console.error('Error fetching enrichment batches:', error);
    throw error;
  }
};

/**
 * Get a specific enrichment batch by ID
 * @param {number} batchId - ID of the batch to retrieve
 * @returns {Promise} - Promise resolving to batch with details
 */
export const getEnrichmentBatchById = async (batchId) => {
  try {
    const response = await axios.get(`${API_URL}/enrichment/batch/${batchId}`);
    return response.data;
  } catch (error) {
    console.error(`Error fetching enrichment batch ${batchId}:`, error);
    throw error;
  }
};

/**
 * Cancel an in-progress enrichment batch
 * @param {number} batchId - ID of the batch to cancel
 * @returns {Promise} - Promise resolving to cancellation result
 */
export const cancelEnrichmentBatch = async (batchId) => {
  try {
    const response = await axios.post(`${API_URL}/enrichment/batch/${batchId}/cancel`);
    return response.data;
  } catch (error) {
    console.error(`Error canceling enrichment batch ${batchId}:`, error);
    throw error;
  }
};

/**
 * Restart a failed enrichment job
 * @param {number} jobId - ID of the job to restart
 * @returns {Promise} - Promise resolving to restart result
 */
export const restartEnrichmentJob = async (jobId) => {
  try {
    const response = await axios.post(`${API_URL}/enrichment/job/${jobId}/restart`);
    return response.data;
  } catch (error) {
    console.error(`Error restarting enrichment job ${jobId}:`, error);
    throw error;
  }
}; 