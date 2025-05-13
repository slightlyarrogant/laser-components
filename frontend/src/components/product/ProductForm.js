import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Card,
  CardContent,
  Divider,
  FormControl,
  FormHelperText,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import CancelIcon from '@mui/icons-material/Cancel';

import productService from '../../services/api/productService';

// ProductForm component for creating and editing products
const ProductForm = ({ product, mode = 'create' }) => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    categoryId: '',
    subcategoryId: '',
    sku: '',
    price: '',
    datasheetUrl: '',
    specifications: {},
  });
  
  const [categories, setCategories] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [formErrors, setFormErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [specFields, setSpecFields] = useState([{ key: '', value: '' }]);

  // Load initial data (categories, subcategories) and populate form for edit mode
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch categories
        const categoriesData = await productService.getCategories();
        setCategories(categoriesData);

        // Fetch all subcategories
        const subcategoriesData = await productService.getSubcategories();
        setSubcategories(subcategoriesData);

        // Populate form data if in edit mode
        if (mode === 'edit' && product) {
          setFormData({
            name: product.name || '',
            description: product.description || '',
            categoryId: product.categoryId || '',
            subcategoryId: product.subcategoryId || '',
            sku: product.sku || '',
            price: product.price || '',
            datasheetUrl: product.datasheetUrl || '',
            specifications: product.specifications || {},
          });

          // Convert specifications object to field array for editing
          if (product.specifications && Object.keys(product.specifications).length > 0) {
            const specFieldsArray = Object.entries(product.specifications).map(([key, value]) => ({
              key,
              value: value || '',
            }));
            setSpecFields(specFieldsArray);
          }
        }
      } catch (err) {
        console.error('Error loading form data:', err);
      }
    };

    fetchData();
  }, [product, mode]);

  // Handle form field changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });

    // Clear error when user types
    if (formErrors[name]) {
      setFormErrors({
        ...formErrors,
        [name]: undefined,
      });
    }
  };

  // When category changes, reset subcategory
  const handleCategoryChange = (e) => {
    const { value } = e.target;
    setFormData({
      ...formData,
      categoryId: value,
      subcategoryId: '', // Reset subcategory when category changes
    });

    // Clear error when user selects a category
    if (formErrors.categoryId) {
      setFormErrors({
        ...formErrors,
        categoryId: undefined,
      });
    }
  };

  // Handle price input (allow only numeric values)
  const handlePriceChange = (e) => {
    const value = e.target.value;
    // Allow empty string, decimal point, and numbers
    if (value === '' || /^[0-9]*\.?[0-9]*$/.test(value)) {
      setFormData({
        ...formData,
        price: value,
      });
    }
  };

  // Handle specification field changes
  const handleSpecFieldChange = (index, field, value) => {
    const updatedFields = [...specFields];
    updatedFields[index][field] = value;
    setSpecFields(updatedFields);
  };

  // Add a new specification field
  const addSpecField = () => {
    setSpecFields([...specFields, { key: '', value: '' }]);
  };

  // Remove a specification field
  const removeSpecField = (index) => {
    if (specFields.length > 1) {
      const updatedFields = [...specFields];
      updatedFields.splice(index, 1);
      setSpecFields(updatedFields);
    }
  };

  // Convert spec fields array to object for submission
  const prepareSpecifications = () => {
    const specs = {};
    specFields.forEach((field) => {
      if (field.key.trim() && field.value.trim()) {
        specs[field.key.trim()] = field.value.trim();
      }
    });
    return specs;
  };

  // Validate form fields
  const validateForm = () => {
    const errors = {};
    
    if (!formData.name.trim()) {
      errors.name = 'Product name is required';
    }
    
    if (!formData.categoryId) {
      errors.categoryId = 'Category is required';
    }
    
    if (!formData.subcategoryId) {
      errors.subcategoryId = 'Subcategory is required';
    }

    return errors;
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const errors = validateForm();
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    try {
      setSubmitting(true);
      
      // Prepare the product data
      const productData = {
        ...formData,
        price: formData.price ? parseFloat(formData.price) : null,
        specifications: prepareSpecifications(),
      };

      // Create or update product based on mode
      if (mode === 'edit' && product) {
        await productService.updateProduct(product.id, productData);
        navigate(`/products/${product.id}`, { state: { message: 'Product updated successfully' } });
      } else {
        const newProduct = await productService.createProduct(productData);
        navigate(`/products/${newProduct.id}`, { state: { message: 'Product created successfully' } });
      }
    } catch (err) {
      console.error('Error saving product:', err);
      setFormErrors({
        submit: 'Failed to save product. Please try again.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          {mode === 'edit' ? 'Edit Product' : 'Create New Product'}
        </Typography>
        <Divider sx={{ mb: 3 }} />
        
        <Grid container spacing={3}>
          {/* Basic Information */}
          <Grid item xs={12}>
            <Typography variant="subtitle1" gutterBottom>Basic Information</Typography>
          </Grid>
          
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Product Name"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              error={!!formErrors.name}
              helperText={formErrors.name}
              required
            />
          </Grid>
          
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Description"
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              multiline
              rows={4}
            />
          </Grid>
          
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth error={!!formErrors.categoryId} required>
              <InputLabel>Category</InputLabel>
              <Select
                name="categoryId"
                value={formData.categoryId}
                onChange={handleCategoryChange}
                label="Category"
              >
                <MenuItem value="">Select a Category</MenuItem>
                {categories.map((category) => (
                  <MenuItem key={category.id} value={category.id}>
                    {category.name}
                  </MenuItem>
                ))}
              </Select>
              {formErrors.categoryId && <FormHelperText>{formErrors.categoryId}</FormHelperText>}
            </FormControl>
          </Grid>
          
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth error={!!formErrors.subcategoryId} required>
              <InputLabel>Subcategory</InputLabel>
              <Select
                name="subcategoryId"
                value={formData.subcategoryId}
                onChange={handleInputChange}
                label="Subcategory"
                disabled={!formData.categoryId}
              >
                <MenuItem value="">Select a Subcategory</MenuItem>
                {subcategories
                  .filter((subcat) => subcat.categoryId === formData.categoryId)
                  .map((subcategory) => (
                    <MenuItem key={subcategory.id} value={subcategory.id}>
                      {subcategory.name}
                    </MenuItem>
                  ))}
              </Select>
              {formErrors.subcategoryId && <FormHelperText>{formErrors.subcategoryId}</FormHelperText>}
            </FormControl>
          </Grid>
          
          {/* Product Details */}
          <Grid item xs={12} sx={{ mt: 2 }}>
            <Typography variant="subtitle1" gutterBottom>Product Details</Typography>
          </Grid>
          
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="SKU"
              name="sku"
              value={formData.sku}
              onChange={handleInputChange}
            />
          </Grid>
          
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Price"
              name="price"
              value={formData.price}
              onChange={handlePriceChange}
              InputProps={{
                startAdornment: <Box component="span" sx={{ mr: 1 }}>$</Box>,
              }}
            />
          </Grid>
          
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Datasheet URL"
              name="datasheetUrl"
              value={formData.datasheetUrl}
              onChange={handleInputChange}
              placeholder="https://example.com/datasheet.pdf"
            />
          </Grid>
          
          {/* Specifications */}
          <Grid item xs={12} sx={{ mt: 2 }}>
            <Typography variant="subtitle1" gutterBottom>Specifications</Typography>
          </Grid>
          
          {specFields.map((field, index) => (
            <Grid item xs={12} key={index} container spacing={2}>
              <Grid item xs={5}>
                <TextField
                  fullWidth
                  label="Specification Name"
                  value={field.key}
                  onChange={(e) => handleSpecFieldChange(index, 'key', e.target.value)}
                  placeholder="e.g., Wavelength"
                />
              </Grid>
              <Grid item xs={5}>
                <TextField
                  fullWidth
                  label="Value"
                  value={field.value}
                  onChange={(e) => handleSpecFieldChange(index, 'value', e.target.value)}
                  placeholder="e.g., 532 nm"
                />
              </Grid>
              <Grid item xs={2}>
                <Button 
                  variant="outlined" 
                  color="error" 
                  onClick={() => removeSpecField(index)}
                  disabled={specFields.length === 1}
                  sx={{ mt: 1 }}
                >
                  Remove
                </Button>
              </Grid>
            </Grid>
          ))}
          
          <Grid item xs={12}>
            <Button variant="outlined" onClick={addSpecField}>
              Add Specification
            </Button>
          </Grid>
        </Grid>
      </Paper>
      
      {/* Form errors */}
      {formErrors.submit && (
        <Box sx={{ color: 'error.main', mb: 2 }}>
          <Typography>{formErrors.submit}</Typography>
        </Box>
      )}
      
      {/* Form actions */}
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
          disabled={submitting}
        >
          {submitting ? 'Saving...' : mode === 'edit' ? 'Update Product' : 'Create Product'}
        </Button>
      </Box>
    </form>
  );
};

export default ProductForm; 