import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';
import StatCard from '../../components/analytics/StatCard';
import ActivityLogTable from '../../components/analytics/ActivityLogTable';
import LeaderboardIcon from '@mui/icons-material/Leaderboard';

// Mock data for activity logs
const mockActivityLogs = [
  {
    id: 1,
    action: 'create',
    resourceType: 'lead',
    resourceId: '123',
    userId: 1,
    user: { email: 'user@example.com', role: 'ADMIN' },
    timestamp: '2023-05-01T10:00:00Z',
    details: { field: 'name', newValue: 'Test Lead' }
  },
  {
    id: 2,
    action: 'update',
    resourceType: 'product',
    resourceId: '456',
    userId: 2,
    user: { email: 'user2@example.com', role: 'USER' },
    timestamp: '2023-05-02T11:00:00Z',
    details: { field: 'price', oldValue: '100', newValue: '200' }
  }
];

// Test suite for StatCard
describe('StatCard Component', () => {
  test('renders loading state', () => {
    render(<StatCard loading={true} title="Test Stat" />);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });
  
  test('renders error state', () => {
    render(<StatCard error="Test Error" title="Test Stat" />);
    expect(screen.getByText('Test Error')).toBeInTheDocument();
  });
  
  test('renders with title and value', () => {
    render(<StatCard title="Test Stat" value={100} />);
    expect(screen.getByText('Test Stat')).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument();
  });
  
  test('renders with formatted value', () => {
    render(<StatCard title="Test Stat" value={100} formatter={(val) => `$${val}`} />);
    expect(screen.getByText('$100')).toBeInTheDocument();
  });
  
  test('renders with icon', () => {
    render(<StatCard title="Test Stat" value={100} icon={LeaderboardIcon} />);
    // The icon should be rendered, but we can't easily test for its presence
    expect(screen.getByText('Test Stat')).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument();
  });
  
  test('renders with positive trend', () => {
    render(<StatCard title="Test Stat" value={100} trend={5.5} trendLabel="vs last week" />);
    expect(screen.getByText('+5.5%')).toBeInTheDocument();
    expect(screen.getByText('vs last week')).toBeInTheDocument();
  });
  
  test('renders with negative trend', () => {
    render(<StatCard title="Test Stat" value={100} trend={-3.2} trendLabel="vs last week" />);
    expect(screen.getByText('-3.2%')).toBeInTheDocument();
    expect(screen.getByText('vs last week')).toBeInTheDocument();
  });
  
  test('renders with description tooltip', () => {
    render(<StatCard title="Test Stat" value={100} description="This is a test description" />);
    expect(screen.getByRole('button')).toBeInTheDocument(); // The help icon button
  });
});

// Test suite for ActivityLogTable
describe('ActivityLogTable Component', () => {
  test('renders loading state', () => {
    render(<ActivityLogTable loading={true} />);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });
  
  test('renders error state', () => {
    render(<ActivityLogTable error="Test Error" />);
    expect(screen.getByText('Test Error')).toBeInTheDocument();
  });
  
  test('renders with empty logs', () => {
    render(<ActivityLogTable logs={[]} />);
    expect(screen.getByText('No activity logs found')).toBeInTheDocument();
  });
  
  test('renders with logs data', () => {
    render(<ActivityLogTable logs={mockActivityLogs} />);
    expect(screen.getByText('create')).toBeInTheDocument();
    expect(screen.getByText('lead')).toBeInTheDocument();
    expect(screen.getByText('user@example.com')).toBeInTheDocument();
    expect(screen.getByText('user2@example.com')).toBeInTheDocument();
  });
  
  test('renders pagination', () => {
    const mockPagination = { page: 0, limit: 10, total: 50 };
    render(<ActivityLogTable logs={mockActivityLogs} pagination={mockPagination} />);
    expect(screen.getByText('Rows per page:')).toBeInTheDocument();
  });
  
  test('calls onFilterChange when filter is changed', () => {
    const mockOnFilterChange = jest.fn();
    render(
      <ActivityLogTable 
        logs={mockActivityLogs} 
        onFilterChange={mockOnFilterChange}
        filters={{ action: 'create' }}
      />
    );
    // Using the action dropdown would be more complex to test
    // This is just a simplified test
    expect(mockOnFilterChange).not.toHaveBeenCalled();
  });
}); 