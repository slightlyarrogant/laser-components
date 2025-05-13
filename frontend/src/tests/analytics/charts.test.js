import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';
import { LineChart, BarChart, PieChart } from '../../components/analytics/charts';

// Mock data for charts
const mockLineData = [
  { timestamp: '2023-01-01', value: 10 },
  { timestamp: '2023-02-01', value: 20 },
  { timestamp: '2023-03-01', value: 15 },
  { timestamp: '2023-04-01', value: 30 },
];

const mockBarData = [
  { name: 'Category 1', value: 40 },
  { name: 'Category 2', value: 30 },
  { name: 'Category 3', value: 20 },
  { name: 'Category 4', value: 10 },
];

const mockPieData = [
  { name: 'Group A', value: 400 },
  { name: 'Group B', value: 300 },
  { name: 'Group C', value: 200 },
  { name: 'Group D', value: 100 },
];

// Test suite for LineChart
describe('LineChart Component', () => {
  test('renders loading state', () => {
    render(<LineChart loading={true} />);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });
  
  test('renders error state', () => {
    render(<LineChart error="Test Error" />);
    expect(screen.getByText('Test Error')).toBeInTheDocument();
  });
  
  test('renders empty state', () => {
    render(<LineChart data={[]} />);
    expect(screen.getByText('No data available')).toBeInTheDocument();
  });
  
  test('renders with title', () => {
    render(<LineChart data={mockLineData} title="Test Line Chart" />);
    expect(screen.getByText('Test Line Chart')).toBeInTheDocument();
  });
});

// Test suite for BarChart
describe('BarChart Component', () => {
  test('renders loading state', () => {
    render(<BarChart loading={true} />);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });
  
  test('renders error state', () => {
    render(<BarChart error="Test Error" />);
    expect(screen.getByText('Test Error')).toBeInTheDocument();
  });
  
  test('renders empty state', () => {
    render(<BarChart data={[]} />);
    expect(screen.getByText('No data available')).toBeInTheDocument();
  });
  
  test('renders with title', () => {
    render(<BarChart data={mockBarData} title="Test Bar Chart" />);
    expect(screen.getByText('Test Bar Chart')).toBeInTheDocument();
  });
});

// Test suite for PieChart
describe('PieChart Component', () => {
  test('renders loading state', () => {
    render(<PieChart loading={true} />);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });
  
  test('renders error state', () => {
    render(<PieChart error="Test Error" />);
    expect(screen.getByText('Test Error')).toBeInTheDocument();
  });
  
  test('renders empty state', () => {
    render(<PieChart data={[]} />);
    expect(screen.getByText('No data available')).toBeInTheDocument();
  });
  
  test('renders with title', () => {
    render(<PieChart data={mockPieData} title="Test Pie Chart" />);
    expect(screen.getByText('Test Pie Chart')).toBeInTheDocument();
  });
}); 