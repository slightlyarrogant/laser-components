import axios from 'axios';
import analyticsService, {
  getDashboardOverview,
  getMetricValues,
  getAggregatedMetrics,
  calculateProductCoverage,
  calculateLeadConversion,
  getActivityLogs,
  getUserActivitySummary,
  formatDate,
  generateColorScale
} from '../../services/analyticsService';

// Mock axios
jest.mock('axios');

describe('Analytics Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  describe('getDashboardOverview', () => {
    test('fetches dashboard overview data', async () => {
      const mockData = {
        overview: {
          productMappingCoverage: 75.5,
          leadConversionRate: 24.8
        },
        recentActivity: [
          { id: 1, action: 'create', timestamp: new Date().toISOString() }
        ]
      };
      
      axios.get.mockResolvedValue({ data: mockData });
      
      const result = await getDashboardOverview();
      
      expect(axios.get).toHaveBeenCalledWith('/api/analytics/dashboard');
      expect(result).toEqual(mockData);
    });
    
    test('handles error when fetching dashboard data', async () => {
      const error = new Error('API error');
      axios.get.mockRejectedValue(error);
      
      await expect(getDashboardOverview()).rejects.toThrow();
    });
  });
  
  describe('getMetricValues', () => {
    test('fetches metric values with filters and options', async () => {
      const mockData = {
        data: [
          { id: 1, timestamp: new Date().toISOString(), value: 25 }
        ],
        pagination: { page: 1, limit: 10, total: 1 }
      };
      
      axios.get.mockResolvedValue({ data: mockData });
      
      const filters = {
        startDate: '2023-01-01',
        endDate: '2023-12-31',
        dimensions: { source: 'web' }
      };
      
      const options = {
        page: 1,
        limit: 10,
        sortBy: 'timestamp',
        sortOrder: 'desc'
      };
      
      const result = await getMetricValues('lead_conversion', filters, options);
      
      expect(axios.get).toHaveBeenCalledWith('/api/analytics/metrics/lead_conversion', {
        params: expect.objectContaining({
          startDate: filters.startDate,
          endDate: filters.endDate,
          dimensions: JSON.stringify(filters.dimensions),
          page: options.page,
          limit: options.limit,
          sortBy: options.sortBy,
          sortOrder: options.sortOrder
        })
      });
      
      expect(result).toEqual(mockData);
    });
  });
  
  describe('getAggregatedMetrics', () => {
    test('fetches aggregated metrics data', async () => {
      const mockData = [
        { source: 'web', avg: 25, count: 10 },
        { source: 'mobile', avg: 30, count: 5 }
      ];
      
      axios.get.mockResolvedValue({ data: mockData });
      
      const filters = {
        startDate: '2023-01-01',
        endDate: '2023-12-31',
        dimensions: { source: 'web' }
      };
      
      const result = await getAggregatedMetrics('lead_conversion', filters);
      
      expect(axios.get).toHaveBeenCalledWith('/api/analytics/metrics/lead_conversion/aggregated', {
        params: expect.objectContaining({
          startDate: filters.startDate,
          endDate: filters.endDate,
          dimensions: JSON.stringify(filters.dimensions)
        })
      });
      
      expect(result).toEqual(mockData);
    });
  });
  
  describe('calculateProductCoverage', () => {
    test('calculates product coverage', async () => {
      const mockData = {
        overallCoverage: 75.5,
        coverageByCategory: [
          { category: 'Lasers', coverage: 85.2 },
          { category: 'Optics', coverage: 65.8 }
        ]
      };
      
      axios.post.mockResolvedValue({ data: mockData });
      
      const result = await calculateProductCoverage();
      
      expect(axios.post).toHaveBeenCalledWith('/api/analytics/calculate/product-coverage', null, { params: {} });
      expect(result).toEqual(mockData);
    });
    
    test('calculates product coverage for specific product', async () => {
      const mockData = { overallCoverage: 80.0 };
      axios.post.mockResolvedValue({ data: mockData });
      
      const result = await calculateProductCoverage('123');
      
      expect(axios.post).toHaveBeenCalledWith('/api/analytics/calculate/product-coverage', null, { 
        params: { productId: '123' } 
      });
      expect(result).toEqual(mockData);
    });
  });
  
  describe('getActivityLogs', () => {
    test('fetches activity logs with filters and pagination', async () => {
      const mockData = {
        data: [
          { id: 1, action: 'create', resourceType: 'lead', timestamp: new Date().toISOString() }
        ],
        pagination: { page: 1, limit: 10, total: 1 }
      };
      
      axios.get.mockResolvedValue({ data: mockData });
      
      const filters = {
        userId: 1,
        action: 'create',
        resourceType: 'lead'
      };
      
      const options = {
        page: 1,
        limit: 10
      };
      
      const result = await getActivityLogs(filters, options);
      
      expect(axios.get).toHaveBeenCalledWith('/api/analytics/activity-logs', {
        params: expect.objectContaining({
          userId: filters.userId,
          action: filters.action,
          resourceType: filters.resourceType,
          page: options.page,
          limit: options.limit
        })
      });
      
      expect(result).toEqual(mockData);
    });
  });
  
  describe('getUserActivitySummary', () => {
    test('fetches current user activity summary', async () => {
      const mockData = [
        { action: 'create', count: 10 },
        { action: 'update', count: 5 }
      ];
      
      axios.get.mockResolvedValue({ data: mockData });
      
      const result = await getUserActivitySummary('me', 'week');
      
      expect(axios.get).toHaveBeenCalledWith('/api/analytics/my-activity', {
        params: { period: 'week' }
      });
      
      expect(result).toEqual(mockData);
    });
    
    test('fetches specific user activity summary', async () => {
      const mockData = [
        { action: 'create', count: 10 },
        { action: 'update', count: 5 }
      ];
      
      axios.get.mockResolvedValue({ data: mockData });
      
      const result = await getUserActivitySummary('123', 'month');
      
      expect(axios.get).toHaveBeenCalledWith('/api/analytics/activity-logs/user/123', {
        params: { period: 'month' }
      });
      
      expect(result).toEqual(mockData);
    });
  });
  
  describe('formatDate', () => {
    test('formats date in short format', () => {
      const isoString = '2023-05-15T10:00:00Z';
      const result = formatDate(isoString, 'short');
      expect(typeof result).toBe('string');
    });
    
    test('formats date in long format', () => {
      const isoString = '2023-05-15T10:00:00Z';
      const result = formatDate(isoString, 'long');
      expect(typeof result).toBe('string');
    });
    
    test('handles empty input', () => {
      const result = formatDate('');
      expect(result).toBe('');
    });
  });
  
  describe('generateColorScale', () => {
    test('generates specified number of colors', () => {
      const colors = generateColorScale(5);
      expect(colors).toHaveLength(5);
      colors.forEach(color => {
        expect(typeof color).toBe('string');
      });
    });
    
    test('generates more colors than base set', () => {
      const colors = generateColorScale(15);
      expect(colors).toHaveLength(15);
    });
  });
}); 