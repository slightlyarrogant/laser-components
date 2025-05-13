import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Container, 
  Box, 
  TextField, 
  Button, 
  Typography, 
  Alert, 
  CircularProgress 
} from '@mui/material';
import axiosInstance from '../../services/axiosInstance'; // <-- CORRECT Path & variable name
// TODO: Import your auth context or state management hook (e.g., useAuth)
// import { useAuth } from '../../contexts/AuthContext'; 

const LoginPage = () => {
  const navigate = useNavigate();
  // const { login } = useAuth(); // TODO: Get login function from context/state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await axiosInstance.post('/auth/login', { email, password });
      
      // TODO: Call your context/state management login function here
      // Pass the user data and access token from the response
      // login(response.data.user, response.data.accessToken);
      console.log('Login successful:', response.data); // Placeholder

      // Redirect to dashboard or intended page after login
      navigate('/'); 
      
    } catch (err) {
      console.error("Login failed:", err);
      if (err.response) {
        // Server responded with a status code (e.g., 401 Unauthorized)
        setError(err.response.data.message || 'Invalid credentials or server error.');
      } else if (err.request) {
        // The request was made but no response was received
        setError('Network error. Could not connect to the server.');
      } else {
        // Something happened in setting up the request
        setError('An unexpected error occurred.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container component="main" maxWidth="xs">
      <Box
        sx={{
          marginTop: 8,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <Typography component="h1" variant="h5">
          Sign in
        </Typography>
        <Box component="form" onSubmit={handleSubmit} noValidate sx={{ mt: 1 }}>
          {error && (
            <Alert severity="error" sx={{ width: '100%', mb: 2 }}>
              {error}
            </Alert>
          )}
          <TextField
            margin="normal"
            required
            fullWidth
            id="email"
            label="Email Address"
            name="email"
            autoComplete="email"
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
          />
          <TextField
            margin="normal"
            required
            fullWidth
            name="password"
            label="Password"
            type="password"
            id="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
          />
          {/* Optional: Add Remember Me checkbox if needed */}
          <Button
            type="submit"
            fullWidth
            variant="contained"
            sx={{ mt: 3, mb: 2 }}
            disabled={loading}
          >
            {loading ? <CircularProgress size={24} /> : 'Sign In'}
          </Button>
          {/* Optional: Add links for Forgot Password or Sign Up */}
          {/* <Grid container>
            <Grid item xs>
              <Link href="#" variant="body2">
                Forgot password?
              </Link>
            </Grid>
            <Grid item>
              <Link href="#" variant="body2">
                {"Don't have an account? Sign Up"}
              </Link>
            </Grid>
          </Grid> */}
        </Box>
      </Box>
    </Container>
  );
};

export default LoginPage; 