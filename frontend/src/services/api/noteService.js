import axiosClient from './axiosClient';

/**
 * Get all notes for a lead
 * @param {number} leadId - Lead ID
 * @param {Object} params - Query parameters
 * @returns {Promise} The API response
 */
export const getNotesForLead = async (leadId, params = {}) => {
  return axiosClient.get(`/api/leads/${leadId}/notes`, { params });
};

/**
 * Get a note by ID
 * @param {number} id - Note ID
 * @returns {Promise} The API response
 */
export const getNoteById = async (id) => {
  return axiosClient.get(`/api/notes/${id}`);
};

/**
 * Create a new note for a lead
 * @param {number} leadId - Lead ID
 * @param {Object} data - Note data
 * @returns {Promise} The API response
 */
export const createNote = async (leadId, data) => {
  return axiosClient.post(`/api/leads/${leadId}/notes`, data);
};

/**
 * Update a note
 * @param {number} id - Note ID
 * @param {Object} data - Updated note data
 * @returns {Promise} The API response
 */
export const updateNote = async (id, data) => {
  return axiosClient.put(`/api/notes/${id}`, data);
};

/**
 * Delete a note
 * @param {number} id - Note ID
 * @returns {Promise} The API response
 */
export const deleteNote = async (id) => {
  return axiosClient.delete(`/api/notes/${id}`);
}; 