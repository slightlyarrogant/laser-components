import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { Box, Container } from '@mui/material';
import UserDetail from '../../../components/user/UserDetail';
import { useAuth } from '../../../contexts/AuthContext';

const UserDetailPage = () => {
  const { id } = useParams();
  const { checkPermission } = useAuth();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Check if user has permission to view user details
  const hasPermission = checkPermission('users', 'read');
  
  // Fetch user data
  useEffect(() => {
    const fetchUser = async () => {
      if (!hasPermission) {
        return;
      }
      
      try {
        setLoading(true);
        const response = await fetch(`/api/users/${id}`);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch user: ${response.statusText}`);
        }
        
        const userData = await response.json();
        setUser(userData);
      } catch (err) {
        console.error('Error fetching user:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    
    fetchUser();
  }, [id, hasPermission]);
  
  return (
    <>
      <Helmet>
        <title>User Details | Laser Components</title>
      </Helmet>
      
      <Container maxWidth="lg">
        <Box sx={{ mt: 4, mb: 4 }}>
          <UserDetail 
            user={user} 
            loading={loading} 
            error={error || (!hasPermission ? 'Access denied' : null)} 
          />
        </Box>
      </Container>
    </>
  );
};

export default UserDetailPage; 