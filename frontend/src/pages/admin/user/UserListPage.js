import React from 'react';
import { Helmet } from 'react-helmet';
import { Box, Container, Paper, Typography } from '@mui/material';
import UserList from '../../../components/user/UserList';
import { useAuth } from '../../../contexts/AuthContext';

const UserListPage = () => {
  const { checkPermission } = useAuth();
  
  // Check if user has permission to view this page
  const hasPermission = checkPermission('users', 'read');
  
  // Handle successful user deletion
  const handleUserDeleted = (userId) => {
    // Could add a toast notification here
    console.log(`User ${userId} deleted successfully`);
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
              You do not have permission to view the user management page.
            </Typography>
          </Paper>
        </Box>
      </Container>
    );
  }
  
  return (
    <>
      <Helmet>
        <title>User Management | Laser Components</title>
      </Helmet>
      
      <Container maxWidth="lg">
        <Box sx={{ mt: 4, mb: 4 }}>
          <UserList onDelete={handleUserDeleted} />
        </Box>
      </Container>
    </>
  );
};

export default UserListPage; 