import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  CardHeader,
  Divider,
  Alert,
  Grid,
  TextField,
  Button,
  IconButton,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import FilterListIcon from '@mui/icons-material/FilterList';
import ClearIcon from '@mui/icons-material/Clear';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { formatISO } from 'date-fns';

import ActivityLogTable from '../../components/analytics/ActivityLogTable';
import analyticsService from '../../services/analyticsService';

const ActivityLogPage = () => {
  // State for activity logs
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // State for filters
  const [filters, setFilters] = useState({});
  const [pagination, setPagination] = useState({
    page: 0,
    limit: 25,
    total: 0
  });
  
  // State for date range
  const [dateRange, setDateRange] = useState([null, null]);
  
  // State for filter visibility
  const [showFilters, setShowFilters] = useState(false);
  
  // Fetch activity logs
  const fetchLogs = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const queryFilters = {
        ...filters,
        page: pagination.page + 1, // API uses 1-based pagination
        limit: pagination.limit
      };
      
      // Add date range to filters if set
      if (dateRange[0] && dateRange[1]) {
        queryFilters.startDate = formatISO(dateRange[0], { representation: 'date' });
        queryFilters.endDate = formatISO(dateRange[1], { representation: 'date' });
      }
      
      const data = await analyticsService.getActivityLogs(queryFilters);
      
      setLogs(data.data || []);
      setPagination({
        ...pagination,
        total: data.pagination?.total || 0
      });
    } catch (err) {
      console.error('Error fetching activity logs:', err);
      setError('Failed to load activity logs. Please try again later.');
    } finally {
      setLoading(false);
    }
  };
  
  // Fetch logs on mount and when filters/pagination change
  useEffect(() => {
    fetchLogs();
  }, [filters, pagination.page, pagination.limit]);
  
  // Handle filter change
  const handleFilterChange = (newFilters) => {
    setFilters(newFilters);
    setPagination({ ...pagination, page: 0 });
  };
  
  // Handle page change
  const handlePageChange = (newPage) => {
    setPagination({ ...pagination, page: newPage });
  };
  
  // Handle limit change
  const handleLimitChange = (newLimit) => {
    setPagination({ ...pagination, limit: newLimit, page: 0 });
  };
  
  // Apply date range filter
  const applyDateRange = () => {
    fetchLogs();
  };
  
  // Clear all filters
  const clearFilters = () => {
    setFilters({});
    setDateRange([null, null]);
    setPagination({ ...pagination, page: 0 });
  };
  
  // Toggle filter visibility
  const toggleFilters = () => {
    setShowFilters(!showFilters);
  };
  
  return (
    <Container maxWidth="lg">
      <Helmet>
        <title>Activity Logs | Laser Components</title>
      </Helmet>
      
      <Box sx={{ mt: 3, mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h4" component="h1">
            Activity Logs
          </Typography>
          
          <Box>
            <Button
              variant="outlined"
              startIcon={<FilterListIcon />}
              onClick={toggleFilters}
              sx={{ mr: 1 }}
            >
              {showFilters ? 'Hide Filters' : 'Show Filters'}
            </Button>
            
            <IconButton onClick={fetchLogs} disabled={loading}>
              <RefreshIcon />
            </IconButton>
          </Box>
        </Box>
        
        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}
        
        <Card>
          {showFilters && (
            <>
              <CardHeader 
                title="Advanced Filters" 
                action={
                  <Button
                    variant="text"
                    startIcon={<ClearIcon />}
                    onClick={clearFilters}
                  >
                    Clear Filters
                  </Button>
                }
              />
              <Divider />
              <CardContent>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={4}>
                    <TextField
                      name="ipAddress"
                      label="IP Address"
                      variant="outlined"
                      fullWidth
                      size="small"
                      value={filters.ipAddress || ''}
                      onChange={(e) => handleFilterChange({ ...filters, ipAddress: e.target.value })}
                    />
                  </Grid>
                  
                  <Grid item xs={12} md={4}>
                    <TextField
                      name="resourceId"
                      label="Resource ID"
                      variant="outlined"
                      fullWidth
                      size="small"
                      value={filters.resourceId || ''}
                      onChange={(e) => handleFilterChange({ ...filters, resourceId: e.target.value })}
                    />
                  </Grid>
                  
                  <Grid item xs={12} md={4}>
                    <TextField
                      name="userAgent"
                      label="User Agent"
                      variant="outlined"
                      fullWidth
                      size="small"
                      value={filters.userAgent || ''}
                      onChange={(e) => handleFilterChange({ ...filters, userAgent: e.target.value })}
                    />
                  </Grid>
                  
                  {/* Date Range - Note: DateRangePicker import might need adjustment based on your MUI version */}
                  <Grid item xs={12}>
                    <LocalizationProvider dateAdapter={AdapterDateFns}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <DatePicker
                          label="Start Date"
                          value={dateRange[0]}
                          onChange={(newValue) => setDateRange([newValue, dateRange[1]])}
                          renderInput={(params) => <TextField {...params} size="small" />}
                        />
                        <Typography>to</Typography>
                        <DatePicker
                          label="End Date"
                          value={dateRange[1]}
                          onChange={(newValue) => setDateRange([dateRange[0], newValue])}
                          renderInput={(params) => <TextField {...params} size="small" />}
                          minDate={dateRange[0]} // Prevent selecting end date before start date
                        />
                        <Button
                          variant="outlined"
                          onClick={applyDateRange}
                          size="small"
                          disabled={!dateRange[0] || !dateRange[1]} // Disable if range is incomplete
                        >
                          Apply
                        </Button>
                      </Box>
                    </LocalizationProvider>
                  </Grid>
                </Grid>
              </CardContent>
              <Divider />
            </>
          )}
          
          <CardContent>
            <ActivityLogTable
              logs={logs}
              loading={loading}
              error={error}
              filters={filters}
              onFilterChange={handleFilterChange}
              pagination={pagination}
              onPageChange={handlePageChange}
              onLimitChange={handleLimitChange}
            />
          </CardContent>
        </Card>
      </Box>
    </Container>
  );
};

export default ActivityLogPage; 