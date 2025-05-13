import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

/**
 * Service for collecting and storing analytics data
 */
class AnalyticsService {
  /**
   * Record an event for analytics
   * @param {string} eventType - Type of event (e.g., 'lead_created', 'lead_converted')
   * @param {string} category - Category (e.g., 'lead', 'product', 'application')
   * @param {string} action - Action (e.g., 'create', 'update', 'delete')
   * @param {string} entityId - ID of related entity (e.g., leadId, productId)
   * @param {Object} metadata - Additional data as JSON
   * @param {number} userId - User who performed action (if applicable)
   * @returns {Promise<Object>} Created event
   */
  async recordEvent(eventType, category, action, entityId, metadata = null, userId = null) {
    try {
      const event = await prisma.analyticsEvent.create({
        data: {
          eventType,
          category,
          action,
          entityId: String(entityId), // Ensure entityId is a string
          metadata,
          userId,
        }
      })
      
      return event
    } catch (error) {
      console.error('Error recording analytics event:', error)
      // Don't throw - analytics errors shouldn't break functionality
      return null
    }
  }

  /**
   * Record a metric value
   * @param {string} metricName - Name of metric (e.g., 'time_to_lead', 'product_coverage')
   * @param {number} value - Numerical value
   * @param {Object} dimensions - Dimensions (e.g., {region: 'EMEA', product: '123'})
   * @returns {Promise<Object>} Created metric value
   */
  async recordMetric(metricName, value, dimensions = null) {
    try {
      const metricValue = await prisma.metricValue.create({
        data: {
          metricName,
          value,
          dimensions,
        }
      })
      
      return metricValue
    } catch (error) {
      console.error('Error recording metric value:', error)
      return null
    }
  }

  /**
   * Calculate and record time-to-lead metric
   * @param {string} leadId - ID of the lead
   * @param {string} applicationId - ID of the application
   * @returns {Promise<Object>} Recorded metric
   */
  async calculateTimeToLead(leadId, applicationId) {
    try {
      // Get lead creation time
      const lead = await prisma.lead.findUnique({
        where: { id: Number(leadId) },
        select: { createdAt: true, applicationId: true }
      })
      
      if (!lead) {
        throw new Error(`Lead with ID ${leadId} not found`)
      }
      
      // Get the related application mapping (when was it added to the system)
      const application = await prisma.application.findUnique({
        where: { id: Number(applicationId) || lead.applicationId },
        select: { createdAt: true }
      })
      
      if (!application) {
        throw new Error(`Application not found`)
      }
      
      // Calculate time difference in hours
      const timeDiffMs = lead.createdAt.getTime() - application.createdAt.getTime()
      const timeDiffHours = timeDiffMs / (1000 * 60 * 60)
      
      // Record the metric
      return this.recordMetric('time_to_lead', timeDiffHours, {
        leadId: String(leadId),
        applicationId: String(applicationId || lead.applicationId)
      })
    } catch (error) {
      console.error('Error calculating time-to-lead metric:', error)
      return null
    }
  }

  /**
   * Calculate and record product mapping coverage
   * @param {string} productId - ID of the product (optional)
   * @returns {Promise<Object>} Recorded metric
   */
  async calculateProductMappingCoverage(productId = null) {
    try {
      let whereClause = {}
      let dimensions = {}
      
      if (productId) {
        whereClause = { productId: Number(productId) }
        dimensions = { productId: String(productId) }
      }
      
      // Count total products
      const totalProductsCount = await prisma.product.count({
        where: whereClause
      })
      
      // Count products with at least one application
      const productsWithApplicationsCount = await prisma.product.count({
        where: {
          ...whereClause,
          applications: {
            some: {}
          }
        }
      })
      
      // Calculate coverage percentage
      const coveragePercentage = totalProductsCount > 0 
        ? (productsWithApplicationsCount / totalProductsCount) * 100 
        : 0
      
      // Record the metric
      return this.recordMetric('product_mapping_coverage', coveragePercentage, dimensions)
    } catch (error) {
      console.error('Error calculating product mapping coverage:', error)
      return null
    }
  }

  /**
   * Calculate and record lead conversion rate
   * @param {Object} filters - Filters to apply (status, date range, etc.)
   * @returns {Promise<Object>} Recorded metric
   */
  async calculateLeadConversionRate(filters = {}) {
    try {
      const whereClause = {}
      const dimensions = {}
      
      // Apply status filter if provided
      if (filters.status) {
        whereClause.status = filters.status
        dimensions.status = filters.status
      }
      
      // Apply date range if provided
      if (filters.startDate && filters.endDate) {
        whereClause.createdAt = {
          gte: new Date(filters.startDate),
          lte: new Date(filters.endDate)
        }
        dimensions.period = `${filters.startDate} to ${filters.endDate}`
      }
      
      // Count total leads matching the filters
      const totalLeadsCount = await prisma.lead.count({
        where: whereClause
      })
      
      // Count converted leads (status = WON)
      const convertedLeadsCount = await prisma.lead.count({
        where: {
          ...whereClause,
          status: 'WON'
        }
      })
      
      // Calculate conversion rate
      const conversionRate = totalLeadsCount > 0 
        ? (convertedLeadsCount / totalLeadsCount) * 100 
        : 0
      
      // Record the metric
      return this.recordMetric('lead_conversion_rate', conversionRate, dimensions)
    } catch (error) {
      console.error('Error calculating lead conversion rate:', error)
      return null
    }
  }

