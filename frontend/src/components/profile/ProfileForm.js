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
  Typography,
  Alert,
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';

const ProfileForm = ({ user, onSubmit }) => {
  const [formData, setFormData] = useState({
    email: user?.email || '',
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
    
    // Email validation
    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email is invalid';
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
      await onSubmit(formData);
      setSuccessMessage('Profile updated successfully');
    } catch (error) {
      console.error('Profile update error:', error);
      
      // Handle validation errors from the server
      if (error.response && error.response.data && error.response.data.errors) {
        const serverErrors = {};
        error.response.data.errors.forEach(err => {
          serverErrors[err.param] = err.msg;
        });
        setErrors(serverErrors);
      } else {
        // Set a generic error
        setErrors({ form: error.message || 'An error occurred while updating your profile. Please try again.' });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader title="Profile Information" />
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
                name="email"
                label="Email Address"
                variant="outlined"
                fullWidth
                required
                value={formData.email}
                onChange={handleChange}
                error={!!errors.email}
                helperText={errors.email}
                disabled={isSubmitting}
              />
            </Grid>
          </Grid>
          
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 3 }}>
            <Button
              type="submit"
              variant="contained"
              color="primary"
              startIcon={isSubmitting ? <CircularProgress size={24} color="inherit" /> : <SaveIcon />}
              disabled={isSubmitting}
            >
              Save Changes
            </Button>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};

export default ProfileForm; 