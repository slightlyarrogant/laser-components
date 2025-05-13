import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Paper,
  TextField,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import MuiAccordion from '@mui/material/Accordion';
import MuiAccordionSummary from '@mui/material/AccordionSummary';
import MuiAccordionDetails from '@mui/material/AccordionDetails';
import { styled } from '@mui/material/styles';

import productService from '../../services/api/productService';

// Styled components for custom accordion
const Accordion = styled((props) => (
  <MuiAccordion disableGutters elevation={0} square {...props} />
))(({ theme }) => ({
  border: `1px solid ${theme.palette.divider}`,
  '&:not(:last-child)': {
    borderBottom: 0,
  },
  '&::before': {
    display: 'none',
  },
}));

const AccordionSummary = styled((props) => (
  <MuiAccordionSummary
    expandIcon={<ExpandMoreIcon />}
    {...props}
  />
))(({ theme }) => ({
  backgroundColor: theme.palette.mode === 'dark'
    ? 'rgba(255, 255, 255, .05)'
    : 'rgba(0, 0, 0, .03)',
  flexDirection: 'row',
  '& .MuiAccordionSummary-expandIconWrapper.Mui-expanded': {
    transform: 'rotate(180deg)',
  },
  '& .MuiAccordionSummary-content': {
    marginLeft: theme.spacing(1),
  },
}));

const AccordionDetails = styled(MuiAccordionDetails)(({ theme }) => ({
  padding: theme.spacing(2),
  borderTop: '1px solid rgba(0, 0, 0, .125)',
}));

