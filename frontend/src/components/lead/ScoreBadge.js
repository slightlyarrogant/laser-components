import React from 'react';
import { Box, Tooltip, Typography } from '@mui/material';

/**
 * Compact badge component for displaying lead scores
 */
const ScoreBadge = ({ score, size = 'medium', showLabel = false }) => {
  // Handle undefined or null score
  if (score === undefined || score === null) {
    return (
      <Tooltip title="No score available">
        <Box
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: size === 'small' ? 30 : size === 'large' ? 50 : 40,
            height: size === 'small' ? 30 : size === 'large' ? 50 : 40,
            borderRadius: '50%',
            bgcolor: 'grey.300',
            color: 'text.secondary',
            fontWeight: 'bold',
            fontSize: size === 'small' ? 12 : size === 'large' ? 18 : 16,
            border: '2px solid',
            borderColor: 'grey.400'
          }}
        >
          -
        </Box>
      </Tooltip>
    );
  }

  // Get color based on score
  const getScoreColor = (score) => {
    if (score >= 80) return { bg: 'success.light', color: 'success.dark', border: 'success.main' };
    if (score >= 60) return { bg: 'success.100', color: 'success.800', border: 'success.500' };
    if (score >= 40) return { bg: 'warning.100', color: 'warning.800', border: 'warning.500' };
    if (score >= 20) return { bg: 'warning.light', color: 'warning.dark', border: 'warning.main' };
    return { bg: 'error.100', color: 'error.800', border: 'error.500' };
  };

  // Get label based on score
  const getScoreLabel = (score) => {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Average';
    if (score >= 20) return 'Below Average';
    return 'Poor';
  };

  const colorSet = getScoreColor(score);
  const label = getScoreLabel(score);

  return (
    <Box sx={{ display: 'inline-flex', alignItems: 'center' }}>
      <Tooltip title={`${score}/100 - ${label}`}>
        <Box
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: size === 'small' ? 30 : size === 'large' ? 50 : 40,
            height: size === 'small' ? 30 : size === 'large' ? 50 : 40,
            borderRadius: '50%',
            bgcolor: colorSet.bg,
            color: colorSet.color,
            fontWeight: 'bold',
            fontSize: size === 'small' ? 12 : size === 'large' ? 18 : 16,
            border: '2px solid',
            borderColor: colorSet.border
          }}
        >
          {score}
        </Box>
      </Tooltip>
      
      {showLabel && (
        <Typography 
          variant="caption" 
          color="text.secondary"
          sx={{ ml: 1 }}
        >
          {label}
        </Typography>
      )}
    </Box>
  );
};

export default ScoreBadge; 