import analyticsService from '../services/analytics/analyticsService.js'
import activityLogService from '../services/analytics/activityLogService.js'

/**
 * Get metric values for a specific metric
 */
export async function getMetricValues(req, res) {
  try {
    const { metricName } = req.params
    const { 
      startDate, 
      endDate, 
      dimensions, 
      page = 1, 
      limit = 100, 
      sortBy = 'timestamp', 
      sortOrder = 'desc' 
    } = req.query

    // Parse dimensions if provided
    let parsedDimensions = null
    if (dimensions) {
      try {
        parsedDimensions = JSON.parse(dimensions)
      } catch (error) {
        return res.status(400).json({ message: 'Invalid dimensions format. Must be valid JSON.' })
      }
    }

    // Set up filters
    const filters = {
      startDate,
      endDate,
      dimensions: parsedDimensions
    }

    // Set up options
    const options = {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      sortBy,
      sortOrder
    }

    const result = await analyticsService.getMetricValues(metricName, filters, options)
    res.status(200).json(result)
  } catch (error) {
    console.error('Error getting metric values:', error)
    res.status(500).json({ message: 'Internal server error fetching metric values' })
  }
}

/**
 * Get aggregated metrics data
 */
export async function getAggregatedMetrics(req, res) {
  try {
    const { metricName } = req.params
    const { startDate, endDate, dimensions } = req.query

    // Parse dimensions if provided
    let parsedDimensions = null
    if (dimensions) {
      try {
        parsedDimensions = JSON.parse(dimensions)
      } catch (error) {
        return res.status(400).json({ message: 'Invalid dimensions format. Must be valid JSON.' })
      }
    }

    // Set up filters
    const filters = {
      startDate,
      endDate,
      dimensions: parsedDimensions
    }

    const result = await analyticsService.getAggregatedMetrics(metricName, filters)
    res.status(200).json(result)
  } catch (error) {
    console.error('Error getting aggregated metrics:', error)
    res.status(500).json({ message: 'Internal server error fetching aggregated metrics' })
  }
}

/**
 * Trigger calculation of product mapping coverage metric
 */
export async function calculateProductCoverage(req, res) {
  try {
    const { productId } = req.query
    
    const result = await analyticsService.calculateProductMappingCoverage(productId || null)
    
    if (!result) {
      return res.status(500).json({ message: 'Failed to calculate product mapping coverage' })
    }
    
    res.status(200).json(result)
  } catch (error) {
    console.error('Error calculating product coverage:', error)
    res.status(500).json({ message: 'Internal server error calculating product coverage' })
  }
}

/**
 * Trigger calculation of lead conversion rate metric
 */
export async function calculateLeadConversion(req, res) {
  try {
    const { status, startDate, endDate } = req.query
    
    const filters = {
      status,
      startDate,
      endDate
    }
    
    const result = await analyticsService.calculateLeadConversionRate(filters)
    
    if (!result) {
      return res.status(500).json({ message: 'Failed to calculate lead conversion rate' })
    }
    
    res.status(200).json(result)
  } catch (error) {
    console.error('Error calculating lead conversion:', error)
    res.status(500).json({ message: 'Internal server error calculating lead conversion' })
  }
}

/**
 * Trigger calculation of time-to-lead metric
 */
export async function calculateTimeToLead(req, res) {
  try {
    const { leadId, applicationId } = req.params
    
    if (!leadId) {
      return res.status(400).json({ message: 'Lead ID is required' })
    }
    
    const result = await analyticsService.calculateTimeToLead(leadId, applicationId)
    
    if (!result) {
      return res.status(500).json({ message: 'Failed to calculate time-to-lead metric' })
    }
    
    res.status(200).json(result)
  } catch (error) {
    console.error('Error calculating time-to-lead:', error)
    res.status(500).json({ message: 'Internal server error calculating time-to-lead' })
  }
}

/**
 * Trigger aggregation of metrics for a specific time period
 */
