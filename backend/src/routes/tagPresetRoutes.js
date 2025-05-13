import express from 'express';
import {
  getTagPresets,
  getTagPresetById,
  createTagPreset,
  updateTagPreset,
  deleteTagPreset
} from '../controllers/tagPresetController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';

const router = express.Router();

/**
 * @swagger
 * /api/tag-presets:
 *   get:
 *     summary: Get all tag presets
 *     description: Retrieve all tag presets with optional sorting
 *     parameters:
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *         description: Field to sort by (default is name)
 *       - in: query
 *         name: sortDir
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *         description: Sort direction (default is asc)
 */
router.get('/', authenticateToken, getTagPresets);

/**
 * @swagger
 * /api/tag-presets/{id}:
 *   get:
 *     summary: Get a tag preset by ID
 *     description: Retrieve a single tag preset by its ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Tag preset ID
 */
router.get('/:id', authenticateToken, getTagPresetById);

/**
 * @swagger
 * /api/tag-presets:
 *   post:
 *     summary: Create a new tag preset
 *     description: Create a new tag preset with name, color, and optional description
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - color
 *             properties:
 *               name:
 *                 type: string
 *                 description: Name of the tag preset
 *               color:
 *                 type: string
 *                 description: Color code for the tag (hex or name)
 *               description:
 *                 type: string
 *                 description: Optional description of the tag preset
 */
router.post('/', authenticateToken, createTagPreset);

/**
 * @swagger
 * /api/tag-presets/{id}:
 *   put:
 *     summary: Update a tag preset
 *     description: Update an existing tag preset
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Tag preset ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: Updated name of the tag preset
 *               color:
 *                 type: string
 *                 description: Updated color code for the tag
 *               description:
 *                 type: string
 *                 description: Updated description of the tag preset
 */
router.put('/:id', authenticateToken, updateTagPreset);

/**
 * @swagger
 * /api/tag-presets/{id}:
 *   delete:
 *     summary: Delete a tag preset
 *     description: Delete an existing tag preset
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Tag preset ID
 */
router.delete('/:id', authenticateToken, deleteTagPreset);

export default router; 