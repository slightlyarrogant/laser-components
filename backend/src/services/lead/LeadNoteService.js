import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Service for managing lead notes
 */
export class LeadNoteService {
  /**
   * Get all notes for a lead
   * @param {number} leadId - ID of the lead
   * @param {Object} options - Query options
   * @returns {Promise<Array>} - Array of notes
   */
  async getNotesForLead(leadId, options = {}) {
    const { sortBy = 'createdAt', sortDir = 'desc' } = options;
    
    const lead = await prisma.lead.findUnique({
      where: { id: Number(leadId) }
    });
    
    if (!lead) {
      throw new Error(`Lead with ID ${leadId} not found`);
    }
    
    return prisma.note.findMany({
      where: { leadId: Number(leadId) },
      orderBy: { [sortBy]: sortDir.toLowerCase() }
    });
  }
  
  /**
   * Get a note by ID
   * @param {number} noteId - ID of the note
   * @returns {Promise<Object>} - Note object
   */
  async getNoteById(noteId) {
    const note = await prisma.note.findUnique({
      where: { id: Number(noteId) }
    });
    
    if (!note) {
      throw new Error(`Note with ID ${noteId} not found`);
    }
    
    return note;
  }
  
  /**
   * Create a new note for a lead
   * @param {number} leadId - ID of the lead
   * @param {Object} noteData - Note data
   * @returns {Promise<Object>} - Created note
   */
  async createNote(leadId, noteData) {
    const { content, createdBy } = noteData;
    
    // Check if lead exists
    const lead = await prisma.lead.findUnique({
      where: { id: Number(leadId) }
    });
    
    if (!lead) {
      throw new Error(`Lead with ID ${leadId} not found`);
    }
    
    // Create note
    return prisma.note.create({
      data: {
        leadId: Number(leadId),
        content,
        createdBy
      }
    });
  }
  
  /**
   * Update a note
   * @param {number} noteId - ID of the note
   * @param {Object} noteData - Updated note data
   * @returns {Promise<Object>} - Updated note
   */
  async updateNote(noteId, noteData) {
    const { content } = noteData;
    
    // Check if note exists
    const note = await prisma.note.findUnique({
      where: { id: Number(noteId) }
    });
    
    if (!note) {
      throw new Error(`Note with ID ${noteId} not found`);
    }
    
    // Update note
    return prisma.note.update({
      where: { id: Number(noteId) },
      data: { content }
    });
  }
  
  /**
   * Delete a note
   * @param {number} noteId - ID of the note
   * @returns {Promise<Object>} - Deleted note
   */
  async deleteNote(noteId) {
    // Check if note exists
    const note = await prisma.note.findUnique({
      where: { id: Number(noteId) }
    });
    
    if (!note) {
      throw new Error(`Note with ID ${noteId} not found`);
    }
    
    // Delete note
    return prisma.note.delete({
      where: { id: Number(noteId) }
    });
  }
} 