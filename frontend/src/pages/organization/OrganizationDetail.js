import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link as RouterLink } from 'react-router-dom';
import {
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Chip,
  CircularProgress,
  Grid,
  Link,
  Paper,
  Tab,
  Tabs,
  TextField,
  Typography,
  Alert,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  TableContainer,
  Table,
  TableBody,
  TableCell,
  TableRow,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import BusinessIcon from '@mui/icons-material/Business';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import PeopleAltIcon from '@mui/icons-material/PeopleAlt';
import MonetizationOnIcon from '@mui/icons-material/MonetizationOn';
import PhoneIcon from '@mui/icons-material/Phone';
import EmailIcon from '@mui/icons-material/Email';
import WorkIcon from '@mui/icons-material/Work';
import LanguageIcon from '@mui/icons-material/Language';
import LinkedInIcon from '@mui/icons-material/LinkedIn';
import TwitterIcon from '@mui/icons-material/Twitter';
import ArticleIcon from '@mui/icons-material/Article';
import ComputerIcon from '@mui/icons-material/Computer';

import organizationService from '../../services/api/organizationService';

const OrganizationDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  
  // State
  const [organization, setOrganization] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Fetch organization details
  useEffect(() => {
    const fetchOrganizationDetails = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const data = await organizationService.getOrganizationById(id);
        setOrganization(data);
        
        setLoading(false);
      } catch (err) {
        console.error('Error fetching organization details:', err);
        setError('Failed to load organization details. Please try again later.');
        setLoading(false);
      }
    };
    
    fetchOrganizationDetails();
  }, [id]);
  
  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return '';
    
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };
  
  // Format employee count
  const formatEmployeeCount = (count) => {
    if (!count) return 'Unknown';
    
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M`;
    }
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K`;
    }
    return count.toString();
  };
  
  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px' }}>
        <CircularProgress />
      </Box>
    );
  }
  
  if (error) {
    return (
      <Box>
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
        <Button 
          component={RouterLink} 
          to="/organizations/search" 
          startIcon={<ArrowBackIcon />}
        >
          Back to Search
        </Button>
      </Box>
    );
  }
  
  if (!organization) {
    return (
      <Box>
        <Alert severity="warning" sx={{ mb: 2 }}>
          Organization not found.
        </Alert>
        <Button 
          component={RouterLink} 
          to="/organizations/search" 
          startIcon={<ArrowBackIcon />}
        >
          Back to Search
        </Button>
      </Box>
    );
  }
  
  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h4" component="h1">
            {organization.name}
          </Typography>
          {organization.industry && (
            <Typography variant="subtitle1" color="text.secondary">
              {organization.industry}
            </Typography>
          )}
        </Box>
        <Button 
          startIcon={<ArrowBackIcon />} 
          component={RouterLink} 
          to="/organizations/search"
        >
          Back to Search
        </Button>
      </Box>
      
      <Grid container spacing={3}>
        {/* Left Column - Main Info */}
        <Grid item xs={12} md={8}>
          {/* Overview Section */}
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Overview
            </Typography>
            
            <Typography paragraph>
              {organization.description || 'No description available.'}
            </Typography>
            
            <Grid container spacing={2} sx={{ mt: 2 }}>
              {organization.location && Object.values(organization.location).some(val => val) && (
                <Grid item xs={12} sm={6}>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <LocationOnIcon sx={{ mr: 1, color: 'text.secondary' }} />
                    <Typography>
                      {[
                        organization.location.city,
                        organization.location.state,
                        organization.location.country
                      ].filter(Boolean).join(', ')}
                    </Typography>
                  </Box>
                </Grid>
              )}
              
              {organization.foundedYear && (
                <Grid item xs={12} sm={6}>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <CalendarTodayIcon sx={{ mr: 1, color: 'text.secondary' }} />
                    <Typography>
                      Founded in {organization.foundedYear}
                    </Typography>
                  </Box>
                </Grid>
              )}
              
              {organization.employeeCount > 0 && (
                <Grid item xs={12} sm={6}>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <PeopleAltIcon sx={{ mr: 1, color: 'text.secondary' }} />
                    <Typography>
                      {formatEmployeeCount(organization.employeeCount)} employees
                    </Typography>
                  </Box>
                </Grid>
              )}
              
              {organization.revenueRange && (
                <Grid item xs={12} sm={6}>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <MonetizationOnIcon sx={{ mr: 1, color: 'text.secondary' }} />
                    <Typography>
                      Revenue: {organization.revenueRange}
                    </Typography>
                  </Box>
                </Grid>
              )}
              
              {organization.website && (
                <Grid item xs={12} sm={6}>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <LanguageIcon sx={{ mr: 1, color: 'text.secondary' }} />
                    <Link href={organization.website} target="_blank" rel="noopener noreferrer">
                      {organization.website.replace(/^https?:\/\//, '')}
                    </Link>
                  </Box>
                </Grid>
              )}
              
              {organization.socialProfiles?.linkedin && (
                <Grid item xs={12} sm={6}>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <LinkedInIcon sx={{ mr: 1, color: 'text.secondary' }} />
                    <Link href={organization.socialProfiles.linkedin} target="_blank" rel="noopener noreferrer">
                      LinkedIn Profile
                    </Link>
                  </Box>
                </Grid>
              )}
              
              {organization.socialProfiles?.twitter && (
                <Grid item xs={12} sm={6}>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <TwitterIcon sx={{ mr: 1, color: 'text.secondary' }} />
                    <Link href={organization.socialProfiles.twitter} target="_blank" rel="noopener noreferrer">
                      Twitter Profile
                    </Link>
                  </Box>
                </Grid>
              )}
            </Grid>
          </Paper>
          
          {/* Keywords Section */}
          {organization.relevantKeywords && organization.relevantKeywords.length > 0 && (
            <Paper sx={{ p: 3, mb: 3 }}>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Relevant Keywords
              </Typography>
              <Box>
                {organization.relevantKeywords.map((keyword, idx) => (
                  <Chip 
                    key={idx} 
                    label={keyword} 
                    sx={{ mr: 1, mb: 1 }} 
                  />
                ))}
              </Box>
            </Paper>
          )}
          
          {/* Technologies Section */}
          {organization.technologies && organization.technologies.length > 0 && (
            <Paper sx={{ p: 3, mb: 3 }}>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Technologies
              </Typography>
              <List dense>
                {organization.technologies.map((tech, idx) => (
                  <ListItem key={idx}>
                    <ListItemIcon>
                      <ComputerIcon />
                    </ListItemIcon>
                    <ListItemText primary={tech} />
                  </ListItem>
                ))}
              </List>
            </Paper>
          )}
          
          {/* Recent News Section */}
          {organization.recentNews && organization.recentNews.length > 0 && (
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Recent News
              </Typography>
              <List>
                {organization.recentNews.map((news, idx) => (
                  <ListItem key={idx}>
                    <ListItemIcon>
                      <ArticleIcon />
                    </ListItemIcon>
                    <ListItemText 
                      primary={
                        <Link href={news.url} target="_blank" rel="noopener noreferrer">
                          {news.title}
                        </Link>
                      }
                      secondary={news.date && formatDate(news.date)}
                    />
                  </ListItem>
                ))}
              </List>
            </Paper>
          )}
        </Grid>
        
        {/* Right Column - Contacts and Meta */}
        <Grid item xs={12} md={4}>
          {/* Contacts Section */}
          {organization.contacts && organization.contacts.length > 0 && (
            <Paper sx={{ p: 3, mb: 3 }}>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Key Contacts
              </Typography>
              {organization.contacts.map((contact, idx) => (
                <Card key={idx} variant="outlined" sx={{ mb: 2 }}>
                  <CardContent>
                    <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                      {contact.name}
                    </Typography>
                    {contact.title && (
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        {contact.title}
                      </Typography>
                    )}
                    
                    {contact.email && (
                      <Box sx={{ display: 'flex', alignItems: 'center', mt: 0.5 }}>
                        <EmailIcon fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} />
                        <Link href={`mailto:${contact.email}`} sx={{ fontSize: '0.875rem' }}>
                          {contact.email}
                        </Link>
                      </Box>
                    )}
                    
                    {contact.phone && (
                      <Box sx={{ display: 'flex', alignItems: 'center', mt: 0.5 }}>
                        <PhoneIcon fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} />
                        <Link href={`tel:${contact.phone}`} sx={{ fontSize: '0.875rem' }}>
                          {contact.phone}
                        </Link>
                      </Box>
                    )}
                  </CardContent>
                </Card>
              ))}
            </Paper>
          )}
          
          {/* Metadata Section */}
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Organization Info
            </Typography>
            <TableContainer component={Box}>
              <Table size="small">
                <TableBody>
                  <TableRow>
                    <TableCell component="th" scope="row" sx={{ width: '40%' }}>
                      External ID
                    </TableCell>
                    <TableCell>
                      {organization.externalId}
                    </TableCell>
                  </TableRow>
                  
                  {organization.location?.countryCode && (
                    <TableRow>
                      <TableCell component="th" scope="row">
                        Country Code
                      </TableCell>
                      <TableCell>
                        {organization.location.countryCode}
                      </TableCell>
                    </TableRow>
                  )}
                  
                  <TableRow>
                    <TableCell component="th" scope="row">
                      Last Updated
                    </TableCell>
                    <TableCell>
                      {formatDate(organization.lastUpdated)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default OrganizationDetail; 