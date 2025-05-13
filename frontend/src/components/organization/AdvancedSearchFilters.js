import React, { useState } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Chip,
  FormControl,
  FormControlLabel,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Slider,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import FilterListIcon from '@mui/icons-material/FilterList';

/**
 * Advanced search filters component for organization search
 */
const AdvancedSearchFilters = ({ filters, onChange }) => {
  // Default filter values
  const initialFilters = {
    industryTypes: [],
    employeeCount: [0, 10000],
    foundedAfter: null,
    foundedBefore: null,
    hasWebsite: null,
    hasContacts: null,
    sortBy: 'relevance',
    sortOrder: 'desc',
    ...filters
  };
  
  const [localFilters, setLocalFilters] = useState(initialFilters);
  
  // Industry options (predefined list)
  const industries = [
    'Aerospace',
    'Automotive',
    'Biotechnology',
    'Defense',
    'Education',
    'Electronics',
    'Energy',
    'Healthcare',
    'Information Technology',
    'Manufacturing',
    'Materials Science',
    'Optics & Photonics',
    'Pharmaceuticals',
    'Research & Development',
    'Robotics',
    'Semiconductors',
    'Telecom'
  ];
  
  // Employee count marks for the slider
  const employeeCountMarks = [
    { value: 0, label: '0' },
    { value: 100, label: '100' },
    { value: 500, label: '500' },
    { value: 1000, label: '1K' },
    { value: 5000, label: '5K' },
    { value: 10000, label: '10K+' }
  ];
  
  // Sort options
  const sortOptions = [
    { value: 'relevance', label: 'Relevance' },
    { value: 'name', label: 'Organization Name' },
    { value: 'employeeCount', label: 'Employee Count' },
    { value: 'foundedYear', label: 'Founded Year' }
  ];
  
  // Handle filter changes
  const handleFilterChange = (name, value) => {
    const updatedFilters = {
      ...localFilters,
      [name]: value
    };
    
    setLocalFilters(updatedFilters);
    
    // Notify parent component
    if (onChange) {
      onChange(updatedFilters);
    }
  };
  
  // Handle industry selection
  const handleIndustryChange = (event) => {
    handleFilterChange('industryTypes', event.target.value);
  };
  
  // Handle employee count change
  const handleEmployeeCountChange = (event, newValue) => {
    handleFilterChange('employeeCount', newValue);
  };
  
  // Handle boolean filter change
  const handleBooleanFilter = (name) => (event) => {
    handleFilterChange(name, event.target.checked ? true : null);
  };
  
  // Format the employee count for display
  const formatEmployeeCount = (value) => {
    if (value >= 1000) {
      return `${value/1000}K`;
    }
    return value.toString();
  };
  
  // Get active filter count
  const getActiveFilterCount = () => {
    let count = 0;
    
    if (localFilters.industryTypes?.length > 0) count++;
    if (localFilters.employeeCount?.[0] > 0 || localFilters.employeeCount?.[1] < 10000) count++;
    if (localFilters.foundedAfter) count++;
    if (localFilters.foundedBefore) count++;
    if (localFilters.hasWebsite !== null) count++;
    if (localFilters.hasContacts !== null) count++;
    if (localFilters.sortBy !== 'relevance' || localFilters.sortOrder !== 'desc') count++;
    
    return count;
  };
  
  // Active filter count
  const activeFilterCount = getActiveFilterCount();
  
  return (
    <Accordion elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
      <AccordionSummary
        expandIcon={<ExpandMoreIcon />}
        aria-controls="advanced-search-filters-content"
        id="advanced-search-filters-header"
      >
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <FilterListIcon sx={{ mr: 1 }} />
          <Typography>Advanced Filters</Typography>
          {activeFilterCount > 0 && (
            <Chip
              label={activeFilterCount}
              size="small"
              color="primary"
              sx={{ ml: 1 }}
            />
          )}
        </Box>
      </AccordionSummary>
      <AccordionDetails>
        <Grid container spacing={3}>
          {/* Industry Type Filter */}
          <Grid item xs={12} md={6}>
            <FormControl fullWidth>
              <InputLabel>Industry Types</InputLabel>
              <Select
                multiple
                value={localFilters.industryTypes || []}
                onChange={handleIndustryChange}
                renderValue={(selected) => (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {selected.map((value) => (
                      <Chip key={value} label={value} size="small" />
                    ))}
                  </Box>
                )}
                label="Industry Types"
              >
                {industries.map((industry) => (
                  <MenuItem key={industry} value={industry}>
                    {industry}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          
          {/* Employee Count Range */}
          <Grid item xs={12} md={6}>
            <Typography gutterBottom>Employee Count Range</Typography>
            <Box sx={{ px: 2 }}>
              <Slider
                value={localFilters.employeeCount || [0, 10000]}
                onChange={handleEmployeeCountChange}
                valueLabelDisplay="auto"
                valueLabelFormat={formatEmployeeCount}
                min={0}
                max={10000}
                marks={employeeCountMarks}
              />
            </Box>
          </Grid>
          
          {/* Founded Year Range */}
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Founded After Year"
              type="number"
              inputProps={{ min: 1800, max: new Date().getFullYear() }}
              value={localFilters.foundedAfter || ''}
              onChange={(e) => handleFilterChange('foundedAfter', e.target.value === '' ? null : Number(e.target.value))}
            />
          </Grid>
          
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Founded Before Year"
              type="number"
              inputProps={{ min: 1800, max: new Date().getFullYear() }}
              value={localFilters.foundedBefore || ''}
              onChange={(e) => handleFilterChange('foundedBefore', e.target.value === '' ? null : Number(e.target.value))}
            />
          </Grid>
          
          {/* Boolean Filters */}
          <Grid item xs={12} sm={6}>
            <FormControlLabel
              control={
                <Switch
                  checked={localFilters.hasWebsite === true}
                  onChange={handleBooleanFilter('hasWebsite')}
                />
              }
              label="Has Website"
            />
          </Grid>
          
          <Grid item xs={12} sm={6}>
            <FormControlLabel
              control={
                <Switch
                  checked={localFilters.hasContacts === true}
                  onChange={handleBooleanFilter('hasContacts')}
                />
              }
              label="Has Contact Information"
            />
          </Grid>
          
          {/* Sorting Options */}
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth>
              <InputLabel>Sort By</InputLabel>
              <Select
                value={localFilters.sortBy || 'relevance'}
                onChange={(e) => handleFilterChange('sortBy', e.target.value)}
                label="Sort By"
              >
                {sortOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth>
              <InputLabel>Sort Order</InputLabel>
              <Select
                value={localFilters.sortOrder || 'desc'}
                onChange={(e) => handleFilterChange('sortOrder', e.target.value)}
                label="Sort Order"
              >
                <MenuItem value="asc">Ascending</MenuItem>
                <MenuItem value="desc">Descending</MenuItem>
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      </AccordionDetails>
    </Accordion>
  );
};

export default AdvancedSearchFilters; 