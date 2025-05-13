import jwt from 'jsonwebtoken'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Load JWT secret from environment variables
const JWT_SECRET = process.env.JWT_SECRET || 'your-default-secret-key' // Use the same secret as in authController

/**
 * Middleware to authenticate requests using JWT.
 * Verifies the token and attaches user information to req.user.
 */
export async function authenticateToken (req, res, next) {
  const authHeader = req.headers.authorization
  const token = authHeader && authHeader.split(' ')[1] // Bearer TOKEN

  if (token == null) {
    // No token provided
    return res.sendStatus(401) // Unauthorized
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET)

    // Token is valid, find the user to ensure they still exist
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      // Select only necessary fields, exclude password hash
      select: {
        id: true,
        email: true,
        role: true
      }
    })

    if (!user) {
      // User associated with token no longer exists
      return res.sendStatus(401) // Unauthorized
    }

    // Attach user object to the request
    req.user = user
    next() // Proceed to the next middleware or route handler
  } catch (err) {
    // Token verification failed (invalid or expired)
    console.error('JWT verification error:', err.message)
    return res.sendStatus(403) // Forbidden
  }
}

/**
 * Middleware factory to authorize requests based on user roles.
 * @param {string[]} allowedRoles - Array of roles allowed to access the route.
 * @returns {function} Express middleware function.
 */
export function authorizeRoles (...allowedRoles) {
  return (req, res, next) => {
    // Assumes authenticateToken middleware has run and attached req.user
    if (!req.user || !req.user.role) {
      return res.sendStatus(403) // Forbidden (should have user/role if authenticated)
    }

    const userRole = req.user.role // e.g., 'ADMIN', 'SALES'

    if (allowedRoles.includes(userRole)) {
      next() // Role is allowed, proceed
    } else {
      res.sendStatus(403) // Forbidden (role not allowed)
    }
  }
}

/**
 * Definition of permissions by role.
 * This maps roles to the actions they can perform on each resource.
 */
const rolePermissions = {
  ADMIN: {
    users: ['read', 'create', 'update', 'delete'],
    products: ['read', 'create', 'update', 'delete'],
    categories: ['read', 'create', 'update', 'delete'],
    applications: ['read', 'create', 'update', 'delete'],
    leads: ['read', 'create', 'update', 'delete', 'export'],
    regions: ['read', 'create', 'update', 'delete'],
    enrichment: ['read', 'create', 'update', 'delete'],
    notes: ['read', 'create', 'update', 'delete'],
    tags: ['read', 'create', 'update', 'delete'],
    research: ['read', 'create', 'update', 'delete', 'manage_collaborators', 'manage_attachments', 'use_ai'],
    // Admin has all permissions on all resources
  },
  RESEARCHER: {
    products: ['read', 'create', 'update'],
    categories: ['read', 'create', 'update'],
    applications: ['read', 'create', 'update'],
    leads: ['read', 'create'],
    regions: ['read'],
    enrichment: ['read', 'create'],
    notes: ['read', 'create', 'update', 'delete'],  // can manage their own notes
    tags: ['read'],
    research: ['read', 'create', 'update', 'delete', 'manage_collaborators', 'manage_attachments', 'use_ai'],
  },
  SALES: {
    products: ['read'],
    categories: ['read'],
    applications: ['read'],
    leads: ['read', 'create', 'update', 'export'],
    regions: ['read'],
    enrichment: ['read', 'create'],
    notes: ['read', 'create', 'update', 'delete'],  // can manage their own notes
    tags: ['read'],
    research: ['read'],
  }
}

/**
 * Checks if a user role has permission to perform an action on a resource.
 * @param {string} role - The user's role.
 * @param {string} resource - The resource being accessed (e.g., 'users', 'leads').
 * @param {string} action - The action being performed (e.g., 'read', 'create').
 * @returns {boolean} - Whether the user has permission.
 */
export function hasPermission(role, resource, action) {
  // Check if the role exists in the permissions map
  if (!rolePermissions[role]) {
    return false
  }
  
  // Check if the resource exists for this role
  if (!rolePermissions[role][resource]) {
    return false
  }
  
  // Check if the action is allowed for this resource and role
  return rolePermissions[role][resource].includes(action)
}

/**
 * Middleware factory to authorize requests based on resource and action.
 * @param {string} resource - The resource being accessed (e.g., 'users', 'leads').
 * @param {string} action - The action being performed (e.g., 'read', 'create').
 * @returns {function} Express middleware function.
 */
export function authorizePermission(resource, action) {
  return (req, res, next) => {
    // Assumes authenticateToken middleware has run and attached req.user
    if (!req.user || !req.user.role) {
      return res.sendStatus(403) // Forbidden (should have user/role if authenticated)
    }

    const userRole = req.user.role // e.g., 'ADMIN', 'SALES'

    if (hasPermission(userRole, resource, action)) {
      next() // User has permission, proceed
    } else {
      res.status(403).json({
        message: `You don't have permission to ${action} ${resource}`
      }) // Forbidden with descriptive message
    }
  }
}

/**
 * Middleware to check if user has permission to access their own resource or has admin rights.
 * Used for operations where regular users should only modify their own data.
 * @param {string} resource - The resource being accessed (e.g., 'notes').
 * @param {string} action - The action being performed (e.g., 'update').
 * @param {function} getResourceOwnerId - Function to extract the owner ID from the request.
 * @returns {function} Express middleware function.
 */
export function authorizeOwnerOrAdmin(resource, action, getResourceOwnerId) {
  return async (req, res, next) => {
    // Assumes authenticateToken middleware has run and attached req.user
    if (!req.user || !req.user.role) {
      return res.sendStatus(403) // Forbidden
    }

    const userRole = req.user.role
    const userId = req.user.id

    // Admins can do anything
    if (userRole === 'ADMIN') {
      return next()
    }

    try {
      // Get the owner ID of the resource
      const ownerId = await getResourceOwnerId(req)

      // If the user is the owner and has the permission for this action
      if (ownerId === userId && hasPermission(userRole, resource, action)) {
        return next()
      }

      // User is neither admin nor the owner
      return res.status(403).json({
        message: `You don't have permission to ${action} this ${resource}`
      })
    } catch (error) {
      console.error(`Error in owner check:`, error)
      return res.status(500).json({
        message: 'Error checking resource ownership'
      })
    }
  }
} 