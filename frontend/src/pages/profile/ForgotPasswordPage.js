import React from 'react';
import { Helmet } from 'react-helmet';
import { Link as RouterLink } from 'react-router-dom';
import {
  Box,
  Container,
  Paper,
  Typography,
  Link,
} from '@mui/material';
import ForgotPasswordForm from '../../components/profile/ForgotPasswordForm';

const ForgotPasswordPage = () => {
  // Handle forgot password submission
  const handleSubmit = async (data) => {
    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to send password reset');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Password reset request error:', error);
      throw error;
    }
  };
  
  return (
    <>
      <Helmet>
        <title>Forgot Password | Laser Components</title>
      </Helmet>
      
      <Container maxWidth="sm">
        <Box sx={{ mt: 8, mb: 4 }}>
          <Typography variant="h4" align="center" gutterBottom>
            Laser Components
          </Typography>
          <Typography variant="subtitle1" align="center" color="textSecondary" gutterBottom>
            Reset your password
          </Typography>
          
          <Paper sx={{ mt: 3, p: 0 }}>
            <ForgotPasswordForm onSubmit={handleSubmit} />
          </Paper>
          
          <Box sx={{ mt: 3, textAlign: 'center' }}>
            <Link component={RouterLink} to="/login" variant="body2">
              Return to login
            </Link>
          </Box>
        </Box>
      </Container>
    </>
  );
};

export default ForgotPasswordPage; 