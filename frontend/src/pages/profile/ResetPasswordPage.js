import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link as RouterLink, useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Container,
  Paper,
  Typography,
  TextField,
  Alert,
  Link,
  CircularProgress,
} from '@mui/material';
import LockResetIcon from '@mui/icons-material/LockReset';

const ResetPasswordPage = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  
  // Handle input change
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear error when field is changed
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };
  
  // Validate form
  const validateForm = () => {
    const newErrors = {};
    
    // Password validation
    if (!formData.password) {
      newErrors.password = 'New password is required';
    } else if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    }
    
    // Confirm password validation
    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
          password: formData.password,
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to reset password');
      }
      
      setSuccess(true);
      
      // Redirect to login after 3 seconds
      setTimeout(() => {
        navigate('/login');
      }, 3000);
    } catch (error) {
      console.error('Password reset error:', error);
      setErrors({ 
        form: error.message || 'An error occurred while resetting your password. The link may be invalid or expired.'
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <>
      <Helmet>
        <title>Reset Password | Laser Components</title>
      </Helmet>
      
      <Container maxWidth="sm">
        <Box sx={{ mt: 8, mb: 4 }}>
          <Typography variant="h4" align="center" gutterBottom>
            Laser Components
          </Typography>
          <Typography variant="subtitle1" align="center" color="textSecondary" gutterBottom>
            Create a new password
          </Typography>
          
          <Paper sx={{ mt: 3, p: 3 }}>
            {success ? (
              <Box>
                <Alert severity="success" sx={{ mb: 3 }}>
                  Your password has been reset successfully!
                </Alert>
                <Typography variant="body2" sx={{ mb: 3 }}>
                  You will be redirected to the login page in a few seconds...
                </Typography>
                <Button 
                  component={RouterLink} 
                  to="/login" 
                  variant="contained" 
                  color="primary"
                  fullWidth
                >
                  Go to Login Now
                </Button>
              </Box>
            ) : (
              <Box component="form" onSubmit={handleSubmit} noValidate>
                {errors.form && (
                  <Alert severity="error" sx={{ mb: 3 }}>
                    {errors.form}
                  </Alert>
                )}
                
                <TextField
                  margin="normal"
                  required
                  fullWidth
                  name="password"
                  label="New Password"
                  type="password"
                  autoComplete="new-password"
                  value={formData.password}
                  onChange={handleChange}
                  error={!!errors.password}
                  helperText={errors.password}
                  disabled={isSubmitting}
                />
                
                <TextField
                  margin="normal"
                  required
                  fullWidth
                  name="confirmPassword"
                  label="Confirm Password"
                  type="password"
                  autoComplete="new-password"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  error={!!errors.confirmPassword}
                  helperText={errors.confirmPassword}
                  disabled={isSubmitting}
                />
                
                <Button
                  type="submit"
                  fullWidth
                  variant="contained"
                  color="primary"
                  startIcon={isSubmitting ? <CircularProgress size={24} color="inherit" /> : <LockResetIcon />}
                  disabled={isSubmitting}
                  sx={{ mt: 3, mb: 2 }}
                >
                  Reset Password
                </Button>
              </Box>
            )}
          </Paper>
          
          <Box sx={{ mt: 3, textAlign: 'center' }}>
            <Link component={RouterLink} to="/login" variant="body2">
              Return to login
            </Link>
          </Box>
        </Box>
      </Container>
    </>
  );
};

export default ResetPasswordPage; 