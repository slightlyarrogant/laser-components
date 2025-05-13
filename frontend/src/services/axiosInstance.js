import axios from 'axios';

// Determine the base URL for the API
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

// Create an Axios instance
const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000, // Optional: set a timeout for requests (10 seconds)
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor: Add the access token to the Authorization header
axiosInstance.interceptors.request.use(
  (config) => {
    // TODO: Retrieve the access token from your auth state/storage
    // Example using localStorage (adjust to your actual storage method):
    const accessToken = localStorage.getItem('accessToken'); 
    
    if (accessToken) {
      config.headers['Authorization'] = `Bearer ${accessToken}`;
    }
    return config;
  },
  (error) => {
    // Handle request error
    return Promise.reject(error);
  }
);

// Response Interceptor (Optional but Recommended):
// Handle common responses like 401 Unauthorized (e.g., trigger logout or token refresh)
axiosInstance.interceptors.response.use(
  (response) => {
    // Any status code that lie within the range of 2xx cause this function to trigger
    return response;
  },
  async (error) => {
    // Any status codes that falls outside the range of 2xx cause this function to trigger
    const originalRequest = error.config;

    // Example: Handle token expiry and attempt refresh
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true; // Mark request to prevent infinite retry loops
      
      try {
        // TODO: Call your backend's /auth/refresh endpoint
        // Note: This assumes your /auth/refresh endpoint relies on the httpOnly refreshToken cookie
        const refreshResponse = await axiosInstance.post('/auth/refresh'); 
        const newAccessToken = refreshResponse.data.accessToken;

        // TODO: Update the stored access token
        localStorage.setItem('accessToken', newAccessToken); // Update stored token

        // Update the header for the original request and retry
        originalRequest.headers['Authorization'] = `Bearer ${newAccessToken}`;
        return axiosInstance(originalRequest); // Retry the original request with the new token
        
      } catch (refreshError) {
        console.error('Token refresh failed:', refreshError);
        // TODO: Trigger logout if refresh fails
        // Example: logout(); // Call your global logout function
        // Redirect to login page
        window.location.href = '/login'; // Force redirect if other methods fail
        return Promise.reject(refreshError);
      }
    }

    // Handle other errors (e.g., 403 Forbidden, 500 Server Error)
    return Promise.reject(error);
  }
);

export default axiosInstance; 