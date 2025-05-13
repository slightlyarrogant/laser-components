import { MockExternalService } from './MockExternalService.js';
import { RealExternalService } from './RealExternalService.js';

/**
 * Factory for creating and managing organization search service instances.
 * This allows for easy switching between different external API providers.
 */
export class OrganizationServiceFactory {
  constructor() {
    this.services = {};
    this.defaultServiceName = null;
  }

  /**
   * Register a service for later use
   * @param {string} name - Service identifier
   * @param {BaseOrganizationService} service - Service instance
   * @param {boolean} isDefault - Set as default service
   * @returns {this} - Factory instance for chaining
   */
  registerService(name, service, isDefault = false) {
    this.services[name] = service;
    
    if (isDefault || this.defaultServiceName === null) {
      this.defaultServiceName = name;
    }
    
    return this;
  }

  /**
   * Get a service by name, or the default service if no name provided
   * @param {string} name - Service identifier (optional)
   * @returns {BaseOrganizationService} - Service instance
   */
  getService(name = null) {
    const serviceName = name || this.defaultServiceName;
    
    if (!serviceName || !this.services[serviceName]) {
      throw new Error(`Organization search service '${serviceName}' not found`);
    }
    
    return this.services[serviceName];
  }

  /**
   * Create a factory with default service configuration
   * @param {Object} config - Configuration options
   * @returns {OrganizationServiceFactory} - Configured factory instance
   */
  static createDefault(config = {}) {
    const factory = new OrganizationServiceFactory();
    
    // Register the mock service by default
    factory.registerService(
      'mock',
      new MockExternalService({
        delayMs: config.mockDelayMs || 800,
        errorRate: config.mockErrorRate || 0.05
      }),
      true
    );
    
    // Register the real service if API key is provided
    if (config.realApiKey && config.realBaseUrl) {
      factory.registerService(
        'real',
        new RealExternalService({
          apiKey: config.realApiKey,
          baseUrl: config.realBaseUrl,
          timeout: config.realTimeout,
          retryAttempts: config.realRetryAttempts,
          retryDelay: config.realRetryDelay
        }),
        config.useRealAsDefault || false
      );
    }
    
    return factory;
  }
} 