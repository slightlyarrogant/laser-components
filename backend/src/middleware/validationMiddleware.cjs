// Import express-validator in CommonJS format
const { body, validationResult } = require('express-validator');

// Middleware to handle validation errors
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// Validation rules for user registration
const registerValidationRules = [
  body('email')
    .isEmail().withMessage('Must be a valid email address')
    .normalizeEmail(),
  body('password')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters long'),
  // Optional: Add validation for 'role' if it's part of registration payload
  body('role').optional().isIn(['ADMIN', 'RESEARCHER', 'SALES']).withMessage('Invalid role')
];

// Validation rules for user login
const loginValidationRules = [
  body('email')
    .isEmail().withMessage('Must be a valid email address')
    .normalizeEmail(),
  body('password')
    .notEmpty().withMessage('Password is required')
];

// Export the middleware and validation rules
module.exports = {
  handleValidationErrors,
  registerValidationRules,
  loginValidationRules
}; 