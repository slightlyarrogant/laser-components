import React from 'react';
import {
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { Typography, Box, CircularProgress } from '@mui/material';
import { generateColorScale } from '../../../services/analyticsService';

/**
 * A responsive pie chart component
 */
const PieChart = ({
  data,
  height = 300,
  dataKey = 'value',
  nameKey = 'name',
  title,
  loading = false,
  error = null,
  tooltip = true,
  legend = true,
  colors,
  innerRadius = 0, // Set > 0 for a donut chart
  formatter,
  legendPosition = 'bottom',
}) => {
  // Generate colors if not specified
  const pieColors = colors || generateColorScale(data?.length || 5);
  
  // Default formatter function
  const defaultFormatter = (value) => {
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
  
  const finalFormatter = formatter || defaultFormatter;
  
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
  
  // Filter out zero values
  const filteredData = data.filter(item => item[dataKey] > 0);
  
  // Calculate percentages for labels if needed
  const total = filteredData.reduce((acc, item) => acc + item[dataKey], 0);
  const dataWithPercentages = filteredData.map(item => ({
    ...item,
    percentage: (item[dataKey] / total) * 100
  }));
  
  return (
    <Box sx={{ width: '100%', height }}>
      {title && (
        <Typography variant="h6" align="center" gutterBottom>
          {title}
        </Typography>
      )}
      <ResponsiveContainer width="100%" height={title ? height - 30 : height}>
        <RechartsPieChart>
          <Pie
            data={dataWithPercentages}
            cx="50%"
            cy="50%"
            labelLine={false}
            outerRadius={80}
            innerRadius={innerRadius}
            fill="#8884d8"
            dataKey={dataKey}
            nameKey={nameKey}
            label={({ name, percentage }) => `${name}: ${percentage.toFixed(1)}%`}
          >
            {dataWithPercentages.map((entry, index) => (
              <Cell 
                key={`cell-${index}`} 
                fill={pieColors[index % pieColors.length]} 
              />
            ))}
          </Pie>
          
          {tooltip && <Tooltip formatter={finalFormatter} />}
          
          {legend && <Legend 
            layout="horizontal" 
            verticalAlign={legendPosition} 
            align="center"
            formatter={(value, entry, index) => {
              return `${value} (${dataWithPercentages[index]?.percentage.toFixed(1)}%)`;
            }}
          />}
        </RechartsPieChart>
      </ResponsiveContainer>
    </Box>
  );
};

export default PieChart; 