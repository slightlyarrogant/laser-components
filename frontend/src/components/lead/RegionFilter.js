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
import * as regionService from '../../services/api/regionService';

/**
 * Component for filtering leads by geographic region and country
 */
const RegionFilter = ({ onChange, initialValues = { regionIds: [], countryIds: [] } }) => {
  // State for options
  const [regions, setRegions] = useState([]);
  const [countries, setCountries] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // State for selections
  const [selectedRegions, setSelectedRegions] = useState([]); 
  const [selectedCountries, setSelectedCountries] = useState([]);
  const [countrySearchTerm, setCountrySearchTerm] = useState('');
  
  // Fetch regions on component mount
  useEffect(() => {
    const fetchRegionData = async () => {
      setLoading(true);
      try {
        const regionsResponse = await regionService.getRegions({
          includeSubregions: true
        });
        
        setRegions(regionsResponse.data);
      } catch (error) {
        console.error('Error fetching regions:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchRegionData();
  }, []);
  
  // Fetch countries when regions change or on search
  useEffect(() => {
    const fetchCountries = async () => {
      // Check if we need to filter by region
      const regionIds = selectedRegions.map(r => r.id);
      
      // Only search if we have a search term of at least 2 characters or have regions selected
      if ((countrySearchTerm.length >= 2) || regionIds.length > 0) {
        setLoading(true);
        try {
          const params = {};
          
          // Add region filter if we have selected regions
          if (regionIds.length === 1) {
            params.regionId = regionIds[0];
          }
          
          // Add search term if we have one
          if (countrySearchTerm.length >= 2) {
            params.search = countrySearchTerm;
          }
          
          const countriesResponse = await regionService.getCountries(params);
          setCountries(countriesResponse.data);
        } catch (error) {
          console.error('Error fetching countries:', error);
        } finally {
          setLoading(false);
        }
      }
    };
    
    // Debounce the search
    const timeoutId = setTimeout(fetchCountries, 300);
    return () => clearTimeout(timeoutId);
  }, [selectedRegions, countrySearchTerm]);
  
  // Load initial values
  useEffect(() => {
    const loadInitialValues = async () => {
      if (
        initialValues.regionIds?.length > 0 || 
        initialValues.countryIds?.length > 0
      ) {
        setLoading(true);
        
        try {
          // Load regions first
          if (initialValues.regionIds?.length > 0) {
            const regionPromises = initialValues.regionIds.map(id => 
              regionService.getRegionById(id)
            );
            
            const regionResults = await Promise.all(regionPromises);
            setSelectedRegions(regionResults.map(r => r.data).filter(Boolean));
          }
          
          // Then load countries
          if (initialValues.countryIds?.length > 0) {
            const countryPromises = initialValues.countryIds.map(id => 
              regionService.getCountryById(id)
            );
            
            const countryResults = await Promise.all(countryPromises);
            setSelectedCountries(countryResults.map(c => c.data).filter(Boolean));
          }
        } catch (error) {
          console.error('Error loading initial values:', error);
        } finally {
          setLoading(false);
        }
      }
    };
    
    loadInitialValues();
  }, [initialValues]);
  
  // Update parent component when selections change
  useEffect(() => {
    if (onChange) {
      onChange({
        regionIds: selectedRegions.map(r => r.id),
        countryIds: selectedCountries.map(c => c.id)
      });
    }
  }, [selectedRegions, selectedCountries, onChange]);
  
  // Handle region selection
  const handleRegionChange = (event, newValue) => {
    setSelectedRegions(newValue);
    
    // Clear country selection if we're selecting regions
    // (to avoid having countries that might not be in the selected regions)
    if (newValue.length !== selectedRegions.length) {
      setSelectedCountries([]);
    }
  };
  
  // Handle country selection
  const handleCountryChange = (event, newValue) => {
    setSelectedCountries(newValue);
  };
  
  // Handle country search input
  const handleCountrySearchChange = (event) => {
    setCountrySearchTerm(event.target.value);
  };
  
  return (
    <Card>
      <CardHeader title="Geographic Filter" />
      <Divider />
      <CardContent>
        <Grid container spacing={2}>
          {/* Region selection */}
          <Grid item xs={12}>
            <Autocomplete
              multiple
              options={regions}
              getOptionLabel={(option) => option.name}
              value={selectedRegions}
              onChange={handleRegionChange}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Regions"
                  placeholder="Select regions"
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
            />
          </Grid>
          
          {/* Country selection */}
          <Grid item xs={12}>
            <Autocomplete
              multiple
              options={countries}
              getOptionLabel={(option) => option.name}
              value={selectedCountries}
              onChange={handleCountryChange}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Countries"
                  placeholder="Search countries"
                  variant="outlined"
                  fullWidth
                  onChange={handleCountrySearchChange}
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
                    <Typography variant="caption" color="text.secondary">
                      {option.region?.name}
                    </Typography>
                  </Box>
                </Box>
              )}
            />
          </Grid>
          
          {/* Instructions */}
          <Grid item xs={12}>
            <Typography variant="caption" color="text.secondary">
              First select regions to narrow down the country list, or search for specific countries by name.
            </Typography>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );
};

export default RegionFilter; 