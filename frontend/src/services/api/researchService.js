import axiosClient from './axiosClient';

const BASE_URL = '/research'; // Matches the backend route prefix

// === Basic CRUD ===

export const fetchResearchList = (params) => {
  // params could include page, limit, status, createdByUserId, etc.
  return axiosClient.get(BASE_URL, { params });
};

export const fetchResearchById = (id) => {
  return axiosClient.get(`${BASE_URL}/${id}`);
};

export const createResearch = (researchData) => {
  return axiosClient.post(BASE_URL, researchData);
};

export const updateResearch = (id, researchData) => {
  return axiosClient.put(`${BASE_URL}/${id}`, researchData);
};

export const deleteResearch = (id) => {
  return axiosClient.delete(`${BASE_URL}/${id}`);
};

// === Collaborators ===

export const addResearchCollaborator = (researchId, userId, role) => {
  return axiosClient.post(`${BASE_URL}/${researchId}/collaborators`, { userId, role });
};

export const removeResearchCollaborator = (researchId, userId) => {
  return axiosClient.delete(`${BASE_URL}/${researchId}/collaborators/${userId}`);
};

// === Attachments ===

export const addResearchAttachment = (researchId, attachmentData) => {
  // attachmentData: { url, attachmentType, description, uploadedByUserId } 
  // Note: uploadedByUserId should ideally come from context on backend, remove if changed
  return axiosClient.post(`${BASE_URL}/${researchId}/attachments`, attachmentData);
};

export const removeResearchAttachment = (researchId, attachmentId) => {
  return axiosClient.delete(`${BASE_URL}/${researchId}/attachments/${attachmentId}`);
};

// === AI Integration ===

export const generateResearchSummary = (researchId) => {
  return axiosClient.post(`${BASE_URL}/${researchId}/generate-summary`);
};

export const generateResearchRecommendations = (researchId) => {
  return axiosClient.post(`${BASE_URL}/${researchId}/generate-recommendations`);
};

export const performOnlineResearch = (query) => {
  return axiosClient.post(`${BASE_URL}/online-search`, { query });
};

export const createResearchFromTopic = (topic) => {
  // Assumes backend gets creatorUserId from auth context
  return axiosClient.post(`${BASE_URL}/ai-create`, { topic });
};

// === Version History ===

export const fetchResearchHistory = (researchId) => {
    return axiosClient.get(`${BASE_URL}/${researchId}/history`);
};

// === Stats ===

export const fetchResearchStatusCounts = () => {
    return axiosClient.get('/research/stats/status-counts');
};

// === AI Product Application Discovery ===

/**
 * Triggers the backend AI process to discover potential applications for a given product.
 * @param {number} productId - The ID of the product.
 * @returns {Promise} Axios promise for the POST request.
 */
export const discoverProductApplications = (productId) => {
  // Note: The backend route is /api/products/:productId/discover-applications
  // We need to use the correct base or construct the full path.
  // Assuming axiosClient is configured for /api base path or we use a different one.
  // Let's construct relative to root for now, assuming axiosClient base is '/'
  // If axiosClient base is '/api', then path should be `/products/${productId}/discover-applications`
  
  // Assuming axiosClient is configured with base URL http://localhost:3001/api
  return axiosClient.post(`/products/${productId}/discover-applications`);
};

// === Review Actions ===

export const approveResearch = (id) => {
  return axiosClient.put(`/research/${id}/approve`);
};

export const rejectResearch = (id) => {
  return axiosClient.put(`/research/${id}/reject`);
};

// === Collaborator Management ===

export const addCollaboratorToResearch = (researchId, userId, role) => {
  return axiosClient.post(`${BASE_URL}/${researchId}/collaborators`, { userId, role });
};

// --- Lead Discovery ---
export const discoverLeadsForResearchItem = (researchId) => {
  return axiosClient.post(`/research/${researchId}/discover-leads`);
}; 