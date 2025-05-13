import React, { useState, useEffect } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { 
  Typography, 
  Box, 
  Card, 
  CardContent, 
  Grid, 
  Button, 
  Paper,
  Stack,
  CardActions,
  CircularProgress
} from '@mui/material';
import CategoryIcon from '@mui/icons-material/Category';
import InventoryIcon from '@mui/icons-material/Inventory';
import BusinessIcon from '@mui/icons-material/Business';
import ScienceIcon from '@mui/icons-material/Science';
import PendingActionsIcon from '@mui/icons-material/PendingActions';
import { fetchResearchStatusCounts } from '../services/api/researchService';

const Dashboard = () => {
  const [researchStats, setResearchStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState(null);

  useEffect(() => {
    const loadStats = async () => {
      setStatsLoading(true);
      setStatsError(null);
      try {
        const researchRes = await fetchResearchStatusCounts();
        setResearchStats(researchRes.data);
      } catch (err) {
        console.error("Error loading dashboard stats:", err);
        setStatsError('Failed to load stats.');
      } finally {
        setStatsLoading(false);
      }
    };
    loadStats();
  }, []);

  return (
    <>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Laser Components Dashboard
        </Typography>
        <Typography variant="body1" color="text.secondary" paragraph>
          Manage your product catalog, applications, and lead generation from this dashboard.
        </Typography>
      </Box>

      <Grid container spacing={3}>
        {/* Products Card */}
        <Grid item xs={12} md={4}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Box display="flex" alignItems="center" mb={2}>
                <InventoryIcon color="primary" sx={{ fontSize: 40, mr: 2 }} />
                <Typography variant="h6" component="h2">
                  Products
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary" paragraph sx={{ mb: 2 }}>
                Manage your laser components product catalog. Add new products, update existing ones, or organize them into categories.
              </Typography>
              <Stack direction="row" spacing={1}>
                <Button 
                  variant="contained" 
                  component={RouterLink} 
                  to="/products"
                >
                  View All Products
                </Button>
                <Button 
                  variant="outlined" 
                  component={RouterLink} 
                  to="/products/new"
                >
                  Add New
                </Button>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* Categories Card */}
        <Grid item xs={12} md={4}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Box display="flex" alignItems="center" mb={2}>
                <CategoryIcon color="primary" sx={{ fontSize: 40, mr: 2 }} />
                <Typography variant="h6" component="h2">
                  Categories
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary" paragraph sx={{ mb: 2 }}>
                Organize your products with categories and subcategories. Create a hierarchical structure for easier navigation.
              </Typography>
              <Stack direction="row" spacing={1}>
                <Button 
                  variant="contained" 
                  component={RouterLink} 
                  to="/categories"
                >
                  Manage Categories
                </Button>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* Applications Card */}
        <Grid item xs={12} md={4}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Box display="flex" alignItems="center" mb={2}>
                <BusinessIcon color="primary" sx={{ fontSize: 40, mr: 2 }} />
                <Typography variant="h6" component="h2">
                  Applications
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary" paragraph sx={{ mb: 2 }}>
                Map products to real-world applications and use cases. Create application profiles and associate relevant products.
              </Typography>
              <Stack direction="row" spacing={1}>
                <Button 
                  variant="contained" 
                  component={RouterLink} 
                  to="/applications"
                >
                  View Applications
                </Button>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* Research Stats Card */}
        <Grid item xs={12} md={4}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Box display="flex" alignItems="center" mb={2}>
                <ScienceIcon color="primary" sx={{ fontSize: 40, mr: 2 }} />
                <Typography variant="h6" component="h2">
                  AI Research
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary" paragraph sx={{ mb: 2 }}>
                Manage industrial application research, powered by AI draft generation and human review.
              </Typography>
              {statsLoading && <CircularProgress size={24} />}
              {statsError && <Typography color="error">{statsError}</Typography>}
              {researchStats && (
                <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                  <PendingActionsIcon color={researchStats.PENDING_APPROVAL > 0 ? 'warning' : 'disabled'} sx={{ mr: 1}} />
                  <Typography variant="body1">
                    {researchStats.PENDING_APPROVAL || 0} drafts pending approval
                  </Typography>
                </Box>
              )}
              <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
                <Button 
                  variant="contained" 
                  component={RouterLink} 
                  to="/research"
                >
                  View Research
                </Button>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* Quick Stats */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>Quick Stats</Typography>
            {statsLoading && <CircularProgress size={20} />}
            {statsError && <Typography color="error">{statsError}</Typography>}
            {!statsLoading && !statsError && (
              <Grid container spacing={3}>
                <Grid item xs={6} sm={3}>
                  <Typography variant="subtitle1">Products</Typography>
                  <Typography variant="h4">--</Typography>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Typography variant="subtitle1">Categories</Typography>
                  <Typography variant="h4">--</Typography>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Typography variant="subtitle1">Applications</Typography>
                  <Typography variant="h4">--</Typography>
                </Grid>
                {researchStats && (
                    <Grid item xs={6} sm={3}>
                      <Typography variant="subtitle1">Approved Research</Typography>
                      <Typography variant="h4">
                        {(researchStats.DRAFT || 0) + (researchStats.IN_PROGRESS || 0) + (researchStats.COMPLETED || 0)}
                      </Typography>
                    </Grid>
                )}
              </Grid>
            )}
          </Paper>
        </Grid>
      </Grid>
    </>
  );
};

export default Dashboard; 