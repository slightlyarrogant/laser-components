/**
 * Global error handling middleware.
 * Catches errors passed via next(error) and sends a standardized JSON response.
 */
export function errorHandler (err, req, res, next) {
  console.error('Unhandled error:', err.stack || err) // Log the full error stack

  // Determine status code - default to 500 if not set
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode
  res.status(statusCode)

  res.json({
    message: err.message || 'Internal Server Error',
    // Optionally include stack trace in development mode
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  })
}

/**
 * Middleware to handle 404 Not Found errors.
 * This should be placed after all other routes.
 */
export function notFound (req, res, next) {
  res.status(404)
  const error = new Error(`Not Found - ${req.originalUrl}`)
  next(error) // Pass the error to the global error handler
} 