import axiosClient from './axiosClient';

/**
 * Fetch leads with optional filtering and pagination
 * @param {Object} params - Query parameters
 * @returns {Promise} - Promise resolving to leads data
 */
export const getLeads = async (params = {}) => {
  try {
    const response = await axiosClient.get(`/leads`, { params });
    return response.data;
  } catch (error) {
    console.error('Error fetching leads:', error);
    throw error;
  }
};

/**
 * Fetch a single lead by ID
 * @param {number} id - Lead ID
 * @returns {Promise} - Promise resolving to lead data
 */
export const getLeadById = async (id) => {
  try {
    const response = await axiosClient.get(`/leads/${id}`);
    return response.data;
  } catch (error) {
    console.error(`Error fetching lead ${id}:`, error);
    throw error;
  }
};

/**
 * Create a new lead
 * @param {Object} leadData - Lead data to create
 * @param {boolean} skipDuplicateCheck - Whether to skip duplicate checking
 * @returns {Promise} - Promise resolving to created lead
 */
export const createLead = async (leadData, skipDuplicateCheck = false) => {
  try {
    const response = await axiosClient.post(`/leads`, leadData, {
      params: { skipDuplicateCheck: skipDuplicateCheck ? 'true' : 'false' }
    });
    return response.data;
  } catch (error) {
    console.error('Error creating lead:', error);
    throw error;
  }
};

/**
 * Update an existing lead
 * @param {number} id - Lead ID
 * @param {Object} leadData - Updated lead data
 * @returns {Promise} - Promise resolving to updated lead
 */
export const updateLead = async (id, leadData) => {
  try {
    const response = await axiosClient.put(`/leads/${id}`, leadData);
    return response.data;
  } catch (error) {
    console.error(`Error updating lead ${id}:`, error);
    throw error;
  }
};

/**
 * Delete a lead
 * @param {number} id - Lead ID
 * @returns {Promise} - Promise resolving when lead is deleted
 */
export const deleteLead = async (id) => {
  try {
    await axiosClient.delete(`/leads/${id}`);
    return true;
  } catch (error) {
    console.error(`Error deleting lead ${id}:`, error);
    throw error;
  }
};

/**
 * Save search results as leads
 * @param {Array} organizations - Organization data to convert to leads
 * @param {number} productId - Product ID to associate with leads
 * @param {number} applicationId - Application ID to associate with leads
 * @param {boolean} skipDuplicateCheck - Whether to skip duplicate checking
 * @returns {Promise} - Promise resolving to creation results
 */
export const saveSearchResultsAsLeads = async (organizations, productId, applicationId, skipDuplicateCheck = false) => {
  try {
    const response = await axiosClient.post(`/leads/from-search`, {
      organizations,
      productId,
      applicationId,
      skipDuplicateCheck
    });
    return response.data;
  } catch (error) {
    console.error('Error saving search results as leads:', error);
    throw error;
  }
};

/**
 * Update tags for multiple leads
 * @param {Array} leadIds - Array of lead IDs
 * @param {Array} tags - Tags to add/remove
 * @param {string} operation - Operation: 'add', 'remove', or 'set'
 * @returns {Promise} - Promise resolving to operation result
 */
export const updateLeadTags = async (leadIds, tags, operation = 'add') => {
  try {
    const response = await axiosClient.post(`/leads/tags`, {
      leadIds,
      tags,
      operation
    });
    return response.data;
  } catch (error) {
    console.error('Error updating lead tags:', error);
    throw error;
  }
};

/**
 * Update status for multiple leads
 * @param {Array} leadIds - Array of lead IDs
 * @param {string} status - New status
 * @returns {Promise} - Promise resolving to operation result
 */
export const updateLeadStatus = async (leadIds, status) => {
  try {
    const response = await axiosClient.post(`/leads/status`, {
      leadIds,
      status
    });
    return response.data;
  } catch (error) {
    console.error('Error updating lead status:', error);
    throw error;
  }
};

/**
 * Find potential duplicates for a lead
 * @param {Object} leadData - Lead data to check
 * @param {number} threshold - Similarity threshold (0-1)
 * @param {boolean} includeScores - Whether to include similarity scores
 * @returns {Promise} - Promise resolving to potential duplicates
 */
