import React, { useState, useEffect } from 'react';
import { useParams, Link as RouterLink } from 'react-router-dom';
import { 
  Box, 
  Typography, 
  Button, 
  Alert 
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

import ProductForm from '../../components/product/ProductForm';
import productService from '../../services/api/productService';

const ProductEdit = () => {
  const { id } = useParams();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        setLoading(true);
        const productData = await productService.getProductById(id);
        setProduct(productData);
        setLoading(false);
      } catch (err) {
        console.error('Error loading product:', err);
        setError('Failed to load product. Please try again later.');
        setLoading(false);
      }
    };

    fetchProduct();
  }, [id]);

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography>Loading product...</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>
        <Button 
          startIcon={<ArrowBackIcon />} 
          component={RouterLink} 
          to="/products"
        >
          Back to Products
        </Button>
      </Box>
    );
  }

  if (!product) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="warning" sx={{ mb: 3 }}>Product not found</Alert>
        <Button 
          startIcon={<ArrowBackIcon />} 
          component={RouterLink} 
          to="/products"
        >
          Back to Products
        </Button>
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h4" component="h1">
          Edit Product: {product.name}
        </Typography>
        <Button 
          startIcon={<ArrowBackIcon />} 
          component={RouterLink} 
          to={`/products/${id}`}
        >
          Back to Product
        </Button>
      </Box>
      
      <ProductForm product={product} mode="edit" />
    </Box>
  );
};

export default ProductEdit;