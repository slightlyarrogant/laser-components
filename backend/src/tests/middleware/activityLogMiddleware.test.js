import { logActivity } from '../../middleware/activityLogMiddleware';
import activityLogService from '../../services/analytics/activityLogService';

// Mock the activity log service
jest.mock('../../services/analytics/activityLogService', () => ({
  logActivity: jest.fn()
}));

describe('Activity Log Middleware', () => {
  let req, res, next;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock request, response, and next function
    req = {
      user: { id: 1, email: 'test@example.com' },
      method: 'GET',
      path: '/api/leads/123',
      params: { id: '123' },
      body: { name: 'Test Lead' },
      ip: '127.0.0.1',
      headers: {
        'user-agent': 'Mozilla/5.0 Test'
      }
    };
    
    res = {
      statusCode: 200,
      json: jest.fn((data) => {
        res.body = data;
        return res;
      })
    };
    
    next = jest.fn();
  });
  
  test('creates middleware function', () => {
    const middleware = logActivity('view', 'lead', 'id');
    expect(typeof middleware).toBe('function');
  });
  
  test('passes request to next middleware', () => {
    const middleware = logActivity('view', 'lead', 'id');
    middleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });
  
  test('logs activity on successful response', async () => {
    // Create middleware
    const middleware = logActivity('view', 'lead', 'id');
    
    // Call middleware
    middleware(req, res, next);
    
    // Simulate successful response
    res.json({ id: 123, name: 'Test Lead' });
    
    // Expect activity to be logged
    expect(activityLogService.logActivity).toHaveBeenCalledWith(
      req.user.id,
      'view',
      'lead',
      '123',
      null,
      req
    );
  });
  
  test('extracts resource ID using string path parameter', async () => {
    const middleware = logActivity('view', 'lead', 'id');
    middleware(req, res, next);
    res.json({});
    
    expect(activityLogService.logActivity).toHaveBeenCalledWith(
      expect.any(Number),
      expect.any(String),
      expect.any(String),
      '123', // Extracted from req.params.id
      null,
      expect.any(Object)
    );
  });
  
  test('extracts resource ID using function', async () => {
    const idExtractor = (req) => req.params.id + '-custom';
    const middleware = logActivity('view', 'lead', idExtractor);
    middleware(req, res, next);
    res.json({});
    
    expect(activityLogService.logActivity).toHaveBeenCalledWith(
      expect.any(Number),
      expect.any(String),
      expect.any(String),
      '123-custom', // Custom ID from extractor function
      null,
      expect.any(Object)
    );
  });
  
  test('extracts details using function', async () => {
    const detailsExtractor = (req, res) => ({ 
      status: res.statusCode,
      responseData: res.body
    });
    
    const middleware = logActivity('view', 'lead', 'id', detailsExtractor);
    middleware(req, res, next);
    
    const responseData = { id: 123, name: 'Test Lead' };
    res.json(responseData);
    
    expect(activityLogService.logActivity).toHaveBeenCalledWith(
      expect.any(Number),
      expect.any(String),
      expect.any(String),
      expect.any(String),
      { status: 200, responseData }, // Details from extractor
      expect.any(Object)
    );
  });
  
  test('handles errors in logging gracefully', async () => {
    activityLogService.logActivity.mockRejectedValue(new Error('Logging error'));
    
    // Create middleware that will throw an error during logging
    const middleware = logActivity('view', 'lead', 'id');
    
    // Should not crash the application
    middleware(req, res, next);
    res.json({});
    
    // Errors should be caught
    expect(activityLogService.logActivity).toHaveBeenCalled();
    // Note: We can't easily test console.error in jest
  });
  
  test('skips logging for non-success status codes', async () => {
    const middleware = logActivity('view', 'lead', 'id');
    middleware(req, res, next);
    
    // Override status code to indicate failure
    res.statusCode = 404;
    res.json({ error: 'Not found' });
    
    // No logging should occur for non-2xx status codes
    expect(activityLogService.logActivity).not.toHaveBeenCalled();
  });
  
  test('works with custom success status code range', async () => {
    const middleware = logActivity('view', 'lead', 'id', null, { successCodes: [201] });
    middleware(req, res, next);
    
    // Set a status code that's not in the default success range but in our custom range
    res.statusCode = 201;
    res.json({ message: 'Created' });
    
    // Should log because 201 is in our custom success codes
    expect(activityLogService.logActivity).toHaveBeenCalled();
  });
}); 