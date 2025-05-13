import axios from 'axios';

const API_URL = '/api/analytics';

/**
 * Get dashboard overview data
 * @returns {Promise<Object>} Dashboard overview data
 */
export const getDashboardOverview = async () => {
  try {
    const response = await axios.get(`${API_URL}/dashboard`);
    return response.data;
  } catch (error) {
    console.error('Error fetching dashboard overview:', error);
    throw error;
  }
};

/**
 * Get metric values for a specific metric
 * @param {string} metricName - Name of the metric
 * @param {Object} filters - Filters to apply
 * @param {Object} options - Options for pagination and sorting
 * @returns {Promise<Object>} Metric values with pagination info
 */
export const getMetricValues = async (metricName, filters = {}, options = {}) => {
  try {
    // Build query parameters
    const params = {
      ...filters,
      ...options
    };
    
    // Handle dimensions object if present
    if (filters.dimensions) {
      params.dimensions = JSON.stringify(filters.dimensions);
    }
    
    const response = await axios.get(`${API_URL}/metrics/${metricName}`, { params });
    return response.data;
  } catch (error) {
    console.error(`Error fetching metric values for ${metricName}:`, error);
    throw error;
  }
};

/**
 * Get aggregated metrics data
 * @param {string} metricName - Name of the metric
 * @param {Object} filters - Filters to apply
 * @returns {Promise<Array>} Aggregated metrics
 */
export const getAggregatedMetrics = async (metricName, filters = {}) => {
  try {
    // Build query parameters
    const params = { ...filters };
    
    // Handle dimensions object if present
    if (filters.dimensions) {
      params.dimensions = JSON.stringify(filters.dimensions);
    }
    
    const response = await axios.get(`${API_URL}/metrics/${metricName}/aggregated`, { params });
    return response.data;
  } catch (error) {
    console.error(`Error fetching aggregated metrics for ${metricName}:`, error);
    throw error;
  }
};

/**
 * Calculate product mapping coverage
 * @param {string} productId - Optional product ID
 * @returns {Promise<Object>} Product mapping coverage metric
 */
export const calculateProductCoverage = async (productId = null) => {
  try {
    const params = productId ? { productId } : {};
    const response = await axios.post(`${API_URL}/calculate/product-coverage`, null, { params });
    return response.data;
  } catch (error) {
    console.error('Error calculating product coverage:', error);
    throw error;
  }
};

/**
 * Calculate lead conversion rate
 * @param {Object} filters - Filters to apply
 * @returns {Promise<Object>} Lead conversion rate metric
 */
export const calculateLeadConversion = async (filters = {}) => {
  try {
    const response = await axios.post(`${API_URL}/calculate/lead-conversion`, null, { params: filters });
    return response.data;
  } catch (error) {
    console.error('Error calculating lead conversion rate:', error);
    throw error;
  }
};

/**
 * Get user activity logs
 * @param {Object} filters - Filters to apply
 * @param {Object} options - Options for pagination and sorting
 * @returns {Promise<Object>} Activity logs with pagination info
 */
export const getActivityLogs = async (filters = {}, options = {}) => {
  try {
    const params = {
      ...filters,
      ...options
    };
    
    const response = await axios.get(`${API_URL}/activity-logs`, { params });
    return response.data;
  } catch (error) {
    console.error('Error fetching activity logs:', error);
    throw error;
  }
};

/**
 * Get user activity summary
 * @param {string} userId - User ID (use 'me' for current user)
 * @param {string} period - Time period (day, week, month)
 * @returns {Promise<Object>} User activity summary
 */
export const getUserActivitySummary = async (userId = 'me', period = 'week') => {
  try {
    const url = userId === 'me' ? `${API_URL}/my-activity` : `${API_URL}/activity-logs/user/${userId}`;
    const response = await axios.get(url, { params: { period } });
    return response.data;
  } catch (error) {
    console.error('Error fetching user activity summary:', error);
    throw error;
  }
};

/**
 * Convert ISO date string to formatted date string
 * @param {string} isoString - ISO date string
 * @param {string} format - Format (short, medium, long)
 * @returns {string} Formatted date string
 */
export const formatDate = (isoString, format = 'medium') => {
  if (!isoString) return '';
  
  const date = new Date(isoString);
  
  switch (format) {
    case 'short':
      return date.toLocaleDateString();
    case 'long':
      return date.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    case 'time':
      return date.toLocaleTimeString();
    case 'full':
      return date.toLocaleString();
    case 'medium':
    default:
      return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }
};

/**
 * Helper to generate a color scale for charts
 * @param {number} count - Number of colors needed
 * @returns {Array<string>} Array of color hex codes
 */
export const generateColorScale = (count = 5) => {
  const baseColors = [
    '#8884d8', // Purple
    '#82ca9d', // Green
    '#ffc658', // Yellow
    '#ff8042', // Orange
    '#0088fe', // Blue
    '#00c49f', // Teal
    '#ffbb28', // Yellow/Orange
    '#ff8042', // Orange
    '#a4de6c', // Light Green
    '#d0ed57'  // Lime
  ];
  
  // If we need more colors than in our base set, generate them
  if (count <= baseColors.length) {
    return baseColors.slice(0, count);
  }
  
  // For larger sets, generate colors by interpolating
  const result = [...baseColors];
  const numToGenerate = count - baseColors.length;
  
  for (let i = 0; i < numToGenerate; i++) {
    const hue = (i * 360 / numToGenerate) % 360;
    result.push(`hsl(${hue}, 70%, 60%)`);
  }
  
  return result;
};

const analyticsService = {
  getDashboardOverview,
  getMetricValues,
  getAggregatedMetrics,
  calculateProductCoverage,
  calculateLeadConversion,
  getActivityLogs,
  getUserActivitySummary,
  formatDate,
  generateColorScale
};

export default analyticsService; 