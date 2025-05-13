import { cacheManager } from '../services/cache/CacheManager.js';

/**
 * Cache middleware to handle caching for API responses
 * This middleware will check the cache before executing the route handler
 * and cache the response after the handler has executed
 * 
 * @param {string} cacheName - Name of the cache to use
 * @param {Object} options - Cache options
 * @returns {Function} - Express middleware function
 */
export const cacheMiddleware = (cacheName = 'default', options = {}) => {
  return (req, res, next) => {
    // Don't cache non-GET requests
    if (req.method !== 'GET') {
      return next();
    }
    
    const cache = cacheManager.getCache(cacheName, options);
    
    // Generate cache key based on the request URL and query parameters
    const cacheKey = cache.generateKey({
      url: req.originalUrl,
      query: req.query
    });
    
    // Check if the response is in the cache
    const cachedResponse = cache.get(cacheKey);
    
    if (cachedResponse) {
      // Add a custom header to indicate a cache hit
      res.set('X-Cache', 'HIT');
      
      // Return the cached response
      return res.status(cachedResponse.status)
        .set(cachedResponse.headers)
        .json(cachedResponse.data);
    }
    
    // Add a custom header to indicate a cache miss
    res.set('X-Cache', 'MISS');
    
    // Store the original res.json method
    const originalJson = res.json;
    
    // Override the res.json method to cache the response
    res.json = function(data) {
      // Only cache successful responses
      if (res.statusCode >= 200 && res.statusCode < 300) {
        // Store response in cache
        cache.set(cacheKey, {
          status: res.statusCode,
          data,
          headers: {
            'Content-Type': 'application/json'
          }
        }, options.ttl);
      }
      
      // Call the original method
      return originalJson.call(this, data);
    };
    
    next();
  };
};

/**
 * Clear cache entries that match a pattern
 * 
 * @param {string} cacheName - Name of the cache to clear
 * @param {Function} predicate - Function that takes a key and returns true if it should be cleared
 */
export const clearCache = (cacheName = 'default', predicate = null) => {
  const cache = cacheManager.getCache(cacheName);
  
  if (predicate) {
    cache.invalidateByPattern(predicate);
  } else {
    cache.clear();
  }
};

/**
 * Get cache statistics
 * 
 * @param {string} cacheName - Name of the cache to get statistics for (optional)
 * @returns {Object} - Cache statistics
 */
export const getCacheStats = (cacheName = null) => {
  if (cacheName) {
    const cache = cacheManager.getCache(cacheName);
    return cache.getStats();
  }
  
  return cacheManager.getStats();
}; 