import { MockLeadDiscoveryService } from './MockLeadDiscoveryService.js'
import { ClearbitLeadDiscoveryService } from './ClearbitLeadDiscoveryService.js'
import { HunterLeadDiscoveryService } from './HunterLeadDiscoveryService.js'

/**
 * Factory for creating and managing lead discovery services
 */
export class LeadDiscoveryFactory {
  constructor() {
    this.services = {}
    this.defaultServiceName = null
  }

  /**
   * Create a default instance with preconfigured services
   * @param {Object} config - Configuration options
   * @returns {LeadDiscoveryFactory} - Configured factory instance
   */
  static createDefault(config = {}) {
    const factory = new LeadDiscoveryFactory()
    
    // Add mock service by default
    factory.registerService(
      'mock',
      new MockLeadDiscoveryService({
        delayMs: config.mockDelayMs || 800,
        errorRate: config.mockErrorRate || 0.05
      })
    )
    
    // Add Clearbit if API key is provided
    if (config.clearbitApiKey) {
      try {
        const clearbitService = new ClearbitLeadDiscoveryService({
          apiKey: config.clearbitApiKey
        })
        factory.registerService('clearbit', clearbitService)
        
        // Set Clearbit as default if enabled
        if (config.useClearbitAsDefault) {
          factory.setDefaultService('clearbit')
        }
      } catch (error) {
        console.warn('Failed to initialize Clearbit service:', error.message)
      }
    }
    
    // Add Hunter if API key is provided
    if (config.hunterApiKey) {
      try {
        const hunterService = new HunterLeadDiscoveryService({
          apiKey: config.hunterApiKey
        })
        factory.registerService('hunter', hunterService)
        
        // Set Hunter as default if enabled and Clearbit not already set
        if (config.useHunterAsDefault && !factory.defaultServiceName) {
          factory.setDefaultService('hunter')
        }
      } catch (error) {
        console.warn('Failed to initialize Hunter service:', error.message)
      }
    }
    
    // If no specific default service set, use first available real API
    if (!factory.defaultServiceName) {
      if (factory.services.clearbit) {
        factory.setDefaultService('clearbit')
      } else if (factory.services.hunter) {
        factory.setDefaultService('hunter')
      } else {
        factory.setDefaultService('mock')
      }
    }
    
    return factory
  }

  /**
   * Register a service with the factory
   * @param {string} name - Service name
   * @param {LeadDiscoveryService} service - Service instance
   * @returns {LeadDiscoveryFactory} - This factory (for chaining)
   */
  registerService(name, service) {
    this.services[name] = service
    return this
  }

  /**
   * Set the default service
   * @param {string} name - Service name
   * @returns {LeadDiscoveryFactory} - This factory (for chaining)
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
   * @returns {LeadDiscoveryService|null} - Service instance or null
   */
  getService(name) {
    return this.services[name] || null
  }

  /**
   * Get the default service
   * @returns {LeadDiscoveryService|null} - Default service or null
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
   * @returns {Object<string, LeadDiscoveryService>} - Map of service names to instances
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
} 