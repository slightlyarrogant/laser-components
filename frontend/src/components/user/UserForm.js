import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  FormControl,
  FormHelperText,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import CancelIcon from '@mui/icons-material/Cancel';

const UserForm = ({ user, onSubmit, isEditing = false }) => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: user?.email || '',
    password: '',
    role: user?.role || 'SALES',
  });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    
    // Email validation
    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email is invalid';
    }
    
    // Password validation (only required for new users)
    if (!isEditing && !formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password && formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    }
    
    // Role validation
    if (!formData.role) {
      newErrors.role = 'Role is required';
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
      // Remove password if it's empty in edit mode
      const submissionData = { ...formData };
      if (isEditing && !submissionData.password) {
        delete submissionData.password;
      }
      
      await onSubmit(submissionData);
      navigate('/admin/users');
    } catch (error) {
      console.error('Form submission error:', error);
      
      // Handle validation errors from the server
      if (error.response && error.response.data && error.response.data.errors) {
        const serverErrors = {};
        error.response.data.errors.forEach(err => {
          serverErrors[err.param] = err.msg;
        });
        setErrors(serverErrors);
      } else {
        // Set a generic error
        setErrors({ form: 'An error occurred while saving the user. Please try again.' });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle cancel button
  const handleCancel = () => {
    navigate('/admin/users');
  };

  return (
    <Box component="form" onSubmit={handleSubmit} noValidate>
      <Card>
        <CardContent>
          <Typography variant="h6" component="h2" gutterBottom>
            {isEditing ? 'Edit User' : 'Create New User'}
          </Typography>
          
          {errors.form && (
            <Typography color="error" sx={{ mb: 2 }}>
              {errors.form}
            </Typography>
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
            
            <Grid item xs={12}>
              <TextField
                name="password"
                label={isEditing ? 'New Password (leave blank to keep current)' : 'Password'}
                type="password"
                variant="outlined"
                fullWidth
                required={!isEditing}
                value={formData.password}
                onChange={handleChange}
                error={!!errors.password}
                helperText={errors.password}
                disabled={isSubmitting}
              />
            </Grid>
            
            <Grid item xs={12}>
              <FormControl fullWidth error={!!errors.role}>
                <InputLabel id="role-label">Role</InputLabel>
                <Select
                  labelId="role-label"
                  name="role"
                  value={formData.role}
                  label="Role"
                  onChange={handleChange}
                  disabled={isSubmitting}
                >
                  <MenuItem value="ADMIN">Admin</MenuItem>
                  <MenuItem value="RESEARCHER">Researcher</MenuItem>
                  <MenuItem value="SALES">Sales</MenuItem>
                </Select>
                {errors.role && <FormHelperText>{errors.role}</FormHelperText>}
              </FormControl>
            </Grid>
          </Grid>
          
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 3, gap: 2 }}>
            <Button
              variant="outlined"
              color="secondary"
              onClick={handleCancel}
              startIcon={<CancelIcon />}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              color="primary"
              startIcon={isSubmitting ? <CircularProgress size={24} color="inherit" /> : <SaveIcon />}
              disabled={isSubmitting}
            >
              {isEditing ? 'Update' : 'Create'}
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};

export default UserForm; 