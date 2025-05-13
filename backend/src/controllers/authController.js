import { PrismaClient } from '@prisma/client'
import {
  hashPassword,
  comparePassword
} from '../utils/passwordUtils.js'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import activityLogService from '../services/analytics/activityLogService.js'

const prisma = new PrismaClient()

// --- JWT Configuration --- 
// **IMPORTANT: Store these secrets securely in .env file for production!**
const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET || 'your-access-secret-key'
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || 'your-refresh-secret-key'
const ACCESS_TOKEN_EXPIRES_IN = '15m' // Short-lived access token (e.g., 15 minutes)
const REFRESH_TOKEN_EXPIRES_IN = '7d' // Longer-lived refresh token (e.g., 7 days)

// JWT secret key from environment variables
const JWT_SECRET = process.env.JWT_SECRET || 'your-default-secret-key'
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1d'

/**
 * Register a new user.
 */
export async function registerUser (req, res) {
  const { email, password, role } = req.body // Add role if you allow setting it during registration

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' })
  }

  // Optional: Add password complexity validation here

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
    // Note: Role assignment might need more control in a real app
    const user = await prisma.user.create({
      data: {
        email,
        password_hash,
        role // Use provided role or default if not provided/allowed
      }
    })

    // Don't send password hash back
    const userResponse = { ...user }
    delete userResponse.password_hash

    res.status(201).json({ message: 'User registered successfully', user: userResponse })
  } catch (error) {
    console.error('Registration error:', error)
    res.status(500).json({ message: 'Internal server error during registration' })
  }
}

/**
 * Log in an existing user.
 * Issues both an access token and a refresh token.
 */
export async function loginUser (req, res) {
  const { email, password } = req.body

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' })
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email }
    })

    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' })
    }

    const isMatch = await comparePassword(password, user.password_hash)

    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' })
    }

    // --- Generate Tokens --- 
    const accessTokenPayload = {
      userId: user.id,
      email: user.email,
      role: user.role
    }
    const refreshTokenPayload = {
      userId: user.id // Keep refresh token payload minimal
    }

    const accessToken = jwt.sign(accessTokenPayload, ACCESS_TOKEN_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRES_IN })
    const refreshToken = jwt.sign(refreshTokenPayload, REFRESH_TOKEN_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRES_IN })

    // TODO: Store refresh token securely (e.g., in DB associated with user)
    // For simplicity here, we are not storing it yet. In a real app, you MUST store it
    // securely and check against the stored value in the refresh endpoint.
    // Example (needs a RefreshToken model in schema.prisma):
    // await prisma.refreshToken.create({ data: { token: refreshToken, userId: user.id } });

    // --- Send Tokens --- 
    // Send refresh token in HttpOnly cookie
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true, // Prevents client-side JS access
      secure: process.env.NODE_ENV === 'production', // Use secure cookies in production (HTTPS)
      sameSite: 'strict', // Mitigate CSRF attacks
      maxAge: 7 * 24 * 60 * 60 * 1000 // Cookie expiry matches token (7 days in ms)
      // path: '/api/auth' // Optional: Scope cookie to auth paths
    })

    // Send access token in JSON response body
    const userResponse = { ...user }
    delete userResponse.password_hash

    // Log the login activity
    activityLogService.logActivity(
      user.id,
      'login',
      'auth',
      null,
      { role: user.role },
      req
    ).catch(error => {
      console.error('Error logging login activity:', error);
      // Don't block the response if logging fails
    });

    res.status(200).json({
      message: 'Login successful',
      accessToken,
      user: userResponse
    })

  } catch (error) {
    console.error('Login error:', error)
    res.status(500).json({ message: 'Internal server error during login' })
  }
}

/**
 * Issues a new access token using a valid refresh token.
 */
