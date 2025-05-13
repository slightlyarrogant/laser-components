import AnalyticsService from '../../services/analytics/analyticsService';
import { PrismaClient } from '@prisma/client';

// Mock PrismaClient
jest.mock('@prisma/client', () => {
  return {
    PrismaClient: jest.fn().mockImplementation(() => ({
      analyticsEvent: {
        create: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        groupBy: jest.fn()
      },
      metric: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn()
      },
      $transaction: jest.fn((callback) => callback()),
      activity: {
        create: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn()
      }
    }))
  };
});

describe('Analytics Service', () => {
  let analyticsService;
  let mockPrisma;
  
  beforeEach(() => {
    jest.clearAllMocks();
    analyticsService = new AnalyticsService();
    mockPrisma = new PrismaClient();
  });
  
  describe('recordEvent', () => {
    test('successfully records an event', async () => {
      const eventData = {
        eventType: 'lead_created',
        category: 'lead',
        action: 'create',
        entityId: '123',
        metadata: { name: 'Test Lead' },
        userId: 1
      };
      
      mockPrisma.analyticsEvent.create.mockResolvedValue({
        id: 1,
        ...eventData,
        timestamp: new Date()
      });
      
      const result = await analyticsService.recordEvent(
        eventData.eventType,
        eventData.category,
        eventData.action,
        eventData.entityId,
        eventData.metadata,
        eventData.userId
      );
      
      expect(mockPrisma.analyticsEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          event_type: eventData.eventType,
          category: eventData.category,
          action: eventData.action,
          entity_id: eventData.entityId,
          metadata: expect.any(String), // JSON stringified
          user_id: eventData.userId
        })
      });
      
      expect(result).toBeDefined();
      expect(result.id).toBe(1);
    });
    
    test('handles error when recording event', async () => {
      const error = new Error('Database error');
      mockPrisma.analyticsEvent.create.mockRejectedValue(error);
      
      await expect(analyticsService.recordEvent('test', 'test', 'test', '123')).rejects.toThrow();
    });
  });
  
  describe('getMetricValues', () => {
    test('returns metric values with pagination', async () => {
      const mockMetricValues = [
        { id: 1, metric_name: 'lead_conversion', value: 25, timestamp: new Date() },
        { id: 2, metric_name: 'lead_conversion', value: 30, timestamp: new Date() }
      ];
      
      mockPrisma.metric.findMany.mockResolvedValue(mockMetricValues);
      mockPrisma.metric.count.mockResolvedValue(2);
      
      const result = await analyticsService.getMetricValues('lead_conversion', {}, { page: 1, limit: 10 });
      
      expect(mockPrisma.metric.findMany).toHaveBeenCalled();
      expect(result.data).toEqual(mockMetricValues);
      expect(result.pagination).toBeDefined();
      expect(result.pagination.total).toBe(2);
    });
    
    test('applies filters correctly', async () => {
      mockPrisma.metric.findMany.mockResolvedValue([]);
      mockPrisma.metric.count.mockResolvedValue(0);
      
      const filters = {
        startDate: '2023-01-01',
        endDate: '2023-12-31',
        dimensions: { source: 'web' }
      };
      
      await analyticsService.getMetricValues('lead_conversion', filters, { page: 1, limit: 10 });
      
      expect(mockPrisma.metric.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({
          metric_name: 'lead_conversion',
          timestamp: {
            gte: expect.any(Date),
            lte: expect.any(Date)
          },
          dimensions: expect.any(Object)
        })
      }));
    });
  });
  
  describe('aggregateMetrics', () => {
    test('aggregates metrics by dimension', async () => {
      const mockAggregation = [
        { source: 'web', _avg: { value: 25 }, _count: { value: 10 } },
        { source: 'mobile', _avg: { value: 30 }, _count: { value: 5 } }
      ];
      
      mockPrisma.metric.groupBy.mockResolvedValue(mockAggregation);
      
      const result = await analyticsService.aggregateMetrics('lead_conversion', 'source');
      
      expect(mockPrisma.metric.groupBy).toHaveBeenCalled();
      expect(result).toEqual([
        { source: 'web', avg: 25, count: 10 },
        { source: 'mobile', avg: 30, count: 5 }
      ]);
    });
  });
  
  describe('calculateMetric', () => {
    test('calculates and stores a new metric', async () => {
      const metricData = {
        name: 'lead_conversion',
        value: 25,
        dimensions: { source: 'web' }
      };
      
      mockPrisma.metric.create.mockResolvedValue({
        id: 1,
        metric_name: metricData.name,
        value: metricData.value,
        dimensions: metricData.dimensions,
        timestamp: new Date()
      });
      
      const result = await analyticsService.calculateMetric(
        metricData.name,
        metricData.value,
        metricData.dimensions
      );
      
      expect(mockPrisma.metric.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          metric_name: metricData.name,
          value: metricData.value,
          dimensions: expect.any(String) // JSON stringified
        })
      });
      
      expect(result).toBeDefined();
      expect(result.id).toBe(1);
    });
  });
}); 