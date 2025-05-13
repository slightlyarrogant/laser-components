import axiosClient from './axiosClient';

/**
 * Get all tag presets
 * @param {Object} params - Query parameters
 * @returns {Promise} The API response
 */
export const getTagPresets = async (params = {}) => {
  return axiosClient.get('/api/tag-presets', { params });
};

/**
 * Get a tag preset by ID
 * @param {number} id - Tag preset ID
 * @returns {Promise} The API response
 */
export const getTagPresetById = async (id) => {
  return axiosClient.get(`/api/tag-presets/${id}`);
};

/**
 * Create a new tag preset
 * @param {Object} data - Tag preset data
 * @returns {Promise} The API response
 */
export const createTagPreset = async (data) => {
  return axiosClient.post('/api/tag-presets', data);
};

/**
 * Update a tag preset
 * @param {number} id - Tag preset ID
 * @param {Object} data - Updated tag preset data
 * @returns {Promise} The API response
 */
export const updateTagPreset = async (id, data) => {
  return axiosClient.put(`/api/tag-presets/${id}`, data);
};

/**
 * Delete a tag preset
 * @param {number} id - Tag preset ID
 * @returns {Promise} The API response
 */
export const deleteTagPreset = async (id) => {
  return axiosClient.delete(`/api/tag-presets/${id}`);
}; 