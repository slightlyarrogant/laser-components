import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

/**
 * Service for tracking user activities
 */
class ActivityLogService {
  /**
   * Log a user activity
   * @param {number} userId - User ID (required)
   * @param {string} action - Action performed (e.g., 'login', 'create_lead')
   * @param {string} resourceType - Type of resource (e.g., 'lead', 'product')
   * @param {string} resourceId - ID of the resource (optional)
   * @param {Object} details - Additional details (optional)
   * @param {Object} req - Express request object for IP and user agent (optional)
   * @returns {Promise<Object>} Created activity log
   */
  async logActivity(userId, action, resourceType, resourceId = null, details = null, req = null) {
    try {
      // Extract IP address and user agent from request if provided
      const ipAddress = req?.ip || req?.headers?.['x-forwarded-for'] || null
      const userAgent = req?.headers?.['user-agent'] || null
      
      const activityLog = await prisma.activityLog.create({
        data: {
          userId,
          action,
          resourceType,
          resourceId: resourceId ? String(resourceId) : null,
          ipAddress,
          userAgent,
          details
        }
      })
      
      return activityLog
    } catch (error) {
      console.error('Error logging activity:', error)
      // Don't throw - activity logging shouldn't break functionality
      return null
    }
  }

  /**
   * Get activity logs with filtering and pagination
   * @param {Object} [filters={}] - Filters (userId, resourceType, action, startDate, endDate, etc.)
   * @param {Object} [options={}] - Pagination/sorting (limit, page, sortBy, sortOrder)
   * @returns {Promise<Object>} Activity logs with pagination metadata
   */
  async getActivityLogs(filters = {}, options = {}) {
    // Provide default options for pagination and sorting if not passed
    const effectiveOptions = {
      limit: options.limit ?? 50, // Default limit
      page: options.page ?? 1,     // Default page
      sortBy: options.sortBy ?? 'timestamp', // Default sort field
      sortOrder: options.sortOrder ?? 'desc', // Default sort order
      skip: options.skip ?? (options.page ? (options.page - 1) * (options.limit ?? 50) : 0), // Calculate skip or default to 0
    };

    try {
      const whereClause = {};
      
      // Apply filters
      if (filters.userId) {
        whereClause.userId = Number(filters.userId);
      }
      if (filters.resourceType) {
        whereClause.resourceType = filters.resourceType;
      }
      if (filters.action) {
        whereClause.action = filters.action;
      }
      if (filters.ipAddress) {
        whereClause.ipAddress = filters.ipAddress;
      }
      if (filters.userAgent) {
        whereClause.userAgent = { contains: filters.userAgent, mode: 'insensitive' }; // Case-insensitive search
      }
      if (filters.resourceId) {
        whereClause.resourceId = String(filters.resourceId);
      }
      if (filters.startDate && filters.endDate) {
        whereClause.timestamp = {
          gte: new Date(filters.startDate),
          lte: new Date(filters.endDate)
        };
      }
      
      // Include user information
      const include = {
        user: {
          select: {
            id: true,
            email: true,
            role: true
          }
        }
      };
      
      // Get activity logs
      const logs = await prisma.activityLog.findMany({
        where: whereClause,
        include,
        orderBy: {
          [effectiveOptions.sortBy]: effectiveOptions.sortOrder
        },
        skip: effectiveOptions.skip, // Use calculated/defaulted skip
        take: effectiveOptions.limit // Use defaulted limit
      });
      
      // Count total
      const total = await prisma.activityLog.count({
        where: whereClause
      });
      
      return {
        data: logs,
        pagination: {
          page: effectiveOptions.page,
          limit: effectiveOptions.limit,
          total,
          totalPages: Math.ceil(total / effectiveOptions.limit)
        }
      };
    } catch (error) {
      console.error('Error getting activity logs:', error);
      throw error;
    }
  }

  /**
   * Get user activity summary
   * @param {number} userId - User ID
   * @param {string} period - Time period ('day', 'week', 'month')
   * @returns {Promise<Object>} Activity summary
   */
  async getUserActivitySummary(userId, period = 'week') {
    try {
      // Calculate date range based on period
      const now = new Date()
      let startDate

      switch (period) {
        case 'day':
          startDate = new Date(now)
          startDate.setHours(0, 0, 0, 0)
          break
        case 'week':
          startDate = new Date(now)
          startDate.setDate(now.getDate() - 7)
          break
        case 'month':
          startDate = new Date(now)
          startDate.setMonth(now.getMonth() - 1)
          break
        default:
          startDate = new Date(now)
          startDate.setHours(0, 0, 0, 0)
      }

      // Get activity count by resource type
      const activityByResourceType = await prisma.activityLog.groupBy({
        by: ['resourceType'],
        where: {
          userId: Number(userId),
          timestamp: {
            gte: startDate
          }
        },
        _count: {
          id: true
        }
      })

      // Get activity count by action
      const activityByAction = await prisma.activityLog.groupBy({
        by: ['action'],
        where: {
          userId: Number(userId),
          timestamp: {
            gte: startDate
          }
        },
        _count: {
          id: true
        }
      })

      // Get total activity count
      const totalActivities = await prisma.activityLog.count({
        where: {
          userId: Number(userId),
          timestamp: {
            gte: startDate
          }
        }
      })

      // Get most recent activity
      const mostRecentActivity = await prisma.activityLog.findFirst({
        where: {
          userId: Number(userId)
        },
        orderBy: {
          timestamp: 'desc'
        }
      })

      return {
        userId: Number(userId),
        period,
        totalActivities,
        activityByResourceType: activityByResourceType.map(item => ({
          resourceType: item.resourceType,
          count: item._count.id
        })),
        activityByAction: activityByAction.map(item => ({
          action: item.action,
          count: item._count.id
        })),
        mostRecentActivity: mostRecentActivity ? {
          id: mostRecentActivity.id,
          action: mostRecentActivity.action,
          resourceType: mostRecentActivity.resourceType,
          timestamp: mostRecentActivity.timestamp
        } : null
      }
    } catch (error) {
      console.error('Error getting user activity summary:', error)
      throw error
    }
  }

  /**
   * Delete activity logs that are older than the specified retention period
   * @param {number} days - Retention period in days
   * @returns {Promise<number>} Number of deleted logs
   */
  async purgeOldActivityLogs(days = 90) {
    try {
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - days)
      
      const { count } = await prisma.activityLog.deleteMany({
        where: {
          timestamp: {
            lt: cutoffDate
          }
        }
      })
      
      return count
    } catch (error) {
      console.error('Error purging old activity logs:', error)
      throw error
    }
  }
}

export default new ActivityLogService() 