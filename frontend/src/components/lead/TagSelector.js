import React, { useState, useEffect } from 'react';
import {
  Box,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Button,
  TextField,
  Autocomplete,
  CircularProgress,
  Typography,
  IconButton,
} from '@mui/material';
import {
  Add as AddIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { HexColorPicker } from 'react-colorful';
import * as tagPresetService from '../../services/api/tagPresetService';

/**
 * Component for selecting and managing tags, with tag preset support
 */
const TagSelector = ({ 
  selectedTags = [], 
  onTagsChange,
  readOnly = false,
  canCreateTags = true
}) => {
  const [tagPresets, setTagPresets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // State for creating new tag presets
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newTagData, setNewTagData] = useState({
    name: '',
    color: '#3f51b5', // Default color
    description: ''
  });
  
  // Fetch tag presets on component mount
  useEffect(() => {
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
    
    fetchTagPresets();
  }, []);
  
  // Convert tag presets to options for the autocomplete
  const tagOptions = tagPresets.map(preset => preset.name);
  
  // Add custom tag option if it doesn't exist in presets
  selectedTags.forEach(tag => {
    if (!tagOptions.includes(tag)) {
      tagOptions.push(tag);
    }
  });
  
  // Handle tag selection change
  const handleTagsChange = (event, newTags) => {
    if (onTagsChange) {
      onTagsChange(newTags);
    }
  };
  
  // Find a tag preset by name
  const findTagPreset = (tagName) => {
    return tagPresets.find(preset => preset.name === tagName);
  };
  
  // Handle creating a new tag preset
  const handleCreateTagPreset = async () => {
    try {
      setLoading(true);
      const response = await tagPresetService.createTagPreset(newTagData);
      setTagPresets([...tagPresets, response.data]);
      
      // Add the new tag to selected tags if it's not already there
      if (!selectedTags.includes(newTagData.name)) {
        onTagsChange([...selectedTags, newTagData.name]);
      }
      
      // Reset form and close dialog
      setNewTagData({
        name: '',
        color: '#3f51b5',
        description: ''
      });
      setCreateDialogOpen(false);
    } catch (err) {
      console.error('Error creating tag preset:', err);
      setError('Failed to create tag preset');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <Box>
      {/* Tag selector */}
      <Autocomplete
        multiple
        options={tagOptions}
        value={selectedTags}
        onChange={handleTagsChange}
        disabled={readOnly}
        renderTags={(value, getTagProps) =>
          value.map((tag, index) => {
            const preset = findTagPreset(tag);
            return (
              <Chip
                key={tag}
                label={tag}
                {...getTagProps({ index })}
                style={{
                  backgroundColor: preset ? preset.color : undefined,
                  color: preset && isLightColor(preset.color) ? '#000' : '#fff',
                }}
              />
            );
          })
        }
        renderInput={(params) => (
          <TextField
            {...params}
            variant="outlined"
            label="Tags"
            placeholder="Select or type tags"
            error={!!error}
            helperText={error}
            InputProps={{
              ...params.InputProps,
              endAdornment: (
                <>
                  {loading ? <CircularProgress color="inherit" size={20} /> : null}
                  {params.InputProps.endAdornment}
                </>
              ),
            }}
          />
        )}
        freeSolo={!readOnly} // Allow custom tags if not read-only
      />
      
      {/* Create tag button */}
      {canCreateTags && !readOnly && (
        <Button
          startIcon={<AddIcon />}
          onClick={() => setCreateDialogOpen(true)}
          size="small"
          sx={{ mt: 1 }}
        >
          Create Tag Preset
        </Button>
      )}
      
      {/* Create tag preset dialog */}
      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>
          Create Tag Preset
          <IconButton
            onClick={() => setCreateDialogOpen(false)}
            sx={{ position: 'absolute', right: 8, top: 8 }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <TextField
            label="Tag Name"
            value={newTagData.name}
            onChange={(e) => setNewTagData({ ...newTagData, name: e.target.value })}
            fullWidth
            margin="normal"
            required
          />
          
          <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>
            Tag Color
          </Typography>
          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
            <HexColorPicker
              color={newTagData.color}
              onChange={(color) => setNewTagData({ ...newTagData, color })}
              style={{ width: '100%', height: 170 }}
            />
          </Box>
          <Box 
            sx={{ 
              width: '100%', 
              height: 30, 
              backgroundColor: newTagData.color,
              borderRadius: 1,
              mb: 2,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              color: isLightColor(newTagData.color) ? '#000' : '#fff',
              border: '1px solid #ddd'
            }}
          >
            {newTagData.color}
          </Box>
          
          <TextField
            label="Description (Optional)"
            value={newTagData.description}
            onChange={(e) => setNewTagData({ ...newTagData, description: e.target.value })}
            fullWidth
            margin="normal"
            multiline
            rows={2}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
          <Button 
            variant="contained" 
            onClick={handleCreateTagPreset}
            disabled={!newTagData.name || !newTagData.color || loading}
          >
            Create Tag
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

// Helper function to determine if a color is light or dark
// This helps decide whether to use black or white text on the tag
function isLightColor(color) {
  // For hex colors
  if (color.startsWith('#')) {
    const hex = color.substring(1);
    const rgb = parseInt(hex, 16);
    const r = (rgb >> 16) & 0xff;
    const g = (rgb >> 8) & 0xff;
    const b = (rgb >> 0) & 0xff;
    
    // Calculate luminance - standard formula
    const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
    return luminance > 128;
  }
  
  // For named colors, assume they're dark (safer default)
  return false;
}

export default TagSelector; 