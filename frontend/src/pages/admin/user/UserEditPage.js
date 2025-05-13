import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { Box, Container, Paper, Typography, Alert, CircularProgress } from '@mui/material';
import UserForm from '../../../components/user/UserForm';
import { useAuth } from '../../../contexts/AuthContext';

const UserEditPage = () => {
  const { id } = useParams();
  const { checkPermission } = useAuth();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  
  // Check if user has permission to update users
  const hasPermission = checkPermission('users', 'update');
  
  // Fetch user data
  useEffect(() => {
    const fetchUser = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/users/${id}`);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch user: ${response.statusText}`);
        }
        
        const userData = await response.json();
        setUser(userData);
      } catch (error) {
        console.error('Error fetching user:', error);
        setErrorMessage(error.message);
      } finally {
        setLoading(false);
      }
    };
    
    fetchUser();
  }, [id]);
  
  // Handle form submission
  const handleSubmit = async (userData) => {
    try {
      const response = await fetch(`/api/users/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update user');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error updating user:', error);
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
              You do not have permission to edit users.
            </Typography>
          </Paper>
        </Box>
      </Container>
    );
  }
  
  return (
    <>
      <Helmet>
        <title>Edit User | Laser Components</title>
      </Helmet>
      
      <Container maxWidth="md">
        <Box sx={{ mt: 4, mb: 4 }}>
          <Box sx={{ mb: 3 }}>
            <Typography variant="h4" gutterBottom>
              Edit User
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Update user details and permissions.
            </Typography>
          </Box>
          
          {errorMessage && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {errorMessage}
            </Alert>
          )}
          
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
              <CircularProgress />
            </Box>
          ) : (
            user ? (
              <UserForm user={user} onSubmit={handleSubmit} isEditing={true} />
            ) : (
              <Paper sx={{ p: 3 }}>
                <Typography>User not found or has been deleted.</Typography>
              </Paper>
            )
          )}
        </Box>
      </Container>
    </>
  );
};

export default UserEditPage; 