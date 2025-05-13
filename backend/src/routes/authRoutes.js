import express from 'express'
import {
  registerUser,
  loginUser,
  refreshToken,
  logoutUser
} from '../controllers/authController.js'

// Use dynamic import for the CJS module
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const {
  registerValidationRules,
  loginValidationRules,
  handleValidationErrors
} = require('../middleware/validationMiddleware.cjs')

import { authenticateToken } from '../middleware/authMiddleware.js'

const router = express.Router()

// Route for user registration with validation
router.post(
  '/register',
  registerValidationRules,
  handleValidationErrors,
  registerUser
)

// Route for user login with validation
router.post(
  '/login',
  loginValidationRules,
  handleValidationErrors,
  loginUser
)

// Route for refreshing access token
router.post('/refresh', refreshToken)

// Route for user logout
router.post('/logout', authenticateToken, logoutUser)

// Add routes for password reset, refresh token etc. later

export default router 