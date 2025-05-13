import React, { useState } from 'react';
import {
  Box,
  Button,
  Divider,
  Drawer,
  Grid,
  IconButton,
  Paper,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  FilterList as FilterIcon,
  Close as CloseIcon,
  SaveAlt as SaveIcon,
  Delete as DeleteIcon,
  Refresh as ResetIcon,
} from '@mui/icons-material';

import ApplicationFilter from './ApplicationFilter';
import RegionFilter from './RegionFilter';
import IndustryFilter from './IndustryFilter';
import ScoreFilter from './ScoreFilter';

/**
 * Component for grouping all filter components in a collapsible panel
 */
const FilterPanel = ({ 
  onFilterChange, 
  initialValues = {},
  onFilterReset,
  onFilterSave,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  
  // State for filters
  const [filters, setFilters] = useState(initialValues);
  
  // State for mobile drawer
  const [drawerOpen, setDrawerOpen] = useState(false);
  
  // State for controlling filter sections expansion (for mobile)
  const [expandedSections, setExpandedSections] = useState({
    application: true,
    region: true,
    industry: true,
    score: true
  });

  // Toggle section expansion
  const toggleSection = (section) => {
    if (isMobile) {
      setExpandedSections(prev => ({
        ...prev,
        [section]: !prev[section]
      }));
    }
  };
  
  // Update filter state and notify parent component
  const handleFilterChange = (filterType, filterValue) => {
    const newFilters = {
      ...filters,
      ...filterValue
    };
    
    setFilters(newFilters);
    
    if (onFilterChange) {
      onFilterChange(newFilters);
    }
  };
  
  // Reset all filters
  const handleFilterReset = () => {
    const emptyFilters = {
      regionIds: [],
      countryIds: [],
      applicationIds: [],
      industries: [],
      minScore: 0,
      maxScore: 100
    };
    
    setFilters(emptyFilters);
    
    if (onFilterReset) {
      onFilterReset();
    }
  };
  
  // Save current filter configuration
  const handleFilterSave = () => {
    if (onFilterSave) {
      onFilterSave(filters);
    }
  };
  
  // The filter content to be displayed in both desktop and mobile views
  const filterContent = (
    <Stack spacing={2}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <Typography variant="h6">Filters</Typography>
        <Box>
          <Button 
            size="small" 
            startIcon={<ResetIcon />}
            onClick={handleFilterReset}
          >
            Clear All
          </Button>
          <Button 
            size="small" 
            startIcon={<SaveIcon />}
            onClick={handleFilterSave}
            sx={{ ml: 1 }}
          >
            Save
          </Button>
          {isMobile && (
            <IconButton 
              size="small" 
              onClick={() => setDrawerOpen(false)} 
              sx={{ ml: 1 }}
            >
              <CloseIcon />
            </IconButton>
          )}
        </Box>
      </Box>
      
      <Divider />
      
      <Box>
        <Box
          sx={{ 
            cursor: isMobile ? 'pointer' : 'default',
            py: isMobile ? 1 : 0 
          }}
          onClick={() => toggleSection('application')}
        >
          <Typography 
            variant="subtitle1" 
            fontWeight="medium"
            sx={{ mb: isMobile ? 0 : 1 }}
          >
            Application Filter
          </Typography>
        </Box>
        {(!isMobile || expandedSections.application) && (
          <ApplicationFilter 
            onChange={(value) => handleFilterChange('application', value)}
            initialValues={{ 
              applicationIds: filters.applicationIds || [] 
            }}
          />
        )}
      </Box>
      
      <Box>
        <Box 
          sx={{ 
            cursor: isMobile ? 'pointer' : 'default',
            py: isMobile ? 1 : 0 
          }} 
          onClick={() => toggleSection('region')}
        >
          <Typography 
            variant="subtitle1" 
            fontWeight="medium"
            sx={{ mb: isMobile ? 0 : 1 }}
          >
            Geographic Region
          </Typography>
        </Box>
        {(!isMobile || expandedSections.region) && (
          <RegionFilter 
            onChange={(value) => handleFilterChange('region', value)}
            initialValues={{ 
              regionIds: filters.regionIds || [], 
              countryIds: filters.countryIds || [] 
            }}
          />
        )}
      </Box>
      
      <Box>
        <Box 
          sx={{ 
            cursor: isMobile ? 'pointer' : 'default',
            py: isMobile ? 1 : 0 
          }} 
          onClick={() => toggleSection('industry')}
        >
          <Typography 
            variant="subtitle1" 
            fontWeight="medium"
            sx={{ mb: isMobile ? 0 : 1 }}
          >
            Industry
          </Typography>
        </Box>
        {(!isMobile || expandedSections.industry) && (
          <IndustryFilter 
            onChange={(value) => handleFilterChange('industry', value)}
            initialValues={{ 
              industries: filters.industries || [] 
            }}
          />
        )}
      </Box>
      
      <Box>
        <Box 
          sx={{ 
            cursor: isMobile ? 'pointer' : 'default',
            py: isMobile ? 1 : 0 
          }} 
          onClick={() => toggleSection('score')}
        >
          <Typography 
            variant="subtitle1" 
            fontWeight="medium"
            sx={{ mb: isMobile ? 0 : 1 }}
          >
            Lead Score
          </Typography>
        </Box>
        {(!isMobile || expandedSections.score) && (
          <ScoreFilter 
            onChange={(value) => handleFilterChange('score', value)}
            initialValues={[
              filters.minScore !== undefined ? filters.minScore : 0,
              filters.maxScore !== undefined ? filters.maxScore : 100
            ]}
          />
        )}
      </Box>
    </Stack>
  );
  
  // For mobile view, we use a drawer that can be toggled open/closed
  if (isMobile) {
    return (
      <>
        {/* Filter button for mobile */}
        <Button
          variant="outlined"
          startIcon={<FilterIcon />}
          onClick={() => setDrawerOpen(true)}
          sx={{ mb: 2 }}
        >
          Filters
        </Button>
        
        {/* Filter drawer for mobile */}
        <Drawer
          anchor="left"
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          PaperProps={{
            sx: { width: '80%', maxWidth: 360, padding: 2 }
          }}
        >
          {filterContent}
        </Drawer>
      </>
    );
  }
  
  // For desktop view, we display the filters in a sidebar
  return (
    <Paper
      elevation={1}
      sx={{
        p: 2,
        height: '100%',
        overflow: 'auto',
      }}
    >
      {filterContent}
    </Paper>
  );
};

export default FilterPanel; 