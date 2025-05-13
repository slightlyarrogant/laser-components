import React from 'react';
import { 
  Card, 
  CardContent, 
  Typography, 
  Box, 
  CircularProgress,
  Tooltip,
  IconButton
} from '@mui/material';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import TrendingFlatIcon from '@mui/icons-material/TrendingFlat';

/**
 * A card component for displaying a single statistic/metric
 */
const StatCard = ({
  title,
  value,
  description,
  icon: Icon,
  trend = null, // positive (>0), negative (<0), or neutral (0)
  trendLabel,
  loading = false,
  error = null,
  formatter = (val) => val,
  color,
}) => {
  // Render loading state
  if (loading) {
    return (
      <Card sx={{ height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <CircularProgress size={24} />
      </Card>
    );
  }
  
  // Render error state
  if (error) {
    return (
      <Card sx={{ height: '100%' }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>{title}</Typography>
          <Typography color="error" variant="body2">{error}</Typography>
        </CardContent>
      </Card>
    );
  }
  
  // Determine trend icon and color
  let TrendIcon = null;
  let trendColor = 'text.secondary';
  
  if (trend !== null) {
    if (trend > 0) {
      TrendIcon = TrendingUpIcon;
      trendColor = 'success.main';
    } else if (trend < 0) {
      TrendIcon = TrendingDownIcon;
      trendColor = 'error.main';
    } else {
      TrendIcon = TrendingFlatIcon;
      trendColor = 'text.secondary';
    }
  }
  
  return (
    <Card sx={{ height: '100%', bgcolor: color }}>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
          <Typography 
            variant="subtitle1" 
            color="text.secondary" 
            sx={{ fontWeight: 'medium' }}
          >
            {title}
          </Typography>
          {description && (
            <Tooltip title={description} arrow>
              <IconButton size="small">
                <HelpOutlineIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Box>
        
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
          {Icon && (
            <Box sx={{ mr: 1, color: 'primary.main' }}>
              <Icon fontSize="large" />
            </Box>
          )}
          <Typography variant="h4" component="div" sx={{ fontWeight: 'medium' }}>
            {formatter(value)}
          </Typography>
        </Box>
        
        {trend !== null && (
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Box sx={{ color: trendColor, display: 'flex', alignItems: 'center', mr: 1 }}>
              <TrendIcon fontSize="small" />
              <Typography 
                variant="body2" 
                component="span" 
                sx={{ ml: 0.5, color: trendColor, fontWeight: 'medium' }}
              >
                {trend > 0 ? '+' : ''}{trend.toFixed(1)}%
              </Typography>
            </Box>
            {trendLabel && (
              <Typography variant="body2" color="text.secondary">
                {trendLabel}
              </Typography>
            )}
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

export default StatCard; 