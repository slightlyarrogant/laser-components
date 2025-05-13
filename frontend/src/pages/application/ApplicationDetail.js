import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link as RouterLink } from 'react-router-dom';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Grid,
  IconButton,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import LinkIcon from '@mui/icons-material/Link';
import LinkOffIcon from '@mui/icons-material/LinkOff';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import UpdateIcon from '@mui/icons-material/Update';

import applicationService from '../../services/api/applicationService';

const ApplicationDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [application, setApplication] = useState(null);
  const [mappedProducts, setMappedProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch application and its mapped products
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Fetch application details
        const applicationData = await applicationService.getApplicationById(id);
        setApplication(applicationData);
        
        // Fetch mapped products
        const productsData = await applicationService.getMappedProducts(id);
        setMappedProducts(productsData);
        
        setLoading(false);
      } catch (err) {
        console.error('Error fetching application details:', err);
        setError('Failed to load application details. Please try again later.');
        setLoading(false);
      }
    };
    
    fetchData();
  }, [id]);

  // Handle application deletion
  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this application?')) {
      try {
        await applicationService.deleteApplication(id);
        navigate('/applications', { state: { notification: 'Application deleted successfully' } });
      } catch (err) {
        console.error('Error deleting application:', err);
        setError('Failed to delete application. Please try again.');
      }
    }
  };

  // Handle product unmapping
  const handleUnmapProduct = async (productId) => {
    if (window.confirm('Are you sure you want to unmap this product?')) {
      try {
        await applicationService.unmapProductFromApplication(id, productId);
        setMappedProducts(mappedProducts.filter(product => product.id !== productId));
      } catch (err) {
        console.error('Error unmapping product:', err);
        setError('Failed to unmap product. Please try again.');
      }
    }
  };

  // Format date for display
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
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
        <Typography variant="h6" color="error">
          Application not found.
        </Typography>
        <Button 
          component={RouterLink} 
          to="/applications" 
          startIcon={<ArrowBackIcon />}
          sx={{ mt: 2 }}
        >
          Back to Applications
        </Button>
      </Box>
    );
  }

  return (
    <Box>
      {/* Header with actions */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Button 
          startIcon={<ArrowBackIcon />} 
          component={RouterLink} 
          to="/applications"
        >
          Back to Applications
        </Button>
        <Stack direction="row" spacing={1}>
          <Button 
            variant="contained" 
            color="primary" 
            startIcon={<EditIcon />}
            component={RouterLink}
            to={`/applications/${id}/edit`}
          >
            Edit
          </Button>
          <Button 
            variant="outlined" 
            color="secondary" 
            startIcon={<LinkIcon />}
            component={RouterLink}
            to={`/applications/${id}/mapping`}
          >
            Manage Products
          </Button>
          <Button 
            variant="outlined" 
            color="error" 
            startIcon={<DeleteIcon />}
            onClick={handleDelete}
          >
            Delete
          </Button>
        </Stack>
      </Box>

      {error && (
        <Typography color="error" sx={{ mb: 2 }}>
          {error}
        </Typography>
      )}

      {/* Application details */}
      <Paper sx={{ mb: 4, overflow: 'hidden' }}>
        <Box sx={{ p: 3, pb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="h4" component="h1">{application.name}</Typography>
            <Chip 
              label={application.status} 
              color={application.status === 'ACTIVE' ? 'success' : 'error'} 
              variant="outlined" 
            />
          </Box>
        </Box>
        <Divider />
        <Box sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>Description</Typography>
          <Typography paragraph>
            {application.description || 'No description provided.'}
          </Typography>
        </Box>
        <Divider />
        <Box sx={{ p: 3, bgcolor: 'action.hover' }}>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={3}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <CalendarTodayIcon sx={{ mr: 1, color: 'text.secondary' }} />
                <Box>
                  <Typography variant="body2" color="text.secondary">Created</Typography>
                  <Typography variant="body1">{formatDate(application.createdAt)}</Typography>
                </Box>
              </Box>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <UpdateIcon sx={{ mr: 1, color: 'text.secondary' }} />
                <Box>
                  <Typography variant="body2" color="text.secondary">Last Updated</Typography>
                  <Typography variant="body1">{formatDate(application.updatedAt)}</Typography>
                </Box>
              </Box>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Box>
                <Typography variant="body2" color="text.secondary">ID</Typography>
                <Typography variant="body1">{application.id}</Typography>
              </Box>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Box>
                <Typography variant="body2" color="text.secondary">Mapped Products</Typography>
                <Typography variant="body1">{mappedProducts.length}</Typography>
              </Box>
            </Grid>
          </Grid>
        </Box>
      </Paper>

      {/* Mapped Products */}
      <Paper>
        <Box sx={{ p: 3, pb: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h5">Mapped Products</Typography>
            <Button 
              variant="outlined" 
              startIcon={<LinkIcon />}
              component={RouterLink}
              to={`/applications/${id}/mapping`}
            >
              Manage
            </Button>
          </Box>
          
          {mappedProducts.length === 0 ? (
            <Typography color="text.secondary">
              No products are mapped to this application yet.
            </Typography>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Product Name</TableCell>
                    <TableCell>Category</TableCell>
                    <TableCell>Mapped On</TableCell>
                    <TableCell>Mapped By</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {mappedProducts.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell>
                        <RouterLink 
                          to={`/products/${product.id}`}
                          style={{ textDecoration: 'none', color: 'inherit' }}
                        >
                          {product.name}
                        </RouterLink>
                      </TableCell>
                      <TableCell>
                        {product.category && (
                          <Chip 
                            size="small" 
                            label={product.category.name} 
                            variant="outlined" 
                          />
                        )}
                      </TableCell>
                      <TableCell>
                        {product.ApplicationProduct && formatDate(product.ApplicationProduct.assignedAt)}
                      </TableCell>
                      <TableCell>
                        {product.ApplicationProduct && product.ApplicationProduct.assignedBy}
                      </TableCell>
                      <TableCell align="right">
                        <IconButton
                          color="primary"
                          component={RouterLink}
                          to={`/products/${product.id}`}
                          size="small"
                          title="View product details"
                        >
                          <EditIcon />
                        </IconButton>
                        <IconButton
                          color="error"
                          onClick={() => handleUnmapProduct(product.id)}
                          size="small"
                          title="Unmap product"
                        >
                          <LinkOffIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Box>
      </Paper>
    </Box>
  );
};

export default ApplicationDetail; 