export const findDuplicateLeads = async (leadData, threshold, includeScores = false) => {
  try {
    const response = await axiosClient.post(`/leads/duplicates`, leadData, {
      params: {
        threshold,
        includeScores: includeScores ? 'true' : 'false'
      }
    });
    return response.data;
  } catch (error) {
    console.error('Error finding duplicate leads:', error);
    throw error;
  }
};

/**
 * Merge two leads
 * @param {number} primaryId - ID of primary lead (will be kept)
 * @param {number} secondaryId - ID of secondary lead (will be deleted)
 * @param {boolean} keepSecondary - Whether to keep the secondary lead
 * @returns {Promise} - Promise resolving to merged lead
 */
export const mergeLeads = async (primaryId, secondaryId, keepSecondary = false) => {
  try {
    const response = await axiosClient.post(`/leads/merge`, {
      primaryId,
      secondaryId,
      keepSecondary
    });
    return response.data;
  } catch (error) {
    console.error('Error merging leads:', error);
    throw error;
  }
};

/**
 * Get a score for a single lead
 * @param {number} leadId - Lead ID to score
 * @returns {Promise} - Promise resolving to score data
 */
export const getLeadScore = async (leadId) => {
  try {
    const response = await axiosClient.get(`/leads/${leadId}/score`);
    return response.data;
  } catch (error) {
    console.error(`Error scoring lead ${leadId}:`, error);
    throw error;
  }
};

/**
 * Score multiple leads
 * @param {Array<number>} leadIds - Array of lead IDs to score
 * @returns {Promise} - Promise resolving to batch scoring results
 */
export const scoreLeads = async (leadIds) => {
  try {
    const response = await axiosClient.post(`/leads/scoring/batch`, {
      leadIds
    });
    return response.data;
  } catch (error) {
    console.error('Error scoring leads:', error);
    throw error;
  }
};

/**
 * Get all leads with scores, filtered and paginated
 * @param {Object} params - Query parameters including score filters
 * @returns {Promise} - Promise resolving to scored leads
 */
export const getScoredLeads = async (params = {}) => {
  try {
    const response = await axiosClient.get(`/leads/scoring/scored`, { params });
    return response.data;
  } catch (error) {
    console.error('Error fetching scored leads:', error);
    throw error;
  }
};

/**
 * Override a lead's score or score components
 * @param {number} leadId - Lead ID to override
 * @param {Object} overrideData - Override data
 * @returns {Promise} - Promise resolving to override result
 */
export const overrideLeadScore = async (leadId, overrideData) => {
  try {
    const response = await axiosClient.post(`/leads/${leadId}/score/override`, overrideData);
    return response.data;
  } catch (error) {
    console.error(`Error overriding score for lead ${leadId}:`, error);
    throw error;
  }
};

/**
 * Get a lead's score override information
 * @param {number} leadId - Lead ID to get override for
 * @returns {Promise} - Promise resolving to override information
 */
export const getLeadScoreOverride = async (leadId) => {
  try {
    const response = await axiosClient.get(`/leads/${leadId}/score/override`);
    return response.data;
  } catch (error) {
    // 404 is expected if there's no override
    if (error.response && error.response.status === 404) {
      return null;
    }
    console.error(`Error fetching score override for lead ${leadId}:`, error);
    throw error;
  }
};

/**
 * Remove a lead's score override
 * @param {number} leadId - Lead ID to remove override for
 * @returns {Promise} - Promise resolving to removal result
 */
export const removeLeadScoreOverride = async (leadId) => {
  try {
    const response = await axiosClient.delete(`/leads/${leadId}/score/override`);
    return response.data;
  } catch (error) {
    console.error(`Error removing score override for lead ${leadId}:`, error);
    throw error;
  }
};

/**
 * Override lead data fields
 * @param {number} leadId - Lead ID to override data for
 * @param {Object} dataOverride - Data to override
 * @returns {Promise} - Promise resolving to updated lead
 */
export const overrideLeadData = async (leadId, dataOverride) => {
  try {
    const response = await axiosClient.post(`/leads/${leadId}/data/override`, dataOverride);
    return response.data;
  } catch (error) {
    console.error(`Error overriding data for lead ${leadId}:`, error);
    throw error;
  }
}; 