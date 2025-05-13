import React, { useState, useEffect } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Box,
  Button,
  Paper,
  TextField,
  Typography,
  IconButton,
  Grid,
  MenuItem,
  InputAdornment,
  Chip,
  TableContainer,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TablePagination,
  TableRow,
  TableSortLabel,
  CircularProgress,
} from '@mui/material';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import SearchIcon from '@mui/icons-material/Search';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import InfoIcon from '@mui/icons-material/Info';
import ScienceIcon from '@mui/icons-material/Science';

import productService from '../../services/api/productService';
import { discoverProductApplications } from '../../services/api/researchService.js';

const ProductList = () => {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Pagination state
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Sorting state
  const [orderBy, setOrderBy] = useState('name');
  const [order, setOrder] = useState('asc');

  // Filter state
  const [filters, setFilters] = useState({
    name: '',
    categoryId: '',
    subcategoryId: '',
  });

  const [discoveryLoading, setDiscoveryLoading] = useState({});

  // Mock snackbar functions (replace with actual implementation)
  const enqueueSnackbar = (message, options) => {
    console.log(`Snackbar: ${message} (${options?.variant})`);
    alert(message); // Simple alert for now
  };

  // Load initial data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        // Fetch categories
        const categoriesData = await productService.getCategories();
        setCategories(categoriesData);

        // Fetch all subcategories
        const subcategoriesData = await productService.getSubcategories();
        setSubcategories(subcategoriesData);

        // Fetch products with current filters
        const productsData = await productService.getProducts({
          ...filters,
          order,
          orderBy,
          page: page + 1, // API uses 1-based indexing
          limit: rowsPerPage
        });
        setProducts(productsData || []);
        setLoading(false);
      } catch (err) {
        setError('Failed to load products. Please try again later.');
        setLoading(false);
        console.error('Error fetching product data:', err);
      }
    };

    fetchData();
  }, [filters, page, rowsPerPage, order, orderBy]);

  // Handle filter changes
  const handleFilterChange = (event) => {
    const { name, value } = event.target;
    // Reset to first page when filters change
    setPage(0);
    setFilters({
      ...filters,
      [name]: value
    });
  };

  // Handle sorting
  const handleRequestSort = (property) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
  };

  // Handle pagination
  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // Find category and subcategory names
  const getCategoryName = (categoryId) => {
    const category = categories.find(cat => cat.id === categoryId);
    return category ? category.name : '';
  };

  const getSubcategoryName = (subcategoryId) => {
    const subcategory = subcategories.find(subcat => subcat.id === subcategoryId);
    return subcategory ? subcategory.name : '';
  };

  // Handle product deletion
  const handleDeleteProduct = async (id) => {
    if (window.confirm('Are you sure you want to delete this product?')) {
      try {
        await productService.deleteProduct(id);
        // Refresh product list
        const updatedProducts = products.filter(product => product.id !== id);
        setProducts(updatedProducts);
      } catch (err) {
        setError('Failed to delete product. Please try again.');
        console.error('Error deleting product:', err);
      }
    }
  };

  // Handle triggering AI discovery
  const handleDiscoverApplications = async (productId) => {
    setDiscoveryLoading(prev => ({ ...prev, [productId]: true }));
    try {
      const response = await discoverProductApplications(productId);
      enqueueSnackbar(response.data.message || 'AI discovery started successfully!', { variant: 'success' });
    } catch (err) {
      console.error('Error triggering application discovery:', err);
      enqueueSnackbar(err.response?.data?.message || 'Failed to start AI discovery.', { variant: 'error' });
    } finally {
      setDiscoveryLoading(prev => ({ ...prev, [productId]: false }));
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Products
        </Typography>
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddCircleOutlineIcon />}
          component={RouterLink}
          to="/products/new"
        >
          Add New Product
        </Button>
      </Box>

      {/* Filter Section */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={4}>
            <TextField
              fullWidth
              label="Search by Name"
              name="name"
              value={filters.name}
              onChange={handleFilterChange}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField
              fullWidth
              select
              label="Category"
              name="categoryId"
              value={filters.categoryId}
              onChange={handleFilterChange}
            >
              <MenuItem value="">All Categories</MenuItem>
              {categories.map((category) => (
                <MenuItem key={category.id} value={category.id}>
                  {category.name}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField
              fullWidth
              select
              label="Subcategory"
              name="subcategoryId"
              value={filters.subcategoryId}
              onChange={handleFilterChange}
              disabled={!filters.categoryId}
            >
              <MenuItem value="">All Subcategories</MenuItem>
              {subcategories
                .filter(subcat => !filters.categoryId || subcat.categoryId === filters.categoryId)
                .map((subcategory) => (
                  <MenuItem key={subcategory.id} value={subcategory.id}>
                    {subcategory.name}
                  </MenuItem>
                ))}
            </TextField>
          </Grid>
        </Grid>
      </Paper>

      {/* Products Table */}
      <Paper>
        {error && (
          <Box sx={{ p: 2, color: 'error.main' }}>
            <Typography>{error}</Typography>
          </Box>
        )}

        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>
                  <TableSortLabel
                    active={orderBy === 'name'}
                    direction={orderBy === 'name' ? order : 'asc'}
                    onClick={() => handleRequestSort('name')}
                  >
                    Name
                  </TableSortLabel>
                </TableCell>
                <TableCell>
                  <TableSortLabel
                    active={orderBy === 'category'}
                    direction={orderBy === 'category' ? order : 'asc'}
                    onClick={() => handleRequestSort('category')}
                  >
                    Category
                  </TableSortLabel>
                </TableCell>
                <TableCell>
                  <TableSortLabel
                    active={orderBy === 'subcategory'}
                    direction={orderBy === 'subcategory' ? order : 'asc'}
                    onClick={() => handleRequestSort('subcategory')}
                  >
                    Subcategory
                  </TableSortLabel>
                </TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={4} align="center">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : products.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} align="center">
                    No products found.
                  </TableCell>
                </TableRow>
              ) : (
                products.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell>{product.name}</TableCell>
                    <TableCell>
                      <Chip 
                        label={getCategoryName(product.categoryId)} 
                        size="small" 
                        variant="outlined" 
                      />
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={getSubcategoryName(product.subcategoryId)} 
                        size="small" 
                      />
                    </TableCell>
                    <TableCell align="right">
                      <IconButton
                        color="info"
                        component={RouterLink}
                        to={`/products/${product.id}`}
                        size="small"
                        title="View Details"
                      >
                        <InfoIcon />
                      </IconButton>
                      <IconButton
                        color="primary"
                        component={RouterLink}
                        to={`/products/${product.id}/edit`}
                        size="small"
                        title="Edit Product"
                      >
                        <EditIcon />
                      </IconButton>
                      <IconButton
                        color="secondary"
                        onClick={() => handleDiscoverApplications(product.id)}
                        disabled={discoveryLoading[product.id]}
                        size="small"
                        title="Discover Applications (AI)"
                      >
                        {discoveryLoading[product.id] ? <CircularProgress size={20} /> : <ScienceIcon />}
                      </IconButton>
                      <IconButton
                        color="error"
                        onClick={() => handleDeleteProduct(product.id)}
                        size="small"
                        title="Delete Product"
                      >
                        <DeleteIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          rowsPerPageOptions={[5, 10, 25]}
          component="div"
          count={products.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
      </Paper>
    </Box>
  );
};

export default ProductList; 