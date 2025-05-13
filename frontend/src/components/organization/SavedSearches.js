import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Paper,
  TextField,
  Typography,
  Tooltip,
  Snackbar,
  Alert,
} from '@mui/material';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import BookmarkBorderIcon from '@mui/icons-material/BookmarkBorder';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import SearchIcon from '@mui/icons-material/Search';

const STORAGE_KEY = 'organization_saved_searches';

/**
 * Component to manage saved searches for the organization search
 */
const SavedSearches = ({ currentSearch, onSearchSelect, showPreview = true }) => {
  const navigate = useNavigate();
  
  const [savedSearches, setSavedSearches] = useState([]);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [searchName, setSearchName] = useState('');
  const [notification, setNotification] = useState({ open: false, message: '', severity: 'success' });
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [selectedSearch, setSelectedSearch] = useState(null);
  const [menuAnchorEl, setMenuAnchorEl] = useState(null);
  const [editMode, setEditMode] = useState(false);
  
  // Load saved searches from localStorage
  useEffect(() => {
    const searches = localStorage.getItem(STORAGE_KEY);
    if (searches) {
      setSavedSearches(JSON.parse(searches));
    }
  }, []);
  
  // Save searches to localStorage when updated
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(savedSearches));
  }, [savedSearches]);
  
  // Open save dialog
  const handleSaveSearch = () => {
    // Check if there are actual search parameters
    if (!currentSearch || (
      !currentSearch.keywords && 
      !currentSearch.applicationId && 
      !currentSearch.regionId && 
      !currentSearch.countryId
    )) {
      setNotification({
        open: true,
        message: 'Please enter search criteria before saving',
        severity: 'warning'
      });
      return;
    }
    
    setSearchName('');
    setEditMode(false);
    setSaveDialogOpen(true);
  };
  
  // Save the current search
  const handleSaveConfirm = () => {
    if (!searchName.trim()) {
      setNotification({
        open: true,
        message: 'Please enter a name for the saved search',
        severity: 'warning'
      });
      return;
    }
    
    // Check if a search with this name already exists
    const existingIndex = savedSearches.findIndex(s => s.name === searchName);
    
    if (existingIndex >= 0 && !editMode) {
      setNotification({
        open: true,
        message: 'A search with this name already exists',
        severity: 'warning'
      });
      return;
    }
    
    const newSearch = {
      name: searchName,
      params: { ...currentSearch },
      savedAt: new Date().toISOString(),
    };
    
    if (editMode && selectedSearch) {
      // Update existing search
      const updatedSearches = [...savedSearches];
      const index = updatedSearches.findIndex(s => s.name === selectedSearch.name);
      
      if (index >= 0) {
        updatedSearches[index] = newSearch;
        setSavedSearches(updatedSearches);
        
        setNotification({
          open: true,
          message: 'Search updated successfully',
          severity: 'success'
        });
      }
    } else {
      // Add new search
      setSavedSearches([...savedSearches, newSearch]);
      
      setNotification({
        open: true,
        message: 'Search saved successfully',
        severity: 'success'
      });
    }
    
    setSaveDialogOpen(false);
    setSelectedSearch(null);
  };
  
  // Open the menu for a search
  const handleMenuOpen = (event, search) => {
    setMenuAnchorEl(event.currentTarget);
    setSelectedSearch(search);
  };
  
  // Close the menu
  const handleMenuClose = () => {
    setMenuAnchorEl(null);
    setSelectedSearch(null);
  };
  
  // Edit a saved search
  const handleEditSearch = () => {
    setMenuAnchorEl(null);
    setSearchName(selectedSearch.name);
    setEditMode(true);
    setSaveDialogOpen(true);
  };
  
  // Delete a saved search (confirmation)
  const handleDeleteClick = () => {
    setMenuAnchorEl(null);
    setConfirmDeleteOpen(true);
  };
  
  // Confirm and delete a saved search
  const handleDeleteConfirm = () => {
    if (selectedSearch) {
      const updatedSearches = savedSearches.filter(s => s.name !== selectedSearch.name);
      setSavedSearches(updatedSearches);
      
      setNotification({
        open: true,
        message: 'Search deleted successfully',
        severity: 'success'
      });
    }
    
    setConfirmDeleteOpen(false);
    setSelectedSearch(null);
  };
  
  // Apply a saved search
  const handleSearchSelect = (search) => {
    if (onSearchSelect) {
      onSearchSelect(search.params);
    } else {
      // Build query string
      const queryParams = new URLSearchParams();
      
      if (search.params.keywords) queryParams.set('keywords', search.params.keywords);
      if (search.params.applicationId) queryParams.set('applicationId', search.params.applicationId);
      if (search.params.regionId) queryParams.set('regionId', search.params.regionId);
      if (search.params.countryId) queryParams.set('countryId', search.params.countryId);
      
      // Navigate to search page with parameters
      navigate({
        pathname: '/organizations/search',
        search: queryParams.toString()
      });
    }
  };
  
  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return '';
    
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };
  
  return (
    <>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Button
          startIcon={<BookmarkBorderIcon />}
          onClick={handleSaveSearch}
          size="small"
        >
          Save Current Search
        </Button>
        
        {showPreview && savedSearches.length > 0 && (
          <Typography variant="subtitle2" color="text.secondary" sx={{ mr: 1 }}>
            {savedSearches.length} Saved {savedSearches.length === 1 ? 'Search' : 'Searches'}
          </Typography>
        )}
      </Box>
      
      {showPreview && savedSearches.length > 0 && (
        <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
          <Typography variant="subtitle1" gutterBottom>
            Saved Searches
          </Typography>
          
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {savedSearches.map((search) => (
              <Box key={search.name} sx={{ position: 'relative' }}>
                <Chip
                  icon={<BookmarkIcon />}
                  label={search.name}
                  onClick={() => handleSearchSelect(search)}
                  onDelete={(e) => {
                    e.stopPropagation();
                    handleMenuOpen(e, search);
                  }}
                  deleteIcon={<MoreVertIcon />}
                  sx={{ mb: 1 }}
                />
              </Box>
            ))}
          </Box>
        </Paper>
      )}
      
      {/* Save Search Dialog */}
      <Dialog open={saveDialogOpen} onClose={() => setSaveDialogOpen(false)}>
        <DialogTitle>
          {editMode ? 'Update Saved Search' : 'Save Current Search'}
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            {editMode
              ? 'Update this saved search with the current search parameters.'
              : 'Save your current search parameters for future use.'}
          </DialogContentText>
          <TextField
            autoFocus
            margin="dense"
            label="Search Name"
            fullWidth
            value={searchName}
            onChange={(e) => setSearchName(e.target.value)}
          />
          
          {currentSearch && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Search Parameters:
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {currentSearch.keywords && (
                  <Chip
                    size="small"
                    label={`Keywords: ${currentSearch.keywords}`}
                  />
                )}
                {currentSearch.applicationId && (
                  <Chip
                    size="small"
                    label={`Application ID: ${currentSearch.applicationId}`}
                  />
                )}
                {currentSearch.regionId && (
                  <Chip
                    size="small"
                    label={`Region ID: ${currentSearch.regionId}`}
                  />
                )}
                {currentSearch.countryId && (
                  <Chip
                    size="small"
                    label={`Country ID: ${currentSearch.countryId}`}
                  />
                )}
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSaveDialogOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSaveConfirm} variant="contained">
            {editMode ? 'Update' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Search Options Menu */}
      <Menu
        anchorEl={menuAnchorEl}
        open={Boolean(menuAnchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={() => {
          handleMenuClose();
          handleSearchSelect(selectedSearch);
        }}>
          <ListItemIcon>
            <SearchIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Apply Search</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleEditSearch}>
          <ListItemIcon>
            <EditIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Edit</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleDeleteClick}>
          <ListItemIcon>
            <DeleteIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Delete</ListItemText>
        </MenuItem>
      </Menu>
      
      {/* Delete Confirmation Dialog */}
      <Dialog open={confirmDeleteOpen} onClose={() => setConfirmDeleteOpen(false)}>
        <DialogTitle>
          Confirm Deletion
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete the saved search "{selectedSearch?.name}"?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDeleteOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleDeleteConfirm} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Notification Snackbar */}
      <Snackbar
        open={notification.open}
        autoHideDuration={6000}
        onClose={() => setNotification(prev => ({ ...prev, open: false }))}
      >
        <Alert 
          onClose={() => setNotification(prev => ({ ...prev, open: false }))} 
          severity={notification.severity}
        >
          {notification.message}
        </Alert>
      </Snackbar>
    </>
  );
};

export default SavedSearches;