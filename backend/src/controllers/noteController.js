import { LeadNoteService } from '../services/lead/LeadNoteService.js';

const noteService = new LeadNoteService();

/**
 * Get all notes for a lead
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const getNotesForLead = async (req, res, next) => {
  try {
    const { leadId } = req.params;
    const { sortBy, sortDir } = req.query;
    
    const notes = await noteService.getNotesForLead(leadId, { sortBy, sortDir });
    
    res.json(notes);
  } catch (error) {
    if (error.message.includes('not found')) {
      return res.status(404).json({ message: error.message });
    }
    next(error);
  }
};

/**
 * Get a note by ID
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const getNoteById = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const note = await noteService.getNoteById(id);
    
    res.json(note);
  } catch (error) {
    if (error.message.includes('not found')) {
      return res.status(404).json({ message: error.message });
    }
    next(error);
  }
};

/**
 * Create a new note for a lead
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const createNote = async (req, res, next) => {
  try {
    const { leadId } = req.params;
    const { content } = req.body;
    
    // For now, use the user's email from session. In a real app,
    // this would come from authentication middleware
    const createdBy = req.user?.email || 'system@example.com';
    
    if (!content) {
      return res.status(400).json({ message: 'Note content is required' });
    }
    
    const note = await noteService.createNote(leadId, { content, createdBy });
    
    res.status(201).json(note);
  } catch (error) {
    if (error.message.includes('not found')) {
      return res.status(404).json({ message: error.message });
    }
    next(error);
  }
};

/**
 * Update a note
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const updateNote = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { content } = req.body;
    
    if (!content) {
      return res.status(400).json({ message: 'Note content is required' });
    }
    
    const note = await noteService.updateNote(id, { content });
    
    res.json(note);
  } catch (error) {
    if (error.message.includes('not found')) {
      return res.status(404).json({ message: error.message });
    }
    next(error);
  }
};

/**
 * Delete a note
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const deleteNote = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    await noteService.deleteNote(id);
    
    res.status(204).send();
  } catch (error) {
    if (error.message.includes('not found')) {
      return res.status(404).json({ message: error.message });
    }
    next(error);
  }
}; 