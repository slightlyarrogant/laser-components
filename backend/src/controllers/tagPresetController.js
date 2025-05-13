import { TagPresetService } from '../services/lead/TagPresetService.js';

const tagPresetService = new TagPresetService();

/**
 * Get all tag presets
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const getTagPresets = async (req, res, next) => {
  try {
    const { sortBy, sortDir } = req.query;
    
    const tagPresets = await tagPresetService.getTagPresets({ sortBy, sortDir });
    
    res.json(tagPresets);
  } catch (error) {
    next(error);
  }
};

/**
 * Get a tag preset by ID
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const getTagPresetById = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const tagPreset = await tagPresetService.getTagPresetById(id);
    
    res.json(tagPreset);
  } catch (error) {
    if (error.message.includes('not found')) {
      return res.status(404).json({ message: error.message });
    }
    next(error);
  }
};

/**
 * Create a new tag preset
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const createTagPreset = async (req, res, next) => {
  try {
    const { name, color, description } = req.body;
    
    // For now, use the user's email from session. In a real app,
    // this would come from authentication middleware
    const createdBy = req.user?.email || 'system@example.com';
    
    if (!name || !color) {
      return res.status(400).json({ message: 'Tag name and color are required' });
    }
    
    const tagPreset = await tagPresetService.createTagPreset({
      name,
      color,
      description,
      createdBy
    });
    
    res.status(201).json(tagPreset);
  } catch (error) {
    if (error.message.includes('already exists')) {
      return res.status(400).json({ message: error.message });
    }
    next(error);
  }
};

/**
 * Update a tag preset
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const updateTagPreset = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, color, description } = req.body;
    
    if (!name && !color && description === undefined) {
      return res.status(400).json({ message: 'At least one field to update is required' });
    }
    
    const tagPreset = await tagPresetService.updateTagPreset(id, {
      name,
      color,
      description
    });
    
    res.json(tagPreset);
  } catch (error) {
    if (error.message.includes('not found')) {
      return res.status(404).json({ message: error.message });
    }
    if (error.message.includes('already exists')) {
      return res.status(400).json({ message: error.message });
    }
    next(error);
  }
};

/**
 * Delete a tag preset
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const deleteTagPreset = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    await tagPresetService.deleteTagPreset(id);
    
    res.status(204).send();
  } catch (error) {
    if (error.message.includes('not found')) {
      return res.status(404).json({ message: error.message });
    }
    next(error);
  }
}; 