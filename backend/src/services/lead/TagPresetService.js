import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Service for managing tag presets
 */
export class TagPresetService {
  /**
   * Get all tag presets
   * @param {Object} options - Query options
   * @returns {Promise<Array>} - Array of tag presets
   */
  async getTagPresets(options = {}) {
    const { sortBy = 'name', sortDir = 'asc' } = options;
    
    return prisma.tagPreset.findMany({
      orderBy: { [sortBy]: sortDir.toLowerCase() }
    });
  }
  
  /**
   * Get a tag preset by ID
   * @param {number} id - Tag preset ID
   * @returns {Promise<Object>} - Tag preset
   */
  async getTagPresetById(id) {
    const tagPreset = await prisma.tagPreset.findUnique({
      where: { id: Number(id) }
    });
    
    if (!tagPreset) {
      throw new Error(`Tag preset with ID ${id} not found`);
    }
    
    return tagPreset;
  }
  
  /**
   * Get a tag preset by name
   * @param {string} name - Tag preset name
   * @returns {Promise<Object>} - Tag preset
   */
  async getTagPresetByName(name) {
    const tagPreset = await prisma.tagPreset.findUnique({
      where: { name }
    });
    
    if (!tagPreset) {
      throw new Error(`Tag preset with name "${name}" not found`);
    }
    
    return tagPreset;
  }
  
  /**
   * Create a new tag preset
   * @param {Object} data - Tag preset data
   * @returns {Promise<Object>} - Created tag preset
   */
  async createTagPreset(data) {
    const { name, color, description, createdBy } = data;
    
    // Check if tag with the same name already exists
    const existingTag = await prisma.tagPreset.findUnique({
      where: { name }
    });
    
    if (existingTag) {
      throw new Error(`Tag preset with name "${name}" already exists`);
    }
    
    // Create tag preset
    return prisma.tagPreset.create({
      data: {
        name,
        color,
        description,
        createdBy
      }
    });
  }
  
  /**
   * Update a tag preset
   * @param {number} id - Tag preset ID
   * @param {Object} data - Updated tag preset data
   * @returns {Promise<Object>} - Updated tag preset
   */
  async updateTagPreset(id, data) {
    const { name, color, description } = data;
    
    // Check if tag preset exists
    const tagPreset = await prisma.tagPreset.findUnique({
      where: { id: Number(id) }
    });
    
    if (!tagPreset) {
      throw new Error(`Tag preset with ID ${id} not found`);
    }
    
    // If name is being changed, check for duplicates
    if (name && name !== tagPreset.name) {
      const existingTag = await prisma.tagPreset.findUnique({
        where: { name }
      });
      
      if (existingTag) {
        throw new Error(`Tag preset with name "${name}" already exists`);
      }
    }
    
    // Update tag preset
    return prisma.tagPreset.update({
      where: { id: Number(id) },
      data: {
        ...(name && { name }),
        ...(color && { color }),
        ...(description !== undefined && { description })
      }
    });
  }
  
  /**
   * Delete a tag preset
   * @param {number} id - Tag preset ID
   * @returns {Promise<Object>} - Deleted tag preset
   */
  async deleteTagPreset(id) {
    // Check if tag preset exists
    const tagPreset = await prisma.tagPreset.findUnique({
      where: { id: Number(id) }
    });
    
    if (!tagPreset) {
      throw new Error(`Tag preset with ID ${id} not found`);
    }
    
    // Delete tag preset
    return prisma.tagPreset.delete({
      where: { id: Number(id) }
    });
  }
} 