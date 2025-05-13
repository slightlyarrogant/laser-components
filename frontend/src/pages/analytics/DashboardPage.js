import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import {
  Box,
  Container,
  Grid,
  Paper,
  Typography,
  Tab,
  Tabs,
  Card,
  CardContent,
  CardHeader,
  Divider,
  Alert,
  IconButton,
  Menu,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
} from '@mui/material';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import RefreshIcon from '@mui/icons-material/Refresh';
import LeaderboardIcon from '@mui/icons-material/Leaderboard';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import CategoryIcon from '@mui/icons-material/Category';
import PercentIcon from '@mui/icons-material/Percent';

import { LineChart, BarChart, PieChart } from '../../components/analytics/charts';
import StatCard from '../../components/analytics/StatCard';
import ActivityLogTable from '../../components/analytics/ActivityLogTable';
import analyticsService from '../../services/analyticsService';

const DashboardPage = () => {
  // State for tabs
  const [activeTab, setActiveTab] = useState(0);
  
  // State for dashboard data
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // State for time period selection
  const [timePeriod, setTimePeriod] = useState('month');
  
  // State for activity logs
  const [activityLogs, setActivityLogs] = useState([]);
  const [activityLogsLoading, setActivityLogsLoading] = useState(true);
  const [activityLogsError, setActivityLogsError] = useState(null);
  const [activityFilters, setActivityFilters] = useState({});
  const [activityPagination, setActivityPagination] = useState({
    page: 0,
    limit: 10,
    total: 0
  });
  
  // State for chart menu
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedChart, setSelectedChart] = useState(null);
  
  // Handle tab change
  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };
  
  // Handle menu open
  const handleMenuOpen = (event, chartId) => {
    setAnchorEl(event.currentTarget);
    setSelectedChart(chartId);
  };
  
  // Handle menu close
  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedChart(null);
  };
  
  // Handle time period change
  const handleTimePeriodChange = (event) => {
    setTimePeriod(event.target.value);
  };
  
  // Handle activity filter change
  const handleActivityFilterChange = (newFilters) => {
    setActivityFilters(newFilters);
    setActivityPagination({ ...activityPagination, page: 0 });
  };
  
  // Handle activity page change
  const handleActivityPageChange = (newPage) => {
    setActivityPagination({ ...activityPagination, page: newPage });
  };
  
  // Handle activity limit change
  const handleActivityLimitChange = (newLimit) => {
    setActivityPagination({ ...activityPagination, limit: newLimit, page: 0 });
  };
  
  // Refresh dashboard data
  const refreshDashboard = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const data = await analyticsService.getDashboardOverview();
      setDashboardData(data);
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      setError('Failed to load dashboard data. Please try again later.');
    } finally {
      setLoading(false);
    }
  };
  
  // Refresh activity logs
  const refreshActivityLogs = async () => {
    setActivityLogsLoading(true);
    setActivityLogsError(null);
    
    try {
      const filters = {
        ...activityFilters,
        page: activityPagination.page + 1, // API uses 1-based pagination
        limit: activityPagination.limit
      };
      
      const data = await analyticsService.getActivityLogs(filters);
      
      setActivityLogs(data.data || []);
      setActivityPagination({
        ...activityPagination,
        total: data.pagination?.total || 0
      });
    } catch (err) {
      console.error('Error fetching activity logs:', err);
      setActivityLogsError('Failed to load activity logs. Please try again later.');
    } finally {
      setActivityLogsLoading(false);
    }
  };
  
  // Fetch dashboard data on mount and when time period changes
  useEffect(() => {
    refreshDashboard();
  }, [timePeriod]);
  
  // Fetch activity logs when filters or pagination changes
  useEffect(() => {
    refreshActivityLogs();
  }, [activityFilters, activityPagination.page, activityPagination.limit]);
  
  // Format percentage value
  const formatPercentage = (value) => {
    if (value === null || value === undefined) return 'N/A';
    return `${value.toFixed(1)}%`;
  };
  
  // Generate dummy lead conversion data for charts
  const generateConversionData = () => {
    const data = [];
    const now = new Date();
    
    for (let i = 11; i >= 0; i--) {
      const date = new Date(now);
      date.setMonth(now.getMonth() - i);
      data.push({
        timestamp: date.toISOString(),
        value: Math.floor(Math.random() * 30) + 10, // Random value between 10-40
      });
    }
    
    return data;
  };
  
  // Generate dummy product coverage data for charts
  const generateCoverageData = () => {
    return [
      { name: 'Lasers', value: 85 },
      { name: 'Optics', value: 76 },
      { name: 'Filters', value: 62 },
      { name: 'Mounts', value: 43 },
      { name: 'Controllers', value: 37 },
    ];
  };
  
  return (
    <Container maxWidth="lg">
      <Helmet>
        <title>Analytics Dashboard | Laser Components</title>
      </Helmet>
      
      <Box sx={{ mt: 3, mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h4" component="h1">
            Analytics Dashboard
          </Typography>
          
          <Box>
            <FormControl variant="outlined" size="small" sx={{ minWidth: 150, mr: 1 }}>
              <InputLabel id="time-period-label">Time Period</InputLabel>
              <Select
                labelId="time-period-label"
                value={timePeriod}
                onChange={handleTimePeriodChange}
                label="Time Period"
              >
                <MenuItem value="day">Last 24 Hours</MenuItem>
                <MenuItem value="week">Last 7 Days</MenuItem>
                <MenuItem value="month">Last 30 Days</MenuItem>
                <MenuItem value="quarter">Last 90 Days</MenuItem>
                <MenuItem value="year">Last 12 Months</MenuItem>
              </Select>
            </FormControl>
            
            <IconButton onClick={refreshDashboard} disabled={loading}>
              <RefreshIcon />
            </IconButton>
          </Box>
        </Box>
        
        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}
        
        {/* Summary Stats Cards */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              title="Lead Conversion Rate"
              value={dashboardData?.overview?.leadConversionRate || 24.5}
              formatter={formatPercentage}
              icon={PercentIcon}
              trend={2.3}
              trendLabel="vs previous period"
              loading={loading}
              description="Percentage of leads that convert to sales"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              title="Product Coverage"
              value={dashboardData?.overview?.productMappingCoverage || 76.8}
              formatter={formatPercentage}
              icon={CategoryIcon}
              trend={5.4}
              trendLabel="vs previous period"
              loading={loading}
              description="Percentage of products mapped to applications"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              title="Average Deal Size"
              value={12500}
              formatter={(val) => `$${val.toLocaleString()}`}
              icon={AttachMoneyIcon}
              trend={-1.2}
              trendLabel="vs previous period"
              loading={loading}
              description="Average value of closed deals"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              title="Sales Pipeline"
              value={37}
              formatter={(val) => `${val} leads`}
              icon={LeaderboardIcon}
              trend={8.7}
              trendLabel="vs previous period"
              loading={loading}
              description="Number of leads in the sales pipeline"
            />
          </Grid>
        </Grid>
        
        {/* Tabs for different dashboard views */}
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
          <Tabs value={activeTab} onChange={handleTabChange}>
            <Tab label="Overview" />
            <Tab label="Leads & Conversions" />
            <Tab label="Products & Applications" />
            <Tab label="User Activity" />
          </Tabs>
        </Box>
        
        {/* Overview Tab */}
        {activeTab === 0 && (
          <Grid container spacing={3}>
            {/* Lead Conversion Trend */}
            <Grid item xs={12} md={8}>
              <Card>
                <CardHeader 
                  title="Lead Conversion Trend" 
                  action={
                    <>
                      <IconButton onClick={(e) => handleMenuOpen(e, 'leadTrend')}>
                        <MoreVertIcon />
                      </IconButton>
                      <Menu
                        anchorEl={anchorEl}
                        open={Boolean(anchorEl) && selectedChart === 'leadTrend'}
                        onClose={handleMenuClose}
                      >
                        <MenuItem onClick={handleMenuClose}>Export as PNG</MenuItem>
                        <MenuItem onClick={handleMenuClose}>Export Data as CSV</MenuItem>
                        <MenuItem onClick={handleMenuClose}>View Full Screen</MenuItem>
                      </Menu>
                    </>
                  }
                />
                <Divider />
                <CardContent>
                  <LineChart
                    data={generateConversionData()}
                    height={300}
                    lines={[{ dataKey: 'value', name: 'Conversion Rate' }]}
                    xAxisDataKey="timestamp"
                    xAxisLabel="Date"
                    yAxisLabel="Conversion Rate (%)"
                    loading={loading}
                    formatY={(value) => `${value}%`}
                  />
                </CardContent>
              </Card>
            </Grid>
            
            {/* Product Category Coverage */}
            <Grid item xs={12} md={4}>
              <Card>
                <CardHeader 
                  title="Product Category Coverage" 
                  action={
                    <>
                      <IconButton onClick={(e) => handleMenuOpen(e, 'productCoverage')}>
                        <MoreVertIcon />
                      </IconButton>
                      <Menu
                        anchorEl={anchorEl}
                        open={Boolean(anchorEl) && selectedChart === 'productCoverage'}
                        onClose={handleMenuClose}
                      >
                        <MenuItem onClick={handleMenuClose}>Export as PNG</MenuItem>
                        <MenuItem onClick={handleMenuClose}>Export Data as CSV</MenuItem>
                        <MenuItem onClick={handleMenuClose}>View Full Screen</MenuItem>
                      </Menu>
                    </>
                  }
                />
                <Divider />
                <CardContent>
                  <PieChart
                    data={generateCoverageData()}
                    height={300}
                    dataKey="value"
                    nameKey="name"
                    loading={loading}
                    formatter={(value) => `${value}%`}
                  />
                </CardContent>
              </Card>
            </Grid>
            
            {/* Activity Logs */}
            <Grid item xs={12}>
              <Card>
                <CardHeader 
                  title="Recent Activity" 
                  action={
                    <IconButton onClick={refreshActivityLogs} disabled={activityLogsLoading}>
                      <RefreshIcon />
                    </IconButton>
                  }
                />
                <Divider />
                <CardContent>
                  <ActivityLogTable
                    logs={activityLogs}
                    loading={activityLogsLoading}
                    error={activityLogsError}
                    filters={activityFilters}
                    onFilterChange={handleActivityFilterChange}
                    pagination={activityPagination}
                    onPageChange={handleActivityPageChange}
                    onLimitChange={handleActivityLimitChange}
                  />
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )}
        
        {/* Leads & Conversions Tab */}
        {activeTab === 1 && (
          <Typography>Leads & Conversions content coming soon...</Typography>
        )}
        
        {/* Products & Applications Tab */}
        {activeTab === 2 && (
          <Typography>Products & Applications content coming soon...</Typography>
        )}
        
        {/* User Activity Tab */}
        {activeTab === 3 && (
          <Typography>User Activity content coming soon...</Typography>
        )}
      </Box>
    </Container>
  );
};

export default DashboardPage; 