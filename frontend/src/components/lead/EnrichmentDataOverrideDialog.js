import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  MenuItem,
  TextField,
  Typography,
} from '@mui/material';
import {
  Save as SaveIcon,
} from '@mui/icons-material';

import * as leadService from '../../services/api/leadService';

/**
 * Dialog for manually overriding a lead's enrichment data
 */
const EnrichmentDataOverrideDialog = ({ open, onClose, lead, onLeadUpdate }) => {
  // State for form data
  const [formData, setFormData] = useState({
    industry: '',
    website: '',
    location: '',
    description: '',
    employeeCount: '',
    annualRevenue: '',
    foundedYear: '',
    linkedInUrl: '',
  });
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Industry options for dropdown
  const INDUSTRY_OPTIONS = [
    'Technology',
    'Manufacturing',
    'Healthcare',
    'Financial Services',
    'Retail',
    'Education',
    'Energy',
    'Transportation',
    'Telecommunications',
    'Construction',
    'Agriculture',
    'Entertainment',
    'Hospitality',
    'Pharmaceuticals',
    'Aerospace',
    'Automotive',
    'Chemicals',
    'Electronics Manufacturing',
    'Integrated Circuit Design',
    'Computing Hardware',
    'Research & Development',
    'Technology Hardware',
    'Software Development',
    'IT Services',
    'Pharmaceuticals',
    'Biotechnology',
    'Environmental Services',
    'Other',
  ];
  
  // Initialize form when lead data changes
  useEffect(() => {
    if (lead) {
      setFormData({
        industry: lead.industry || '',
        website: lead.website || '',
        location: lead.location || '',
        description: lead.description || '',
        employeeCount: lead.employeeCount || '',
        annualRevenue: lead.annualRevenue || '',
        foundedYear: lead.foundedYear || '',
        linkedInUrl: lead.linkedInUrl || '',
      });
    }
  }, [lead]);
  
  // Handle form changes
  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData(prevData => ({
      ...prevData,
      [name]: value,
    }));
  };
  
  // Handle numeric input with validation
  const handleNumericChange = (event) => {
    const { name, value } = event.target;
    // Allow empty string or valid number
    if (value === '' || (!isNaN(Number(value)) && Number(value) >= 0)) {
      setFormData(prevData => ({
        ...prevData,
        [name]: value,
      }));
    }
  };
  
  // Form submission
  const handleSubmit = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Prepare data for API - remove empty fields
      const updateData = {};
      
      Object.keys(formData).forEach(key => {
        // Include non-empty fields
        if (formData[key] !== '') {
          // Convert numeric fields to numbers
          if (key === 'employeeCount' || key === 'foundedYear') {
            updateData[key] = parseInt(formData[key], 10);
          } else if (key === 'annualRevenue') {
            updateData[key] = parseFloat(formData[key]);
          } else {
            updateData[key] = formData[key];
          }
        }
      });
      
      // Send update to API
      const result = await leadService.overrideLeadData(lead.id, updateData);
      
      // Callback to update parent component
      if (onLeadUpdate) {
        onLeadUpdate(result.lead);
      }
      
      setLoading(false);
      onClose();
    } catch (err) {
      console.error('Error updating lead data:', err);
      setError(err.message || 'Failed to update lead data');
      setLoading(false);
    }
  };
  
  return (
    <Dialog
      open={open}
      onClose={loading ? undefined : onClose}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle>
        Override Lead Enrichment Data
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
          Manually edit lead data fields. Empty fields will not be updated.
        </Typography>
      </DialogTitle>
      <Divider />
      
      <DialogContent>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            {error && (
              <Typography color="error" gutterBottom>
                {error}
              </Typography>
            )}
            
            <Grid container spacing={3}>
              {/* Industry */}
              <Grid item xs={12} md={6}>
                <TextField
                  select
                  label="Industry"
                  name="industry"
                  value={formData.industry}
                  onChange={handleChange}
                  fullWidth
                >
                  <MenuItem value="">
                    <em>None</em>
                  </MenuItem>
                  {INDUSTRY_OPTIONS.sort().map((option) => (
                    <MenuItem key={option} value={option}>
                      {option}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              
              {/* Website */}
              <Grid item xs={12} md={6}>
                <TextField
                  label="Website"
                  name="website"
                  value={formData.website}
                  onChange={handleChange}
                  fullWidth
                  placeholder="e.g., example.com"
                />
              </Grid>
              
              {/* Location */}
              <Grid item xs={12} md={6}>
                <TextField
                  label="Location"
                  name="location"
                  value={formData.location}
                  onChange={handleChange}
                  fullWidth
                  placeholder="e.g., New York, NY"
                />
              </Grid>
              
              {/* LinkedIn URL */}
              <Grid item xs={12} md={6}>
                <TextField
                  label="LinkedIn URL"
                  name="linkedInUrl"
                  value={formData.linkedInUrl}
                  onChange={handleChange}
                  fullWidth
                  placeholder="e.g., linkedin.com/company/example"
                />
              </Grid>
              
              {/* Employee Count */}
              <Grid item xs={12} md={6}>
                <TextField
                  label="Employee Count"
                  name="employeeCount"
                  type="number"
                  value={formData.employeeCount}
                  onChange={handleNumericChange}
                  fullWidth
                  inputProps={{ min: 0 }}
                />
              </Grid>
              
              {/* Annual Revenue */}
              <Grid item xs={12} md={6}>
                <TextField
                  label="Annual Revenue ($)"
                  name="annualRevenue"
                  type="number"
                  value={formData.annualRevenue}
                  onChange={handleNumericChange}
                  fullWidth
                  inputProps={{ min: 0 }}
                />
              </Grid>
              
              {/* Founded Year */}
              <Grid item xs={12} md={6}>
                <TextField
                  label="Founded Year"
                  name="foundedYear"
                  type="number"
                  value={formData.foundedYear}
                  onChange={handleNumericChange}
                  fullWidth
                  inputProps={{ min: 1800, max: new Date().getFullYear() }}
                />
              </Grid>
              
              {/* Description */}
              <Grid item xs={12}>
                <TextField
                  label="Description"
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  fullWidth
                  multiline
                  rows={3}
                  placeholder="Company description"
                />
              </Grid>
            </Grid>
          </>
        )}
      </DialogContent>
      
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button
          onClick={onClose}
          disabled={loading}
        >
          Cancel
        </Button>
        <Button
          variant="contained"
          color="primary"
          onClick={handleSubmit}
          disabled={loading}
          startIcon={<SaveIcon />}
        >
          Save Changes
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default EnrichmentDataOverrideDialog; 