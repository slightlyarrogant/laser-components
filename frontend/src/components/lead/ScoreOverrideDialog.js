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
  FormControlLabel,
  Grid,
  Slider,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import {
  Save as SaveIcon,
  Refresh as RefreshIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';

import * as leadService from '../../services/api/leadService';

/**
 * Dialog for manually overriding a lead's score
 */
const ScoreOverrideDialog = ({ open, onClose, leadId, currentScore, onScoreUpdate }) => {
  // State for score override
  const [overrideData, setOverrideData] = useState({
    score: null,
    componentOverrides: {},
    reason: '',
  });
  
  // State for UI control
  const [overrideMode, setOverrideMode] = useState('full'); // 'full', 'components', or null
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [existingOverride, setExistingOverride] = useState(null);
  
  // Load any existing override when the dialog opens
  useEffect(() => {
    if (open && leadId) {
      fetchExistingOverride();
    }
  }, [open, leadId]);
  
  // Initialize from current score
  useEffect(() => {
    if (currentScore && open) {
      // If we don't have an override yet, initialize with current score values
      if (!existingOverride) {
        setOverrideData({
          score: currentScore.score,
          componentOverrides: {
            industry: currentScore.breakdown?.industry?.score || 50,
            employeeCount: currentScore.breakdown?.employeeCount?.score || 50,
            annualRevenue: currentScore.breakdown?.annualRevenue?.score || 50,
            foundedYear: currentScore.breakdown?.foundedYear?.score || 50,
            completeness: currentScore.breakdown?.completeness?.score || 50,
            applicationMatch: currentScore.breakdown?.applicationMatch?.score || 50,
          },
          reason: '',
        });
      }
    }
  }, [currentScore, open, existingOverride]);
  
  // Load any existing override
  const fetchExistingOverride = async () => {
    try {
      setLoading(true);
      const override = await leadService.getLeadScoreOverride(leadId);
      
      if (override) {
        // Set override mode based on what's overridden
        if (override.score !== null && override.score !== undefined) {
          setOverrideMode('full');
        } else if (override.componentOverrides) {
          setOverrideMode('components');
        }
        
        setExistingOverride(override);
        
        // Initialize form values with existing override
        setOverrideData({
          score: override.score !== null ? override.score : (currentScore?.score || 50),
          componentOverrides: override.componentOverrides || {
            industry: currentScore?.breakdown?.industry?.score || 50,
            employeeCount: currentScore?.breakdown?.employeeCount?.score || 50,
            annualRevenue: currentScore?.breakdown?.annualRevenue?.score || 50,
            foundedYear: currentScore?.breakdown?.foundedYear?.score || 50,
            completeness: currentScore?.breakdown?.completeness?.score || 50,
            applicationMatch: currentScore?.breakdown?.applicationMatch?.score || 50,
          },
          reason: override.metadata?.reason || '',
        });
      }
      
      setLoading(false);
    } catch (err) {
      console.error('Error loading override:', err);
      setLoading(false);
      // Not finding an override is normal, so don't set an error
    }
  };
  
  // Handle mode change
  const handleModeChange = (event) => {
    setOverrideMode(event.target.checked ? 'components' : 'full');
  };
  
  // Handle slider changes
  const handleScoreChange = (value) => {
    setOverrideData(prev => ({
      ...prev,
      score: value,
    }));
  };
  
  const handleComponentChange = (component, value) => {
    setOverrideData(prev => ({
      ...prev,
      componentOverrides: {
        ...prev.componentOverrides,
        [component]: value,
      },
    }));
  };
  
  // Handle reason change
  const handleReasonChange = (event) => {
    setOverrideData(prev => ({
      ...prev,
      reason: event.target.value,
    }));
  };
  
  // Save override
  const handleSaveOverride = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Prepare data based on override mode
      const dataToSend = {
        reason: overrideData.reason,
      };
      
      if (overrideMode === 'full') {
        dataToSend.score = overrideData.score;
        // Don't include component overrides when in full mode
      } else if (overrideMode === 'components') {
        // In component mode, only include the score components
        dataToSend.componentOverrides = overrideData.componentOverrides;
      }
      
      // Save the override
      await leadService.overrideLeadScore(leadId, dataToSend);
      
      // Refresh score
      if (onScoreUpdate) {
        onScoreUpdate();
      }
      
      setLoading(false);
      onClose();
    } catch (err) {
      console.error('Error saving override:', err);
      setError(err.message || 'Failed to save score override');
      setLoading(false);
    }
  };
  
  // Remove override
  const handleRemoveOverride = async () => {
    if (!existingOverride) return;
    
    try {
      setLoading(true);
      await leadService.removeLeadScoreOverride(leadId);
      
      // Refresh score
      if (onScoreUpdate) {
        onScoreUpdate();
      }
      
      setLoading(false);
      onClose();
    } catch (err) {
      console.error('Error removing override:', err);
      setError(err.message || 'Failed to remove score override');
      setLoading(false);
    }
  };
  
  // Get component label from key
  const getComponentLabel = (key) => {
    const labels = {
      industry: 'Industry Relevance',
      employeeCount: 'Company Size',
      annualRevenue: 'Annual Revenue',
      foundedYear: 'Company Age',
      completeness: 'Data Completeness',
      applicationMatch: 'Application Match',
    };
    
    return labels[key] || key;
  };
  
  return (
    <Dialog 
      open={open} 
      onClose={loading ? undefined : onClose}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle>
        Override Lead Score
        {existingOverride && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            Last modified on {new Date(existingOverride.metadata?.overriddenAt).toLocaleString()} by {existingOverride.metadata?.overriddenBy}
          </Typography>
        )}
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
            
            <Box sx={{ mb: 3 }}>
              <FormControlLabel
                control={
                  <Switch 
                    checked={overrideMode === 'components'} 
                    onChange={handleModeChange}
                  />
                }
                label="Override individual components instead of the full score"
              />
            </Box>
            
            {overrideMode === 'full' ? (
              <Box sx={{ mb: 4 }}>
                <Typography variant="subtitle1" gutterBottom>
                  Overall Score Override
                </Typography>
                <Grid container spacing={2} alignItems="center">
                  <Grid item xs>
                    <Slider
                      value={overrideData.score || 50}
                      onChange={(_, newValue) => handleScoreChange(newValue)}
                      min={0}
                      max={100}
                      valueLabelDisplay="auto"
                      aria-labelledby="score-slider"
                    />
                  </Grid>
                  <Grid item>
                    <TextField
                      value={overrideData.score || 50}
                      onChange={(e) => handleScoreChange(Number(e.target.value))}
                      inputProps={{
                        step: 1,
                        min: 0,
                        max: 100,
                        type: 'number',
                      }}
                      size="small"
                      sx={{ width: 80 }}
                    />
                  </Grid>
                </Grid>
              </Box>
            ) : (
              <Box sx={{ mb: 4 }}>
                <Typography variant="subtitle1" gutterBottom>
                  Component Score Overrides
                </Typography>
                <Grid container spacing={3}>
                  {Object.keys(overrideData.componentOverrides).map((component) => (
                    <Grid item xs={12} md={6} key={component}>
                      <Typography id={`${component}-slider-label`} gutterBottom>
                        {getComponentLabel(component)}
                      </Typography>
                      <Grid container spacing={2} alignItems="center">
                        <Grid item xs>
                          <Slider
                            value={overrideData.componentOverrides[component] || 50}
                            onChange={(_, newValue) => handleComponentChange(component, newValue)}
                            min={0}
                            max={100}
                            valueLabelDisplay="auto"
                            aria-labelledby={`${component}-slider-label`}
                          />
                        </Grid>
                        <Grid item>
                          <TextField
                            value={overrideData.componentOverrides[component] || 50}
                            onChange={(e) => handleComponentChange(component, Number(e.target.value))}
                            inputProps={{
                              step: 1,
                              min: 0,
                              max: 100,
                              type: 'number',
                            }}
                            size="small"
                            sx={{ width: 80 }}
                          />
                        </Grid>
                      </Grid>
                    </Grid>
                  ))}
                </Grid>
              </Box>
            )}
            
            <Box sx={{ mb: 3 }}>
              <TextField
                label="Reason for Override"
                fullWidth
                multiline
                rows={2}
                value={overrideData.reason}
                onChange={handleReasonChange}
                placeholder="Explain why you're overriding the score"
              />
            </Box>
          </>
        )}
      </DialogContent>
      
      <DialogActions sx={{ px: 3, py: 2, justifyContent: 'space-between' }}>
        <Box>
          {existingOverride && (
            <Button
              color="error"
              onClick={handleRemoveOverride}
              disabled={loading}
              startIcon={<DeleteIcon />}
            >
              Remove Override
            </Button>
          )}
        </Box>
        <Box>
          <Button
            onClick={onClose}
            disabled={loading}
            sx={{ mr: 1 }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            color="primary"
            onClick={handleSaveOverride}
            disabled={loading || (!overrideData.score && overrideMode === 'full')}
            startIcon={<SaveIcon />}
          >
            Save Override
          </Button>
        </Box>
      </DialogActions>
    </Dialog>
  );
};

export default ScoreOverrideDialog; 