import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Divider,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Paper,
  TextField,
  Typography,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
} from '@mui/icons-material';
import { formatDistanceToNow } from 'date-fns';
import * as noteService from '../../services/api/noteService';

/**
 * Component for displaying and managing lead notes
 */
const LeadNotes = ({ leadId, readOnly = false }) => {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // State for note creation/editing
  const [newNote, setNewNote] = useState('');
  const [editNote, setEditNote] = useState(null); // { id, content }
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  
  // State for delete confirmation
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [noteToDelete, setNoteToDelete] = useState(null);
  
  // Fetch notes on component mount
  useEffect(() => {
    if (leadId) {
      fetchNotes();
    }
  }, [leadId]);
  
  // Fetch all notes for the lead
  const fetchNotes = async () => {
    setLoading(true);
    try {
      const response = await noteService.getNotesForLead(leadId);
      setNotes(response.data || []);
      setError(null);
    } catch (err) {
      console.error('Error fetching notes:', err);
      setError('Failed to load notes');
    } finally {
      setLoading(false);
    }
  };
  
  // Create a new note
  const handleCreateNote = async () => {
    if (!newNote.trim()) return;
    
    setLoading(true);
    try {
      const response = await noteService.createNote(leadId, { content: newNote });
      setNotes([...notes, response.data]);
      setNewNote('');
      setError(null);
    } catch (err) {
      console.error('Error creating note:', err);
      setError('Failed to create note');
    } finally {
      setLoading(false);
    }
  };
  
  // Open edit dialog
  const handleOpenEditDialog = (note) => {
    setEditNote({ id: note.id, content: note.content });
    setEditDialogOpen(true);
  };
  
  // Update a note
  const handleUpdateNote = async () => {
    if (!editNote || !editNote.content.trim()) return;
    
    setLoading(true);
    try {
      const response = await noteService.updateNote(editNote.id, { content: editNote.content });
      
      // Update notes array with the updated note
      setNotes(notes.map(note => 
        note.id === editNote.id ? response.data : note
      ));
      
      setEditNote(null);
      setEditDialogOpen(false);
      setError(null);
    } catch (err) {
      console.error('Error updating note:', err);
      setError('Failed to update note');
    } finally {
      setLoading(false);
    }
  };
  
  // Open delete confirmation dialog
  const handleOpenDeleteDialog = (note) => {
    setNoteToDelete(note);
    setDeleteConfirmOpen(true);
  };
  
  // Delete a note
  const handleDeleteNote = async () => {
    if (!noteToDelete) return;
    
    setLoading(true);
    try {
      await noteService.deleteNote(noteToDelete.id);
      
      // Remove the deleted note from the notes array
      setNotes(notes.filter(note => note.id !== noteToDelete.id));
      
      setNoteToDelete(null);
      setDeleteConfirmOpen(false);
      setError(null);
    } catch (err) {
      console.error('Error deleting note:', err);
      setError('Failed to delete note');
    } finally {
      setLoading(false);
    }
  };
  
  // Format date for display
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return formatDistanceToNow(date, { addSuffix: true });
  };
  
  return (
    <Box>
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
            Notes
            {loading && <CircularProgress size={20} sx={{ ml: 2 }} />}
          </Typography>
          
          {error && (
            <Typography color="error" variant="body2" sx={{ mb: 2 }}>
              {error}
            </Typography>
          )}
          
          {/* Note creation box */}
          {!readOnly && (
            <Box sx={{ mb: 3 }}>
              <TextField
                label="Add a new note"
                multiline
                rows={3}
                fullWidth
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                disabled={loading}
                variant="outlined"
                placeholder="Type your note here..."
              />
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={handleCreateNote}
                disabled={!newNote.trim() || loading}
                sx={{ mt: 1 }}
              >
                Add Note
              </Button>
            </Box>
          )}
          
          <Divider sx={{ mb: 2 }} />
          
          {/* Notes list */}
          {notes.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
              No notes available
            </Typography>
          ) : (
            <List sx={{ width: '100%' }}>
              {notes.map((note) => (
                <Paper key={note.id} sx={{ mb: 2, p: 0 }} elevation={1}>
                  <ListItem
                    alignItems="flex-start"
                    secondaryAction={
                      !readOnly && (
                        <Box>
                          <IconButton 
                            edge="end" 
                            onClick={() => handleOpenEditDialog(note)}
                            size="small"
                            title="Edit Note"
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                          <IconButton 
                            edge="end" 
                            onClick={() => handleOpenDeleteDialog(note)}
                            size="small" 
                            color="error"
                            title="Delete Note"
                            sx={{ ml: 1 }}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Box>
                      )
                    }
                  >
                    <ListItemText
                      primary={
                        <Box sx={{ whiteSpace: 'pre-wrap' }}>
                          {note.content}
                        </Box>
                      }
                      secondary={
                        <Typography 
                          variant="caption" 
                          color="text.secondary"
                          component="div"
                          sx={{ mt: 1 }}
                        >
                          Added by {note.createdBy} {formatDate(note.createdAt)}
                          {note.createdAt !== note.updatedAt && (
                            <> • Edited {formatDate(note.updatedAt)}</>
                          )}
                        </Typography>
                      }
                    />
                  </ListItem>
                </Paper>
              ))}
            </List>
          )}
        </CardContent>
      </Card>
      
      {/* Edit note dialog */}
      <Dialog 
        open={editDialogOpen} 
        onClose={() => setEditDialogOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Edit Note</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Note Content"
            multiline
            rows={5}
            fullWidth
            value={editNote?.content || ''}
            onChange={(e) => setEditNote({ ...editNote, content: e.target.value })}
            variant="outlined"
          />
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => setEditDialogOpen(false)} 
            startIcon={<CancelIcon />}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleUpdateNote} 
            variant="contained" 
            startIcon={<SaveIcon />}
            disabled={!editNote?.content.trim() || loading}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Delete confirmation dialog */}
      <Dialog
        open={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
      >
        <DialogTitle>Delete Note</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete this note? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmOpen(false)}>Cancel</Button>
          <Button onClick={handleDeleteNote} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default LeadNotes;