  /**
   * Get metric values with filtering and pagination
   * @param {string} metricName - Name of the metric
   * @param {Object} [filters={}] - Filters (startDate, endDate, dimensions)
   * @param {Object} [options={}] - Pagination/sorting (limit, page, sortBy, sortOrder)
   * @returns {Promise<Object>} Metric values with pagination metadata
   */
  async getMetricValues(metricName, filters = {}, options = {}) {
    // Provide default options for pagination and sorting if not passed
    const effectiveOptions = {
      limit: options.limit ?? 100, // Default limit
      page: options.page ?? 1,     // Default page
      sortBy: options.sortBy ?? 'timestamp', // Default sort field
      sortOrder: options.sortOrder ?? 'desc', // Default sort order
      skip: options.skip ?? (options.page ? (options.page - 1) * (options.limit ?? 100) : 0), // Calculate skip or default to 0
    };

    try {
      const whereClause = { metricName };
      
      // Apply date range if provided
      if (filters.startDate && filters.endDate) {
        whereClause.timestamp = {
          gte: new Date(filters.startDate),
          lte: new Date(filters.endDate)
        }
      }
      
      // Apply dimensions filter if provided
      if (filters.dimensions) {
        whereClause.dimensions = {
          path: Object.keys(filters.dimensions).map(key => `$.${key}`),
          equals: Object.values(filters.dimensions)
        }
      }
      
      // Get metric values
      const metricValues = await prisma.metricValue.findMany({
        where: whereClause,
        orderBy: {
          [effectiveOptions.sortBy]: effectiveOptions.sortOrder
        },
        skip: effectiveOptions.skip, // Use calculated/defaulted skip
        take: effectiveOptions.limit // Use defaulted limit
      })
      
      // Count total
      const total = await prisma.metricValue.count({
        where: whereClause
      })
      
      return {
        data: metricValues,
        pagination: {
          page: effectiveOptions.page,
          limit: effectiveOptions.limit,
          total,
          totalPages: Math.ceil(total / effectiveOptions.limit)
        }
      }
    } catch (error) {
      console.error('Error getting metric values:', error)
      throw error
    }
  }

  /**
   * Aggregate metrics and store the results
   * @param {string} metricName - Name of the metric to aggregate
   * @param {Object} dimensions - Dimensions to group by
   * @param {string} startDate - Start date for aggregation period
   * @param {string} endDate - End date for aggregation period
   * @returns {Promise<Object>} Aggregated metrics
   */
  async aggregateMetrics(metricName, dimensions = null, startDate, endDate) {
    try {
      const whereClause = {
        metricName,
        timestamp: {
          gte: new Date(startDate),
          lte: new Date(endDate)
        }
      }
      
      // Apply dimensions filter if provided
      if (dimensions) {
        whereClause.dimensions = {
          path: Object.keys(dimensions).map(key => `$.${key}`),
          equals: Object.values(dimensions)
        }
      }
      
      // Get metrics for aggregation
      const metrics = await prisma.metricValue.findMany({
        where: whereClause,
        select: {
          value: true
        }
      })
      
      // Calculate aggregates
      const values = metrics.map(m => m.value)
      const count = values.length
      const sum = values.reduce((acc, val) => acc + val, 0)
      const avg = count > 0 ? sum / count : 0
      const min = count > 0 ? Math.min(...values) : null
      const max = count > 0 ? Math.max(...values) : null
      
      // Store aggregates
      const aggregate = await prisma.metricAggregate.upsert({
        where: {
          metricName_dimensions_startDate_endDate: {
            metricName,
            dimensions: dimensions || {},
            startDate: new Date(startDate),
            endDate: new Date(endDate)
          }
        },
        update: {
          count,
          sum,
          avg,
          min,
          max
        },
        create: {
          metricName,
          dimensions,
          count,
          sum,
          avg,
          min,
          max,
          startDate: new Date(startDate),
          endDate: new Date(endDate)
        }
      })
      
      return aggregate
    } catch (error) {
      console.error('Error aggregating metrics:', error)
      throw error
    }
  }

  /**
   * Get aggregated metrics
   * @param {string} metricName - Name of the metric
   * @param {Object} filters - Filters to apply (dimensions, date range)
   * @returns {Promise<Array>} Aggregated metrics
   */
  async getAggregatedMetrics(metricName, filters = {}) {
    try {
      const whereClause = { metricName }
      
      // Apply date range if provided
      if (filters.startDate && filters.endDate) {
        whereClause.startDate = { gte: new Date(filters.startDate) }
        whereClause.endDate = { lte: new Date(filters.endDate) }
      }
      
      // Apply dimensions filter if provided
      if (filters.dimensions) {
        whereClause.dimensions = {
          path: Object.keys(filters.dimensions).map(key => `$.${key}`),
          equals: Object.values(filters.dimensions)
        }
      }
      
      // Get aggregated metrics
      const aggregates = await prisma.metricAggregate.findMany({
        where: whereClause,
        orderBy: {
          startDate: 'desc'
        }
      })
      
      return aggregates
    } catch (error) {
      console.error('Error getting aggregated metrics:', error)
      throw error
    }
  }
}

export default new AnalyticsService() 