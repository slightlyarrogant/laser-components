import React from 'react';
import {
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Typography,
  Box,
  CircularProgress,
  Chip,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Grid,
} from '@mui/material';
import { formatDistance } from 'date-fns';

/**
 * Component for displaying activity logs with filtering and pagination
 */
const ActivityLogTable = ({
  logs = [],
  loading = false,
  error = null,
  onFilterChange,
  filters = {},
  pagination = { page: 0, limit: 10, total: 0 },
  onPageChange,
  onLimitChange,
}) => {
  // Get color based on action type
  const getActionColor = (action) => {
    switch (action) {
      case 'create':
        return 'success';
      case 'update':
      case 'edit':
        return 'info';
      case 'delete':
        return 'error';
      case 'view':
      case 'list':
        return 'default';
      case 'login':
        return 'primary';
      case 'logout':
        return 'warning';
      default:
        return 'default';
    }
  };
  
  // Format relative time
  const formatTime = (timestamp) => {
    try {
      return formatDistance(new Date(timestamp), new Date(), { addSuffix: true });
    } catch (e) {
      return 'Unknown time';
    }
  };
  
  // Handle filter changes
  const handleFilterChange = (e) => {
    if (onFilterChange) {
      const { name, value } = e.target;
      onFilterChange({ ...filters, [name]: value });
    }
  };
  
  // Handle page change
  const handlePageChange = (event, newPage) => {
    if (onPageChange) {
      onPageChange(newPage);
    }
  };
  
  // Handle rows per page change
  const handleLimitChange = (event) => {
    if (onLimitChange) {
      onLimitChange(parseInt(event.target.value, 10));
    }
  };
  
  // Render loading state
  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
        <CircularProgress />
      </Box>
    );
  }
  
  // Render error state
  if (error) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography color="error">{error}</Typography>
      </Box>
    );
  }
  
  return (
    <Box>
      {/* Filters */}
      <Box sx={{ mb: 2 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} md={4}>
            <FormControl fullWidth size="small">
              <InputLabel id="action-filter-label">Action</InputLabel>
              <Select
                labelId="action-filter-label"
                name="action"
                value={filters.action || ''}
                label="Action"
                onChange={handleFilterChange}
              >
                <MenuItem value="">All Actions</MenuItem>
                <MenuItem value="create">Create</MenuItem>
                <MenuItem value="update">Update</MenuItem>
                <MenuItem value="delete">Delete</MenuItem>
                <MenuItem value="view">View</MenuItem>
                <MenuItem value="login">Login</MenuItem>
                <MenuItem value="logout">Logout</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={4}>
            <FormControl fullWidth size="small">
              <InputLabel id="resource-filter-label">Resource Type</InputLabel>
              <Select
                labelId="resource-filter-label"
                name="resourceType"
                value={filters.resourceType || ''}
                label="Resource Type"
                onChange={handleFilterChange}
              >
                <MenuItem value="">All Resources</MenuItem>
                <MenuItem value="lead">Lead</MenuItem>
                <MenuItem value="product">Product</MenuItem>
                <MenuItem value="application">Application</MenuItem>
                <MenuItem value="user">User</MenuItem>
                <MenuItem value="auth">Authentication</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={4}>
            <TextField
              name="userId"
              label="User ID"
              variant="outlined"
              fullWidth
              size="small"
              value={filters.userId || ''}
              onChange={handleFilterChange}
            />
          </Grid>
        </Grid>
      </Box>
      
      {/* Logs Table */}
      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Action</TableCell>
              <TableCell>Resource</TableCell>
              <TableCell>User</TableCell>
              <TableCell>Time</TableCell>
              <TableCell>Details</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {logs.length > 0 ? (
              logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell>
                    <Chip 
                      label={log.action} 
                      size="small" 
                      color={getActionColor(log.action)}
                    />
                  </TableCell>
                  <TableCell>
                    {log.resourceType}
                    {log.resourceId && (
                      <Typography variant="caption" display="block" color="text.secondary">
                        ID: {log.resourceId}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    {log.user?.email || log.userId}
                    {log.user?.role && (
                      <Typography variant="caption" display="block" color="text.secondary">
                        {log.user.role}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    {formatTime(log.timestamp)}
                  </TableCell>
                  <TableCell>
                    {log.details ? (
                      <Typography 
                        variant="body2" 
                        sx={{ 
                          maxWidth: 250, 
                          overflow: 'hidden', 
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {JSON.stringify(log.details)}
                      </Typography>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        No details
                      </Typography>
                    )}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} align="center">
                  <Typography variant="body2" sx={{ py: 2 }}>
                    No activity logs found
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
      
      {/* Pagination */}
      <TablePagination
        component="div"
        count={pagination.total}
        page={pagination.page}
        onPageChange={handlePageChange}
        rowsPerPage={pagination.limit}
        onRowsPerPageChange={handleLimitChange}
        rowsPerPageOptions={[10, 25, 50, 100]}
      />
    </Box>
  );
};

export default ActivityLogTable; 