import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  FormControl,
  FormControlLabel,
  FormHelperText,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Radio,
  RadioGroup,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import CancelIcon from '@mui/icons-material/Cancel';

const ApplicationForm = ({ application = null, onSave, saving = false }) => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    status: 'ACTIVE'
  });
  const [errors, setErrors] = useState({});

  // Initialize form with application data if editing
  useEffect(() => {
    if (application) {
      setFormData({
        name: application.name || '',
        description: application.description || '',
        status: application.status || 'ACTIVE'
      });
    }
  }, [application]);

  // Handle form field changes
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear error when user types
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: undefined
      }));
    }
  };

  // Validate form
  const validate = () => {
    const validationErrors = {};
    
    if (!formData.name.trim()) {
      validationErrors.name = 'Application name is required';
    }
    
    return validationErrors;
  };

  // Handle form submission
  const handleSubmit = (e) => {
    e.preventDefault();
    
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    
    onSave(formData);
  };

  return (
    <form onSubmit={handleSubmit}>
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          {application ? 'Edit Application' : 'Create New Application'}
        </Typography>
        
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Application Name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              error={!!errors.name}
              helperText={errors.name}
              required
            />
          </Grid>
          
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              multiline
              rows={4}
            />
          </Grid>
          
          <Grid item xs={12}>
            <FormControl component="fieldset">
              <Typography variant="subtitle2" gutterBottom>
                Status
              </Typography>
              <RadioGroup
                row
                name="status"
                value={formData.status}
                onChange={handleChange}
              >
                <FormControlLabel
                  value="ACTIVE"
                  control={<Radio />}
                  label="Active"
                />
                <FormControlLabel
                  value="INACTIVE"
                  control={<Radio />}
                  label="Inactive"
                />
              </RadioGroup>
            </FormControl>
          </Grid>
        </Grid>
      </Paper>
      
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
        <Button
          variant="outlined"
          startIcon={<CancelIcon />}
          onClick={() => navigate(-1)}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          variant="contained"
          color="primary"
          startIcon={<SaveIcon />}
          disabled={saving}
        >
          {saving ? 'Saving...' : application ? 'Update' : 'Create'}
        </Button>
      </Box>
    </form>
  );
};

export default ApplicationForm; 