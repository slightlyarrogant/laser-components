import axiosClient from './axiosClient';

// const API_URL = '/api';

/**
 * Service for handling application-related API calls
 */
const applicationService = {
  // Application endpoints
  getApplications: async () => {
    const response = await axiosClient.get(`/applications`);
    return response.data;
  },

  getApplicationById: async (id) => {
    const response = await axiosClient.get(`/applications/${id}`);
    return response.data;
  },

  createApplication: async (applicationData) => {
    const response = await axiosClient.post(`/applications`, applicationData);
    return response.data;
  },

  updateApplication: async (id, applicationData) => {
    const response = await axiosClient.put(`/applications/${id}`, applicationData);
    return response.data;
  },

  deleteApplication: async (id) => {
    const response = await axiosClient.delete(`/applications/${id}`);
    return response.data;
  },

  // Product mapping endpoints
  getMappedProducts: async (applicationId) => {
    const response = await axiosClient.get(`/applications/${applicationId}/products`);
    return response.data;
  },

  mapProductsToApplication: async (applicationId, productIds) => {
    const response = await axiosClient.post(
      `/applications/${applicationId}/products`, 
      { productIds }
    );
    return response.data;
  },

  unmapProductFromApplication: async (applicationId, productId) => {
    const response = await axiosClient.delete(
      `/applications/${applicationId}/products/${productId}`
    );
    return response.data;
  }
};

export default applicationService; 