export async function aggregateMetrics(req, res) {
  try {
    const { metricName } = req.params
    const { dimensions, startDate, endDate } = req.body
    
    if (!metricName) {
      return res.status(400).json({ message: 'Metric name is required' })
    }
    
    if (!startDate || !endDate) {
      return res.status(400).json({ message: 'Start date and end date are required' })
    }
    
    const result = await analyticsService.aggregateMetrics(metricName, dimensions, startDate, endDate)
    
    res.status(200).json(result)
  } catch (error) {
    console.error('Error aggregating metrics:', error)
    res.status(500).json({ message: 'Internal server error aggregating metrics' })
  }
}

/**
 * Get user activity logs
 */
export async function getActivityLogs(req, res) {
  try {
    const { 
      userId, 
      action, 
      resourceType, 
      resourceId, 
      startDate, 
      endDate, 
      page = 1, 
      limit = 50, 
      sortBy = 'timestamp', 
      sortOrder = 'desc' 
    } = req.query
    
    // Set up filters
    const filters = {
      userId,
      action,
      resourceType,
      resourceId,
      startDate,
      endDate
    }
    
    // Set up options
    const options = {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      sortBy,
      sortOrder
    }
    
    const result = await activityLogService.getActivityLogs(filters, options)
    res.status(200).json(result)
  } catch (error) {
    console.error('Error getting activity logs:', error)
    res.status(500).json({ message: 'Internal server error fetching activity logs' })
  }
}

/**
 * Get user activity summary
 */
export async function getUserActivitySummary(req, res) {
  try {
    const { userId } = req.params
    const { period = 'week' } = req.query
    
    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' })
    }
    
    const result = await activityLogService.getUserActivitySummary(userId, period)
    res.status(200).json(result)
  } catch (error) {
    console.error('Error getting user activity summary:', error)
    res.status(500).json({ message: 'Internal server error fetching user activity summary' })
  }
}

/**
 * Get dashboard overview with key metrics
 */
export async function getDashboardOverview(req, res) {
  try {
    // Calculate end date (today)
    const endDate = new Date().toISOString().split('T')[0]
    
    // Calculate start date (30 days ago)
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - 30)
    const startDateStr = startDate.toISOString().split('T')[0]
    
    // Get lead conversion rate
    let conversionRate = null
    try {
      const conversionResult = await analyticsService.calculateLeadConversionRate({
        startDate: startDateStr,
        endDate
      })
      conversionRate = conversionResult?.value || 0
    } catch (error) {
      console.error('Error getting conversion rate:', error)
    }
    
    // Get product mapping coverage
    let productCoverage = null
    try {
      const coverageResult = await analyticsService.calculateProductMappingCoverage()
      productCoverage = coverageResult?.value || 0
    } catch (error) {
      console.error('Error getting product coverage:', error)
    }
    
    // Get recent metrics
    let recentMetrics = []
    try {
      const metricsResult = await analyticsService.getMetricValues('lead_conversion_rate', {
        startDate: startDateStr,
        endDate
      }, { limit: 5 })
      recentMetrics = metricsResult?.data || []
    } catch (error) {
      console.error('Error getting recent metrics:', error)
    }
    
    // Get recent activities
    let recentActivities = []
    try {
      const activitiesResult = await activityLogService.getActivityLogs({
        startDate: startDateStr,
        endDate
      }, { limit: 5 })
      recentActivities = activitiesResult?.data || []
    } catch (error) {
      console.error('Error getting recent activities:', error)
    }
    
    // Build and return dashboard data
    res.status(200).json({
      overview: {
        leadConversionRate: conversionRate,
        productMappingCoverage: productCoverage,
        period: `${startDateStr} to ${endDate}`
      },
      recentMetrics,
      recentActivities
    })
  } catch (error) {
    console.error('Error getting dashboard overview:', error)
    res.status(500).json({ message: 'Internal server error fetching dashboard overview' })
  }
} 