import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import { Box, Container, Paper, Typography, Alert } from '@mui/material';
import UserForm from '../../../components/user/UserForm';
import { useAuth } from '../../../contexts/AuthContext';

const UserCreatePage = () => {
  const { checkPermission } = useAuth();
  const [errorMessage, setErrorMessage] = useState('');
  
  // Check if user has permission to create users
  const hasPermission = checkPermission('users', 'create');
  
  // Handle form submission
  const handleSubmit = async (userData) => {
    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create user');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error creating user:', error);
      setErrorMessage(error.message);
      throw error;
    }
  };
  
  if (!hasPermission) {
    return (
      <Container maxWidth="lg">
        <Box sx={{ mt: 4, mb: 4 }}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h5" color="error">
              Access Denied
            </Typography>
            <Typography>
              You do not have permission to create users.
            </Typography>
          </Paper>
        </Box>
      </Container>
    );
  }
  
  return (
    <>
      <Helmet>
        <title>Create User | Laser Components</title>
      </Helmet>
      
      <Container maxWidth="md">
        <Box sx={{ mt: 4, mb: 4 }}>
          <Box sx={{ mb: 3 }}>
            <Typography variant="h4" gutterBottom>
              Create New User
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Add a new user to the system with specific role and permissions.
            </Typography>
          </Box>
          
          {errorMessage && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {errorMessage}
            </Alert>
          )}
          
          <UserForm onSubmit={handleSubmit} />
        </Box>
      </Container>
    </>
  );
};

export default UserCreatePage; 