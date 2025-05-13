import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import {
  Box,
  Container,
  Grid,
  Paper,
  Typography,
  CircularProgress,
  Alert,
  Tabs,
  Tab,
} from '@mui/material';
import ProfileForm from '../../components/profile/ProfileForm';
import PasswordChangeForm from '../../components/profile/PasswordChangeForm';
import { useAuth } from '../../contexts/AuthContext';

const ProfilePage = () => {
  const { user, loading: authLoading } = useAuth();
  const [tabValue, setTabValue] = useState(0);
  const [message, setMessage] = useState(null);
  
  // Handle tab change
  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };
  
  // Handle profile update
  const handleProfileUpdate = async (profileData) => {
    try {
      const response = await fetch('/api/users/me', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(profileData),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update profile');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Profile update error:', error);
      throw error;
    }
  };
  
  // Handle password change
  const handlePasswordChange = async (passwordData) => {
    try {
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(passwordData),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to change password');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Password change error:', error);
      throw error;
    }
  };
  
  if (authLoading) {
    return (
      <Container maxWidth="lg">
        <Box sx={{ mt: 4, mb: 4, display: 'flex', justifyContent: 'center' }}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }
  
  if (!user) {
    return (
      <Container maxWidth="lg">
        <Box sx={{ mt: 4, mb: 4 }}>
          <Paper sx={{ p: 3 }}>
            <Alert severity="error">
              You must be logged in to view your profile.
            </Alert>
          </Paper>
        </Box>
      </Container>
    );
  }
  
  return (
    <>
      <Helmet>
        <title>My Profile | Laser Components</title>
      </Helmet>
      
      <Container maxWidth="lg">
        <Box sx={{ mt: 4, mb: 4 }}>
          <Typography variant="h4" gutterBottom>
            My Profile
          </Typography>
          
          <Paper sx={{ mb: 3 }}>
            <Tabs 
              value={tabValue} 
              onChange={handleTabChange}
              indicatorColor="primary"
              textColor="primary"
              variant="fullWidth"
            >
              <Tab label="Profile Information" />
              <Tab label="Change Password" />
            </Tabs>
          </Paper>
          
          <Box sx={{ mt: 3 }}>
            {tabValue === 0 && (
              <ProfileForm user={user} onSubmit={handleProfileUpdate} />
            )}
            
            {tabValue === 1 && (
              <PasswordChangeForm onSubmit={handlePasswordChange} />
            )}
          </Box>
        </Box>
      </Container>
    </>
  );
};

export default ProfilePage; 