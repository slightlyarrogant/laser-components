import axios from 'axios';

const API_URL = '/api';

/**
 * Service for handling organization-related API calls
 */
const organizationService = {
  // Search organizations by application keywords and region
  searchOrganizations: async (params = {}) => {
    const response = await axios.get(`${API_URL}/organizations/search`, { params });
    return response.data;
  },

  // Get organization details by ID
  getOrganizationById: async (id) => {
    const response = await axios.get(`${API_URL}/organizations/${id}`);
    return response.data;
  },

  // Search organizations by application ID
  searchByApplication: async (applicationId, params = {}) => {
    const searchParams = {
      applicationId,
      ...params
    };
    return organizationService.searchOrganizations(searchParams);
  },

  // Search organizations by region/country
  searchByRegion: async (regionId, countryId = null, params = {}) => {
    const searchParams = {
      regionId,
      ...params
    };
    
    if (countryId) {
      searchParams.countryId = countryId;
    }
    
    return organizationService.searchOrganizations(searchParams);
  },

  // Search organizations by application and region
  searchByApplicationAndRegion: async (applicationId, regionId, countryId = null, params = {}) => {
    const searchParams = {
      applicationId,
      regionId,
      ...params
    };
    
    if (countryId) {
      searchParams.countryId = countryId;
    }
    
    return organizationService.searchOrganizations(searchParams);
  },
  
  // Search organizations by keywords
  searchByKeywords: async (keywords, params = {}) => {
    // If keywords is an array, join them with commas
    const keywordsString = Array.isArray(keywords) ? keywords.join(',') : keywords;
    
    const searchParams = {
      keywords: keywordsString,
      ...params
    };
    
    return organizationService.searchOrganizations(searchParams);
  }
};

export default organizationService; 