export async function refreshToken (req, res) {
  const receivedRefreshToken = req.cookies.refreshToken

  if (!receivedRefreshToken) {
    return res.status(401).json({ message: 'Refresh token not found' })
  }

  try {
    // Verify the refresh token
    const decoded = jwt.verify(receivedRefreshToken, REFRESH_TOKEN_SECRET)

    // Optional but RECOMMENDED: Verify refresh token against stored tokens in DB
    // const storedToken = await prisma.refreshToken.findUnique({ where: { token: receivedRefreshToken } });
    // if (!storedToken || storedToken.userId !== decoded.userId) {
    //   return res.status(403).json({ message: 'Invalid refresh token' });
    // }
    // If implementing token rotation, invalidate storedToken here.

    // Find user associated with token
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, email: true, role: true } // Select necessary fields
    })

    if (!user) {
      return res.status(403).json({ message: 'User not found for refresh token' })
    }

    // Issue a new access token
    const newAccessTokenPayload = {
      userId: user.id,
      email: user.email,
      role: user.role
    }
    const newAccessToken = jwt.sign(newAccessTokenPayload, ACCESS_TOKEN_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRES_IN })

    // Optional: Implement refresh token rotation: issue a new refresh token
    // const newRefreshToken = jwt.sign({ userId: user.id }, REFRESH_TOKEN_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRES_IN });
    // await prisma.refreshToken.create({ data: { token: newRefreshToken, userId: user.id } });
    // Send new refresh token in cookie...

    res.status(200).json({ accessToken: newAccessToken })

  } catch (error) {
    // Handles expired tokens, invalid tokens etc.
    console.error('Refresh token error:', error)
    // Clear the potentially invalid refresh token cookie
    res.clearCookie('refreshToken', { httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production' })
    return res.status(403).json({ message: 'Invalid or expired refresh token' })
  }
}

/**
 * Logs out the user by clearing the refresh token cookie.
 */
export async function logoutUser (req, res) {
  // Log the logout activity if we have user info
  if (req.user && req.user.id) {
    activityLogService.logActivity(
      req.user.id,
      'logout',
      'auth',
      null,
      null,
      req
    ).catch(error => {
      console.error('Error logging logout activity:', error);
      // Don't block the response if logging fails
    });
  }

  // TODO: If storing refresh tokens in DB, invalidate/delete the token associated
  // with req.cookies.refreshToken here.
  // Example:
  // const receivedRefreshToken = req.cookies.refreshToken;
  // if (receivedRefreshToken) {
  //   await prisma.refreshToken.deleteMany({ where: { token: receivedRefreshToken } });
  // }

  // Clear the refresh token cookie
  res.clearCookie('refreshToken', {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production'
    // Ensure path matches the one used when setting the cookie, if any
    // path: '/api/auth' 
  })

  res.status(200).json({ message: 'Logout successful' })
}

/**
 * Change current user password (requires authentication)
 */
export async function changePassword(req, res) {
  const userId = req.user.id; // From authenticateToken middleware
  const { currentPassword, newPassword } = req.body;
  
  try {
    // Find user
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Verify current password
    const isPasswordValid = await comparePassword(currentPassword, user.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }
    
    // Hash new password
    const password_hash = await hashPassword(newPassword);
    
    // Update password
    await prisma.user.update({
      where: { id: userId },
      data: { password_hash }
    });
    
    // Log password change activity
    activityLogService.logActivity(
      userId,
      'change_password',
      'auth',
      null,
      null,
      req
    ).catch(error => {
      console.error('Error logging password change activity:', error);
    });
    
    res.status(200).json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Error changing password:', error);
    res.status(500).json({ message: 'Internal server error while changing password' });
  }
}

/**
 * Request password reset (generates token and would send email in a real app)
 */
export async function forgotPassword(req, res) {
  const { email } = req.body;
  
  try {
    // Find user
    const user = await prisma.user.findUnique({
      where: { email }
    });
    
    if (!user) {
      // For security reasons, don't reveal whether the email exists
      return res.status(200).json({ 
        message: 'If that email exists in our system, we\'ve sent a password reset link' 
      });
    }
    
    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = crypto
      .createHash('sha256')
      .update(resetToken)
      .digest('hex');
    
    // Set expiry (1 hour from now)
    const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000);
    
    // Store token in user record
    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetTokenHash,
        resetTokenExpiry
      }
    });
    
    // Log password reset request activity
    activityLogService.logActivity(
      user.id,
      'request_password_reset',
      'auth',
      null,
      { email: user.email },
      req
    ).catch(error => {
      console.error('Error logging password reset request activity:', error);
    });
    
    // In a real app, send email with reset link
    // For now, just log it
    console.log(`Password reset token for ${email}: ${resetToken}`);
    console.log(`Reset link: ${process.env.FRONTEND_URL}/reset-password/${resetToken}`);
    
    // Return success response
    res.status(200).json({ 
      message: 'If that email exists in our system, we\'ve sent a password reset link' 
    });
  } catch (error) {
    console.error('Error generating password reset:', error);
    res.status(500).json({ message: 'Internal server error while processing password reset' });
  }
}

/**
 * Reset password using token
 */
export async function resetPassword(req, res) {
  const { token, password } = req.body;
  
  try {
    // Hash the provided token for comparison
    const resetTokenHash = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');
    
    // Find user with this token
    const user = await prisma.user.findFirst({
      where: {
        resetTokenHash,
        resetTokenExpiry: {
          gt: new Date() // Token not expired
        }
      }
    });
    
    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired password reset token' });
    }
    
    // Hash new password
    const password_hash = await hashPassword(password);
    
    // Update user with new password and clear reset token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password_hash,
        resetTokenHash: null,
        resetTokenExpiry: null
      }
    });
    
    // Log password reset activity
    activityLogService.logActivity(
      user.id,
      'reset_password',
      'auth',
      null,
      null,
      req
    ).catch(error => {
      console.error('Error logging password reset activity:', error);
    });
    
    res.status(200).json({ message: 'Password has been reset successfully' });
  } catch (error) {
    console.error('Error resetting password:', error);
    res.status(500).json({ message: 'Internal server error while resetting password' });
  }
}

// --- TODO: Add Logout Endpoint --- 
// export async function logoutUser(req, res) { ... } 