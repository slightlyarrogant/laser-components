import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link as RouterLink } from 'react-router-dom';
import { 
  Box, 
  Typography, 
  Button, 
  Alert, 
  Snackbar, 
  CircularProgress 
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

import ApplicationForm from '../../components/application/ApplicationForm';
import applicationService from '../../services/api/applicationService';

const ApplicationEdit = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [application, setApplication] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [notification, setNotification] = useState({ open: false, message: '' });

  // Fetch application data
  useEffect(() => {
    const fetchApplication = async () => {
      try {
        setLoading(true);
        const data = await applicationService.getApplicationById(id);
        setApplication(data);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching application:', err);
        setError('Failed to load application. Please try again later.');
        setLoading(false);
      }
    };

    fetchApplication();
  }, [id]);

  const handleUpdateApplication = async (applicationData) => {
    try {
      setSaving(true);
      await applicationService.updateApplication(id, applicationData);
      setNotification({
        open: true,
        message: 'Application updated successfully!'
      });
      
      // Redirect to application details page after a short delay
      setTimeout(() => {
        navigate(`/applications/${id}`);
      }, 1500);
    } catch (err) {
      console.error('Error updating application:', err);
      setError('Failed to update application. Please try again.');
      setSaving(false);
    }
  };

  const handleCloseNotification = () => {
    setNotification({ ...notification, open: false });
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!application && !loading) {
    return (
      <Box>
        <Alert severity="error" sx={{ mb: 2 }}>
          Application not found or you don't have permission to edit it.
        </Alert>
        <Button 
          component={RouterLink} 
          to="/applications" 
          startIcon={<ArrowBackIcon />}
        >
          Back to Applications
        </Button>
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h4" component="h1">
          Edit Application: {application.name}
        </Typography>
        <Button 
          startIcon={<ArrowBackIcon />} 
          component={RouterLink} 
          to={`/applications/${id}`}
        >
          Back to Details
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <ApplicationForm 
        application={application}
        onSave={handleUpdateApplication} 
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

export default ApplicationEdit; 