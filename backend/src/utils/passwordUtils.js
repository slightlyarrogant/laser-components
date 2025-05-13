import bcrypt from 'bcrypt'

const saltRounds = 10 // Cost factor for hashing

/**
 * Hashes a plain text password.
 * @param {string} password - The plain text password.
 * @returns {Promise<string>} The hashed password.
 */
export async function hashPassword (password) {
  try {
    const salt = await bcrypt.genSalt(saltRounds)
    const hash = await bcrypt.hash(password, salt)
    return hash
  } catch (error) {
    console.error('Error hashing password:', error)
    throw new Error('Could not hash password') // Or handle more gracefully
  }
}

/**
 * Compares a plain text password with a hashed password.
 * @param {string} password - The plain text password.
 * @param {string} hash - The hashed password from the database.
 * @returns {Promise<boolean>} True if the passwords match, false otherwise.
 */
export async function comparePassword (password, hash) {
  try {
    const match = await bcrypt.compare(password, hash)
    return match
  } catch (error) {
    console.error('Error comparing password:', error)
    // In case of bcrypt error, treat as non-match for security
    return false
  }
} 