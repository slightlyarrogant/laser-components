import {
  getMetricValues,
  getAggregatedMetrics,
  calculateProductCoverage,
  calculateLeadConversion,
  getActivityLogs,
  getUserActivitySummary,
  getDashboardOverview
} from '../../controllers/analyticsController';
import analyticsService from '../../services/analytics/analyticsService';
import activityLogService from '../../services/analytics/activityLogService';

// Mock the services
jest.mock('../../services/analytics/analyticsService', () => ({
  getMetricValues: jest.fn(),
  aggregateMetrics: jest.fn(),
  calculateMetric: jest.fn(),
  calculateProductCoverage: jest.fn(),
  calculateLeadConversionRate: jest.fn(),
  calculateTimeToLead: jest.fn()
}));

jest.mock('../../services/analytics/activityLogService', () => ({
  getActivityLogs: jest.fn(),
  getUserActivitySummary: jest.fn()
}));

describe('Analytics Controller', () => {
  let req, res;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock request and response objects
    req = {
      params: {},
      query: {},
      user: { id: 1, email: 'test@example.com', role: 'ADMIN' }
    };
    
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
  });
  
  describe('getMetricValues', () => {
    test('successfully retrieves metric values', async () => {
      const mockResult = {
        data: [
          { id: 1, metric_name: 'lead_conversion', value: 25, timestamp: new Date() }
        ],
        pagination: { page: 1, pageSize: 10, total: 1 }
      };
      
      analyticsService.getMetricValues.mockResolvedValue(mockResult);
      
      req.params.metricName = 'lead_conversion';
      req.query = {
        startDate: '2023-01-01',
        endDate: '2023-12-31',
        page: '1',
        limit: '10',
        sortBy: 'timestamp',
        sortOrder: 'desc'
      };
      
      await getMetricValues(req, res);
      
      expect(analyticsService.getMetricValues).toHaveBeenCalledWith(
        'lead_conversion',
        expect.any(Object),
        expect.any(Object)
      );
      
      expect(res.json).toHaveBeenCalledWith(mockResult);
      expect(res.status).not.toHaveBeenCalled(); // Default 200 status
    });
    
    test('handles error when retrieving metrics', async () => {
      const error = new Error('Service error');
      analyticsService.getMetricValues.mockRejectedValue(error);
      
      req.params.metricName = 'lead_conversion';
      
      await getMetricValues(req, res);
      
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: 'Error retrieving metric values' });
    });
  });
  
  describe('getAggregatedMetrics', () => {
    test('successfully retrieves aggregated metrics', async () => {
      const mockResult = [
        { source: 'web', avg: 25, count: 10 },
        { source: 'mobile', avg: 30, count: 5 }
      ];
      
      analyticsService.aggregateMetrics.mockResolvedValue(mockResult);
      
      req.params.metricName = 'lead_conversion';
      req.query.dimension = 'source';
      
      await getAggregatedMetrics(req, res);
      
      expect(analyticsService.aggregateMetrics).toHaveBeenCalledWith(
        'lead_conversion',
        'source',
        expect.any(Object)
      );
      
      expect(res.json).toHaveBeenCalledWith(mockResult);
    });
    
    test('handles missing dimension parameter', async () => {
      req.params.metricName = 'lead_conversion';
      // No dimension in query
      
      await getAggregatedMetrics(req, res);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'Dimension parameter is required' });
    });
  });
  
  describe('calculateProductCoverage', () => {
    test('successfully calculates product coverage', async () => {
      const mockResult = {
        overallCoverage: 75.5,
        coverageByCategory: [
          { category: 'Lasers', coverage: 85.2 },
          { category: 'Optics', coverage: 65.8 }
        ]
      };
      
      analyticsService.calculateProductCoverage.mockResolvedValue(mockResult);
      
      await calculateProductCoverage(req, res);
      
      expect(analyticsService.calculateProductCoverage).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(mockResult);
    });
  });
  
  describe('getActivityLogs', () => {
    test('successfully retrieves activity logs', async () => {
      const mockResult = {
        data: [
          { id: 1, action: 'create', resourceType: 'lead', userId: 1, timestamp: new Date() }
        ],
        pagination: { page: 1, pageSize: 10, total: 1 }
      };
      
      activityLogService.getActivityLogs.mockResolvedValue(mockResult);
      
      req.query = {
        userId: '1',
        action: 'create',
        page: '1',
        limit: '10'
      };
      
      await getActivityLogs(req, res);
      
      expect(activityLogService.getActivityLogs).toHaveBeenCalledWith(
        expect.any(Object), // Filters
        expect.any(Object)  // Pagination
      );
      
      expect(res.json).toHaveBeenCalledWith(mockResult);
    });
  });
  
  describe('getUserActivitySummary', () => {
    test('gets activity summary for current user when userId is "me"', async () => {
      const mockResult = [
        { action: 'create', count: 10 },
        { action: 'update', count: 5 }
      ];
      
      activityLogService.getUserActivitySummary.mockResolvedValue(mockResult);
      
      req.params.userId = 'me';
      req.query.period = 'week';
      
      await getUserActivitySummary(req, res);
      
      expect(activityLogService.getUserActivitySummary).toHaveBeenCalledWith(
        1, // Current user ID from req.user
        'week'
      );
      
      expect(res.json).toHaveBeenCalledWith(mockResult);
    });
    
    test('gets activity summary for specific user', async () => {
      const mockResult = [
        { action: 'create', count: 10 },
        { action: 'update', count: 5 }
      ];
      
      activityLogService.getUserActivitySummary.mockResolvedValue(mockResult);
      
      req.params.userId = '2';
      req.query.period = 'month';
      
      await getUserActivitySummary(req, res);
      
      expect(activityLogService.getUserActivitySummary).toHaveBeenCalledWith(
        2, // Specified user ID
        'month'
      );
      
      expect(res.json).toHaveBeenCalledWith(mockResult);
    });
  });
  
  describe('getDashboardOverview', () => {
    test('successfully retrieves dashboard overview data', async () => {
      const mockProductCoverage = { overallCoverage: 75.5 };
      const mockLeadConversion = { rate: 24.8 };
      const mockRecentActivity = {
        data: [{ id: 1, action: 'create', timestamp: new Date() }],
        pagination: { total: 1 }
      };
      
      analyticsService.calculateProductCoverage.mockResolvedValue(mockProductCoverage);
      analyticsService.calculateLeadConversionRate.mockResolvedValue(mockLeadConversion);
      activityLogService.getActivityLogs.mockResolvedValue(mockRecentActivity);
      
      await getDashboardOverview(req, res);
      
      expect(res.json).toHaveBeenCalledWith({
        overview: {
          productMappingCoverage: mockProductCoverage.overallCoverage,
          leadConversionRate: mockLeadConversion.rate
        },
        recentActivity: mockRecentActivity.data
      });
    });
    
    test('handles error in dashboard overview', async () => {
      const error = new Error('Service error');
      analyticsService.calculateProductCoverage.mockRejectedValue(error);
      
      await getDashboardOverview(req, res);
      
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: 'Error retrieving dashboard overview data' });
    });
  });
}); 