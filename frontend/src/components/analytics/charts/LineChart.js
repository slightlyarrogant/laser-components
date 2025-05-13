import React from 'react';
import {
  LineChart as RechartsLineChart,
  Line,
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
 * A responsive line chart component
 */
const LineChart = ({
  data,
  height = 300,
  lines = [{ dataKey: 'value', name: 'Value' }],
  xAxisDataKey = 'timestamp',
  xAxisLabel = 'Date',
  yAxisLabel = 'Value',
  title,
  loading = false,
  error = null,
  tooltip = true,
  legend = true,
  grid = true,
  formatX,
  formatY,
}) => {
  // Generate colors if not specified
  const lineColors = generateColorScale(lines.length);
  
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
        <RechartsLineChart
          data={data}
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
        >
          {grid && <CartesianGrid strokeDasharray="3 3" />}
          
          <XAxis 
            dataKey={xAxisDataKey} 
            label={{ value: xAxisLabel, position: 'insideBottomRight', offset: -5 }}
            tickFormatter={finalFormatX}
          />
          
          <YAxis 
            label={{ value: yAxisLabel, angle: -90, position: 'insideLeft' }}
            tickFormatter={finalFormatY}
          />
          
          {tooltip && <Tooltip 
            formatter={finalFormatY}
            labelFormatter={finalFormatX}
          />}
          
          {legend && <Legend />}
          
          {lines.map((line, index) => (
            <Line
              key={line.dataKey}
              type="monotone"
              dataKey={line.dataKey}
              name={line.name || line.dataKey}
              stroke={line.color || lineColors[index % lineColors.length]}
              activeDot={{ r: 6 }}
              dot={{ r: 4 }}
              isAnimationActive={true}
            />
          ))}
        </RechartsLineChart>
      </ResponsiveContainer>
    </Box>
  );
};

export default LineChart; 