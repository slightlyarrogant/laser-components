import { MockEnrichmentService } from './MockEnrichmentService.js'
import { ClearbitEnrichmentService } from './ClearbitEnrichmentService.js'
import { LinkedInEnrichmentService } from './LinkedInEnrichmentService.js'

/**
 * Factory for creating and managing data enrichment services
 */
export class EnrichmentServiceFactory {
  constructor() {
    this.services = {}
    this.defaultServiceName = null
  }

  /**
   * Create a default instance with preconfigured services
   * @param {Object} config - Configuration options
   * @returns {EnrichmentServiceFactory} - Configured factory instance
   */
  static createDefault(config = {}) {
    const factory = new EnrichmentServiceFactory()
    
    // Add mock service by default
    factory.registerService(
      'mock', 
      new MockEnrichmentService({
        delayMs: config.mockDelayMs || 500,
        errorRate: config.mockErrorRate || 0.1
      })
    )
    
    // Add Clearbit if API key is provided
    if (config.clearbitApiKey) {
      try {
        const clearbitService = new ClearbitEnrichmentService({
          apiKey: config.clearbitApiKey,
          timeout: config.clearbitTimeout,
          rateLimitDelay: config.clearbitRateLimitDelay
        })
        factory.registerService('clearbit', clearbitService)
        
        // Set Clearbit as default if enabled
        if (config.useClearbitAsDefault) {
          factory.setDefaultService('clearbit')
        }
      } catch (error) {
        console.warn('Failed to initialize Clearbit enrichment service:', error.message)
      }
    }
    
    // Add LinkedIn if API key is provided
    if (config.linkedinApiKey) {
      try {
        const linkedinService = new LinkedInEnrichmentService({
          apiKey: config.linkedinApiKey,
          baseUrl: config.linkedinBaseUrl,
          timeout: config.linkedinTimeout,
          rateLimitDelay: config.linkedinRateLimitDelay
        })
        factory.registerService('linkedin', linkedinService)
        
        // Set LinkedIn as default if enabled and Clearbit not already set
        if (config.useLinkedInAsDefault && !factory.defaultServiceName) {
          factory.setDefaultService('linkedin')
        }
      } catch (error) {
        console.warn('Failed to initialize LinkedIn enrichment service:', error.message)
      }
    }
    
    // If no specific default service set, use first available real API
    if (!factory.defaultServiceName) {
      if (factory.services.clearbit) {
        factory.setDefaultService('clearbit')
      } else if (factory.services.linkedin) {
        factory.setDefaultService('linkedin')
      } else {
        factory.setDefaultService('mock')
      }
    }
    
    return factory
  }

  /**
   * Register a service with the factory
   * @param {string} name - Service name
   * @param {DataEnrichmentService} service - Service instance
   * @returns {EnrichmentServiceFactory} - This factory (for chaining)
   */
  registerService(name, service) {
    this.services[name] = service
    return this
  }

  /**
   * Set the default service
   * @param {string} name - Service name
   * @returns {EnrichmentServiceFactory} - This factory (for chaining)
   */
  setDefaultService(name) {
    if (this.services[name]) {
      this.defaultServiceName = name
    } else {
      throw new Error(`Service "${name}" not registered`)
    }
    return this
  }

  /**
   * Get a service by name
   * @param {string} name - Service name
   * @returns {DataEnrichmentService|null} - Service instance or null
   */
  getService(name) {
    return this.services[name] || null
  }

  /**
   * Get the default service
   * @returns {DataEnrichmentService|null} - Default service or null
   */
  getDefaultService() {
    // If default service is set, use it
    if (this.defaultServiceName && this.services[this.defaultServiceName]) {
      return this.services[this.defaultServiceName]
    }
    
    // Otherwise, return the first available service
    const serviceNames = Object.keys(this.services)
    if (serviceNames.length === 0) {
      return null
    }
    
    // Prefer non-mock service if available
    const nonMockService = serviceNames.find(name => name !== 'mock')
    return this.services[nonMockService] || this.services[serviceNames[0]]
  }

  /**
   * Get all registered services
   * @returns {Object<string, DataEnrichmentService>} - Map of service names to instances
   */
  getAllServices() {
    return { ...this.services }
  }

  /**
   * Get a list of available service names
   * @returns {string[]} - Service names
   */
  getServiceNames() {
    return Object.keys(this.services)
  }

  /**
   * Get the name of the default service
   * @returns {string|null} - Name of default service or null
   */
  getDefaultServiceName() {
    if (this.defaultServiceName) {
      return this.defaultServiceName
    }
    
    const service = this.getDefaultService()
    return service ? service.getName().toLowerCase() : null
  }

  /**
   * Check service availability and get status for all services
   * @returns {Promise<Object>} - Service status information
   */
  async getServicesStatus() {
    const statuses = {}
    const serviceNames = this.getServiceNames()
    
    // Check each service in parallel
    const statusPromises = serviceNames.map(async (name) => {
      const service = this.services[name]
      try {
        const isAvailable = await service.isAvailable()
        return { name, isAvailable }
      } catch (error) {
        return { name, isAvailable: false, error: error.message }
      }
    })
    
    // Collect results
    const results = await Promise.all(statusPromises)
    
    // Format into object
    results.forEach(result => {
      statuses[result.name] = {
        available: result.isAvailable,
        isDefault: result.name === this.defaultServiceName,
        error: result.error
      }
    })
    
    return {
      services: statuses,
      defaultService: this.defaultServiceName
    }
  }
} 