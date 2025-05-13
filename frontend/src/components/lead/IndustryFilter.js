import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  Checkbox,
  Chip,
  Collapse,
  Divider,
  Grid,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
} from '@mui/material';
import { ExpandLess, ExpandMore } from '@mui/icons-material';

// Industry hierarchy data (in a real implementation, this might come from an API)
// This is a simplified version of industry classifications based on common standards
const INDUSTRY_HIERARCHY = [
  {
    id: 'manufacturing',
    name: 'Manufacturing',
    children: [
      { id: 'semiconductor', name: 'Semiconductor Manufacturing' },
      { id: 'electronics', name: 'Electronics Manufacturing' },
      { id: 'automotive', name: 'Automotive Manufacturing' },
      { id: 'aerospace', name: 'Aerospace & Defense' },
      { id: 'medical_devices', name: 'Medical Devices Manufacturing' },
    ]
  },
  {
    id: 'healthcare',
    name: 'Healthcare',
    children: [
      { id: 'hospitals', name: 'Hospitals & Clinics' },
      { id: 'pharma', name: 'Pharmaceuticals' },
      { id: 'biotech', name: 'Biotechnology' },
      { id: 'medical_services', name: 'Medical Services' },
    ]
  },
  {
    id: 'research',
    name: 'Research & Development',
    children: [
      { id: 'academic', name: 'Academic & University Research' },
      { id: 'government_labs', name: 'Government Laboratories' },
      { id: 'commercial_labs', name: 'Commercial Research Labs' },
    ]
  },
  {
    id: 'technology',
    name: 'Technology',
    children: [
      { id: 'software', name: 'Software & IT' },
      { id: 'hardware', name: 'Computer Hardware' },
      { id: 'telecommunications', name: 'Telecommunications' },
      { id: 'consumer_electronics', name: 'Consumer Electronics' },
    ]
  },
  {
    id: 'energy',
    name: 'Energy & Utilities',
    children: [
      { id: 'renewable', name: 'Renewable Energy' },
      { id: 'oil_gas', name: 'Oil & Gas' },
      { id: 'power_utilities', name: 'Power & Utilities' },
    ]
  }
];

/**
 * Component for filtering leads by industry with hierarchical selection
 */
const IndustryFilter = ({ onChange, initialValues = { industries: [] } }) => {
  // State for expanded categories and selected industries
  const [expandedCategories, setExpandedCategories] = useState({});
  const [selectedIndustries, setSelectedIndustries] = useState([]);
  
  // Load initial values
  useEffect(() => {
    if (initialValues.industries?.length > 0) {
      setSelectedIndustries(initialValues.industries);
    }
  }, [initialValues]);
  
  // Update parent component when selection changes
  useEffect(() => {
    if (onChange) {
      onChange({
        industries: selectedIndustries
      });
    }
  }, [selectedIndustries, onChange]);
  
  // Toggle category expansion
  const handleToggleCategory = (categoryId) => {
    setExpandedCategories(prev => ({
      ...prev,
      [categoryId]: !prev[categoryId]
    }));
  };
  
  // Check if a category has some or all children selected
  const getCategorySelectionState = (categoryChildren) => {
    const childIds = categoryChildren.map(child => child.id);
    const selectedChildIds = childIds.filter(id => selectedIndustries.includes(id));
    
    if (selectedChildIds.length === 0) {
      return 'none'; // No children selected
    } else if (selectedChildIds.length === childIds.length) {
      return 'all'; // All children selected
    } else {
      return 'some'; // Some children selected
    }
  };
  
  // Handle industry selection
  const handleIndustryToggle = (industryId) => {
    setSelectedIndustries(prev => {
      if (prev.includes(industryId)) {
        return prev.filter(id => id !== industryId);
      } else {
        return [...prev, industryId];
      }
    });
  };
  
  // Handle category selection (selects/deselects all children)
  const handleCategoryToggle = (category) => {
    const childIds = category.children.map(child => child.id);
    const selectionState = getCategorySelectionState(category.children);
    
    setSelectedIndustries(prev => {
      if (selectionState === 'all') {
        // If all children are selected, deselect all
        return prev.filter(id => !childIds.includes(id));
      } else {
        // Otherwise, select all children
        // First remove any that might be already selected to avoid duplicates
        const filtered = prev.filter(id => !childIds.includes(id));
        return [...filtered, ...childIds];
      }
    });
  };
  
  // Get selected industry count for the summary display
  const getSelectedCount = () => {
    return selectedIndustries.length;
  };
  
  return (
    <Card>
      <CardHeader title="Industry Filter" />
      <Divider />
      <CardContent>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle1">
                Selected Industries: 
                <Chip 
                  label={getSelectedCount()} 
                  color="primary" 
                  size="small" 
                  sx={{ ml: 1 }}
                />
              </Typography>
            </Box>
            
            <List
              sx={{ 
                width: '100%', 
                bgcolor: 'background.paper',
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 1,
                maxHeight: 300,
                overflow: 'auto'
              }}
            >
              {INDUSTRY_HIERARCHY.map((category) => {
                const selectionState = getCategorySelectionState(category.children);
                
                return (
                  <React.Fragment key={category.id}>
                    <ListItem disablePadding>
                      <ListItemButton 
                        onClick={() => handleToggleCategory(category.id)}
                        dense
                      >
                        <ListItemIcon sx={{ minWidth: 36 }}>
                          <Checkbox
                            edge="start"
                            checked={selectionState === 'all'}
                            indeterminate={selectionState === 'some'}
                            onClick={(event) => {
                              event.stopPropagation();
                              handleCategoryToggle(category);
                            }}
                            tabIndex={-1}
                            disableRipple
                            size="small"
                          />
                        </ListItemIcon>
                        <ListItemText 
                          primary={category.name} 
                          primaryTypographyProps={{ 
                            fontWeight: selectionState !== 'none' ? 'bold' : 'normal' 
                          }}
                        />
                        {expandedCategories[category.id] ? <ExpandLess /> : <ExpandMore />}
                      </ListItemButton>
                    </ListItem>
                    
                    <Collapse in={expandedCategories[category.id]} timeout="auto" unmountOnExit>
                      <List component="div" disablePadding>
                        {category.children.map((industry) => (
                          <ListItem 
                            key={industry.id} 
                            disablePadding 
                            sx={{ pl: 4 }}
                          >
                            <ListItemButton 
                              onClick={() => handleIndustryToggle(industry.id)}
                              dense
                            >
                              <ListItemIcon sx={{ minWidth: 36 }}>
                                <Checkbox
                                  edge="start"
                                  checked={selectedIndustries.includes(industry.id)}
                                  tabIndex={-1}
                                  disableRipple
                                  size="small"
                                />
                              </ListItemIcon>
                              <ListItemText primary={industry.name} />
                            </ListItemButton>
                          </ListItem>
                        ))}
                      </List>
                    </Collapse>
                  </React.Fragment>
                );
              })}
            </List>
          </Grid>
          
          <Grid item xs={12}>
            <Typography variant="caption" color="text.secondary">
              Expand categories and select specific industries or select an entire category.
            </Typography>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );
};

export default IndustryFilter; 