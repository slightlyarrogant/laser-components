import express from 'express'
import {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  getCurrentUser,
  updateCurrentUser
} from '../controllers/userController.js'
import { 
  authenticateToken, 
  authorizePermission,
  authorizeOwnerOrAdmin
} from '../middleware/authMiddleware.js'

const router = express.Router()

// Routes requiring authentication
router.use(authenticateToken)

// Current user routes (available to all authenticated users)
router.get('/me', getCurrentUser)
router.put('/me', updateCurrentUser)

// User management routes with permission-based authorization
router.get('/', authorizePermission('users', 'read'), getAllUsers)
router.post('/', authorizePermission('users', 'create'), createUser)
router.get('/:id', authorizePermission('users', 'read'), getUserById)

// User edit/delete routes with ownership checks
// The resource owner getter function for user resources
const getUserOwner = async (req) => Number(req.params.id)

router.put('/:id', authorizeOwnerOrAdmin('users', 'update', getUserOwner), updateUser)
router.delete('/:id', authorizePermission('users', 'delete'), deleteUser) // Only admins can delete users

export default router 