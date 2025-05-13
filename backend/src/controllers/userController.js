import { PrismaClient } from '@prisma/client'
import { hashPassword } from '../utils/passwordUtils.js'

const prisma = new PrismaClient()

/**
 * Get a list of all users (for admin use)
 */
export async function getAllUsers(req, res) {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true,
        updatedAt: true
      }
    })
    
    res.status(200).json(users)
  } catch (error) {
    console.error('Error fetching users:', error)
    res.status(500).json({ message: 'Internal server error while fetching users' })
  }
}

/**
 * Get a specific user by ID
 */
export async function getUserById(req, res) {
  const { id } = req.params
  
  try {
    const user = await prisma.user.findUnique({
      where: { id: Number(id) },
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true,
        updatedAt: true
      }
    })
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' })
    }
    
    res.status(200).json(user)
  } catch (error) {
    console.error('Error fetching user:', error)
    res.status(500).json({ message: 'Internal server error while fetching user' })
  }
}

/**
 * Create a new user (admin function)
 */
export async function createUser(req, res) {
  const { email, password, role } = req.body
  
  try {
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    })
    
    if (existingUser) {
      return res.status(409).json({ message: 'User already exists with this email' })
    }
    
    // Hash the password
    const password_hash = await hashPassword(password)
    
    // Create the user
    const user = await prisma.user.create({
      data: {
        email,
        password_hash,
        role: role || 'SALES' // Default to SALES if not provided
      },
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true,
        updatedAt: true
      }
    })
    
    res.status(201).json({
      message: 'User created successfully',
      user
    })
  } catch (error) {
    console.error('Error creating user:', error)
    res.status(500).json({ message: 'Internal server error while creating user' })
  }
}

/**
 * Update a user by ID
 */
export async function updateUser(req, res) {
  const { id } = req.params
  const { email, password, role } = req.body
  
  try {
    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id: Number(id) }
    })
    
    if (!existingUser) {
      return res.status(404).json({ message: 'User not found' })
    }
    
    // Prepare update data
    const updateData = {}
    
    if (email) {
      // Check if the email is already used by another user
      if (email !== existingUser.email) {
        const emailExists = await prisma.user.findUnique({
          where: { email }
        })
        
        if (emailExists) {
          return res.status(409).json({ message: 'Email is already in use by another account' })
        }
        
        updateData.email = email
      }
    }
    
    if (password) {
      updateData.password_hash = await hashPassword(password)
    }
    
    if (role) {
      updateData.role = role
    }
    
    // Update the user if there are changes
    if (Object.keys(updateData).length > 0) {
      const updatedUser = await prisma.user.update({
        where: { id: Number(id) },
        data: updateData,
        select: {
          id: true,
          email: true,
          role: true,
          createdAt: true,
          updatedAt: true
        }
      })
      
      res.status(200).json({
        message: 'User updated successfully',
        user: updatedUser
      })
    } else {
      // No changes were provided
      res.status(200).json({
        message: 'No changes to update',
        user: {
          id: existingUser.id,
          email: existingUser.email,
          role: existingUser.role,
          createdAt: existingUser.createdAt,
          updatedAt: existingUser.updatedAt
        }
      })
    }
  } catch (error) {
    console.error('Error updating user:', error)
    res.status(500).json({ message: 'Internal server error while updating user' })
  }
}

/**
 * Delete a user by ID
 */
export async function deleteUser(req, res) {
  const { id } = req.params
  
  try {
    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id: Number(id) }
    })
    
    if (!existingUser) {
      return res.status(404).json({ message: 'User not found' })
    }
    
    // Delete the user
    await prisma.user.delete({
      where: { id: Number(id) }
    })
    
    res.status(200).json({ message: 'User deleted successfully' })
  } catch (error) {
    console.error('Error deleting user:', error)
    res.status(500).json({ message: 'Internal server error while deleting user' })
  }
}

/**
 * Get the current authenticated user's information
 */
export async function getCurrentUser(req, res) {
  // This assumes the authenticateToken middleware has run and attached req.user
  res.status(200).json(req.user)
}

/**
 * Update the current authenticated user's information
 */
export async function updateCurrentUser(req, res) {
  const userId = req.user.id
  const { email, password } = req.body
  
  try {
    // Prepare update data
    const updateData = {}
    
    if (email && email !== req.user.email) {
      // Check if the email is already used by another user
      const emailExists = await prisma.user.findUnique({
        where: { email }
      })
      
      if (emailExists) {
        return res.status(409).json({ message: 'Email is already in use by another account' })
      }
      
      updateData.email = email
    }
    
    if (password) {
      updateData.password_hash = await hashPassword(password)
    }
    
    // Update the user if there are changes
    if (Object.keys(updateData).length > 0) {
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: updateData,
        select: {
          id: true,
          email: true,
          role: true,
          createdAt: true,
          updatedAt: true
        }
      })
      
      res.status(200).json({
        message: 'Your profile has been updated successfully',
        user: updatedUser
      })
    } else {
      // No changes were provided
      res.status(200).json({
        message: 'No changes to update',
        user: req.user
      })
    }
  } catch (error) {
    console.error('Error updating current user:', error)
    res.status(500).json({ message: 'Internal server error while updating profile' })
  }
} 