const CategoryList = () => {
  const [categories, setCategories] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [expandedCategory, setExpandedCategory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Dialog states
  const [categoryDialog, setCategoryDialog] = useState({ open: false, mode: 'create', data: {} });
  const [subcategoryDialog, setSubcategoryDialog] = useState({ open: false, mode: 'create', data: {}, parentId: null });
  const [deleteConfirmDialog, setDeleteConfirmDialog] = useState({ open: false, type: null, id: null });
  
  // Load categories and subcategories
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const categoriesData = await productService.getCategories();
        setCategories(categoriesData);
        
        const subcategoriesData = await productService.getSubcategories();
        setSubcategories(subcategoriesData);
        
        setLoading(false);
      } catch (err) {
        setError('Failed to load categories. Please try again later.');
        setLoading(false);
        console.error('Error fetching category data:', err);
      }
    };
    
    fetchData();
  }, []);

  // Handle expand/collapse of a category
  const handleCategoryExpand = (categoryId) => {
    setExpandedCategory(expandedCategory === categoryId ? null : categoryId);
  };
  
  // Get subcategories for a specific category
  const getCategorySubcategories = (categoryId) => {
    return subcategories.filter(subcat => subcat.categoryId === categoryId);
  };
  
  // Dialog handlers for Category CRUD
  const handleOpenCategoryDialog = (mode, category = {}) => {
    setCategoryDialog({
      open: true,
      mode,
      data: { ...category },
    });
  };
  
  const handleCloseCategoryDialog = () => {
    setCategoryDialog({ open: false, mode: 'create', data: {} });
  };
  
  const handleCategoryInputChange = (e) => {
    const { name, value } = e.target;
    setCategoryDialog({
      ...categoryDialog,
      data: {
        ...categoryDialog.data,
        [name]: value,
      },
    });
  };
  
  const handleSaveCategory = async () => {
    try {
      const { mode, data } = categoryDialog;
      
      if (mode === 'create') {
        const newCategory = await productService.createCategory(data);
        setCategories([...categories, newCategory]);
      } else {
        const updatedCategory = await productService.updateCategory(data.id, data);
        setCategories(categories.map(cat => cat.id === data.id ? updatedCategory : cat));
      }
      
      handleCloseCategoryDialog();
    } catch (err) {
      console.error('Error saving category:', err);
      setError('Failed to save category. Please try again.');
    }
  };
  
  // Dialog handlers for Subcategory CRUD
  const handleOpenSubcategoryDialog = (mode, parentId, subcategory = {}) => {
    setSubcategoryDialog({
      open: true,
      mode,
      data: { ...subcategory },
      parentId,
    });
  };
  
  const handleCloseSubcategoryDialog = () => {
    setSubcategoryDialog({ open: false, mode: 'create', data: {}, parentId: null });
  };
  
  const handleSubcategoryInputChange = (e) => {
    const { name, value } = e.target;
    setSubcategoryDialog({
      ...subcategoryDialog,
      data: {
        ...subcategoryDialog.data,
        [name]: value,
      },
    });
  };
  
  const handleSaveSubcategory = async () => {
    try {
      const { mode, data, parentId } = subcategoryDialog;
      
      // Set the categoryId if this is a new subcategory
      const subcategoryData = {
        ...data,
        categoryId: mode === 'create' ? parentId : data.categoryId,
      };
      
      if (mode === 'create') {
        const newSubcategory = await productService.createSubcategory(subcategoryData);
        setSubcategories([...subcategories, newSubcategory]);
      } else {
        const updatedSubcategory = await productService.updateSubcategory(data.id, subcategoryData);
        setSubcategories(subcategories.map(subcat => subcat.id === data.id ? updatedSubcategory : subcat));
      }
      
      handleCloseSubcategoryDialog();
    } catch (err) {
      console.error('Error saving subcategory:', err);
      setError('Failed to save subcategory. Please try again.');
    }
  };
  
  // Delete confirmation dialog
  const handleOpenDeleteDialog = (type, id) => {
    setDeleteConfirmDialog({
      open: true,
      type,
      id,
    });
  };
  
  const handleCloseDeleteDialog = () => {
    setDeleteConfirmDialog({ open: false, type: null, id: null });
  };
  
  const handleConfirmDelete = async () => {
    try {
      const { type, id } = deleteConfirmDialog;
      
      if (type === 'category') {
        await productService.deleteCategory(id);
        setCategories(categories.filter(cat => cat.id !== id));
        // Also filter out related subcategories
        setSubcategories(subcategories.filter(subcat => subcat.categoryId !== id));
      } else if (type === 'subcategory') {
        await productService.deleteSubcategory(id);
        setSubcategories(subcategories.filter(subcat => subcat.id !== id));
      }
      
      handleCloseDeleteDialog();
    } catch (err) {
      console.error('Error deleting item:', err);
      setError(`Failed to delete ${deleteConfirmDialog.type}. Please try again.`);
      handleCloseDeleteDialog();
    }
  };
  
  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Categories
        </Typography>
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddIcon />}
          onClick={() => handleOpenCategoryDialog('create')}
        >
          Add Category
        </Button>
      </Box>
      
      {error && (
        <Paper sx={{ p: 2, mb: 3, bgcolor: 'error.light', color: 'error.contrastText' }}>
          <Typography>{error}</Typography>
        </Paper>
      )}
      
      {loading ? (
        <Paper sx={{ p: 3 }}>
          <Typography>Loading categories...</Typography>
        </Paper>
      ) : categories.length === 0 ? (
        <Paper sx={{ p: 3, textAlign: 'center' }}>
          <Typography sx={{ mb: 2 }}>No categories found.</Typography>
          <Button
            variant="outlined"
            startIcon={<AddIcon />}
            onClick={() => handleOpenCategoryDialog('create')}
          >
            Create First Category
          </Button>
        </Paper>
      ) : (
        <>
          {/* Categories with subcategories in accordion style */}
          {categories.map((category) => (
            <Accordion
              key={category.id}
              expanded={expandedCategory === category.id}
              onChange={() => handleCategoryExpand(category.id)}
              sx={{ mb: 2 }}
            >
              <AccordionSummary>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                  <Typography variant="h6">{category.name}</Typography>
                  <Box sx={{ ml: 'auto', mr: 2, display: 'flex' }}>
                    <IconButton
                      size="small"
                      color="primary"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenCategoryDialog('edit', category);
                      }}
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      color="error"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenDeleteDialog('category', category.id);
                      }}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Box>
                </Box>
              </AccordionSummary>
              <AccordionDetails>
                <Box>
                  {category.description && (
                    <Typography variant="body2" color="text.secondary" paragraph>
                      {category.description}
                    </Typography>
                  )}
                  
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                    <Typography variant="subtitle1">Subcategories</Typography>
                    <Button
                      size="small"
                      startIcon={<AddIcon />}
                      onClick={() => handleOpenSubcategoryDialog('create', category.id)}
                    >
                      Add Subcategory
                    </Button>
                  </Box>
                  
                  <List component={Paper} variant="outlined">
                    {getCategorySubcategories(category.id).length === 0 ? (
                      <ListItem>
                        <ListItemText primary="No subcategories found" />
                      </ListItem>
                    ) : (
                      getCategorySubcategories(category.id).map((subcategory) => (
                        <React.Fragment key={subcategory.id}>
                          <ListItem
                            secondaryAction={
                              <Box>
                                <IconButton
                                  edge="end"
                                  aria-label="edit"
                                  size="small"
                                  onClick={() => handleOpenSubcategoryDialog('edit', category.id, subcategory)}
                                >
                                  <EditIcon fontSize="small" />
                                </IconButton>
                                <IconButton
                                  edge="end"
                                  aria-label="delete"
                                  size="small"
                                  color="error"
                                  onClick={() => handleOpenDeleteDialog('subcategory', subcategory.id)}
                                >
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </Box>
                            }
                          >
                            <ListItemText
                              primary={subcategory.name}
                              secondary={subcategory.description || 'No description'}
                            />
                          </ListItem>
                          {getCategorySubcategories(category.id).indexOf(subcategory) !== getCategorySubcategories(category.id).length - 1 && (
                            <Divider component="li" />
                          )}
                        </React.Fragment>
                      ))
                    )}
                  </List>
                </Box>
              </AccordionDetails>
            </Accordion>
          ))}
        </>
      )}
      
      {/* Category Dialog */}
      <Dialog open={categoryDialog.open} onClose={handleCloseCategoryDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {categoryDialog.mode === 'create' ? 'Add New Category' : 'Edit Category'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <TextField
              fullWidth
              margin="dense"
              name="name"
              label="Category Name"
              value={categoryDialog.data.name || ''}
              onChange={handleCategoryInputChange}
              required
            />
            <TextField
              fullWidth
              margin="dense"
              name="description"
              label="Description"
              value={categoryDialog.data.description || ''}
              onChange={handleCategoryInputChange}
              multiline
              rows={3}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseCategoryDialog}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveCategory}>
            {categoryDialog.mode === 'create' ? 'Create' : 'Update'}
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Subcategory Dialog */}
      <Dialog open={subcategoryDialog.open} onClose={handleCloseSubcategoryDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {subcategoryDialog.mode === 'create' ? 'Add New Subcategory' : 'Edit Subcategory'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <TextField
              fullWidth
              margin="dense"
              name="name"
              label="Subcategory Name"
              value={subcategoryDialog.data.name || ''}
              onChange={handleSubcategoryInputChange}
              required
            />
            <TextField
              fullWidth
              margin="dense"
              name="description"
              label="Description"
              value={subcategoryDialog.data.description || ''}
              onChange={handleSubcategoryInputChange}
              multiline
              rows={3}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseSubcategoryDialog}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveSubcategory}>
            {subcategoryDialog.mode === 'create' ? 'Create' : 'Update'}
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmDialog.open} onClose={handleCloseDeleteDialog}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete this {deleteConfirmDialog.type}?
            {deleteConfirmDialog.type === 'category' && ' This will also delete all subcategories.'}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDeleteDialog}>Cancel</Button>
          <Button variant="contained" color="error" onClick={handleConfirmDelete}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default CategoryList; 