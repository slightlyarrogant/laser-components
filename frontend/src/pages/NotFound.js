import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Button, Typography, Paper } from '@mui/material';
import HomeIcon from '@mui/icons-material/Home';

const NotFound = () => {
  return (
    <Paper sx={{ p: 5, textAlign: 'center', maxWidth: '600px', mx: 'auto', mt: 5 }}>
      <Typography variant="h1" component="h1" sx={{ fontSize: '5rem', fontWeight: 'bold', color: 'text.secondary' }}>
        404
      </Typography>
      <Typography variant="h5" component="h2" sx={{ mb: 4 }}>
        Page Not Found
      </Typography>
      <Typography variant="body1" color="text.secondary" paragraph>
        The page you are looking for might have been removed, had its name changed, 
        or is temporarily unavailable.
      </Typography>
      <Box sx={{ mt: 4 }}>
        <Button
          variant="contained"
          startIcon={<HomeIcon />}
          component={RouterLink}
          to="/"
          size="large"
        >
          Go to Homepage
        </Button>
      </Box>
    </Paper>
  );
};

export default NotFound; 