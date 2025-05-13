import React, { useState } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { 
  Box, 
  Typography, 
  Button, 
  Alert, 
  Snackbar 
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

import ApplicationForm from '../../components/application/ApplicationForm';
import applicationService from '../../services/api/applicationService';

const ApplicationCreate = () => {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [notification, setNotification] = useState({ open: false, message: '' });

  const handleCreateApplication = async (applicationData) => {
    try {
      setSaving(true);
      const createdApplication = await applicationService.createApplication(applicationData);
      setNotification({
        open: true,
        message: 'Application created successfully!'
      });
      
      // Redirect to application details page after a short delay
      setTimeout(() => {
        navigate(`/applications/${createdApplication.id}`);
      }, 1500);
    } catch (err) {
      console.error('Error creating application:', err);
      setError('Failed to create application. Please try again.');
      setSaving(false);
    }
  };

  const handleCloseNotification = () => {
    setNotification({ ...notification, open: false });
  };

  return (
    <Box>
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h4" component="h1">
          Create New Application
        </Typography>
        <Button 
          startIcon={<ArrowBackIcon />} 
          component={RouterLink} 
          to="/applications"
        >
          Back to Applications
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <ApplicationForm 
        onSave={handleCreateApplication} 
        saving={saving} 
      />

      <Snackbar
        open={notification.open}
        autoHideDuration={3000}
        onClose={handleCloseNotification}
        message={notification.message}
      />
    </Box>
  );
};

export default ApplicationCreate; 