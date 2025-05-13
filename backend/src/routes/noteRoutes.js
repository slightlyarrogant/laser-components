import express from 'express';
import {
  getNotesForLead,
  getNoteById,
  createNote,
  updateNote,
  deleteNote
} from '../controllers/noteController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';

const router = express.Router();

/**
 * @swagger
 * /api/leads/{leadId}/notes:
 *   get:
 *     summary: Get all notes for a lead
 *     description: Retrieve all notes for a specific lead with optional sorting
 *     parameters:
 *       - in: path
 *         name: leadId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Lead ID
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *         description: Field to sort by (default is createdAt)
 *       - in: query
 *         name: sortDir
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *         description: Sort direction (default is desc)
 */
router.get('/leads/:leadId/notes', authenticateToken, getNotesForLead);

/**
 * @swagger
 * /api/notes/{id}:
 *   get:
 *     summary: Get a note by ID
 *     description: Retrieve a single note by its ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Note ID
 */
router.get('/notes/:id', authenticateToken, getNoteById);

/**
 * @swagger
 * /api/leads/{leadId}/notes:
 *   post:
 *     summary: Create a new note for a lead
 *     description: Create a new note for a specific lead
 *     parameters:
 *       - in: path
 *         name: leadId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Lead ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - content
 *             properties:
 *               content:
 *                 type: string
 *                 description: Content of the note
 */
router.post('/leads/:leadId/notes', authenticateToken, createNote);

/**
 * @swagger
 * /api/notes/{id}:
 *   put:
 *     summary: Update a note
 *     description: Update an existing note
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Note ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - content
 *             properties:
 *               content:
 *                 type: string
 *                 description: Updated content of the note
 */
router.put('/notes/:id', authenticateToken, updateNote);

/**
 * @swagger
 * /api/notes/{id}:
 *   delete:
 *     summary: Delete a note
 *     description: Delete an existing note
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Note ID
 */
router.delete('/notes/:id', authenticateToken, deleteNote);

export default router; 