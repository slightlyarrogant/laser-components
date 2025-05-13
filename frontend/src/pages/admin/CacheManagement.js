import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Divider,
  Grid,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  Alert,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Snackbar,
  LinearProgress,
  Stack,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import RefreshIcon from '@mui/icons-material/Refresh';
import SaveIcon from '@mui/icons-material/Save';
import axios from 'axios';

const CacheManagement = () => {
  const [cacheStats, setCacheStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [clearTarget, setClearTarget] = useState(null);
  const [notification, setNotification] = useState({ open: false, message: '', severity: 'success' });
  const [config, setConfig] = useState({ ttl: 3600000, maxSize: 100 });
  
  // Fetch cache statistics
  const fetchCacheStats = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await axios.get('/api/cache/stats');
      setCacheStats(response.data);
      
      setLoading(false);
    } catch (err) {
      console.error('Error fetching cache statistics:', err);
      setError('Failed to load cache statistics. Please try again later.');
      setLoading(false);
    }
  };
  
  // Load initial data
  useEffect(() => {
    fetchCacheStats();
  }, []);
  
  // Handle config change
  const handleConfigChange = (e) => {
    const { name, value } = e.target;
    setConfig(prev => ({ ...prev, [name]: parseInt(value) }));
  };
  
  // Update cache configuration
  const updateCacheConfig = async () => {
    try {
      const response = await axios.put('/api/cache/config', config);
      
      setNotification({
        open: true,
        message: 'Cache configuration updated successfully',
        severity: 'success'
      });
    } catch (err) {
      console.error('Error updating cache configuration:', err);
      
      setNotification({
        open: true,
        message: 'Failed to update cache configuration',
        severity: 'error'
      });
    }
  };
  
  // Handle clear cache
  const handleClearCache = (cacheName = null) => {
    setClearTarget(cacheName);
    setConfirmOpen(true);
  };
  
  // Confirm and clear cache
  const confirmClearCache = async () => {
    try {
      let response;
      
      if (clearTarget) {
        response = await axios.delete(`/api/cache/${clearTarget}/clear`);
      } else {
        response = await axios.delete('/api/cache/clear');
      }
      
      setNotification({
        open: true,
        message: response.data.message,
        severity: 'success'
      });
      
      // Refresh stats
      fetchCacheStats();
    } catch (err) {
      console.error('Error clearing cache:', err);
      
      setNotification({
        open: true,
        message: 'Failed to clear cache',
        severity: 'error'
      });
    } finally {
      setConfirmOpen(false);
      setClearTarget(null);
    }
  };
  
  // Format numbers for display
  const formatNumber = (num) => {
    return new Intl.NumberFormat().format(num);
  };
  
  // Format hit rate for display
  const formatHitRate = (rate) => {
    return `${(rate * 100).toFixed(1)}%`;
  };
  
  // Format time for display
  const formatTime = (ms) => {
    if (ms < 1000) {
      return `${ms}ms`;
    } else if (ms < 60000) {
      return `${(ms / 1000).toFixed(1)}s`;
    } else if (ms < 3600000) {
      return `${(ms / 60000).toFixed(1)}m`;
    } else if (ms < 86400000) {
      return `${(ms / 3600000).toFixed(1)}h`;
    } else {
      return `${(ms / 86400000).toFixed(1)}d`;
    }
  };
  
  return (
    <Box>
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h4" component="h1">
          Cache Management
        </Typography>
        <Box>
          <Button 
            startIcon={<RefreshIcon />}
            onClick={fetchCacheStats}
            disabled={loading}
            sx={{ mr: 1 }}
          >
            Refresh
          </Button>
          <Button 
            variant="outlined" 
            color="error"
            startIcon={<DeleteIcon />}
            onClick={() => handleClearCache()}
            disabled={loading}
          >
            Clear All Caches
          </Button>
        </Box>
      </Box>
      
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}
      
      <Grid container spacing={3}>
        {/* Cache Configuration */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Default Cache Configuration
            </Typography>
            
            <Box component="form" noValidate sx={{ mt: 1 }}>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Time To Live (ms)"
                    name="ttl"
                    type="number"
                    value={config.ttl}
                    onChange={handleConfigChange}
                    InputProps={{ inputProps: { min: 1000 } }}
                    helperText={`${formatTime(config.ttl)} cache lifetime`}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Maximum Cache Size"
                    name="maxSize"
                    type="number"
                    value={config.maxSize}
                    onChange={handleConfigChange}
                    InputProps={{ inputProps: { min: 10 } }}
                    helperText="Maximum number of entries per cache"
                  />
                </Grid>
                <Grid item xs={12}>
                  <Button
                    variant="contained"
                    startIcon={<SaveIcon />}
                    onClick={updateCacheConfig}
                  >
                    Update Configuration
                  </Button>
                </Grid>
              </Grid>
            </Box>
          </Paper>
        </Grid>
        
        {/* Cache Overview */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Cache Overview
            </Typography>
            
            {loading ? (
              <LinearProgress sx={{ my: 2 }} />
            ) : (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Cache Name</TableCell>
                      <TableCell align="right">Size</TableCell>
                      <TableCell align="right">Hit Rate</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {Object.entries(cacheStats).map(([name, stats]) => (
                      <TableRow key={name}>
                        <TableCell component="th" scope="row">
                          {name}
                        </TableCell>
                        <TableCell align="right">
                          {formatNumber(stats.size)}
                        </TableCell>
                        <TableCell align="right">
                          {formatHitRate(stats.hitRate)}
                        </TableCell>
                        <TableCell align="right">
                          <IconButton
                            color="error"
                            size="small"
                            onClick={() => handleClearCache(name)}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                    
                    {Object.keys(cacheStats).length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} align="center">
                          No active caches found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Paper>
        </Grid>
        
        {/* Detailed Cache Statistics */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Detailed Cache Statistics
            </Typography>
            
            {loading ? (
              <LinearProgress sx={{ my: 2 }} />
            ) : (
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Cache Name</TableCell>
                      <TableCell align="right">Size</TableCell>
                      <TableCell align="right">Hits</TableCell>
                      <TableCell align="right">Misses</TableCell>
                      <TableCell align="right">Sets</TableCell>
                      <TableCell align="right">Hit Rate</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {Object.entries(cacheStats).map(([name, stats]) => (
                      <TableRow key={name}>
                        <TableCell component="th" scope="row">
                          {name}
                        </TableCell>
                        <TableCell align="right">
                          {formatNumber(stats.size)}
                        </TableCell>
                        <TableCell align="right">
                          {formatNumber(stats.hits)}
                        </TableCell>
                        <TableCell align="right">
                          {formatNumber(stats.misses)}
                        </TableCell>
                        <TableCell align="right">
                          {formatNumber(stats.sets)}
                        </TableCell>
                        <TableCell align="right">
                          {formatHitRate(stats.hitRate)}
                        </TableCell>
                      </TableRow>
                    ))}
                    
                    {Object.keys(cacheStats).length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} align="center">
                          No active caches found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Paper>
        </Grid>
      </Grid>
      
      {/* Clear Cache Confirmation Dialog */}
      <Dialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
      >
        <DialogTitle>
          Confirm Cache Clear
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            {clearTarget
              ? `Are you sure you want to clear the "${clearTarget}" cache? This action cannot be undone.`
              : 'Are you sure you want to clear all caches? This action cannot be undone.'}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)}>
            Cancel
          </Button>
          <Button 
            onClick={confirmClearCache} 
            color="error" 
            variant="contained" 
            autoFocus
          >
            Clear Cache
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Notification Snackbar */}
      <Snackbar
        open={notification.open}
        autoHideDuration={6000}
        onClose={() => setNotification(prev => ({ ...prev, open: false }))}
      >
        <Alert 
          onClose={() => setNotification(prev => ({ ...prev, open: false }))} 
          severity={notification.severity}
        >
          {notification.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default CacheManagement; 