import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link as RouterLink } from 'react-router-dom';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Grid,
  Link,
  Paper,
  Typography,
  Stack,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';

import productService from '../../services/api/productService';

const ProductDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [category, setCategory] = useState(null);
  const [subcategory, setSubcategory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const productData = await productService.getProductById(id);
        setProduct(productData);

        // Fetch category and subcategory data
        if (productData.categoryId) {
          const categoryData = await productService.getCategoryById(productData.categoryId);
          setCategory(categoryData);
        }

        if (productData.subcategoryId) {
          const subcategoryData = await productService.getSubcategoryById(productData.subcategoryId);
          setSubcategory(subcategoryData);
        }

        setLoading(false);
      } catch (err) {
        setError('Failed to load product details. Please try again later.');
        setLoading(false);
        console.error('Error fetching product details:', err);
      }
    };

    fetchData();
  }, [id]);

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this product?')) {
      try {
        await productService.deleteProduct(id);
        navigate('/products', { state: { message: 'Product deleted successfully' } });
      } catch (err) {
        setError('Failed to delete product. Please try again.');
        console.error('Error deleting product:', err);
      }
    }
  };

  // Helper function to display specifications
  const renderSpecifications = (specs) => {
    if (!specs || Object.keys(specs).length === 0) {
      return <Typography color="text.secondary">No specifications available</Typography>;
    }

    return (
      <Grid container spacing={2}>
        {Object.entries(specs).map(([key, value]) => (
          <Grid item xs={12} sm={6} key={key}>
            <Box sx={{ mb: 1 }}>
              <Typography variant="subtitle2" color="text.secondary">{key}</Typography>
              <Typography variant="body1">{value}</Typography>
            </Box>
          </Grid>
        ))}
      </Grid>
    );
  };

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography variant="h6">Loading product details...</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3, color: 'error.main' }}>
        <Typography variant="h6">{error}</Typography>
        <Button 
          startIcon={<ArrowBackIcon />} 
          component={RouterLink} 
          to="/products"
          sx={{ mt: 2 }}
        >
          Back to Products
        </Button>
      </Box>
    );
  }

  if (!product) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography variant="h6">Product not found</Typography>
        <Button 
          startIcon={<ArrowBackIcon />} 
          component={RouterLink} 
          to="/products"
          sx={{ mt: 2 }}
        >
          Back to Products
        </Button>
      </Box>
    );
  }

  return (
    <Box>
      {/* Header with navigation and actions */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Button 
          startIcon={<ArrowBackIcon />} 
          component={RouterLink} 
          to="/products"
        >
          Back to Products
        </Button>
        <Stack direction="row" spacing={1}>
          <Button 
            variant="contained" 
            color="primary" 
            startIcon={<EditIcon />}
            component={RouterLink}
            to={`/products/${id}/edit`}
          >
            Edit
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

      {/* Product information */}
      <Paper sx={{ mb: 3 }}>
        <Box sx={{ p: 3, pb: 1 }}>
          <Typography variant="h4" component="h1">{product.name}</Typography>
          <Box sx={{ mt: 1, mb: 2 }}>
            {category && (
              <Chip 
                label={category.name} 
                variant="outlined" 
                size="small" 
                sx={{ mr: 1 }} 
              />
            )}
            {subcategory && (
              <Chip 
                label={subcategory.name} 
                size="small"
              />
            )}
          </Box>
        </Box>
        <Divider />
        <Box sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>Description</Typography>
          <Typography paragraph>
            {product.description || 'No description available.'}
          </Typography>
        </Box>
      </Paper>

      {/* Specifications */}
      <Paper sx={{ mb: 3 }}>
        <Box sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>Specifications</Typography>
          {renderSpecifications(product.specifications)}
        </Box>
      </Paper>

      {/* Additional Information */}
      <Grid container spacing={3}>
        {/* Price and SKU */}
        <Grid item xs={12} md={6}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>Product Details</Typography>
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" color="text.secondary">SKU</Typography>
                <Typography variant="body1">{product.sku || 'N/A'}</Typography>
              </Box>
              <Box>
                <Typography variant="subtitle2" color="text.secondary">Price</Typography>
                <Typography variant="body1">
                  {product.price ? `$${product.price.toFixed(2)}` : 'Price on request'}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Datasheet */}
        <Grid item xs={12} md={6}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>Resources</Typography>
              {product.datasheetUrl ? (
                <Button 
                  variant="outlined" 
                  startIcon={<CloudDownloadIcon />}
                  component={Link}
                  href={product.datasheetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Download Datasheet
                </Button>
              ) : (
                <Typography color="text.secondary">No datasheet available</Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default ProductDetail; 