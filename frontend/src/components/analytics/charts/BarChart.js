import React from 'react';
import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { Typography, Box, CircularProgress } from '@mui/material';
import { generateColorScale } from '../../../services/analyticsService';

/**
 * A responsive bar chart component
 */
const BarChart = ({
  data,
  height = 300,
  bars = [{ dataKey: 'value', name: 'Value' }],
  xAxisDataKey = 'name',
  xAxisLabel = '',
  yAxisLabel = 'Value',
  title,
  loading = false,
  error = null,
  tooltip = true,
  legend = true,
  grid = true,
  formatX,
  formatY,
  layout = 'vertical', // 'vertical' or 'horizontal'
  stacked = false,
}) => {
  // Generate colors if not specified
  const barColors = generateColorScale(bars.length);
  
  // Format functions
  const defaultFormatX = (value) => {
    if (!value) return '';
    if (typeof value === 'string' && value.includes('T')) {
      // If it's an ISO date string
      return new Date(value).toLocaleDateString();
    }
    return value;
  };
  
  const defaultFormatY = (value) => {
    if (typeof value === 'number') {
      // If it's a percentage
      if (value > 0 && value <= 100) {
        return `${value.toFixed(1)}%`;
      }
      // Regular number
      return value.toLocaleString();
    }
    return value;
  };
  
  const finalFormatX = formatX || defaultFormatX;
  const finalFormatY = formatY || defaultFormatY;
  
  // Render loading state
  if (loading) {
    return (
      <Box sx={{ height, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }
  
  // Render error state
  if (error) {
    return (
      <Box sx={{ height, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <Typography color="error">{error}</Typography>
      </Box>
    );
  }
  
  // Render empty state
  if (!data || data.length === 0) {
    return (
      <Box sx={{ height, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <Typography color="textSecondary">No data available</Typography>
      </Box>
    );
  }
  
  return (
    <Box sx={{ width: '100%', height }}>
      {title && (
        <Typography variant="h6" align="center" gutterBottom>
          {title}
        </Typography>
      )}
      <ResponsiveContainer width="100%" height={title ? height - 30 : height}>
        <RechartsBarChart
          data={data}
          layout={layout}
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
        >
          {grid && <CartesianGrid strokeDasharray="3 3" />}
          
          <XAxis 
            type={layout === 'vertical' ? 'number' : 'category'} 
            dataKey={layout === 'vertical' ? null : xAxisDataKey} 
            label={layout === 'vertical' ? null : { value: xAxisLabel, position: 'insideBottomRight', offset: -5 }}
            tickFormatter={layout === 'vertical' ? finalFormatY : finalFormatX}
          />
          
          <YAxis 
            type={layout === 'vertical' ? 'category' : 'number'} 
            dataKey={layout === 'vertical' ? xAxisDataKey : null} 
            label={layout === 'vertical' ? null : { value: yAxisLabel, angle: -90, position: 'insideLeft' }}
            tickFormatter={layout === 'vertical' ? finalFormatX : finalFormatY}
          />
          
          {tooltip && <Tooltip 
            formatter={finalFormatY}
            labelFormatter={finalFormatX}
          />}
          
          {legend && <Legend />}
          
          {bars.map((bar, index) => (
            <Bar
              key={bar.dataKey}
              dataKey={bar.dataKey}
              name={bar.name || bar.dataKey}
              fill={bar.color || barColors[index % barColors.length]}
              stackId={stacked ? 'stack' : null}
            />
          ))}
        </RechartsBarChart>
      </ResponsiveContainer>
    </Box>
  );
};

export default BarChart; 