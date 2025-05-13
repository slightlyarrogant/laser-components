import axiosClient from './axiosClient';

/**
 * Get all regions with optional filters
 * @param {Object} params - Query parameters
 * @param {number|null} params.parentId - Filter by parent region ID (null for top-level regions)
 * @param {boolean} params.includeSubregions - Include subregions in response
 * @param {boolean} params.includeCountries - Include countries in response
 * @returns {Promise} Promise with regions data
 */
export const getRegions = async (params = {}) => {
  return axiosClient.get('/regions', { params });
};

/**
 * Get a region by ID
 * @param {number} id - Region ID
 * @returns {Promise} Promise with region data
 */
export const getRegionById = async (id) => {
  return axiosClient.get(`/regions/${id}`);
};

/**
 * Get all countries with optional filters
 * @param {Object} params - Query parameters
 * @param {number} params.regionId - Filter by region ID
 * @param {string} params.search - Search term for country name or code
 * @returns {Promise} Promise with countries data
 */
export const getCountries = async (params = {}) => {
  return axiosClient.get('/countries', { params });
};

/**
 * Get a country by ID
 * @param {number} id - Country ID
 * @returns {Promise} Promise with country data
 */
export const getCountryById = async (id) => {
  return axiosClient.get(`/countries/${id}`);
};

/**
 * Get a country by ISO code
 * @param {string} code - ISO country code
 * @returns {Promise} Promise with country data
 */
export const getCountryByCode = async (code) => {
  return axiosClient.get(`/countries/code/${code}`);
}; 