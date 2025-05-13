import ActivityLogService from '../../services/analytics/activityLogService';
import { PrismaClient } from '@prisma/client';

// Mock PrismaClient
jest.mock('@prisma/client', () => {
  return {
    PrismaClient: jest.fn().mockImplementation(() => ({
      activity: {
        create: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        groupBy: jest.fn()
      },
      user: {
        findUnique: jest.fn()
      },
      $transaction: jest.fn((callback) => callback())
    }))
  };
});

describe('Activity Log Service', () => {
  let activityLogService;
  let mockPrisma;
  
  beforeEach(() => {
    jest.clearAllMocks();
    activityLogService = new ActivityLogService();
    mockPrisma = new PrismaClient();
  });
  
  describe('logActivity', () => {
    test('successfully logs an activity', async () => {
      const activityData = {
        userId: 1,
        action: 'create',
        resourceType: 'lead',
        resourceId: '123',
        details: { name: 'Test Lead' }
      };
      
      const mockReq = {
        ip: '127.0.0.1',
        headers: {
          'user-agent': 'Mozilla/5.0 Test'
        }
      };
      
      mockPrisma.activity.create.mockResolvedValue({
        id: 1,
        user_id: activityData.userId,
        action: activityData.action,
        resource_type: activityData.resourceType,
        resource_id: activityData.resourceId,
        details: JSON.stringify(activityData.details),
        ip_address: mockReq.ip,
        user_agent: mockReq.headers['user-agent'],
        timestamp: new Date()
      });
      
      const result = await activityLogService.logActivity(
        activityData.userId,
        activityData.action,
        activityData.resourceType,
        activityData.resourceId,
        activityData.details,
        mockReq
      );
      
      expect(mockPrisma.activity.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          user_id: activityData.userId,
          action: activityData.action,
          resource_type: activityData.resourceType,
          resource_id: activityData.resourceId,
          details: expect.any(String), // JSON stringified
          ip_address: mockReq.ip,
          user_agent: mockReq.headers['user-agent']
        })
      });
      
      expect(result).toBeDefined();
      expect(result.id).toBe(1);
    });
    
    test('logs activity without request information', async () => {
      mockPrisma.activity.create.mockResolvedValue({
        id: 1,
        user_id: 1,
        action: 'create',
        resource_type: 'lead',
        timestamp: new Date()
      });
      
      const result = await activityLogService.logActivity(1, 'create', 'lead');
      
      expect(mockPrisma.activity.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          user_id: 1,
          action: 'create',
          resource_type: 'lead',
          ip_address: null,
          user_agent: null
        })
      });
      
      expect(result).toBeDefined();
      expect(result.id).toBe(1);
    });
    
    test('handles error when logging activity', async () => {
      const error = new Error('Database error');
      mockPrisma.activity.create.mockRejectedValue(error);
      
      await expect(activityLogService.logActivity(1, 'create', 'lead')).rejects.toThrow();
    });
  });
  
  describe('getActivityLogs', () => {
    test('returns activity logs with pagination', async () => {
      const mockLogs = [
        { 
          id: 1,
          user_id: 1,
          action: 'create',
          resource_type: 'lead',
          timestamp: new Date() 
        },
        { 
          id: 2,
          user_id: 2,
          action: 'update',
          resource_type: 'product',
          timestamp: new Date() 
        }
      ];
      
      mockPrisma.activity.findMany.mockResolvedValue(mockLogs);
      mockPrisma.activity.count.mockResolvedValue(2);
      
      const result = await activityLogService.getActivityLogs({}, { page: 1, limit: 10 });
      
      expect(mockPrisma.activity.findMany).toHaveBeenCalled();
      expect(result.data).toEqual(mockLogs);
      expect(result.pagination).toBeDefined();
      expect(result.pagination.total).toBe(2);
    });
    
    test('applies filters correctly', async () => {
      mockPrisma.activity.findMany.mockResolvedValue([]);
      mockPrisma.activity.count.mockResolvedValue(0);
      
      const filters = {
        userId: 1,
        action: 'create',
        resourceType: 'lead',
        startDate: '2023-01-01',
        endDate: '2023-12-31'
      };
      
      await activityLogService.getActivityLogs(filters, { page: 1, limit: 10 });
      
      expect(mockPrisma.activity.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({
          user_id: filters.userId,
          action: filters.action,
          resource_type: filters.resourceType,
          timestamp: {
            gte: expect.any(Date),
            lte: expect.any(Date)
          }
        })
      }));
    });
  });
  
  describe('getUserActivitySummary', () => {
    test('returns user activity summary for specific period', async () => {
      const mockSummary = [
        { action: 'create', _count: { id: 10 } },
        { action: 'update', _count: { id: 5 } },
        { action: 'delete', _count: { id: 2 } }
      ];
      
      mockPrisma.activity.groupBy.mockResolvedValue(mockSummary);
      
      const result = await activityLogService.getUserActivitySummary(1, 'week');
      
      expect(mockPrisma.activity.groupBy).toHaveBeenCalled();
      expect(result).toEqual([
        { action: 'create', count: 10 },
        { action: 'update', count: 5 },
        { action: 'delete', count: 2 }
      ]);
    });
    
    test('handles error when getting user activity summary', async () => {
      const error = new Error('Database error');
      mockPrisma.activity.groupBy.mockRejectedValue(error);
      
      await expect(activityLogService.getUserActivitySummary(1, 'week')).rejects.toThrow();
    });
  });
}); 