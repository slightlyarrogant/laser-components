import React, { createContext, useState, useContext, useEffect } from 'react';
import axios from 'axios';
import { hasPermission } from '../utils/permissionUtils';

// Create context
const AuthContext = createContext();

// Auth provider component
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load user from localStorage on init
  useEffect(() => {
    const loadUser = async () => {
      try {
        const storedUser = localStorage.getItem('user');
        const storedToken = localStorage.getItem('token');
        
        if (storedUser && storedToken) {
          // Set up axios with the token
          axios.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
          
          // Try to get current user to validate token
          const response = await axios.get('/api/users/me');
          
          if (response.data) {
            setUser(response.data);
          } else {
            // Token invalid, clear storage
            localStorage.removeItem('user');
            localStorage.removeItem('token');
          }
        }
      } catch (err) {
        console.error('Auth initialization error:', err);
        // Token likely invalid, clear storage
        localStorage.removeItem('user');
        localStorage.removeItem('token');
      } finally {
        setLoading(false);
      }
    };
    
    loadUser();
  }, []);

  // Login function
  const login = async (email, password) => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await axios.post('/api/auth/login', { email, password });
      
      const { accessToken, user } = response.data;
      
      // Store in context state
      setUser(user);
      
      // Set axios default header
      axios.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
      
      // Store in localStorage (careful with this for security considerations in production)
      localStorage.setItem('token', accessToken);
      localStorage.setItem('user', JSON.stringify(user));
      
      return { success: true };
    } catch (err) {
      console.error('Login error:', err);
      setError(err.response?.data?.message || 'Login failed');
      return { success: false, error: err.response?.data?.message || 'Login failed' };
    } finally {
      setLoading(false);
    }
  };

  // Register function
  const register = async (userData) => {
    try {
      setLoading(true);
      setError(null);
      
      await axios.post('/api/auth/register', userData);
      
      return { success: true };
    } catch (err) {
      console.error('Registration error:', err);
      setError(err.response?.data?.message || 'Registration failed');
      return { success: false, error: err.response?.data?.message || 'Registration failed' };
    } finally {
      setLoading(false);
    }
  };

  // Logout function
  const logout = () => {
    // Clear user from state
    setUser(null);
    
    // Remove token from axios
    delete axios.defaults.headers.common['Authorization'];
    
    // Clear localStorage
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  };

  // Check permission for the current user
  const checkPermission = (resource, action) => {
    if (!user || !user.role) return false;
    return hasPermission(user.role, resource, action);
  };

  // Context value
  const value = {
    user,
    loading,
    error,
    login,
    register,
    logout,
    checkPermission,
    isAuthenticated: !!user
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Custom hook for using auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext; 