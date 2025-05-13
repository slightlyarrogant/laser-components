import express from 'express';
import { 
  authenticateToken, 
  authorizeRoles 
} from '../middleware/authMiddleware.js';
import { cacheManager } from '../services/cache/CacheManager.js';
import { getCacheStats, clearCache } from '../middleware/cacheMiddleware.js';

const router = express.Router();

/**
 * GET /api/cache/stats
 * Get cache statistics
 */
router.get(
  '/stats',
  authenticateToken,
  authorizeRoles(['admin']),
  (req, res) => {
    const stats = getCacheStats();
    res.json(stats);
  }
);

/**
 * GET /api/cache/:name/stats
 * Get statistics for a specific cache
 */
router.get(
  '/:name/stats',
  authenticateToken,
  authorizeRoles(['admin']),
  (req, res) => {
    const { name } = req.params;
    
    try {
      const stats = getCacheStats(name);
      res.json(stats);
    } catch (error) {
      res.status(404).json({ message: `Cache '${name}' not found` });
    }
  }
);

/**
 * DELETE /api/cache/clear
 * Clear all caches
 */
router.delete(
  '/clear',
  authenticateToken,
  authorizeRoles(['admin']),
  (req, res) => {
    cacheManager.clearAll();
    res.json({ message: 'All caches cleared successfully' });
  }
);

/**
 * DELETE /api/cache/:name/clear
 * Clear a specific cache
 */
router.delete(
  '/:name/clear',
  authenticateToken,
  authorizeRoles(['admin']),
  (req, res) => {
    const { name } = req.params;
    
    try {
      clearCache(name);
      res.json({ message: `Cache '${name}' cleared successfully` });
    } catch (error) {
      res.status(404).json({ message: `Cache '${name}' not found` });
    }
  }
);

/**
 * PUT /api/cache/config
 * Update default cache configuration
 */
router.put(
  '/config',
  authenticateToken,
  authorizeRoles(['admin']),
  (req, res) => {
    const { ttl, maxSize } = req.body;
    
    const options = {};
    if (ttl !== undefined) options.ttl = parseInt(ttl);
    if (maxSize !== undefined) options.maxSize = parseInt(maxSize);
    
    cacheManager.setDefaultOptions(options);
    
    res.json({ 
      message: 'Cache configuration updated successfully',
      config: cacheManager.defaultOptions
    });
  }
);

export default router; 