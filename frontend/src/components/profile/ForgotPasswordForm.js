import React, { useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  CircularProgress,
  Divider,
  TextField,
  Typography,
  Alert,
} from '@mui/material';
import EmailIcon from '@mui/icons-material/Email';

const ForgotPasswordForm = ({ onSubmit }) => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // Handle email input change
  const handleEmailChange = (e) => {
    setEmail(e.target.value);
    setError('');
    
    // Clear success message when email is modified after submission
    if (successMessage) {
      setSuccessMessage('');
    }
  };

  // Validate form
  const validateForm = () => {
    if (!email) {
      setError('Email is required');
      return false;
    }
    
    if (!/\S+@\S+\.\S+/.test(email)) {
      setError('Email is invalid');
      return false;
    }
    
    return true;
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      await onSubmit({ email });
      setSuccessMessage('Password reset instructions have been sent to your email address');
    } catch (error) {
      console.error('Password reset request error:', error);
      setError(error.response?.data?.message || error.message || 'An error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader title="Forgot Password" />
      <Divider />
      <CardContent>
        <Box component="form" onSubmit={handleSubmit} noValidate>
          {successMessage ? (
            <>
              <Alert severity="success" sx={{ mb: 3 }}>
                {successMessage}
              </Alert>
              <Typography variant="body2" sx={{ mb: 2 }}>
                Please check your email for instructions on how to reset your password. If you don't receive an email within a few minutes, please check your spam folder.
              </Typography>
              <Button 
                fullWidth
                variant="outlined"
                onClick={() => {
                  setEmail('');
                  setSuccessMessage('');
                }}
              >
                Try Another Email
              </Button>
            </>
          ) : (
            <>
              <Typography variant="body2" sx={{ mb: 3 }}>
                Enter your email address and we'll send you instructions to reset your password.
              </Typography>
              
              {error && (
                <Alert severity="error" sx={{ mb: 3 }}>
                  {error}
                </Alert>
              )}
              
              <TextField
                name="email"
                label="Email Address"
                type="email"
                variant="outlined"
                fullWidth
                required
                value={email}
                onChange={handleEmailChange}
                error={!!error}
                helperText={error}
                disabled={isSubmitting}
                sx={{ mb: 3 }}
              />
              
              <Button
                type="submit"
                variant="contained"
                color="primary"
                fullWidth
                startIcon={isSubmitting ? <CircularProgress size={24} color="inherit" /> : <EmailIcon />}
                disabled={isSubmitting}
              >
                Send Reset Link
              </Button>
            </>
          )}
        </Box>
      </CardContent>
    </Card>
  );
};

export default ForgotPasswordForm; 