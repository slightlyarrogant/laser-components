import React from 'react';
import {
  Box,
  Container,
  Breadcrumbs,
  Link,
  Typography,
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import TagManagement from '../../components/lead/TagManagement';

/**
 * Page for managing tag presets
 */
const TagManagementPage = () => {
  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ mb: 3 }}>
        <Breadcrumbs aria-label="breadcrumb">
          <Link component={RouterLink} to="/" color="inherit">
            Dashboard
          </Link>
          <Link component={RouterLink} to="/settings" color="inherit">
            Settings
          </Link>
          <Typography color="text.primary">Tag Management</Typography>
        </Breadcrumbs>
      </Box>
      
      <Typography variant="h4" component="h1" gutterBottom>
        Tag Management
      </Typography>
      
      <Typography variant="body1" paragraph color="text.secondary">
        Create and manage tag presets for your leads. Tag presets allow you to consistently categorize 
        leads with predefined colors for better visual organization.
      </Typography>
      
      <Box sx={{ mt: 3 }}>
        <TagManagement />
      </Box>
    </Container>
  );
};

export default TagManagementPage; 