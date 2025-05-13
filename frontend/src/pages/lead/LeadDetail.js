import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link as RouterLink } from 'react-router-dom';
import {
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Chip,
  CircularProgress,
  Divider,
  Grid,
  IconButton,
  Link,
  Paper,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  Add as AddIcon,
  AutoFixHigh as DataEnrichmentIcon
} from '@mui/icons-material';

import * as leadService from '../../services/api/leadService';
import productService from '../../services/api/productService';
import applicationService from '../../services/api/applicationService';
import LeadScoreCard from '../../components/lead/LeadScoreCard';
import ScoreOverrideDialog from '../../components/lead/ScoreOverrideDialog';
import EnrichmentDataOverrideDialog from '../../components/lead/EnrichmentDataOverrideDialog';
import TagSelector from '../../components/lead/TagSelector';
import LeadNotes from '../../components/lead/LeadNotes';

const LEAD_STATUS_OPTIONS = [
  { value: 'NEW', label: 'New', color: 'primary' },
  { value: 'CONTACTED', label: 'Contacted', color: 'info' },
  { value: 'QUALIFIED', label: 'Qualified', color: 'success' },
  { value: 'LOST', label: 'Lost', color: 'error' },
  { value: 'WON', label: 'Won', color: 'secondary' },
];

function TabPanel(props) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`lead-tabpanel-${index}`}
      aria-labelledby={`lead-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

const LeadDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  
  // State for lead data
  const [lead, setLead] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // State for related data
  const [product, setProduct] = useState(null);
  const [application, setApplication] = useState(null);
  
  // State for tabs
  const [tabValue, setTabValue] = useState(0);
  
  // State for tags
  const [newTag, setNewTag] = useState('');
  
  // State for lead scoring
  const [scoreData, setScoreData] = useState(null);
  const [scoreLoading, setScoreLoading] = useState(false);
  const [scoreError, setScoreError] = useState(null);
  
  // State for override dialogs
  const [scoreOverrideOpen, setScoreOverrideOpen] = useState(false);
  const [dataOverrideOpen, setDataOverrideOpen] = useState(false);
  
  // Function to fetch lead score - Wrapped in useCallback
  const fetchLeadScore = useCallback(async () => {
    try {
      setScoreLoading(true);
      setScoreError(null);
      
      const result = await leadService.getLeadScore(id);
      setScoreData(result);
      
      setScoreLoading(false);
    } catch (err) {
      setScoreError('Unable to load score data. Try refreshing.');
      setScoreLoading(false);
      console.error('Error fetching lead score:', err);
    }
  }, [id]); // Dependency: id
  
  // Fetch lead data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Fetch lead data
        const leadData = await leadService.getLeadById(id);
        setLead(leadData);
        
        // Fetch related data if needed
        if (leadData.productId) {
          const productData = await productService.getProductById(leadData.productId);
          setProduct(productData);
        }
        
        if (leadData.applicationId) {
          const applicationData = await applicationService.getApplicationById(leadData.applicationId);
          setApplication(applicationData);
        }
        
        setLoading(false);
      } catch (err) {
        setError('Failed to load lead data. Please try again later.');
        setLoading(false);
        console.error('Error fetching lead data:', err);
      }
    };
    
    fetchData();
  }, [id]);
  
  // Fetch lead score data
  useEffect(() => {
    // Only try to fetch score if we have a lead and it's not already loading
    if (lead && !scoreLoading) {
      fetchLeadScore();
    }
  }, [lead, scoreLoading, fetchLeadScore]); // fetchLeadScore is now stable
  
  // Handle refreshing the score
  const handleRefreshScore = () => {
    fetchLeadScore();
  };

  // Handle opening score override dialog
  const handleOpenScoreOverride = () => {
    setScoreOverrideOpen(true);
  };

  // Handle closing score override dialog
  const handleCloseScoreOverride = () => {
    setScoreOverrideOpen(false);
  };

  // Handle opening data override dialog
  const handleOpenDataOverride = () => {
    setDataOverrideOpen(true);
  };

  // Handle closing data override dialog
  const handleCloseDataOverride = () => {
    setDataOverrideOpen(false);
  };

  // Handle lead update after data override
  const handleLeadUpdate = (updatedLead) => {
    // Update the lead data in state
    setLead(prevLead => ({
      ...prevLead,
      ...updatedLead,
    }));

    // Refresh score since data changes may affect it
    fetchLeadScore();
  };
  
  // Handle tab change
  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };
  
  // Handle tag edit using the new TagSelector component
  const handleTagsChange = (newTags) => {
    if (!lead) return;
    
    // Get tags to add and remove
    const currentTags = lead.tags || [];
    const tagsToAdd = newTags.filter(tag => !currentTags.includes(tag));
    const tagsToRemove = currentTags.filter(tag => !newTags.includes(tag));
    
    // Update server and local state
    const updateTags = async () => {
      try {
        // Add new tags
        if (tagsToAdd.length > 0) {
          await leadService.updateLeadTags([lead.id], tagsToAdd, 'add');
        }
        
        // Remove old tags
        if (tagsToRemove.length > 0) {
          await leadService.updateLeadTags([lead.id], tagsToRemove, 'remove');
        }
        
        // Update local state
        setLead({
          ...lead,
          tags: newTags
        });
      } catch (err) {
        setError('Failed to update tags. Please try again.');
        console.error('Error updating tags:', err);
      }
    };
    
    updateTags();
  };
  
  // Handle status change
  const handleStatusChange = async (newStatus) => {
    try {
      await leadService.updateLeadStatus([lead.id], newStatus);
      
      // Update local state
      setLead({
        ...lead,
        status: newStatus
      });
    } catch (err) {
      setError('Failed to update status. Please try again.');
      console.error('Error updating status:', err);
    }
  };
  
  // Handle tag operations
  const handleAddTag = async () => {
    if (!newTag) return;
    
    try {
      await leadService.updateLeadTags([lead.id], [newTag], 'add');
      
      // Update local state
      setLead({
        ...lead,
        tags: [...(lead.tags || []), newTag]
      });
      
      // Clear input
      setNewTag('');
    } catch (err) {
      setError('Failed to add tag. Please try again.');
      console.error('Error adding tag:', err);
    }
  };
  
  const handleRemoveTag = async (tag) => {
    try {
      await leadService.updateLeadTags([lead.id], [tag], 'remove');
      
      // Update local state
      setLead({
        ...lead,
        tags: (lead.tags || []).filter(t => t !== tag)
      });
    } catch (err) {
      setError('Failed to remove tag. Please try again.');
      console.error('Error removing tag:', err);
    }
  };
  
  // Handle lead deletion
  const handleDeleteLead = async () => {
    if (window.confirm('Are you sure you want to delete this lead?')) {
      try {
        await leadService.deleteLead(id);
        navigate('/leads');
      } catch (err) {
        setError('Failed to delete lead. Please try again.');
        console.error('Error deleting lead:', err);
      }
    }
  };
  
  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography>Loading lead details...</Typography>
      </Box>
    );
  }
  
  if (error) {
    return (
      <Box sx={{ p: 3, color: 'error.main' }}>
        <Typography>{error}</Typography>
        <Button 
          variant="outlined" 
          startIcon={<ArrowBackIcon />} 
          component={RouterLink} 
          to="/leads"
          sx={{ mt: 2 }}
        >
          Back to Leads
        </Button>
      </Box>
    );
  }
  
  if (!lead) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography>Lead not found.</Typography>
        <Button 
          variant="outlined" 
          startIcon={<ArrowBackIcon />} 
          component={RouterLink} 
          to="/leads"
          sx={{ mt: 2 }}
        >
          Back to Leads
        </Button>
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Button 
            variant="outlined" 
            startIcon={<ArrowBackIcon />} 
            component={RouterLink} 
            to="/leads"
            sx={{ mr: 2 }}
          >
            Back
          </Button>
          <Typography variant="h4" component="h1">
            {lead.name}
          </Typography>
        </Box>
        <Box>
          <Button
            variant="outlined"
            color="primary"
            startIcon={<EditIcon />}
            component={RouterLink}
            to={`/leads/${id}/edit`}
            sx={{ mr: 1 }}
          >
            Edit
          </Button>
          <Button
            variant="outlined"
            color="error"
            startIcon={<DeleteIcon />}
            onClick={handleDeleteLead}
          >
            Delete
          </Button>
        </Box>
      </Box>

      {/* Status and Tags */}
      <Paper sx={{ mb: 3, p: 2 }}>
        <Grid container spacing={3}>
          <Grid item xs={12} sm={6}>
            <Typography variant="subtitle1" component="div" gutterBottom>
              Status
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              {LEAD_STATUS_OPTIONS.map(option => (
                <Chip
                  key={option.value}
                  label={option.label}
                  color={lead.status === option.value ? option.color : 'default'}
                  variant={lead.status === option.value ? 'filled' : 'outlined'}
                  onClick={() => handleStatusChange(option.value)}
                  clickable
                />
              ))}
            </Box>
          </Grid>
          <Grid item xs={12} sm={6}>
            <Typography variant="subtitle1" component="div" gutterBottom>
              Tags
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1 }}>
              {lead.tags && lead.tags.length > 0 ? (
                lead.tags.map(tag => (
                  <Chip
                    key={tag}
                    label={tag}
                    size="small"
                    onDelete={() => handleRemoveTag(tag)}
                  />
                ))
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No tags yet
                </Typography>
              )}
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <TextField
                size="small"
                label="New Tag"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                variant="outlined"
                placeholder="Enter tag name"
              />
              <Button
                variant="contained"
                size="small"
                startIcon={<AddIcon />}
                onClick={handleAddTag}
                disabled={!newTag}
              >
                Add
              </Button>
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {/* Lead Score */}
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mb: 1 }}>
          <Button
            startIcon={<EditIcon />}
            onClick={handleOpenScoreOverride}
            size="small"
            color="primary"
          >
            Override Score
          </Button>
          <Button
            startIcon={<RefreshIcon />}
            onClick={handleRefreshScore}
            disabled={scoreLoading}
            size="small"
          >
            Refresh Score
          </Button>
        </Box>
        <LeadScoreCard 
          scoreData={scoreData} 
          loading={scoreLoading} 
          error={scoreError} 
        />
      </Box>

      {/* Content Tabs */}
      <Box sx={{ width: '100%', mt: 3 }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs 
            value={tabValue} 
            onChange={handleTabChange}
            aria-label="lead detail tabs"
            variant="scrollable"
            scrollButtons="auto"
          >
            <Tab label="Info" />
            <Tab label="Tags" />
            <Tab label="Notes" />
            <Tab label="Score" />
          </Tabs>
        </Box>
        
        {/* Info Tab */}
        <TabPanel value={tabValue} index={0}>
          <Grid container spacing={3}>
            {/* Left column - Main Information */}
            <Grid item xs={12} md={8}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Organization Information
                  </Typography>
                  <Divider sx={{ mb: 2 }} />
                  
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="subtitle2" color="text.secondary">
                        Name
                      </Typography>
                      <Typography variant="body1" gutterBottom>
                        {lead.name}
                      </Typography>
                    </Grid>
                    
                    <Grid item xs={12} sm={6}>
                      <Typography variant="subtitle2" color="text.secondary">
                        Industry
                      </Typography>
                      <Typography variant="body1" gutterBottom>
                        {lead.industry || 'Not specified'}
                      </Typography>
                    </Grid>
                    
                    {lead.email && (
                      <Grid item xs={12} sm={6}>
                        <Typography variant="subtitle2" color="text.secondary">
                          Email
                        </Typography>
                        <Typography variant="body1" gutterBottom>
                          <Link href={`mailto:${lead.email}`} underline="hover">
                            {lead.email}
                          </Link>
                        </Typography>
                      </Grid>
                    )}
                    
                    {lead.phone && (
                      <Grid item xs={12} sm={6}>
                        <Typography variant="subtitle2" color="text.secondary">
                          Phone
                        </Typography>
                        <Typography variant="body1" gutterBottom>
                          <Link href={`tel:${lead.phone}`} underline="hover">
                            {lead.phone}
                          </Link>
                        </Typography>
                      </Grid>
                    )}
                    
                    {lead.website && (
                      <Grid item xs={12} sm={6}>
                        <Typography variant="subtitle2" color="text.secondary">
                          Website
                        </Typography>
                        <Typography variant="body1" gutterBottom>
                          <Link href={lead.website} target="_blank" rel="noopener" underline="hover">
                            {lead.website}
                          </Link>
                        </Typography>
                      </Grid>
                    )}
                    
                    {lead.location && (
                      <Grid item xs={12} sm={6}>
                        <Typography variant="subtitle2" color="text.secondary">
                          Location
                        </Typography>
                        <Typography variant="body1" gutterBottom>
                          {lead.location}
                        </Typography>
                      </Grid>
                    )}

                    {lead.employeeCount && (
                      <Grid item xs={12} sm={6}>
                        <Typography variant="subtitle2" color="text.secondary">
                          Employee Count
                        </Typography>
                        <Typography variant="body1" gutterBottom>
                          {lead.employeeCount.toLocaleString()}
                        </Typography>
                      </Grid>
                    )}

                    {lead.annualRevenue && (
                      <Grid item xs={12} sm={6}>
                        <Typography variant="subtitle2" color="text.secondary">
                          Annual Revenue
                        </Typography>
                        <Typography variant="body1" gutterBottom>
                          ${lead.annualRevenue.toLocaleString()}
                        </Typography>
                      </Grid>
                    )}

                    {lead.foundedYear && (
                      <Grid item xs={12} sm={6}>
                        <Typography variant="subtitle2" color="text.secondary">
                          Founded Year
                        </Typography>
                        <Typography variant="body1" gutterBottom>
                          {lead.foundedYear}
                        </Typography>
                      </Grid>
                    )}

                    {lead.linkedInUrl && (
                      <Grid item xs={12} sm={6}>
                        <Typography variant="subtitle2" color="text.secondary">
                          LinkedIn
                        </Typography>
                        <Typography variant="body1" gutterBottom>
                          <Link href={lead.linkedInUrl} target="_blank" rel="noopener" underline="hover">
                            {lead.linkedInUrl}
                          </Link>
                        </Typography>
                      </Grid>
                    )}
                  </Grid>
                  
                  {lead.description && (
                    <>
                      <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 2 }}>
                        Description
                      </Typography>
                      <Typography variant="body1" paragraph style={{ whiteSpace: 'pre-wrap' }}>
                        {lead.description}
                      </Typography>
                    </>
                  )}
                </CardContent>
              </Card>
              
              {/* Additional details card */}
              <Card sx={{ mt: 3 }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Application & Product Details
                  </Typography>
                  <Divider sx={{ mb: 2 }} />
                  
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="subtitle2" color="text.secondary">
                        Product
                      </Typography>
                      <Typography variant="body1" gutterBottom>
                        {product?.name || 'Loading...'}
                      </Typography>
                    </Grid>
                    
                    <Grid item xs={12} sm={6}>
                      <Typography variant="subtitle2" color="text.secondary">
                        Application
                      </Typography>
                      <Typography variant="body1" gutterBottom>
                        {application?.name || 'Loading...'}
                      </Typography>
                    </Grid>
                    
                    {product?.description && (
                      <Grid item xs={12}>
                        <Typography variant="subtitle2" color="text.secondary">
                          Product Description
                        </Typography>
                        <Typography variant="body1" paragraph>
                          {product.description}
                        </Typography>
                      </Grid>
                    )}
                    
                    {application?.description && (
                      <Grid item xs={12}>
                        <Typography variant="subtitle2" color="text.secondary">
                          Application Description
                        </Typography>
                        <Typography variant="body1" paragraph>
                          {application.description}
                        </Typography>
                      </Grid>
                    )}
                  </Grid>
                </CardContent>
              </Card>
            </Grid>
            
            {/* Right column - Status Information */}
            <Grid item xs={12} md={4}>
              <Card sx={{ mb: 3 }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Lead Status
                  </Typography>
                  <Divider sx={{ mb: 2 }} />
                  
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                      Current Status
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      {LEAD_STATUS_OPTIONS.map(option => (
                        <Chip
                          key={option.value}
                          label={option.label}
                          color={lead.status === option.value ? option.color : 'default'}
                          variant={lead.status === option.value ? 'filled' : 'outlined'}
                          onClick={() => handleStatusChange(option.value)}
                          clickable
                        />
                      ))}
                    </Box>
                  </Box>
                  
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                      Lead Score
                    </Typography>
                    {scoreData ? (
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <Box 
                          sx={{ 
                            width: 60, 
                            height: 60, 
                            borderRadius: '50%', 
                            bgcolor: scoreData.score > 70 ? 'success.main' : 
                                     scoreData.score > 40 ? 'warning.main' : 'error.main',
                            color: 'white',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 'bold',
                            fontSize: '1.5rem',
                          }}
                        >
                          {scoreData.score}
                        </Box>
                        <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                          {scoreData.score > 70 ? 'High potential' : 
                           scoreData.score > 40 ? 'Medium potential' : 'Low potential'}
                        </Typography>
                      </Box>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        {scoreLoading ? 'Loading score...' : 'No score available'}
                      </Typography>
                    )}
                  </Box>
                  
                  <Divider sx={{ my: 2 }} />
                  
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                      Tags
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {lead.tags && lead.tags.length > 0 ? (
                        lead.tags.map(tag => (
                          <Chip
                            key={tag}
                            label={tag}
                            size="small"
                            variant="outlined"
                          />
                        ))
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          No tags yet
                        </Typography>
                      )}
                    </Box>
                  </Box>
                  
                  <Divider sx={{ my: 2 }} />
                  
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                      Created
                    </Typography>
                    <Typography variant="body2">
                      {new Date(lead.createdAt).toLocaleString()}
                    </Typography>
                    
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom sx={{ mt: 2 }}>
                      Last Updated
                    </Typography>
                    <Typography variant="body2">
                      {new Date(lead.updatedAt).toLocaleString()}
                    </Typography>
                    
                    {lead.lastEnriched && (
                      <>
                        <Typography variant="subtitle2" color="text.secondary" gutterBottom sx={{ mt: 2 }}>
                          Last Enriched
                        </Typography>
                        <Typography variant="body2">
                          {new Date(lead.lastEnriched).toLocaleString()}
                        </Typography>
                      </>
                    )}
                  </Box>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Quick Actions
                  </Typography>
                  <Divider sx={{ mb: 2 }} />
                  
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <Button
                      variant="outlined"
                      startIcon={<EditIcon />}
                      component={RouterLink}
                      to={`/leads/${id}/edit`}
                      fullWidth
                    >
                      Edit Lead
                    </Button>
                    
                    <Button
                      variant="outlined"
                      startIcon={<RefreshIcon />}
                      onClick={handleRefreshScore}
                      disabled={scoreLoading}
                      fullWidth
                    >
                      Refresh Score
                    </Button>
                    
                    <Button
                      variant="outlined"
                      startIcon={<DataEnrichmentIcon />}
                      onClick={handleOpenDataOverride}
                      fullWidth
                    >
                      Update Enrichment Data
                    </Button>
                    
                    <Button
                      variant="outlined"
                      color="error"
                      startIcon={<DeleteIcon />}
                      onClick={handleDeleteLead}
                      fullWidth
                    >
                      Delete Lead
                    </Button>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </TabPanel>
        
        {/* Tags Tab */}
        <TabPanel value={tabValue} index={1}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Lead Tags
              </Typography>
              <Divider sx={{ mb: 2 }} />
              
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Add, edit, or remove tags for this lead. Tags help you categorize and filter leads.
              </Typography>
              
              <TagSelector 
                selectedTags={lead.tags || []} 
                onTagsChange={(newTags) => {
                  // Handle tag changes
                  handleTagsChange(newTags);
                }}
              />
            </CardContent>
          </Card>
        </TabPanel>
        
        {/* Notes Tab */}
        <TabPanel value={tabValue} index={2}>
          <LeadNotes leadId={id} />
        </TabPanel>
        
        {/* Score Tab */}
        <TabPanel value={tabValue} index={3}>
          <Box sx={{ mb: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mb: 1 }}>
              <Button
                startIcon={<EditIcon />}
                onClick={handleOpenScoreOverride}
                size="small"
                color="primary"
              >
                Override Score
              </Button>
              <Button
                startIcon={<RefreshIcon />}
                onClick={handleRefreshScore}
                disabled={scoreLoading}
                size="small"
              >
                Refresh Score
              </Button>
            </Box>
            <LeadScoreCard 
              scoreData={scoreData} 
              loading={scoreLoading} 
              error={scoreError} 
            />
          </Box>
        </TabPanel>
      </Box>

      {/* Score Override Dialog */}
      <ScoreOverrideDialog
        open={scoreOverrideOpen}
        onClose={handleCloseScoreOverride}
        leadId={lead.id}
        currentScore={scoreData}
        onScoreUpdate={fetchLeadScore}
      />

      {/* Data Override Dialog */}
      <EnrichmentDataOverrideDialog
        open={dataOverrideOpen}
        onClose={handleCloseDataOverride}
        lead={lead}
        onLeadUpdate={handleLeadUpdate}
      />
    </Box>
  );
};

export default LeadDetail; 