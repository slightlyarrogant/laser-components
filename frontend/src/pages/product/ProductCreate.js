import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { 
  Box, 
  Typography, 
  Button 
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

import ProductForm from '../../components/product/ProductForm';

const ProductCreate = () => {
  return (
    <Box>
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h4" component="h1">
          Add New Product
        </Typography>
        <Button 
          startIcon={<ArrowBackIcon />} 
          component={RouterLink} 
          to="/products"
        >
          Back to Products
        </Button>
      </Box>
      
      <ProductForm mode="create" />
    </Box>
  );
};

export default ProductCreate; 