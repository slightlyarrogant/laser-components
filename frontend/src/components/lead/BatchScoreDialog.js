import React, { useState } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Typography,
} from '@mui/material';
import {
  Close as CloseIcon,
  Check as CheckIcon,
  Error as ErrorIcon,
  Score as ScoreIcon,
} from '@mui/icons-material';

import * as leadService from '../../services/api/leadService';

/**
 * Dialog component for batch scoring multiple leads
 */
const BatchScoreDialog = ({ open, onClose, leadIds, onScoreComplete }) => {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);

  // Handle batch scoring
  const handleBatchScore = async () => {
    try {
      setLoading(true);
      setError(null);
      setResults(null);

      // Call the API to score leads
      const scoreResults = await leadService.scoreLeads(leadIds);
      setResults(scoreResults.results);
      
      // Call the callback with results
      if (onScoreComplete) {
        onScoreComplete(scoreResults.results);
      }
      
    } catch (err) {
      console.error('Error during batch scoring:', err);
      setError(err.message || 'An error occurred during batch scoring');
    } finally {
      setLoading(false);
    }
  };

  // Handle dialog close
  const handleClose = () => {
    if (!loading) {
      setResults(null);
      setError(null);
      onClose();
    }
  };

  return (
    <Dialog 
      open={open} 
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>
        Batch Score Leads
      </DialogTitle>
      <Divider />
      
      <DialogContent>
        {!results && !error && (
          <DialogContentText>
            You are about to calculate scores for {leadIds.length} lead{leadIds.length !== 1 ? 's' : ''}.
            This process analyzes each lead's data to evaluate their relevance and potential.
            The score is based on industry match, company size, revenue, and other factors.
          </DialogContentText>
        )}

        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        )}

        {error && (
          <Box sx={{ color: 'error.main', py: 2 }}>
            <Typography variant="body1" gutterBottom>
              <ErrorIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
              Error calculating scores
            </Typography>
            <Typography variant="body2">
              {error}
            </Typography>
          </Box>
        )}

        {results && (
          <Box>
            <Typography variant="subtitle1" gutterBottom>
              Scoring Results
            </Typography>
            <List>
              {results.map((result) => (
                <ListItem key={result.leadId} divider>
                  {result.error ? (
                    <>
                      <ListItemIcon>
                        <ErrorIcon color="error" />
                      </ListItemIcon>
                      <ListItemText
                        primary={`Lead ID: ${result.leadId}`}
                        secondary={`Error: ${result.error}`}
                        secondaryTypographyProps={{ color: 'error' }}
                      />
                    </>
                  ) : (
                    <>
                      <ListItemIcon>
                        <CheckIcon color="success" />
                      </ListItemIcon>
                      <ListItemText
                        primary={`Lead ID: ${result.leadId}`}
                        secondary={`Score: ${result.score} (${getScoreLabel(result.score)})`}
                      />
                    </>
                  )}
                </ListItem>
              ))}
            </List>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        {!results ? (
          <>
            <Button onClick={handleClose} disabled={loading}>
              Cancel
            </Button>
            <Button 
              onClick={handleBatchScore} 
              variant="contained" 
              disabled={loading} 
              startIcon={<ScoreIcon />}
            >
              {loading ? 'Scoring...' : 'Calculate Scores'}
            </Button>
          </>
        ) : (
          <Button onClick={handleClose} variant="contained">
            Close
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

// Helper function to get score label
const getScoreLabel = (score) => {
  if (score >= 80) return 'Excellent';
  if (score >= 60) return 'Good';
  if (score >= 40) return 'Average';
  if (score >= 20) return 'Below Average';
  return 'Poor';
};

export default BatchScoreDialog; 