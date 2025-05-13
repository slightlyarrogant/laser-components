/**
 * In-memory cache service for storing and retrieving search results
 * This implementation uses a simple Map for storage with TTL expiration
 */
export class CacheService {
  constructor(options = {}) {
    this.cache = new Map();
    this.ttl = options.ttl || 3600000; // Default TTL: 1 hour in milliseconds
    this.maxSize = options.maxSize || 100; // Maximum number of cache entries
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0
    };
  }

  /**
   * Generate a cache key from search parameters
   * @param {Object} params - Search parameters
   * @returns {string} - Cache key
   */
  generateKey(params) {
    // Sort the keys to ensure consistent order
    const sortedParams = Object.keys(params)
      .sort()
      .reduce((acc, key) => {
        acc[key] = params[key];
        return acc;
      }, {});
    
    return JSON.stringify(sortedParams);
  }

  /**
   * Get an item from the cache
   * @param {string} key - Cache key
   * @returns {any|null} - Cached item or null if not found or expired
   */
  get(key) {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.stats.misses++;
      return null;
    }
    
    // Check if the entry has expired
    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      this.stats.misses++;
      return null;
    }
    
    // Update access time
    entry.lastAccessed = Date.now();
    this.stats.hits++;
    
    return entry.value;
  }

  /**
   * Set an item in the cache
   * @param {string} key - Cache key
   * @param {any} value - Value to cache
   * @param {number} ttl - Time to live in milliseconds (optional, uses default if not provided)
   */
  set(key, value, ttl = this.ttl) {
    // Evict entries if cache is at max size
    if (this.cache.size >= this.maxSize) {
      this._evictOldest();
    }
    
    this.cache.set(key, {
      value,
      expiry: Date.now() + ttl,
      lastAccessed: Date.now()
    });
    
    this.stats.sets++;
  }

  /**
   * Check if an item exists in the cache and is not expired
   * @param {string} key - Cache key
   * @returns {boolean} - Whether the item exists and is valid
   */
  has(key) {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return false;
    }
    
    // Check if the entry has expired
    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      return false;
    }
    
    return true;
  }

  /**
   * Remove an item from the cache
   * @param {string} key - Cache key
   */
  delete(key) {
    this.cache.delete(key);
  }

  /**
   * Clear all items from the cache
   */
  clear() {
    this.cache.clear();
  }

  /**
   * Invalidate cache entries that match a pattern
   * @param {Function} predicate - Function that takes a key and returns true if it should be invalidated
   */
  invalidateByPattern(predicate) {
    for (const key of this.cache.keys()) {
      if (predicate(key)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Get cache statistics
   * @returns {Object} - Cache statistics
   */
  getStats() {
    return {
      ...this.stats,
      size: this.cache.size,
      hitRate: this.stats.hits / (this.stats.hits + this.stats.misses) || 0
    };
  }

  /**
   * Reset cache statistics
   */
  resetStats() {
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0
    };
  }

  /**
   * Evict the least recently accessed entry
   * @private
   */
  _evictOldest() {
    let oldestKey = null;
    let oldestAccess = Date.now();
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessed < oldestAccess) {
        oldestAccess = entry.lastAccessed;
        oldestKey = key;
      }
    }
    
    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }
} 