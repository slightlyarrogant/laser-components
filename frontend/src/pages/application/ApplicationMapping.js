import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link as RouterLink } from 'react-router-dom';
import {
  Autocomplete,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Divider,
  FormControl,
  FormControlLabel,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Snackbar,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Tooltip,
  Typography,
  Alert
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SaveIcon from '@mui/icons-material/Save';
import SearchIcon from '@mui/icons-material/Search';
import LinkIcon from '@mui/icons-material/Link';
import LinkOffIcon from '@mui/icons-material/LinkOff';
import FilterListIcon from '@mui/icons-material/FilterList';

import applicationService from '../../services/api/applicationService';
import productService from '../../services/api/productService';

const ApplicationMapping = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  
  // Application state
  const [application, setApplication] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Products state
  const [products, setProducts] = useState([]);
  const [mappedProducts, setMappedProducts] = useState([]);
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  
  // Filter state
  const [filters, setFilters] = useState({
    name: '',
    categoryId: '',
    subcategoryId: '',
  });
  
  // Pagination state
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  
  // UI state
  const [showFilters, setShowFilters] = useState(false);
  const [notification, setNotification] = useState({ open: false, message: '', severity: 'success' });
  const [saving, setSaving] = useState(false);
  
  // Fetch application and products data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Fetch application details
        const applicationData = await applicationService.getApplicationById(id);
        setApplication(applicationData);
        
        // Fetch mapped products
        const mappedProductsData = await applicationService.getMappedProducts(id);
        setMappedProducts(mappedProductsData);
        
        // Fetch all products
        const productsData = await productService.getProducts();
        setProducts(productsData.products || []);
        
        // Fetch categories and subcategories for filters
        const categoriesData = await productService.getCategories();
        setCategories(categoriesData);
        
        const subcategoriesData = await productService.getSubcategories();
        setSubcategories(subcategoriesData);
        
        setLoading(false);
        setLoadingProducts(false);
      } catch (err) {
        console.error('Error fetching data:', err);
        setError('Failed to load data. Please try again later.');
        setLoading(false);
        setLoadingProducts(false);
      }
    };
    
    fetchData();
  }, [id]);
  
  // Map products to application
  const handleMapProducts = async () => {
    if (selectedProducts.length === 0) {
      setNotification({
        open: true,
        message: 'Please select at least one product to map',
        severity: 'warning'
      });
      return;
    }
    
    try {
      setSaving(true);
      
      // Get IDs of selected products
      const productIds = selectedProducts.map(product => product.id);
      
      // Send mapping request
      await applicationService.mapProductsToApplication(id, productIds);
      
      // Update mapped products list
      const updatedMappedProducts = [...mappedProducts];
      selectedProducts.forEach(product => {
        if (!mappedProducts.some(mp => mp.id === product.id)) {
          updatedMappedProducts.push(product);
        }
      });
      
      setMappedProducts(updatedMappedProducts);
      setSelectedProducts([]);
      
      setNotification({
        open: true,
        message: `Successfully mapped ${productIds.length} products to this application`,
        severity: 'success'
      });
      
      setSaving(false);
    } catch (err) {
      console.error('Error mapping products:', err);
      setNotification({
        open: true,
        message: 'Failed to map products. Please try again.',
        severity: 'error'
      });
      setSaving(false);
    }
  };
  
  // Unmap a product from the application
  const handleUnmapProduct = async (productId) => {
    try {
      await applicationService.unmapProductFromApplication(id, productId);
      
      // Update mapped products list
      setMappedProducts(mappedProducts.filter(product => product.id !== productId));
      
      setNotification({
        open: true,
        message: 'Product successfully unmapped from application',
        severity: 'success'
      });
    } catch (err) {
      console.error('Error unmapping product:', err);
      setNotification({
        open: true,
        message: 'Failed to unmap product. Please try again.',
        severity: 'error'
      });
    }
  };
  
  // Handle filter changes
  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters({
      ...filters,
      [name]: value
    });
  };
  
  // Reset all filters
  const handleResetFilters = () => {
    setFilters({
      name: '',
      categoryId: '',
      subcategoryId: ''
    });
  };
  
  // Handle product selection
  const handleSelectProduct = (product) => {
    const isAlreadySelected = selectedProducts.some(p => p.id === product.id);
    
    if (isAlreadySelected) {
      setSelectedProducts(selectedProducts.filter(p => p.id !== product.id));
    } else {
      setSelectedProducts([...selectedProducts, product]);
    }
  };
  
  // Handle select all products on current page
  const handleSelectAllOnPage = (event) => {
    if (event.target.checked) {
      const newSelected = [...selectedProducts];
      
      // Add all products on current page that aren't already selected
      filteredProducts
        .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
        .forEach(product => {
          if (!newSelected.some(p => p.id === product.id) && 
              !mappedProducts.some(p => p.id === product.id)) {
            newSelected.push(product);
          }
        });
      
      setSelectedProducts(newSelected);
    } else {
      // Remove all products on current page from selection
      const productsOnPage = filteredProducts
        .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
        .map(product => product.id);
      
      setSelectedProducts(selectedProducts.filter(product => 
        !productsOnPage.includes(product.id)
      ));
    }
  };
  
  // Handle pagination changes
  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };
  
  // Close notification
  const handleCloseNotification = () => {
    setNotification({ ...notification, open: false });
  };
  
  // Check if a product is already mapped
  const isProductMapped = (productId) => {
    return mappedProducts.some(product => product.id === productId);
  };
  
  // Check if a product is selected
  const isProductSelected = (productId) => {
    return selectedProducts.some(product => product.id === productId);
  };
  
  // Get category and subcategory names
  const getCategoryName = (categoryId) => {
    const category = categories.find(c => c.id === categoryId);
    return category ? category.name : '';
  };
  
  const getSubcategoryName = (subcategoryId) => {
    const subcategory = subcategories.find(s => s.id === subcategoryId);
    return subcategory ? subcategory.name : '';
  };
  
  // Filter products based on search criteria
  const filteredProducts = products.filter(product => {
    const nameMatch = product.name.toLowerCase().includes(filters.name.toLowerCase());
    const categoryMatch = filters.categoryId ? product.categoryId === filters.categoryId : true;
    const subcategoryMatch = filters.subcategoryId ? product.subcategoryId === filters.subcategoryId : true;
    
    return nameMatch && categoryMatch && subcategoryMatch;
  });
  
  // Filter out already mapped products
  const availableProducts = filteredProducts.filter(product => 
    !mappedProducts.some(mp => mp.id === product.id)
  );
  
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
        <Alert severity="error" sx={{ mb: 2 }}>
          Application not found or you don't have permission to access it.
        </Alert>
        <Button 
          component={RouterLink} 
          to="/applications" 
          startIcon={<ArrowBackIcon />}
        >
          Back to Applications
        </Button>
      </Box>
    );
  }
  
  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h4" component="h1">
            Map Products to Application
          </Typography>
          <Typography variant="subtitle1" color="text.secondary">
            {application.name}
          </Typography>
        </Box>
        <Button 
          startIcon={<ArrowBackIcon />} 
          component={RouterLink} 
          to={`/applications/${id}`}
        >
          Back to Application
        </Button>
      </Box>
      
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}
      
      {/* Mapped Products Section */}
      <Paper sx={{ mb: 4, p: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">
            Currently Mapped Products
            <Chip 
              label={mappedProducts.length} 
              size="small" 
              color="primary" 
              sx={{ ml: 1 }} 
            />
          </Typography>
        </Box>
        
        <TableContainer sx={{ maxHeight: 300 }}>
          <Table stickyHeader size="small">
            <TableHead>
              <TableRow>
                <TableCell>Product Name</TableCell>
                <TableCell>Category</TableCell>
                <TableCell>Subcategory</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {mappedProducts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} align="center">
                    <Typography color="text.secondary">
                      No products are mapped to this application yet.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                mappedProducts.map(product => (
                  <TableRow key={product.id}>
                    <TableCell>{product.name}</TableCell>
                    <TableCell>{getCategoryName(product.categoryId)}</TableCell>
                    <TableCell>{getSubcategoryName(product.subcategoryId)}</TableCell>
                    <TableCell align="right">
                      <Tooltip title="Unmap product">
                        <IconButton
                          color="error"
                          size="small"
                          onClick={() => handleUnmapProduct(product.id)}
                        >
                          <LinkOffIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
      
      {/* Available Products Section */}
      <Paper>
        <Box sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">
              Available Products
              <Chip 
                label={availableProducts.length} 
                size="small" 
                color="info" 
                sx={{ ml: 1 }} 
              />
            </Typography>
            <Box>
              <Button 
                variant="outlined" 
                startIcon={<FilterListIcon />}
                onClick={() => setShowFilters(!showFilters)}
                sx={{ mr: 1 }}
              >
                {showFilters ? 'Hide Filters' : 'Show Filters'}
              </Button>
              <Button
                variant="contained"
                color="primary"
                startIcon={<SaveIcon />}
                onClick={handleMapProducts}
                disabled={selectedProducts.length === 0 || saving}
              >
                {saving ? 'Mapping...' : `Map (${selectedProducts.length})`}
              </Button>
            </Box>
          </Box>
          
          {/* Filter Section */}
          {showFilters && (
            <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
              <Grid container spacing={2} alignItems="center">
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    label="Search by Name"
                    name="name"
                    value={filters.name}
                    onChange={handleFilterChange}
                    InputProps={{
                      startAdornment: <SearchIcon sx={{ color: 'action.active', mr: 1 }} />,
                    }}
                  />
                </Grid>
                <Grid item xs={12} md={3}>
                  <FormControl fullWidth>
                    <InputLabel>Category</InputLabel>
                    <Select
                      name="categoryId"
                      value={filters.categoryId}
                      label="Category"
                      onChange={handleFilterChange}
                    >
                      <MenuItem value="">All Categories</MenuItem>
                      {categories.map(category => (
                        <MenuItem key={category.id} value={category.id}>
                          {category.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={3}>
                  <FormControl fullWidth disabled={!filters.categoryId}>
                    <InputLabel>Subcategory</InputLabel>
                    <Select
                      name="subcategoryId"
                      value={filters.subcategoryId}
                      label="Subcategory"
                      onChange={handleFilterChange}
                    >
                      <MenuItem value="">All Subcategories</MenuItem>
                      {subcategories
                        .filter(s => s.categoryId === filters.categoryId)
                        .map(subcategory => (
                          <MenuItem key={subcategory.id} value={subcategory.id}>
                            {subcategory.name}
                          </MenuItem>
                        ))
                      }
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={2}>
                  <Button 
                    variant="outlined" 
                    onClick={handleResetFilters}
                    fullWidth
                  >
                    Reset Filters
                  </Button>
                </Grid>
              </Grid>
            </Paper>
          )}
          
          {loadingProducts ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
              <CircularProgress />
            </Box>
          ) : (
            <>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell padding="checkbox">
                        <Checkbox
                          indeterminate={
                            selectedProducts.length > 0 && 
                            selectedProducts.length < availableProducts
                              .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                              .length
                          }
                          checked={
                            availableProducts
                              .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                              .length > 0 &&
                            availableProducts
                              .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                              .every(product => isProductSelected(product.id))
                          }
                          onChange={handleSelectAllOnPage}
                        />
                      </TableCell>
                      <TableCell>Product Name</TableCell>
                      <TableCell>Category</TableCell>
                      <TableCell>Subcategory</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {availableProducts.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} align="center">
                          <Typography color="text.secondary">
                            No products available to map. All products might already be mapped or no products match your filters.
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ) : (
                      availableProducts
                        .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                        .map(product => (
                          <TableRow 
                            key={product.id}
                            hover
                            onClick={() => handleSelectProduct(product)}
                            role="checkbox"
                            aria-checked={isProductSelected(product.id)}
                            selected={isProductSelected(product.id)}
                            sx={{ cursor: 'pointer' }}
                          >
                            <TableCell padding="checkbox">
                              <Checkbox
                                checked={isProductSelected(product.id)}
                              />
                            </TableCell>
                            <TableCell>{product.name}</TableCell>
                            <TableCell>{getCategoryName(product.categoryId)}</TableCell>
                            <TableCell>{getSubcategoryName(product.subcategoryId)}</TableCell>
                            <TableCell align="right">
                              <Tooltip title="Map product">
                                <IconButton
                                  color="primary"
                                  size="small"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleSelectProduct(product);
                                  }}
                                >
                                  <LinkIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </TableCell>
                          </TableRow>
                        ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
              <TablePagination
                rowsPerPageOptions={[5, 10, 25, 50]}
                component="div"
                count={availableProducts.length}
                rowsPerPage={rowsPerPage}
                page={page}
                onPageChange={handleChangePage}
                onRowsPerPageChange={handleChangeRowsPerPage}
              />
            </>
          )}
        </Box>
      </Paper>
      
      {/* Notifications */}
      <Snackbar
        open={notification.open}
        autoHideDuration={4000}
        onClose={handleCloseNotification}
      >
        <Alert 
          onClose={handleCloseNotification} 
          severity={notification.severity} 
          variant="filled"
        >
          {notification.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default ApplicationMapping; 