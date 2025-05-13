import { CacheService } from './CacheService.js';

/**
 * Cache manager to handle different cache stores
 * and provide a centralized configuration
 */
export class CacheManager {
  constructor() {
    this.caches = new Map();
    this.defaultOptions = {
      ttl: 3600000, // 1 hour in milliseconds
      maxSize: 100
    };
  }

  /**
   * Get or create a cache instance
   * @param {string} name - Cache name
   * @param {Object} options - Cache options (optional)
   * @returns {CacheService} - Cache instance
   */
  getCache(name, options = {}) {
    if (!this.caches.has(name)) {
      const cacheOptions = { 
        ...this.defaultOptions, 
        ...options 
      };
      this.caches.set(name, new CacheService(cacheOptions));
    }
    
    return this.caches.get(name);
  }

  /**
   * Set default options for all new caches
   * @param {Object} options - Default cache options
   */
  setDefaultOptions(options) {
    this.defaultOptions = { 
      ...this.defaultOptions, 
      ...options 
    };
  }

  /**
   * Get all cache instances
   * @returns {Map<string, CacheService>} - Map of cache instances
   */
  getCaches() {
    return this.caches;
  }

  /**
   * Clear all caches
   */
  clearAll() {
    for (const cache of this.caches.values()) {
      cache.clear();
    }
  }

  /**
   * Get statistics for all caches
   * @returns {Object} - Cache statistics by cache name
   */
  getStats() {
    const stats = {};
    
    for (const [name, cache] of this.caches.entries()) {
      stats[name] = cache.getStats();
    }
    
    return stats;
  }

  /**
   * Reset statistics for all caches
   */
  resetStats() {
    for (const cache of this.caches.values()) {
      cache.resetStats();
    }
  }
}

// Export a singleton instance
export const cacheManager = new CacheManager(); 