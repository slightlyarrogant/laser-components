import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link as RouterLink, useLocation, useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  CircularProgress,
  Grid,
  Paper,
  TextField,
  Typography,
  Alert,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  InputAdornment,
  Breadcrumbs,
  Link,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import HomeIcon from '@mui/icons-material/Home';

import organizationService from '../../services/api/organizationService';
import applicationService from '../../services/api/applicationService';
import SavedSearches from '../../components/organization/SavedSearches';
import AdvancedSearchFilters from '../../components/organization/AdvancedSearchFilters';
import OrganizationSearchResults from '../../components/organization/OrganizationSearchResults';
import { exportOrganizationsToCSV } from '../../utils/exportUtils';

const OrganizationSearch = () => {
  // Search params state
  const [searchParams, setSearchParams] = useState({
    keywords: '',
    applicationId: '',
    regionId: '',
    countryId: '',
  });
  
  // Advanced filters state
  const [advancedFilters, setAdvancedFilters] = useState({
    industryTypes: [],
    employeeCount: [0, 10000],
    foundedAfter: null,
    foundedBefore: null,
    hasWebsite: null,
    hasContacts: null,
    sortBy: 'relevance',
    sortOrder: 'desc',
  });
  
  // Search results state
  const [searchResults, setSearchResults] = useState({
    organizations: [],
    meta: { total: 0, page: 1, limit: 10, pages: 0 }
  });
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [applications, setApplications] = useState([]);
  const [regions, setRegions] = useState([]);
  const [countries, setCountries] = useState([]);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [hasSearched, setHasSearched] = useState(false);
  
  // Router state
  const location = useLocation();
  const navigate = useNavigate();
  
  // Perform the search - Wrapped in useCallback
  const performSearch = useCallback(async (params = searchParams, pageNum = 0, pageSize = rowsPerPage) => {
    // Make sure we have at least some search criteria
    if (!params.keywords && !params.applicationId && !params.regionId) {
      setError('Please enter keywords, select an application, or choose a region to search.');
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      
      // Prepare API params
      const apiParams = {
        ...params,
        page: pageNum + 1, // API uses 1-based indexing
        limit: pageSize,
      };
      
      // Add advanced filters
      if (advancedFilters.industryTypes?.length > 0) {
        apiParams.industryTypes = advancedFilters.industryTypes.join(',');
      }
      
      if (advancedFilters.sortBy && advancedFilters.sortBy !== 'relevance') {
        apiParams.sortBy = advancedFilters.sortBy;
        apiParams.sortOrder = advancedFilters.sortOrder || 'desc';
      }
      
      // Employee count filter
      if (advancedFilters.employeeCount?.[0] > 0) {
        apiParams.minEmployees = advancedFilters.employeeCount[0];
      }
      
      if (advancedFilters.employeeCount?.[1] < 10000) {
        apiParams.maxEmployees = advancedFilters.employeeCount[1];
      }
      
      // Founded year filters
      if (advancedFilters.foundedAfter) {
        apiParams.foundedAfter = advancedFilters.foundedAfter;
      }
      
      if (advancedFilters.foundedBefore) {
        apiParams.foundedBefore = advancedFilters.foundedBefore;
      }
      
      // Boolean filters
      if (advancedFilters.hasWebsite === true) {
        apiParams.hasWebsite = true;
      }
      
      if (advancedFilters.hasContacts === true) {
        apiParams.hasContacts = true;
      }
      
      // Call search API with all params
      const results = await organizationService.searchOrganizations(apiParams);
      setSearchResults(results);
      setHasSearched(true);
      
      setLoading(false);
    } catch (err) {
      console.error('Error searching organizations:', err);
      setError('Failed to search organizations. Please try again later.');
      setLoading(false);
    }
  }, [searchParams, rowsPerPage, advancedFilters]); // Dependencies for performSearch
  
  // Load dropdown data and check URL for initial search
  useEffect(() => {
    const fetchDropdownData = async () => {
      try {
        // Fetch applications
        const applicationsData = await applicationService.getApplications();
        setApplications(applicationsData.filter(app => app.status === 'ACTIVE'));
        
        // Mock region and country data
        // In a real implementation, we'd fetch from regionService
        setRegions([
          { id: 1, name: 'North America', code: 'NA' },
          { id: 2, name: 'Europe', code: 'EU' },
          { id: 3, name: 'Asia Pacific', code: 'APAC' },
          { id: 4, name: 'Latin America', code: 'LATAM' },
          { id: 5, name: 'Middle East and Africa', code: 'MEA' },
        ]);
        
        setCountries([
          { id: 1, name: 'United States', code: 'US', regionId: 1 },
          { id: 2, name: 'Canada', code: 'CA', regionId: 1 },
          { id: 3, name: 'United Kingdom', code: 'GB', regionId: 2 },
          { id: 4, name: 'Germany', code: 'DE', regionId: 2 },
          { id: 5, name: 'Japan', code: 'JP', regionId: 3 },
          { id: 6, name: 'Australia', code: 'AU', regionId: 3 },
          { id: 7, name: 'Brazil', code: 'BR', regionId: 4 },
          { id: 8, name: 'Mexico', code: 'MX', regionId: 4 },
          { id: 9, name: 'South Africa', code: 'ZA', regionId: 5 },
          { id: 10, name: 'United Arab Emirates', code: 'AE', regionId: 5 }
        ]);
      } catch (err) {
        console.error('Error loading dropdown data:', err);
        setError('Failed to load necessary data. Please try again later.');
      }
    };
    
    fetchDropdownData();
    
    // Check URL for initial search params
    const queryParams = new URLSearchParams(location.search);
    const initialParams = {};
    
    if (queryParams.has('keywords')) initialParams.keywords = queryParams.get('keywords');
    if (queryParams.has('applicationId')) initialParams.applicationId = queryParams.get('applicationId');
    if (queryParams.has('regionId')) initialParams.regionId = queryParams.get('regionId');
    if (queryParams.has('countryId')) initialParams.countryId = queryParams.get('countryId');
    
    // If any search params exist in URL, update state and perform search
    if (Object.keys(initialParams).length > 0) {
      setSearchParams(prev => ({ ...prev, ...initialParams }));
      setPage(0);
      performSearch(initialParams);
    }
  }, [performSearch, location.search]); // performSearch is now stable
  
  // Load applications for filter
  useEffect(() => {
    // Only fetch countries if region has changed and is selected
    if (searchParams.regionId && searchParams.regionId !== prevRegionIdRef.current) {
      // fetchCountries(searchParams.regionId); // Commented out undefined function call
      prevRegionIdRef.current = searchParams.regionId;
    }
  }, [searchParams.regionId, searchParams.countryId]); // Added back searchParams.countryId
  
  const prevRegionIdRef = useRef();
  
  // Update countries when region changes
  useEffect(() => {
    if (searchParams.regionId) {
      // Reset country if it doesn't belong to the selected region
      const filteredCountries = countries.filter(
        country => country.regionId === parseInt(searchParams.regionId)
      );
      
      if (searchParams.countryId && !filteredCountries.some(
        country => country.id === parseInt(searchParams.countryId)
      )) {
        setSearchParams(prev => ({ ...prev, countryId: '' }));
      }
    }
  }, [searchParams.regionId, searchParams.countryId, countries, setSearchParams]); // Added missing dependencies
  
  // Handle input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setSearchParams(prev => ({ ...prev, [name]: value }));
    
    // If changing region, reset country
    if (name === 'regionId') {
      setSearchParams(prev => ({ ...prev, regionId: value, countryId: '' }));
    }
  };
  
  // Handle advanced filter changes
  const handleFilterChange = (filters) => {
    setAdvancedFilters(filters);
  };
  
  // Handle search button click
  const handleSearch = () => {
    // Reset to first page
    setPage(0);
    
    // Update URL with search params
    const queryParams = new URLSearchParams();
    
    if (searchParams.keywords) queryParams.set('keywords', searchParams.keywords);
    if (searchParams.applicationId) queryParams.set('applicationId', searchParams.applicationId);
    if (searchParams.regionId) queryParams.set('regionId', searchParams.regionId);
    if (searchParams.countryId) queryParams.set('countryId', searchParams.countryId);
    
    navigate({ search: queryParams.toString() });
    
    // Perform search
    performSearch(searchParams, 0, rowsPerPage);
  };
  
  // Handle pressing Enter in the search field
  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };
  
  // Handle clearing the form
  const handleClearForm = () => {
    setSearchParams({
      keywords: '',
      applicationId: '',
      regionId: '',
      countryId: '',
    });
    
    setAdvancedFilters({
      industryTypes: [],
      employeeCount: [0, 10000],
      foundedAfter: null,
      foundedBefore: null,
      hasWebsite: null,
      hasContacts: null,
      sortBy: 'relevance',
      sortOrder: 'desc',
    });
    
    setPage(0);
    navigate({ search: '' });
  };
  
  // Handle pagination changes
  const handlePageChange = (event, newPage) => {
    setPage(newPage);
    performSearch(searchParams, newPage, rowsPerPage);
  };
  
  // Handle rows per page change
  const handleRowsPerPageChange = (event) => {
    const newRowsPerPage = parseInt(event.target.value, 10);
    setRowsPerPage(newRowsPerPage);
    setPage(0);
    performSearch(searchParams, 0, newRowsPerPage);
  };
  
  // Handle applying a saved search
  const handleApplySavedSearch = (params) => {
    setSearchParams(params);
    setPage(0);
    
    // Update URL
    const queryParams = new URLSearchParams();
    
    if (params.keywords) queryParams.set('keywords', params.keywords);
    if (params.applicationId) queryParams.set('applicationId', params.applicationId);
    if (params.regionId) queryParams.set('regionId', params.regionId);
    if (params.countryId) queryParams.set('countryId', params.countryId);
    
    navigate({ search: queryParams.toString() });
    
    // Perform search
    performSearch(params, 0, rowsPerPage);
  };
  
  // Handle exporting search results
  const handleExport = (organizations, format = 'csv') => {
    if (format === 'csv') {
      const filename = `organization_search_${new Date().toISOString().slice(0, 10)}.csv`;
      exportOrganizationsToCSV(organizations, filename);
    }
  };
  
  return (
    <Box>
      {/* Breadcrumbs */}
      <Breadcrumbs aria-label="breadcrumb" sx={{ mb: 2 }}>
        <Link 
          underline="hover" 
          color="inherit" 
          component={RouterLink}
          to="/"
        >
          <HomeIcon sx={{ mr: 0.5 }} fontSize="inherit" />
          Home
        </Link>
        <Typography color="text.primary">Organization Search</Typography>
      </Breadcrumbs>
      
      <Typography variant="h4" component="h1" gutterBottom>
        Organization Search
      </Typography>
      
      {/* Saved Searches */}
      <SavedSearches 
        currentSearch={searchParams} 
        onSearchSelect={handleApplySavedSearch}
      />
      
      {/* Search Form */}
      <Paper sx={{ p: 3, mb: 4 }}>
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Search Keywords"
              name="keywords"
              value={searchParams.keywords}
              onChange={handleInputChange}
              onKeyPress={handleKeyPress}
              placeholder="Enter keywords (e.g., laser, photonics)"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
            />
          </Grid>
          
          <Grid item xs={12} md={6}>
            <FormControl fullWidth>
              <InputLabel>Application</InputLabel>
              <Select
                name="applicationId"
                value={searchParams.applicationId}
                onChange={handleInputChange}
                label="Application"
              >
                <MenuItem value="">All Applications</MenuItem>
                {applications.map(app => (
                  <MenuItem key={app.id} value={app.id.toString()}>
                    {app.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <FormControl fullWidth>
              <InputLabel>Region</InputLabel>
              <Select
                name="regionId"
                value={searchParams.regionId}
                onChange={handleInputChange}
                label="Region"
              >
                <MenuItem value="">All Regions</MenuItem>
                {regions.map(region => (
                  <MenuItem key={region.id} value={region.id.toString()}>
                    {region.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <FormControl 
              fullWidth
              disabled={!searchParams.regionId}
            >
              <InputLabel>Country</InputLabel>
              <Select
                name="countryId"
                value={searchParams.countryId}
                onChange={handleInputChange}
                label="Country"
              >
                <MenuItem value="">All Countries</MenuItem>
                {countries
                  .filter(country => !searchParams.regionId || country.regionId === parseInt(searchParams.regionId))
                  .map(country => (
                    <MenuItem key={country.id} value={country.id.toString()}>
                      {country.name}
                    </MenuItem>
                  ))
                }
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12}>
            <AdvancedSearchFilters
              filters={advancedFilters}
              onChange={handleFilterChange}
            />
          </Grid>
          
          <Grid item xs={12}>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
              <Button 
                variant="outlined" 
                onClick={handleClearForm}
              >
                Clear All
              </Button>
              <Button 
                variant="contained" 
                startIcon={<SearchIcon />} 
                onClick={handleSearch}
                disabled={loading}
              >
                {loading ? 'Searching...' : 'Search Organizations'}
              </Button>
            </Box>
          </Grid>
        </Grid>
      </Paper>
      
      {/* Error Message */}
      {error && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}
      
      {/* Loading Indicator */}
      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}>
          <CircularProgress />
        </Box>
      )}
      
      {/* Search Results */}
      {!loading && hasSearched && (
        <OrganizationSearchResults 
          results={searchResults}
          loading={loading}
          page={page}
          rowsPerPage={rowsPerPage}
          onPageChange={handlePageChange}
          onRowsPerPageChange={handleRowsPerPageChange}
          onExport={handleExport}
        />
      )}
    </Box>
  );
};

export default OrganizationSearch; 