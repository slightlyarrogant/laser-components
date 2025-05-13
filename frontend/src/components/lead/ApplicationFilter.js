import React, { useState, useEffect } from 'react';
import {
  Autocomplete,
  Box,
  Card,
  CardContent,
  CardHeader,
  Chip,
  CircularProgress,
  Divider,
  Grid,
  TextField,
  Typography,
} from '@mui/material';
import applicationService from '../../services/api/applicationService';

/**
 * Component for filtering leads by application with multi-select capability
 */
const ApplicationFilter = ({ onChange, initialValues = { applicationIds: [] } }) => {
  // State for options and selected values
  const [applications, setApplications] = useState([]);
  const [selectedApplications, setSelectedApplications] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // Fetch applications on component mount
  useEffect(() => {
    const fetchApplications = async () => {
      setLoading(true);
      try {
        const response = await applicationService.getApplications();
        setApplications(response.data || []);
      } catch (error) {
        console.error('Error fetching applications:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchApplications();
  }, []);
  
  // Load initial values
  useEffect(() => {
    const loadInitialValues = async () => {
      if (initialValues.applicationIds?.length > 0) {
        setLoading(true);
        
        try {
          // Get application details for each ID
          const appPromises = initialValues.applicationIds.map(id => 
            applicationService.getApplicationById(id)
          );
          
          const appResults = await Promise.all(appPromises);
          setSelectedApplications(appResults.map(r => r.data).filter(Boolean));
        } catch (error) {
          console.error('Error loading initial application values:', error);
        } finally {
          setLoading(false);
        }
      }
    };
    
    loadInitialValues();
  }, [initialValues]);
  
  // Update parent component when selection changes
  useEffect(() => {
    if (onChange) {
      onChange({
        applicationIds: selectedApplications.map(app => app.id)
      });
    }
  }, [selectedApplications, onChange]);
  
  // Handle application selection
  const handleApplicationChange = (event, newValue) => {
    setSelectedApplications(newValue);
  };
  
  // Group applications by category for better organization
  const groupedApplications = applications.reduce((acc, app) => {
    const category = app.category?.name || 'Uncategorized';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(app);
    return acc;
  }, {});
  
  // Create an array of options with headers for the grouped autocomplete
  const groupedOptions = Object.entries(groupedApplications).map(([category, apps]) => ({
    category,
    options: apps
  }));
  
  return (
    <Card>
      <CardHeader title="Application Filter" />
      <Divider />
      <CardContent>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <Autocomplete
              multiple
              options={applications}
              groupBy={(option) => option.category?.name || 'Uncategorized'}
              getOptionLabel={(option) => option.name}
              value={selectedApplications}
              onChange={handleApplicationChange}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Applications"
                  placeholder="Select applications"
                  variant="outlined"
                  fullWidth
                  InputProps={{
                    ...params.InputProps,
                    endAdornment: (
                      <>
                        {loading ? <CircularProgress color="inherit" size={20} /> : null}
                        {params.InputProps.endAdornment}
                      </>
                    ),
                  }}
                />
              )}
              renderTags={(value, getTagProps) =>
                value.map((option, index) => (
                  <Chip
                    label={option.name}
                    {...getTagProps({ index })}
                    key={option.id}
                  />
                ))
              }
              renderOption={(props, option) => (
                <Box component="li" {...props}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                    <Typography>{option.name}</Typography>
                    {option.category && (
                      <Typography variant="caption" color="text.secondary">
                        {option.category.name}
                      </Typography>
                    )}
                  </Box>
                </Box>
              )}
            />
          </Grid>
          
          <Grid item xs={12}>
            <Typography variant="caption" color="text.secondary">
              Select one or more applications to filter leads by their application field.
            </Typography>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );
};

export default ApplicationFilter; 