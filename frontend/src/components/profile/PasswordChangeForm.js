import React, { useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  CircularProgress,
  Divider,
  Grid,
  TextField,
  Alert,
} from '@mui/material';
import LockResetIcon from '@mui/icons-material/LockReset';

const PasswordChangeForm = ({ onSubmit }) => {
  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

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
    
    // Clear success message when form is modified
    if (successMessage) {
      setSuccessMessage('');
    }
  };

  // Validate form
  const validateForm = () => {
    const newErrors = {};
    
    // Current password validation
    if (!formData.currentPassword) {
      newErrors.currentPassword = 'Current password is required';
    }
    
    // New password validation
    if (!formData.newPassword) {
      newErrors.newPassword = 'New password is required';
    } else if (formData.newPassword.length < 8) {
      newErrors.newPassword = 'Password must be at least 8 characters';
    }
    
    // Confirm password validation
    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your new password';
    } else if (formData.newPassword !== formData.confirmPassword) {
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
      // Only send current and new password to the API
      const passwordData = {
        currentPassword: formData.currentPassword,
        newPassword: formData.newPassword,
      };
      
      await onSubmit(passwordData);
      
      // Clear form on success
      setFormData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
      
      setSuccessMessage('Password changed successfully');
    } catch (error) {
      console.error('Password change error:', error);
      
      // Handle validation errors from the server
      if (error.response && error.response.data && error.response.data.errors) {
        const serverErrors = {};
        error.response.data.errors.forEach(err => {
          serverErrors[err.param] = err.msg;
        });
        setErrors(serverErrors);
      } else {
        // Set a generic error or use server message if available
        setErrors({ 
          form: error.response?.data?.message || 
                error.message || 
                'An error occurred while changing your password. Please try again.' 
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader title="Change Password" />
      <Divider />
      <CardContent>
        <Box component="form" onSubmit={handleSubmit} noValidate>
          {successMessage && (
            <Alert severity="success" sx={{ mb: 3 }}>
              {successMessage}
            </Alert>
          )}
          
          {errors.form && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {errors.form}
            </Alert>
          )}
          
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <TextField
                name="currentPassword"
                label="Current Password"
                type="password"
                variant="outlined"
                fullWidth
                required
                value={formData.currentPassword}
                onChange={handleChange}
                error={!!errors.currentPassword}
                helperText={errors.currentPassword}
                disabled={isSubmitting}
              />
            </Grid>
            
            <Grid item xs={12}>
              <TextField
                name="newPassword"
                label="New Password"
                type="password"
                variant="outlined"
                fullWidth
                required
                value={formData.newPassword}
                onChange={handleChange}
                error={!!errors.newPassword}
                helperText={errors.newPassword}
                disabled={isSubmitting}
              />
            </Grid>
            
            <Grid item xs={12}>
              <TextField
                name="confirmPassword"
                label="Confirm New Password"
                type="password"
                variant="outlined"
                fullWidth
                required
                value={formData.confirmPassword}
                onChange={handleChange}
                error={!!errors.confirmPassword}
                helperText={errors.confirmPassword}
                disabled={isSubmitting}
              />
            </Grid>
          </Grid>
          
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 3 }}>
            <Button
              type="submit"
              variant="contained"
              color="primary"
              startIcon={isSubmitting ? <CircularProgress size={24} color="inherit" /> : <LockResetIcon />}
              disabled={isSubmitting}
            >
              Change Password
            </Button>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};

export default PasswordChangeForm; 