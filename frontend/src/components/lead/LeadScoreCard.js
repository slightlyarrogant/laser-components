import React from 'react';
import {
  Box,
  Card,
  CardHeader,
  CardContent,
  CircularProgress,
  Divider,
  Grid,
  LinearProgress,
  Paper,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  Business as BusinessIcon,
  AttachMoney as AttachMoneyIcon,
  CalendarToday as CalendarTodayIcon,
  Category as CategoryIcon,
  AssignmentTurnedIn as AssignmentTurnedInIcon,
  Psychology as PsychologyIcon
} from '@mui/icons-material';

/**
 * Component to display a lead's score with visual indicators and detailed breakdown
 */
const LeadScoreCard = ({ scoreData, loading, error }) => {
  // Handle loading state
  if (loading) {
    return (
      <Card>
        <CardHeader title="Lead Score" />
        <Divider />
        <CardContent sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 4 }}>
          <CircularProgress />
        </CardContent>
      </Card>
    );
  }

  // Handle error state
  if (error) {
    return (
      <Card>
        <CardHeader title="Lead Score" />
        <Divider />
        <CardContent>
          <Typography color="error" variant="body2">
            {error}
          </Typography>
        </CardContent>
      </Card>
    );
  }

  // Handle no data
  if (!scoreData) {
    return (
      <Card>
        <CardHeader title="Lead Score" />
        <Divider />
        <CardContent>
          <Typography variant="body2" color="text.secondary">
            No score data available for this lead. Try refreshing the page or scoring the lead.
          </Typography>
        </CardContent>
      </Card>
    );
  }

  // Score color mapping
  const getScoreColor = (score) => {
    if (score >= 80) return 'success.main';
    if (score >= 60) return 'success.light';
    if (score >= 40) return 'warning.main';
    if (score >= 20) return 'warning.light';
    return 'error.main';
  };

  // Score label mapping
  const getScoreLabel = (score) => {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Average';
    if (score >= 20) return 'Below Average';
    return 'Poor';
  };

  // Get icon for each score factor
  const getScoreIcon = (factorKey) => {
    switch (factorKey) {
      case 'industry':
        return <CategoryIcon color="primary" />;
      case 'employeeCount':
        return <BusinessIcon color="info" />;
      case 'annualRevenue':
        return <AttachMoneyIcon color="success" />;
      case 'foundedYear':
        return <CalendarTodayIcon color="warning" />;
      case 'completeness':
        return <AssignmentTurnedInIcon color="secondary" />;
      case 'applicationMatch':
        return <PsychologyIcon color="error" />;
      default:
        return <TrendingUpIcon />;
    }
  };

  // Map score factor keys to readable names
  const getFactorName = (factorKey) => {
    const factorNames = {
      industry: 'Industry Relevance',
      employeeCount: 'Company Size',
      annualRevenue: 'Annual Revenue',
      foundedYear: 'Company Age',
      completeness: 'Data Completeness',
      applicationMatch: 'Application Match'
    };
    return factorNames[factorKey] || factorKey;
  };

  const { score, breakdown } = scoreData;
  const scoreColor = getScoreColor(score);
  const scoreLabel = getScoreLabel(score);

  return (
    <Card>
      <CardHeader 
        title="Lead Score" 
        subheader={`Score calculated on ${new Date(scoreData.scoredAt).toLocaleDateString()}`} 
      />
      <Divider />
      <CardContent>
        <Grid container spacing={3}>
          {/* Overall Score */}
          <Grid item xs={12} sm={4} md={3}>
            <Paper 
              elevation={0} 
              sx={{ 
                p: 3, 
                textAlign: 'center',
                bgcolor: 'background.default',
                borderRadius: 2,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%'
              }}
            >
              <Box
                sx={{
                  position: 'relative',
                  display: 'inline-flex',
                  mb: 1
                }}
              >
                <CircularProgress
                  variant="determinate"
                  value={score}
                  size={80}
                  thickness={4}
                  sx={{ color: scoreColor }}
                />
                <Box
                  sx={{
                    top: 0,
                    left: 0,
                    bottom: 0,
                    right: 0,
                    position: 'absolute',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Typography variant="h5" component="div" color={scoreColor} fontWeight="bold">
                    {score}
                  </Typography>
                </Box>
              </Box>
              <Typography variant="subtitle1" color={scoreColor}>
                {scoreLabel}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Overall lead quality
              </Typography>
            </Paper>
          </Grid>

          {/* Score Breakdown */}
          <Grid item xs={12} sm={8} md={9}>
            <Typography variant="subtitle1" gutterBottom>
              Score Breakdown
            </Typography>
            <Grid container spacing={2}>
              {breakdown && Object.keys(breakdown).filter(k => k !== 'total').map((key) => (
                <Grid item xs={12} key={key}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                    <Box sx={{ mr: 1 }}>{getScoreIcon(key)}</Box>
                    <Box sx={{ flexGrow: 1 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Tooltip title={`Weight: ${breakdown[key].weight}%`}>
                          <Typography variant="body2">{getFactorName(key)}</Typography>
                        </Tooltip>
                        <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                          {breakdown[key].score}/100
                        </Typography>
                      </Box>
                      <LinearProgress 
                        variant="determinate" 
                        value={breakdown[key].score} 
                        sx={{ 
                          height: 8, 
                          borderRadius: 1,
                          bgcolor: 'background.default',
                          '& .MuiLinearProgress-bar': {
                            bgcolor: getScoreColor(breakdown[key].score)
                          }
                        }} 
                      />
                    </Box>
                  </Box>
                </Grid>
              ))}
            </Grid>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );
};

export default LeadScoreCard; 