import React, { useState, useEffect } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Container, 
  Box, 
  Typography, 
  CircularProgress, 
  Alert, 
  List, 
  ListItem, 
  ListItemText, 
  ListItemSecondaryAction, 
  IconButton, 
  Paper,
  Divider
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit'; // For linking to review/edit form
import { fetchResearchList } from '../../services/api/researchService'; // Import API service

const ResearchReviewPage = () => {
  const [researchItems, setResearchItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadPendingReviewItems = async () => {
      setLoading(true);
      setError(null);
      try {
        // Fetch only items with status AI_DISCOVERED
        const response = await fetchResearchList({ status: 'AI_DISCOVERED' });
        setResearchItems(response.data?.data || []); // Assuming pagination structure
      } catch (err) {
        console.error("Error fetching research items for review:", err);
        setError(err.response?.data?.message || 'Failed to load research items for review.');
      } finally {
        setLoading(false);
      }
    };

    loadPendingReviewItems();
  }, []);

  return (
    <Container maxWidth="lg">
      <Typography variant="h4" component="h1" gutterBottom>
        Review AI-Discovered Applications
      </Typography>
      <Typography variant="body1" color="text.secondary" paragraph>
        Review the potential applications discovered by the AI for specific products. Approve, reject, or edit them.
      </Typography>

      {loading && (
        <Box display="flex" justifyContent="center" sx={{ my: 4 }}>
          <CircularProgress />
        </Box>
      )}

      {error && (
        <Alert severity="error" sx={{ my: 2 }}>
          {error}
        </Alert>
      )}

      {!loading && !error && (
        <Paper elevation={2} sx={{ mt: 2 }}>
          <List disablePadding>
            {researchItems.length === 0 ? (
              <ListItem>
                <ListItemText primary="No research items currently pending AI review." />
              </ListItem>
            ) : (
              researchItems.map((item, index) => (
                <React.Fragment key={item.id}>
                  <ListItem>
                    <ListItemText 
                      primary={item.applicationName}
                      secondary={`Industry: ${item.industrySector || 'N/A'} | Discovered From: ${item.discoveredFromProduct?.name || 'Unknown Product'}`}
                    />
                    <ListItemSecondaryAction>
                      {/* Link to the review/edit form (using existing ResearchForm for now) */}
                      <IconButton 
                        edge="end" 
                        aria-label="review"
                        component={RouterLink}
                        to={`/research/${item.id}/review`} // Route to the review form
                        title="Review/Edit"
                      >
                        <EditIcon />
                      </IconButton>
                      {/* TODO: Add quick Approve/Reject buttons here later if needed */}
                    </ListItemSecondaryAction>
                  </ListItem>
                  {index < researchItems.length - 1 && <Divider component="li" />}
                </React.Fragment>
              ))
            )}
          </List>
        </Paper>
      )}
    </Container>
  );
};

export default ResearchReviewPage; 