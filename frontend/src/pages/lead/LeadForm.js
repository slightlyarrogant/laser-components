import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link as RouterLink } from 'react-router-dom';
import {
  Box,
  Button,
  CircularProgress,
  FormControl,
  FormHelperText,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Save as SaveIcon,
} from '@mui/icons-material';

import * as leadService from '../../services/api/leadService';
import productService from '../../services/api/productService';
import applicationService from '../../services/api/applicationService';

const LEAD_STATUS_OPTIONS = [
  { value: 'NEW', label: 'New' },
  { value: 'CONTACTED', label: 'Contacted' },
  { value: 'QUALIFIED', label: 'Qualified' },
  { value: 'LOST', label: 'Lost' },
  { value: 'WON', label: 'Won' },
];

const initialFormState = {
  name: '',
  email: '',
  phone: '',
  website: '',
  industry: '',
  location: '',
  description: '',
  employeeCount: '',
  annualRevenue: '',
  productId: '',
  applicationId: '',
  status: 'NEW',
  tags: [],
};

const LeadForm = ({ isEdit = false }) => {
  const navigate = useNavigate();
  const { id } = useParams();
  
  // Form state
  const [formData, setFormData] = useState(initialFormState);
  const [errors, setErrors] = useState({});
  const [products, setProducts] = useState([]);
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [formError, setFormError] = useState(null);
  
  // Load products and applications data
  useEffect(() => {
    const fetchReferenceData = async () => {
      try {
        const [productsData, applicationsData] = await Promise.all([
          productService.getProducts(),
          applicationService.getApplications(),
        ]);
        
        setProducts(productsData.data || []);
        setApplications(applicationsData.data || []);
      } catch (err) {
        console.error('Error loading reference data:', err);
        setFormError('Failed to load products and applications data.');
      }
    };
    
    fetchReferenceData();
  }, []);
  
  // Load lead data if editing
  useEffect(() => {
    if (isEdit && id) {
      const fetchLead = async () => {
        try {
          setLoading(true);
          const leadData = await leadService.getLeadById(id);
          
          // Transform lead data for the form
          setFormData({
            name: leadData.name || '',
            email: leadData.email || '',
            phone: leadData.phone || '',
            website: leadData.website || '',
            industry: leadData.industry || '',
            location: leadData.location || '',
            description: leadData.description || '',
            employeeCount: leadData.employeeCount || '',
            annualRevenue: leadData.annualRevenue || '',
            productId: leadData.productId || '',
            applicationId: leadData.applicationId || '',
            status: leadData.status || 'NEW',
            tags: leadData.tags || [],
          });
          
          setLoading(false);
        } catch (err) {
          console.error('Error loading lead data:', err);
          setFormError('Failed to load lead data. Please try again.');
          setLoading(false);
        }
      };
      
      fetchLead();
    }
  }, [isEdit, id]);
  
  // Handle form input changes
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Clear error when field is updated
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }));
    }
  };
  
  // Validate form
  const validateForm = () => {
    const newErrors = {};
    
    // Required fields
    if (!formData.name) newErrors.name = 'Name is required';
    if (!formData.productId) newErrors.productId = 'Product is required';
    if (!formData.applicationId) newErrors.applicationId = 'Application is required';
    
    // Email validation
    if (formData.email && !/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(formData.email)) {
      newErrors.email = 'Invalid email address';
    }
    
    // URL validation
    if (formData.website && !/^(https?:\/\/)?(www\.)?[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(\/.*)?$/i.test(formData.website)) {
      newErrors.website = 'Invalid website URL';
    }
    
    // Number validation
    if (formData.employeeCount && (isNaN(formData.employeeCount) || formData.employeeCount < 0)) {
      newErrors.employeeCount = 'Must be a positive number';
    }
    
    if (formData.annualRevenue && (isNaN(formData.annualRevenue) || formData.annualRevenue < 0)) {
      newErrors.annualRevenue = 'Must be a positive number';
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
    
    try {
      setSaveLoading(true);
      
      // Process form data
      const leadData = {
        ...formData,
        employeeCount: formData.employeeCount ? parseInt(formData.employeeCount, 10) : null,
        annualRevenue: formData.annualRevenue ? parseFloat(formData.annualRevenue) : null,
        productId: parseInt(formData.productId, 10),
        applicationId: parseInt(formData.applicationId, 10),
      };
      
      if (isEdit) {
        // Update existing lead
        await leadService.updateLead(id, leadData);
      } else {
        // Create new lead
        await leadService.createLead(leadData);
      }
      
      // Navigate back to leads list
      navigate('/leads');
    } catch (err) {
      console.error('Error saving lead:', err);
      
      // Check for specific error types
      if (err.response?.status === 409) {
        // Duplicate lead detected
        setFormError('A similar lead already exists. Please check for duplicates.');
      } else {
        setFormError('Failed to save lead. Please try again.');
      }
      
      setSaveLoading(false);
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Button 
            variant="outlined" 
            startIcon={<ArrowBackIcon />} 
            component={RouterLink} 
            to="/leads"
            sx={{ mr: 2 }}
          >
            Back
          </Button>
          <Typography variant="h4" component="h1">
            {isEdit ? 'Edit Lead' : 'Create Lead'}
          </Typography>
        </Box>
      </Box>
      
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Paper sx={{ p: 3 }}>
          {formError && (
            <Box sx={{ mb: 3, p: 2, bgcolor: 'error.light', borderRadius: 1 }}>
              <Typography color="error">{formError}</Typography>
            </Box>
          )}
          
          <form onSubmit={handleSubmit}>
            <Grid container spacing={3}>
              {/* Basic Information */}
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom>
                  Basic Information
                </Typography>
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Organization Name *"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  error={!!errors.name}
                  helperText={errors.name}
                  required
                />
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Industry"
                  name="industry"
                  value={formData.industry}
                  onChange={handleChange}
                  error={!!errors.industry}
                  helperText={errors.industry}
                />
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  error={!!errors.email}
                  helperText={errors.email}
                />
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Phone"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  error={!!errors.phone}
                  helperText={errors.phone}
                />
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Website"
                  name="website"
                  value={formData.website}
                  onChange={handleChange}
                  error={!!errors.website}
                  helperText={errors.website || 'e.g., https://example.com'}
                  placeholder="https://example.com"
                />
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Location"
                  name="location"
                  value={formData.location}
                  onChange={handleChange}
                  error={!!errors.location}
                  helperText={errors.location}
                  placeholder="City, Country"
                />
              </Grid>
              
              {/* Business Information */}
              <Grid item xs={12} sx={{ mt: 2 }}>
                <Typography variant="h6" gutterBottom>
                  Business Information
                </Typography>
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Employee Count"
                  name="employeeCount"
                  type="number"
                  value={formData.employeeCount}
                  onChange={handleChange}
                  error={!!errors.employeeCount}
                  helperText={errors.employeeCount}
                  inputProps={{ min: 0 }}
                />
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Annual Revenue"
                  name="annualRevenue"
                  type="number"
                  value={formData.annualRevenue}
                  onChange={handleChange}
                  error={!!errors.annualRevenue}
                  helperText={errors.annualRevenue}
                  inputProps={{ min: 0, step: 1000 }}
                />
              </Grid>
              
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  multiline
                  rows={4}
                  label="Description"
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  error={!!errors.description}
                  helperText={errors.description}
                />
              </Grid>
              
              {/* Classification */}
              <Grid item xs={12} sx={{ mt: 2 }}>
                <Typography variant="h6" gutterBottom>
                  Classification
                </Typography>
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth error={!!errors.productId} required>
                  <InputLabel>Product *</InputLabel>
                  <Select
                    name="productId"
                    value={formData.productId}
                    onChange={handleChange}
                    label="Product *"
                  >
                    <MenuItem value="">
                      <em>Select a product</em>
                    </MenuItem>
                    {products.map(product => (
                      <MenuItem key={product.id} value={product.id}>
                        {product.name}
                      </MenuItem>
                    ))}
                  </Select>
                  {errors.productId && <FormHelperText>{errors.productId}</FormHelperText>}
                </FormControl>
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth error={!!errors.applicationId} required>
                  <InputLabel>Application *</InputLabel>
                  <Select
                    name="applicationId"
                    value={formData.applicationId}
                    onChange={handleChange}
                    label="Application *"
                  >
                    <MenuItem value="">
                      <em>Select an application</em>
                    </MenuItem>
                    {applications.map(application => (
                      <MenuItem key={application.id} value={application.id}>
                        {application.name}
                      </MenuItem>
                    ))}
                  </Select>
                  {errors.applicationId && <FormHelperText>{errors.applicationId}</FormHelperText>}
                </FormControl>
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Status</InputLabel>
                  <Select
                    name="status"
                    value={formData.status}
                    onChange={handleChange}
                    label="Status"
                  >
                    {LEAD_STATUS_OPTIONS.map(option => (
                      <MenuItem key={option.value} value={option.value}>
                        {option.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              
              {/* Form Actions */}
              <Grid item xs={12} sx={{ mt: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
                  <Button
                    variant="outlined"
                    component={RouterLink}
                    to="/leads"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="contained"
                    color="primary"
                    startIcon={saveLoading ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />}
                    disabled={saveLoading}
                  >
                    {isEdit ? 'Update Lead' : 'Create Lead'}
                  </Button>
                </Box>
              </Grid>
            </Grid>
          </form>
        </Paper>
      )}
    </Box>
  );
};

export default LeadForm; 