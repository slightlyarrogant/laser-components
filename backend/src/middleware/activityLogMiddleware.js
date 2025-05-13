import activityLogService from '../services/analytics/activityLogService.js'

/**
 * Middleware to automatically log user activities
 * 
 * @param {string} action - The action being performed (e.g., 'create', 'update', 'delete')
 * @param {string} resourceType - The type of resource (e.g., 'lead', 'product', 'user')
 * @param {string|function} resourceIdExtractor - Function to extract resource ID from request or path param name
 * @param {function} detailsExtractor - Optional function to extract additional details from request
 * @returns {function} Express middleware function
 */
export function logActivity(action, resourceType, resourceIdExtractor, detailsExtractor = null) {
  return async (req, res, next) => {
    // Store the original JSON method
    const originalJson = res.json;
    
    // Override the json method to capture the response and log activity
    res.json = function(data) {
      try {
        // Only log successful responses (2xx status codes)
        if (res.statusCode >= 200 && res.statusCode < 300 && req.user?.id) {
          let resourceId = null;
          
          // Extract resource ID using the provided extractor
          if (typeof resourceIdExtractor === 'function') {
            resourceId = resourceIdExtractor(req, data);
          } else if (typeof resourceIdExtractor === 'string') {
            // If string provided, treat as path param name
            resourceId = req.params[resourceIdExtractor];
          }
          
          // Extract details if detailsExtractor is provided
          let details = null;
          if (typeof detailsExtractor === 'function') {
            details = detailsExtractor(req, data);
          }
          
          // Log the activity asynchronously
          activityLogService.logActivity(
            req.user.id,
            action,
            resourceType,
            resourceId,
            details,
            req
          ).catch(error => {
            console.error('Error logging activity:', error);
            // Don't block the response even if logging fails
          });
        }
      } catch (error) {
        console.error('Error in activity logging middleware:', error);
        // Don't block the response even if there's an error
      }
      
      // Call the original json method
      return originalJson.call(this, data);
    };
    
    next();
  };
}

/**
 * Preset middleware for common CRUD operations on resources
 */
export const activityLogMiddleware = {
  /**
   * Log a resource creation activity
   * @param {string} resourceType - The type of resource (e.g., 'lead', 'product')
   * @param {string|function} resourceIdExtractor - Function to extract resource ID from request or path param name
   */
  create: (resourceType, resourceIdExtractor = (req, data) => data?.id || null) => {
    return logActivity(
      'create',
      resourceType,
      resourceIdExtractor,
      (req) => ({ requestBody: req.body })
    );
  },
  
  /**
   * Log a resource update activity
   * @param {string} resourceType - The type of resource (e.g., 'lead', 'product')
   * @param {string} resourceIdParam - Name of the path parameter containing the resource ID
   */
  update: (resourceType, resourceIdParam = 'id') => {
    return logActivity(
      'update',
      resourceType,
      resourceIdParam,
      (req) => ({ requestBody: req.body })
    );
  },
  
  /**
   * Log a resource deletion activity
   * @param {string} resourceType - The type of resource (e.g., 'lead', 'product')
   * @param {string} resourceIdParam - Name of the path parameter containing the resource ID
   */
  delete: (resourceType, resourceIdParam = 'id') => {
    return logActivity(
      'delete',
      resourceType,
      resourceIdParam
    );
  },
  
  /**
   * Log a resource view activity
   * @param {string} resourceType - The type of resource (e.g., 'lead', 'product')
   * @param {string} resourceIdParam - Name of the path parameter containing the resource ID
   */
  view: (resourceType, resourceIdParam = 'id') => {
    return logActivity(
      'view',
      resourceType,
      resourceIdParam
    );
  },
  
  /**
   * Log a resource list activity
   * @param {string} resourceType - The type of resource (e.g., 'lead', 'product')
   */
  list: (resourceType) => {
    return logActivity(
      'list',
      resourceType,
      null,
      (req) => ({ query: req.query })
    );
  },
  
  /**
   * Log a custom activity
   * @param {string} action - The action being performed
   * @param {string} resourceType - The type of resource
   * @param {string|function} resourceIdExtractor - Function to extract resource ID or path param name
   * @param {function} detailsExtractor - Function to extract additional details
   */
  custom: (action, resourceType, resourceIdExtractor, detailsExtractor) => {
    return logActivity(action, resourceType, resourceIdExtractor, detailsExtractor);
  }
}; 