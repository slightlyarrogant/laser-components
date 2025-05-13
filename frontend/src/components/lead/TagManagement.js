import React, { useState, useEffect } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  List,
  ListItem,
  ListItemSecondaryAction,
  ListItemText,
  Paper,
  TextField,
  Typography,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Close as CloseIcon,
  Save as SaveIcon,
} from '@mui/icons-material';
import { HexColorPicker } from 'react-colorful';
import * as tagPresetService from '../../services/api/tagPresetService';

/**
 * Component for managing tag presets
 */
const TagManagement = () => {
  const [tagPresets, setTagPresets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // State for tag dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState('create'); // 'create' or 'edit'
  const [currentTag, setCurrentTag] = useState({
    id: null,
    name: '',
    color: '#3f51b5',
    description: '',
  });
  
  // State for delete confirmation
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [tagToDelete, setTagToDelete] = useState(null);
  
  // Load tag presets on mount
  useEffect(() => {
    fetchTagPresets();
  }, []);
  
  // Fetch tag presets
  const fetchTagPresets = async () => {
    setLoading(true);
    try {
      const response = await tagPresetService.getTagPresets();
      setTagPresets(response.data || []);
      setError(null);
    } catch (err) {
      console.error('Error fetching tag presets:', err);
      setError('Failed to load tag presets');
    } finally {
      setLoading(false);
    }
  };
  
  // Open dialog for creating a new tag
  const handleCreateTag = () => {
    setCurrentTag({
      id: null,
      name: '',
      color: '#3f51b5',
      description: '',
    });
    setDialogMode('create');
    setDialogOpen(true);
  };
  
  // Open dialog for editing a tag
  const handleEditTag = (tag) => {
    setCurrentTag({ ...tag });
    setDialogMode('edit');
    setDialogOpen(true);
  };
  
  // Save tag (create or update)
  const handleSaveTag = async () => {
    if (!currentTag.name || !currentTag.color) return;
    
    setLoading(true);
    try {
      let response;
      
      if (dialogMode === 'create') {
        response = await tagPresetService.createTagPreset(currentTag);
        setTagPresets([...tagPresets, response.data]);
      } else {
        response = await tagPresetService.updateTagPreset(currentTag.id, currentTag);
        setTagPresets(tagPresets.map(tag => 
          tag.id === currentTag.id ? response.data : tag
        ));
      }
      
      setDialogOpen(false);
      setError(null);
    } catch (err) {
      console.error('Error saving tag preset:', err);
      setError(`Failed to ${dialogMode} tag preset`);
    } finally {
      setLoading(false);
    }
  };
  
  // Open delete confirmation dialog
  const handleDeleteConfirm = (tag) => {
    setTagToDelete(tag);
    setDeleteConfirmOpen(true);
  };
  
  // Delete a tag preset
  const handleDeleteTag = async () => {
    if (!tagToDelete) return;
    
    setLoading(true);
    try {
      await tagPresetService.deleteTagPreset(tagToDelete.id);
      setTagPresets(tagPresets.filter(tag => tag.id !== tagToDelete.id));
      setDeleteConfirmOpen(false);
      setTagToDelete(null);
      setError(null);
    } catch (err) {
      console.error('Error deleting tag preset:', err);
      setError('Failed to delete tag preset');
    } finally {
      setLoading(false);
    }
  };
  
  // Helper function to determine if a color is light or dark
  const isLightColor = (color) => {
    if (color.startsWith('#')) {
      const hex = color.substring(1);
      const rgb = parseInt(hex, 16);
      const r = (rgb >> 16) & 0xff;
      const g = (rgb >> 8) & 0xff;
      const b = (rgb >> 0) & 0xff;
      
      // Calculate luminance
      const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
      return luminance > 128;
    }
    return false;
  };
  
  return (
    <Box>
      <Card>
        <CardHeader 
          title="Tag Presets"
          action={
            <Button
              startIcon={<AddIcon />}
              variant="contained"
              onClick={handleCreateTag}
              disabled={loading}
            >
              New Tag
            </Button>
          }
        />
        <CardContent>
          {loading && <CircularProgress size={24} sx={{ mb: 2 }} />}
          
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          
          {tagPresets.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
              No tag presets available. Create your first tag preset!
            </Typography>
          ) : (
            <List>
              {tagPresets.map((tag) => (
                <Paper key={tag.id} sx={{ mb: 2 }} elevation={1}>
                  <ListItem>
                    <Box sx={{ mr: 2 }}>
                      <Chip
                        label={tag.name}
                        style={{
                          backgroundColor: tag.color,
                          color: isLightColor(tag.color) ? '#000' : '#fff',
                        }}
                      />
                    </Box>
                    <ListItemText
                      primary={tag.name}
                      secondary={tag.description || 'No description'}
                    />
                    <ListItemSecondaryAction>
                      <IconButton 
                        edge="end" 
                        onClick={() => handleEditTag(tag)}
                        title="Edit tag"
                      >
                        <EditIcon />
                      </IconButton>
                      <IconButton 
                        edge="end" 
                        onClick={() => handleDeleteConfirm(tag)}
                        title="Delete tag"
                        color="error"
                        sx={{ ml: 1 }}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </ListItemSecondaryAction>
                  </ListItem>
                </Paper>
              ))}
            </List>
          )}
        </CardContent>
      </Card>
      
      {/* Tag edit/create dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>
          {dialogMode === 'create' ? 'Create Tag Preset' : 'Edit Tag Preset'}
          <IconButton
            onClick={() => setDialogOpen(false)}
            sx={{ position: 'absolute', right: 8, top: 8 }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <TextField
            label="Tag Name"
            value={currentTag.name}
            onChange={(e) => setCurrentTag({ ...currentTag, name: e.target.value })}
            fullWidth
            margin="normal"
            required
          />
          
          <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>
            Tag Color
          </Typography>
          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
            <HexColorPicker
              color={currentTag.color}
              onChange={(color) => setCurrentTag({ ...currentTag, color })}
              style={{ width: '100%', height: 170 }}
            />
          </Box>
          <Box 
            sx={{ 
              width: '100%', 
              height: 30, 
              backgroundColor: currentTag.color,
              borderRadius: 1,
              mb: 2,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              color: isLightColor(currentTag.color) ? '#000' : '#fff',
              border: '1px solid #ddd'
            }}
          >
            {currentTag.color}
          </Box>
          
          <TextField
            label="Description (Optional)"
            value={currentTag.description}
            onChange={(e) => setCurrentTag({ ...currentTag, description: e.target.value })}
            fullWidth
            margin="normal"
            multiline
            rows={2}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button 
            variant="contained" 
            onClick={handleSaveTag}
            disabled={!currentTag.name || !currentTag.color || loading}
            startIcon={<SaveIcon />}
          >
            {dialogMode === 'create' ? 'Create' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Delete confirmation dialog */}
      <Dialog
        open={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
      >
        <DialogTitle>Delete Tag Preset</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete the tag preset "{tagToDelete?.name}"? 
            This will not remove the tag from existing leads.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmOpen(false)}>Cancel</Button>
          <Button onClick={handleDeleteTag} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default TagManagement; 