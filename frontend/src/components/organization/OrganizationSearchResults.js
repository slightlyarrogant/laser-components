import React, { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Chip,
  Divider,
  Grid,
  IconButton,
  Link,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Typography,
  Tooltip,
  ToggleButtonGroup,
  ToggleButton,
} from '@mui/material';
import ViewListIcon from '@mui/icons-material/ViewList';
import ViewModuleIcon from '@mui/icons-material/ViewModule';
import ViewColumnIcon from '@mui/icons-material/ViewColumn';
import BusinessIcon from '@mui/icons-material/Business';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import WorkIcon from '@mui/icons-material/Work';
import PeopleAltIcon from '@mui/icons-material/PeopleAlt';
import LanguageIcon from '@mui/icons-material/Language';
import LinkedInIcon from '@mui/icons-material/LinkedIn';
import TwitterIcon from '@mui/icons-material/Twitter';
import GetAppIcon from '@mui/icons-material/GetApp';
import MoreVertIcon from '@mui/icons-material/MoreVert';

/**
 * Component to display organization search results with multiple view options
 */
const OrganizationSearchResults = ({ 
  results,
  loading,
  onPageChange,
  onRowsPerPageChange,
  page,
  rowsPerPage,
  onExport,
}) => {
  const [viewMode, setViewMode] = useState('card');
  const [selectedOrgs, setSelectedOrgs] = useState([]);
  const [menuAnchorEl, setMenuAnchorEl] = useState(null);
  const [activeOrg, setActiveOrg] = useState(null);

  // Handle view mode change
  const handleViewModeChange = (event, newMode) => {
    if (newMode !== null) {
      setViewMode(newMode);
    }
  };
  
  // Format employee count
  const formatEmployeeCount = (count) => {
    if (!count && count !== 0) return 'N/A';
    
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K`;
    }
    return count.toString();
  };
  
  // Toggle selection of an organization
  const toggleOrgSelection = (org) => {
    if (selectedOrgs.some(o => o.externalId === org.externalId)) {
      setSelectedOrgs(selectedOrgs.filter(o => o.externalId !== org.externalId));
    } else {
      setSelectedOrgs([...selectedOrgs, org]);
    }
  };
  
  // Check if an org is selected
  const isOrgSelected = (org) => {
    return selectedOrgs.some(o => o.externalId === org.externalId);
  };
  
  // Open the menu for an organization
  const handleMenuOpen = (event, org) => {
    setMenuAnchorEl(event.currentTarget);
    setActiveOrg(org);
  };
  
  // Close the menu
  const handleMenuClose = () => {
    setMenuAnchorEl(null);
    setActiveOrg(null);
  };
  
  // Export selected organizations
  const handleExport = (format = 'csv') => {
    if (onExport) {
      onExport(selectedOrgs.length > 0 ? selectedOrgs : results.organizations, format);
    }
    handleMenuClose();
  };
  
  // Display "no results" message if needed
  if (!loading && (!results?.organizations || results.organizations.length === 0)) {
    return (
      <Paper sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="h6" color="text.secondary" gutterBottom>
          No organizations found
        </Typography>
        <Typography color="text.secondary">
          Try adjusting your search criteria or filters to find more results.
        </Typography>
      </Paper>
    );
  }
  
  // Card View
  const renderCardView = () => (
    <Grid container spacing={2}>
      {results.organizations.map(org => (
        <Grid item xs={12} sm={6} md={4} key={org.externalId}>
          <Card 
            variant="outlined" 
            sx={{ 
              height: '100%', 
              display: 'flex', 
              flexDirection: 'column',
              bgcolor: isOrgSelected(org) ? 'action.selected' : 'background.paper'
            }}
          >
            <CardContent sx={{ flexGrow: 1 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Typography 
                  variant="h6" 
                  component={RouterLink} 
                  to={`/organizations/${org.externalId}`} 
                  sx={{ textDecoration: 'none', color: 'primary.main', mb: 1 }}
                >
                  {org.name}
                </Typography>
                <IconButton 
                  size="small" 
                  onClick={(e) => handleMenuOpen(e, org)}
                >
                  <MoreVertIcon fontSize="small" />
                </IconButton>
              </Box>
              
              <Box sx={{ display: 'flex', flexWrap: 'wrap', mb: 1 }}>
                {org.industry && (
                  <Chip 
                    icon={<BusinessIcon />} 
                    label={org.industry}
                    size="small"
                    sx={{ mr: 0.5, mb: 0.5 }}
                  />
                )}
                
                {org.location?.country && (
                  <Chip 
                    icon={<LocationOnIcon />} 
                    label={org.location.city ? `${org.location.city}, ${org.location.country}` : org.location.country}
                    size="small"
                    sx={{ mr: 0.5, mb: 0.5 }}
                  />
                )}
                
                {org.employeeCount > 0 && (
                  <Chip 
                    icon={<PeopleAltIcon />} 
                    label={`${formatEmployeeCount(org.employeeCount)} employees`}
                    size="small"
                    sx={{ mr: 0.5, mb: 0.5 }}
                  />
                )}
              </Box>
              
              <Typography 
                variant="body2" 
                color="text.secondary" 
                sx={{
                  mb: 1,
                  display: '-webkit-box',
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  height: '4.5em'
                }}
              >
                {org.description || 'No description available.'}
              </Typography>
              
              <Box sx={{ display: 'flex', mt: 'auto' }}>
                {org.website && (
                  <Tooltip title="Visit website">
                    <IconButton 
                      component="a" 
                      href={org.website} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      size="small"
                      sx={{ mr: 1 }}
                    >
                      <LanguageIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
                
                {org.socialProfiles?.linkedin && (
                  <Tooltip title="LinkedIn profile">
                    <IconButton 
                      component="a" 
                      href={org.socialProfiles.linkedin} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      size="small"
                      sx={{ mr: 1 }}
                    >
                      <LinkedInIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
              </Box>
            </CardContent>
            <CardActions>
              <Button 
                component={RouterLink} 
                to={`/organizations/${org.externalId}`}
                size="small"
              >
                View Details
              </Button>
              <Button 
                size="small"
                onClick={() => toggleOrgSelection(org)}
              >
                {isOrgSelected(org) ? 'Deselect' : 'Select'}
              </Button>
            </CardActions>
          </Card>
        </Grid>
      ))}
    </Grid>
  );
  
  // List View
  const renderListView = () => (
    <List>
      {results.organizations.map(org => (
        <React.Fragment key={org.externalId}>
          <ListItem 
            alignItems="flex-start"
            sx={{ 
              bgcolor: isOrgSelected(org) ? 'action.selected' : 'background.paper',
              py: 1
            }}
          >
            <Box sx={{ width: '100%' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Box>
                  <Typography 
                    variant="h6" 
                    component={RouterLink} 
                    to={`/organizations/${org.externalId}`} 
                    sx={{ textDecoration: 'none', color: 'primary.main' }}
                  >
                    {org.name}
                  </Typography>
                  
                  <Box sx={{ display: 'flex', alignItems: 'center', mt: 0.5, color: 'text.secondary' }}>
                    {org.industry && (
                      <>
                        <BusinessIcon fontSize="small" sx={{ mr: 0.5 }} />
                        <Typography variant="body2" sx={{ mr: 2 }}>
                          {org.industry}
                        </Typography>
                      </>
                    )}
                    
                    {org.location?.country && (
                      <>
                        <LocationOnIcon fontSize="small" sx={{ mr: 0.5 }} />
                        <Typography variant="body2" sx={{ mr: 2 }}>
                          {org.location.city ? `${org.location.city}, ${org.location.country}` : org.location.country}
                        </Typography>
                      </>
                    )}
                    
                    {org.employeeCount > 0 && (
                      <>
                        <PeopleAltIcon fontSize="small" sx={{ mr: 0.5 }} />
                        <Typography variant="body2">
                          {formatEmployeeCount(org.employeeCount)} employees
                        </Typography>
                      </>
                    )}
                  </Box>
                </Box>
                
                <Box sx={{ display: 'flex' }}>
                  {org.website && (
                    <Tooltip title="Visit website">
                      <IconButton 
                        component="a" 
                        href={org.website} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        size="small"
                        sx={{ mr: 0.5 }}
                      >
                        <LanguageIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                  
                  <IconButton 
                    size="small" 
                    onClick={(e) => handleMenuOpen(e, org)}
                  >
                    <MoreVertIcon fontSize="small" />
                  </IconButton>
                </Box>
              </Box>
              
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1, mb: 1 }}>
                {org.description && org.description.length > 150 
                  ? `${org.description.substring(0, 150)}...` 
                  : org.description || 'No description available.'}
              </Typography>
              
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {org.relevantKeywords?.slice(0, 3).map((keyword, idx) => (
                    <Chip 
                      key={idx} 
                      label={keyword} 
                      size="small" 
                    />
                  ))}
                  {org.relevantKeywords?.length > 3 && (
                    <Chip 
                      label={`+${org.relevantKeywords.length - 3} more`} 
                      size="small"
                      variant="outlined"
                    />
                  )}
                </Box>
                
                <Box>
                  <Button 
                    component={RouterLink} 
                    to={`/organizations/${org.externalId}`}
                    size="small"
                    sx={{ mr: 1 }}
                  >
                    View Details
                  </Button>
                  <Button 
                    size="small"
                    onClick={() => toggleOrgSelection(org)}
                  >
                    {isOrgSelected(org) ? 'Deselect' : 'Select'}
                  </Button>
                </Box>
              </Box>
            </Box>
          </ListItem>
          <Divider />
        </React.Fragment>
      ))}
    </List>
  );
  
  // Table View
  const renderTableView = () => (
    <TableContainer component={Paper} variant="outlined">
      <Table size="medium">
        <TableHead>
          <TableRow>
            <TableCell>Name</TableCell>
            <TableCell>Industry</TableCell>
            <TableCell>Location</TableCell>
            <TableCell>Size</TableCell>
            <TableCell>Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {results.organizations.map(org => (
            <TableRow key={org.externalId} sx={{ 
              bgcolor: isOrgSelected(org) ? 'action.selected' : 'background.paper'
            }}>
              <TableCell>
                <Link 
                  component={RouterLink} 
                  to={`/organizations/${org.externalId}`}
                  sx={{ textDecoration: 'none' }}
                >
                  {org.name}
                </Link>
              </TableCell>
              <TableCell>{org.industry || 'N/A'}</TableCell>
              <TableCell>
                {org.location?.country
                  ? (org.location.city ? `${org.location.city}, ${org.location.country}` : org.location.country)
                  : 'N/A'
                }
              </TableCell>
              <TableCell>{formatEmployeeCount(org.employeeCount)}</TableCell>
              <TableCell>
                <Box sx={{ display: 'flex' }}>
                  <Tooltip title="Visit website">
                    <IconButton 
                      component="a" 
                      href={org.website || '#'} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      size="small"
                      disabled={!org.website}
                      sx={{ mr: 0.5 }}
                    >
                      <LanguageIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  
                  <Button 
                    size="small"
                    onClick={() => toggleOrgSelection(org)}
                    sx={{ mr: 0.5 }}
                  >
                    {isOrgSelected(org) ? 'Deselect' : 'Select'}
                  </Button>
                  
                  <IconButton 
                    size="small" 
                    onClick={(e) => handleMenuOpen(e, org)}
                  >
                    <MoreVertIcon fontSize="small" />
                  </IconButton>
                </Box>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
  
  return (
    <>
      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6">
          Search Results 
          <Chip 
            label={`${results.meta.total} organizations`} 
            size="small" 
            sx={{ ml: 1 }} 
          />
          {selectedOrgs.length > 0 && (
            <Chip 
              label={`${selectedOrgs.length} selected`} 
              size="small" 
              color="primary"
              sx={{ ml: 1 }} 
            />
          )}
        </Typography>
        
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          {selectedOrgs.length > 0 && (
            <Button
              startIcon={<GetAppIcon />}
              onClick={() => handleExport('csv')}
              size="small"
              sx={{ mr: 2 }}
            >
              Export Selected
            </Button>
          )}
          
          <ToggleButtonGroup
            value={viewMode}
            exclusive
            onChange={handleViewModeChange}
            size="small"
          >
            <ToggleButton value="card" aria-label="card view">
              <Tooltip title="Card View">
                <ViewModuleIcon fontSize="small" />
              </Tooltip>
            </ToggleButton>
            <ToggleButton value="list" aria-label="list view">
              <Tooltip title="List View">
                <ViewListIcon fontSize="small" />
              </Tooltip>
            </ToggleButton>
            <ToggleButton value="table" aria-label="table view">
              <Tooltip title="Table View">
                <ViewColumnIcon fontSize="small" />
              </Tooltip>
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>
      </Box>
      
      {/* Render the appropriate view */}
      {viewMode === 'card' && renderCardView()}
      {viewMode === 'list' && renderListView()}
      {viewMode === 'table' && renderTableView()}
      
      {/* Pagination */}
      <TablePagination
        component="div"
        count={results.meta.total}
        page={page}
        onPageChange={onPageChange}
        rowsPerPage={rowsPerPage}
        onRowsPerPageChange={onRowsPerPageChange}
        rowsPerPageOptions={[10, 20, 50]}
        sx={{ mt: 2 }}
      />
      
      {/* Organization Menu */}
      <Menu
        anchorEl={menuAnchorEl}
        open={Boolean(menuAnchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={() => {
          handleMenuClose();
          toggleOrgSelection(activeOrg);
        }}>
          <ListItemIcon>
            {isOrgSelected(activeOrg) ? <ViewListIcon fontSize="small" /> : <ViewModuleIcon fontSize="small" />}
          </ListItemIcon>
          <ListItemText>
            {isOrgSelected(activeOrg) ? 'Deselect' : 'Select'}
          </ListItemText>
        </MenuItem>
        <MenuItem 
          component={RouterLink} 
          to={activeOrg ? `/organizations/${activeOrg.externalId}` : '#'}
          onClick={handleMenuClose}
        >
          <ListItemIcon>
            <BusinessIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>View Details</ListItemText>
        </MenuItem>
        <Divider />
        <MenuItem onClick={() => handleExport('csv')}>
          <ListItemIcon>
            <GetAppIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Export as CSV</ListItemText>
        </MenuItem>
      </Menu>
    </>
  );
};

export default OrganizationSearchResults; 