import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  Grid,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  TextField,
  Tooltip,
  Typography,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Alert,
} from '@mui/material';
import {
  Add as AddIcon,
  Search as SearchIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Info as InfoIcon,
  Label as LabelIcon,
  Send as SendIcon,
  Check as CheckIcon,
  Close as CloseIcon,
  Score as ScoreIcon,
  AutoFixHigh as DataEnrichmentIcon,
  RestartAlt as ResetIcon,
  Download as DownloadIcon,
} from '@mui/icons-material';

import * as leadService from '../../services/api/leadService';
import productService from '../../services/api/productService';
import applicationService from '../../services/api/applicationService';
import BatchScoreDialog from '../../components/lead/BatchScoreDialog';
import ScoreBadge from '../../components/lead/ScoreBadge';
import BatchEnrichment from '../../components/lead/BatchEnrichment';
import FilterPanel from '../../components/lead/FilterPanel';
import SortableTable from '../../components/common/SortableTable';
import useTableSort from '../../hooks/useTableSort';
import { exportToCSV } from '../../utils/exportUtils';

const LEAD_STATUS_OPTIONS = [
  { value: 'NEW', label: 'New', color: 'primary' },
  { value: 'CONTACTED', label: 'Contacted', color: 'info' },
  { value: 'QUALIFIED', label: 'Qualified', color: 'success' },
  { value: 'LOST', label: 'Lost', color: 'error' },
  { value: 'WON', label: 'Won', color: 'secondary' },
];

const LeadList = () => {
  // State for leads data
  const [leads, setLeads] = useState([]);
  const [totalLeads, setTotalLeads] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // State for related data
  const [products, setProducts] = useState([]);
  
  // State for pagination and sorting
  const [page, setPage] = useState(0);
  const [limit, setLimit] = useState(10);
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortDir, setSortDir] = useState('desc');
  
  // State for filtering
  const [filters, setFilters] = useState({
    status: '',
    productId: '',
    applicationId: '',
    industry: '',
    regionIds: [],
    countryIds: [],
    applicationIds: [],
    industries: [],
    minScore: 0,
    maxScore: 100
  });
  
  // State for search
  const [searchQuery, setSearchQuery] = useState('');
  
  // State for selected leads
  const [selectedLeads, setSelectedLeads] = useState([]);
  
  // State for tag management dialog
  const [tagDialogOpen, setTagDialogOpen] = useState(false);
  const [tagOperation, setTagOperation] = useState('add');
  const [newTag, setNewTag] = useState('');
  
  // State for status update dialog
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [newStatus, setNewStatus] = useState('');

  // State for score dialog
  const [scoreDialogOpen, setScoreDialogOpen] = useState(false);
  const [scoreFilters, setScoreFilters] = useState({ minScore: 0, maxScore: 100 });
  const [scoredLeads, setScoredLeads] = useState({});

  // State for batch enrichment dialog
  const [enrichmentOpen, setEnrichmentOpen] = useState(false);

  // State for filter presets
  const [filterPresets, setFilterPresets] = useState([]);
  
  // State for export dialog
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState('csv');

  // Function to fetch leads with current filters - Wrapped in useCallback
  const fetchLeads = useCallback(async () => {
    try {
      setLoading(true);
      
      // Prepare query parameters
      const params = {
        page: page + 1, // API uses 1-based indexing
        limit,
        sortBy,
        sortDir,
        status: filters.status,
        productId: filters.productId,
      };
      
      // Add application filter (can be single or multiple)
      if (filters.applicationId) {
        params.applicationId = filters.applicationId;
      } else if (filters.applicationIds && filters.applicationIds.length > 0) {
        params.applicationIds = filters.applicationIds.join(',');
      }
      
      // Add region filter
      if (filters.regionIds && filters.regionIds.length > 0) {
        params.regionIds = filters.regionIds.join(',');
      }
      
      // Add country filter
      if (filters.countryIds && filters.countryIds.length > 0) {
        params.countryIds = filters.countryIds.join(',');
      }
      
      // Add industry filter
      if (filters.industry) {
        params.industry = filters.industry;
      } else if (filters.industries && filters.industries.length > 0) {
        params.industries = filters.industries.join(',');
      }
      
      // Add score filter
      if (filters.minScore > 0 || filters.maxScore < 100) {
        params.minScore = filters.minScore;
        params.maxScore = filters.maxScore;
      }
      
      // Add search query if present
      if (searchQuery) {
        params.search = searchQuery;
      }
      
      // Fetch leads
      const response = await leadService.getLeads(params);
      
      setLeads(response.data || []);
      setTotalLeads(response.pagination?.total || 0);
      setLoading(false);
    } catch (err) {
      setError('Failed to load leads. Please try again.');
      setLoading(false);
      console.error('Error fetching leads:', err);
    }
  }, [page, limit, sortBy, sortDir, filters, searchQuery]); // Dependencies for fetchLeads
  
  // Fetch initial data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Fetch ONLY products for filters (Applications are now included with leads)
        // const [productsData, applicationsData] = await Promise.all([
        //   productService.getProducts(),
        //   applicationService.getApplications(),
        // ]);
        const productsData = await productService.getProducts();
        
        setProducts(productsData || []);
        // setApplications(applicationsData || []); // Remove
        
        // Fetch leads (which now include relations)
        await fetchLeads();
        
        setLoading(false);
      } catch (err) {
        setError('Failed to load lead data. Please try again later.');
        setLoading(false);
        console.error('Error fetching lead data:', err);
      }
    };
    
    fetchData();
  }, [fetchLeads]); // Added fetchLeads dependency
  
  // Fetch leads whenever filters, pagination, or sorting changes
  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]); // fetchLeads is now stable
  
  // Handle basic filter changes (single value filters)
  const handleFilterChange = (event) => {
    const { name, value } = event.target;
    // Reset to first page when filters change
    setPage(0);
    setFilters({
      ...filters,
      [name]: value
    });
  };
  
  // Handle advanced filter changes (from FilterPanel)
  const handleAdvancedFilterChange = (newFilters) => {
    // Reset to first page when filters change
    setPage(0);
    setFilters({
      ...filters,
      ...newFilters
    });
  };
  
  // Reset all filters
  const handleFilterReset = () => {
    setPage(0);
    setFilters({
      status: '',
      productId: '',
      applicationId: '',
      industry: '',
      regionIds: [],
      countryIds: [],
      applicationIds: [],
      industries: [],
      minScore: 0,
      maxScore: 100
    });
  };
  
  // Save current filter as a preset
  const handleFilterSave = (filtersToSave) => {
    // Open a dialog to name the preset
    const presetName = prompt('Enter a name for this filter preset:');
    if (presetName) {
      const newPreset = {
        id: Date.now(), // simple unique ID
        name: presetName,
        filters: { ...filtersToSave }
      };
      
      setFilterPresets([...filterPresets, newPreset]);
      
      // Save to localStorage for persistence
      try {
        const existingPresets = JSON.parse(localStorage.getItem('leadFilterPresets') || '[]');
        existingPresets.push(newPreset);
        localStorage.setItem('leadFilterPresets', JSON.stringify(existingPresets));
      } catch (error) {
        console.error('Error saving filter preset to localStorage:', error);
      }
    }
  };
  
  // Load filter presets from localStorage on component mount
  useEffect(() => {
    try {
      const savedPresets = JSON.parse(localStorage.getItem('leadFilterPresets') || '[]');
      if (savedPresets.length > 0) {
        setFilterPresets(savedPresets);
      }
    } catch (error) {
      console.error('Error loading filter presets from localStorage:', error);
    }
  }, []);
  
  // Apply a saved filter preset
  const handleApplyPreset = (preset) => {
    setPage(0);
    setFilters({
      ...filters,
      ...preset.filters
    });
  };
  
  // Handle search
  const handleSearch = (event) => {
    setSearchQuery(event.target.value);
    setPage(0); // Reset to first page when search changes
  };
  
  // Handle sorting
  const handleRequestSort = (property) => {
    const isAsc = sortBy === property && sortDir === 'asc';
    setSortDir(isAsc ? 'desc' : 'asc');
    setSortBy(property);
  };
  
  // Handle pagination
  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };
  
  const handleChangeRowsPerPage = (event) => {
    setLimit(parseInt(event.target.value, 10));
    setPage(0);
  };
  
  // Handle lead selection
  const handleSelectLead = (leadId) => {
    setSelectedLeads(prev => {
      if (prev.includes(leadId)) {
        return prev.filter(id => id !== leadId);
      } else {
        return [...prev, leadId];
      }
    });
  };
  
  const handleSelectAllLeads = (event) => {
    if (event.target.checked) {
      setSelectedLeads(leads.map(lead => lead.id));
    } else {
      setSelectedLeads([]);
    }
  };
  
  // Handle tag operations
  const handleTagDialogOpen = (operation = 'add') => {
    setTagOperation(operation);
    setTagDialogOpen(true);
  };
  
  const handleTagDialogClose = () => {
    setTagDialogOpen(false);
    setNewTag('');
  };
  
  const handleApplyTag = async () => {
    if (!newTag || selectedLeads.length === 0) return;
    
    try {
      await leadService.updateLeadTags(selectedLeads, [newTag], tagOperation);
      handleTagDialogClose();
      fetchLeads(); // Refresh lead data
    } catch (err) {
      setError('Failed to update tags. Please try again.');
      console.error('Error updating tags:', err);
    }
  };
  
  // Handle status update
  const handleStatusDialogOpen = () => {
    setStatusDialogOpen(true);
  };
  
  const handleStatusDialogClose = () => {
    setStatusDialogOpen(false);
    setNewStatus('');
  };
  
  const handleUpdateStatus = async () => {
    if (!newStatus || selectedLeads.length === 0) return;
    
    try {
      await leadService.updateLeadStatus(selectedLeads, newStatus);
      handleStatusDialogClose();
      fetchLeads(); // Refresh lead data
    } catch (err) {
      setError('Failed to update status. Please try again.');
      console.error('Error updating status:', err);
    }
  };
  
  // Handle lead deletion
  const handleDeleteLead = async (id) => {
    if (window.confirm('Are you sure you want to delete this lead?')) {
      try {
        await leadService.deleteLead(id);
        // Refresh lead list
        fetchLeads();
      } catch (err) {
        setError('Failed to delete lead. Please try again.');
        console.error('Error deleting lead:', err);
      }
    }
  };
  
  // Helper functions
  const getProductName = (productId) => {
    const product = products.find(p => p.id === productId);
    return product ? product.name : 'Unknown Product';
  };
  
  const getStatusChip = (status) => {
    const statusOption = LEAD_STATUS_OPTIONS.find(opt => opt.value === status) || 
      { value: status, label: status, color: 'default' };
    
    return (
      <Chip
        label={statusOption.label}
        color={statusOption.color}
        size="small"
      />
    );
  };
  
  const getTagChips = (tags) => {
    if (!tags || tags.length === 0) return null;
    
    return (
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
        {tags.map(tag => (
          <Chip 
            key={tag} 
            label={tag} 
            size="small" 
            variant="outlined" 
          />
        ))}
      </Box>
    );
  };

  // Add this to your useEffect where you load leads or create a new one
  useEffect(() => {
    const fetchScoredLeads = async () => {
      try {
        // Only fetch if we have leads to display
        if (leads.length > 0) {
          const response = await leadService.getScoredLeads({
            ...scoreFilters,
            page: 1,
            limit: 1000 // We'll filter client-side for now
          });
          
          // Create a map of leadId -> score for easy lookup
          const scoreMap = {};
          response.data.forEach(lead => {
            scoreMap[lead.id] = lead.score;
          });
          
          setScoredLeads(scoreMap);
        }
      } catch (error) {
        console.error('Error fetching scored leads:', error);
      }
    };
    
    fetchScoredLeads();
  }, [leads, scoreFilters]);

  // Add these handler functions
  const handleScoreFilterChange = (filters) => {
    setScoreFilters(filters);
  };

  // This is the updated version of the handler function for toggling lead selection
  const handleToggleLeadSelection = (leadId) => {
    setSelectedLeads(prev => {
      if (prev.includes(leadId)) {
        return prev.filter(id => id !== leadId);
      } else {
        return [...prev, leadId];
      }
    });
  };

  const handleOpenScoreDialog = () => {
    if (selectedLeads.length > 0) {
      setScoreDialogOpen(true);
    }
  };

  const handleCloseScoreDialog = () => {
    setScoreDialogOpen(false);
  };

  const handleScoreComplete = (results) => {
    // Update the local state with new scores
    const newScores = { ...scoredLeads };
    
    results.forEach(result => {
      if (!result.error) {
        newScores[result.leadId] = result.score;
      }
    });
    
    setScoredLeads(newScores);
  };

  const handleOpenEnrichment = () => {
    setEnrichmentOpen(true);
  };

  const handleCloseEnrichment = () => {
    setEnrichmentOpen(false);
  };

  // Setup server-side sort handler for the useTableSort hook
  const handleServerSideSort = (property, direction) => {
    setSortBy(property);
    setSortDir(direction);
    // Page will reset to 0 on sort change
    setPage(0);
  };

  // Define table columns configuration
  const tableColumns = useMemo(() => [
    {
      field: 'name',
      label: 'Organization',
      sortable: true,
      render: (lead) => (
        <Box>
          <Typography variant="subtitle2">{lead.name}</Typography>
          {lead.website && (
            <Typography variant="caption" display="block" color="text.secondary">
              {lead.website}
            </Typography>
          )}
        </Box>
      ),
    },
    {
      field: 'status',
      label: 'Status',
      sortable: true,
      render: (lead) => getStatusChip(lead.status),
    },
    {
      field: 'industry',
      label: 'Industry',
      sortable: true,
      render: (lead) => lead.industry || '-',
    },
    {
      field: 'productId',
      label: 'Product',
      sortable: true,
      responsive: 'desktop',
      render: (lead) => getProductName(lead.productId),
    },
    {
      id: 'applicationContext',
      label: 'Application/Research',
      sortable: true,
      responsive: 'desktop',
      render: (lead) => {
        if (lead.sourceResearch?.applicationName) {
          return `Research: ${lead.sourceResearch.applicationName}`;
        } else if (lead.application?.name) {
          return lead.application.name;
        } else {
          return 'N/A';
        }
      },
    },
    {
      field: 'tags',
      label: 'Tags',
      sortable: false,
      responsive: 'tablet',
      render: (lead) => getTagChips(lead.tags),
    },
    {
      field: 'score',
      label: 'Score',
      sortable: true,
      render: (lead) => (
        scoredLeads[lead.id] !== undefined ? (
          <ScoreBadge score={scoredLeads[lead.id]} size="small" />
        ) : (
          <ScoreBadge score={null} size="small" />
        )
      ),
    },
    {
      field: 'createdAt',
      label: 'Created',
      sortable: true,
      render: (lead) => (
        <Tooltip title={new Date(lead.createdAt).toLocaleString()}>
          <span>{new Date(lead.createdAt).toLocaleDateString()}</span>
        </Tooltip>
      ),
    },
  ], [scoredLeads, getProductName]);

  // Action buttons renderer for table
  const renderActionButtons = (lead) => (
    <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
      <Tooltip title="View Details">
        <IconButton
          color="info"
          component={RouterLink}
          to={`/leads/${lead.id}`}
          size="small"
          aria-label={`View ${lead.name} details`}
        >
          <InfoIcon />
        </IconButton>
      </Tooltip>
      <Tooltip title="Edit Lead">
        <IconButton
          color="primary"
          component={RouterLink}
          to={`/leads/${lead.id}/edit`}
          size="small"
          aria-label={`Edit ${lead.name}`}
        >
          <EditIcon />
        </IconButton>
      </Tooltip>
      <Tooltip title="Delete Lead">
        <IconButton
          color="error"
          onClick={() => handleDeleteLead(lead.id)}
          size="small"
          aria-label={`Delete ${lead.name}`}
        >
          <DeleteIcon />
        </IconButton>
      </Tooltip>
    </Box>
  );

  // Handle export dialog
  const handleOpenExportDialog = () => {
    setExportDialogOpen(true);
  };
  
  const handleCloseExportDialog = () => {
    setExportDialogOpen(false);
  };
  
  const handleExportFormatChange = (event) => {
    setExportFormat(event.target.value);
  };
  
  const handleExportConfirm = () => {
    // Currently only supporting CSV, but could add other formats
    if (exportFormat === 'csv') {
      exportLeadsToCSV();
    }
    handleCloseExportDialog();
  };

  // Handle export functionality
  const exportLeadsToCSV = () => {
    const dataToExport = leads.map(lead => ({
      ...lead,
      // Apply the same display logic for the export
      applicationContext: lead.sourceResearch?.applicationName 
                          ? `Research: ${lead.sourceResearch.applicationName}` 
                          : lead.application?.name || 'N/A',
      productName: getProductName(lead.productId),
      // Remove the incorrect applicationName field
      // applicationName: getProductName(lead.applicationId)
    }));

    // Define headers for CSV
    const headers = [
      { label: 'ID', key: 'id' },
      { label: 'Name', key: 'name' },
      { label: 'Status', key: 'status' },
      { label: 'Industry', key: 'industry' },
      { label: 'Website', key: 'website' },
      { label: 'Application/Research', key: 'applicationContext' }, // Use the new key
      { label: 'Product', key: 'productName' }, 
      // Add other relevant headers
    ];

    exportToCSV(dataToExport, headers, 'leads_export.csv');
    handleCloseExportDialog();
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" sx={{ mb: 3 }}>Lead Management</Typography>
      
      {/* Error message */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}
      
      {/* Top actions bar */}
      <Box sx={{ display: 'flex', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          component={RouterLink}
          to="/leads/create"
        >
          Add Lead
        </Button>
        
        {/* Bulk actions */}
        {selectedLeads.length > 0 && (
          <>
            <Button 
              variant="outlined" 
              startIcon={<LabelIcon />}
              onClick={() => handleTagDialogOpen('add')}
            >
              Add Tag
            </Button>
            <Button 
              variant="outlined" 
              startIcon={<LabelIcon />}
              onClick={() => handleTagDialogOpen('remove')}
            >
              Remove Tag
            </Button>
            <Button 
              variant="outlined" 
              startIcon={<ScoreIcon />}
              onClick={handleOpenScoreDialog}
            >
              Score Selected
            </Button>
            <Button
              variant="outlined"
              startIcon={<DataEnrichmentIcon />}
              onClick={handleOpenEnrichment}
            >
              Enrich Selected
            </Button>
            <Button 
              variant="outlined" 
              startIcon={<SendIcon />}
              onClick={handleStatusDialogOpen}
            >
              Update Status
            </Button>
            <Button 
              variant="outlined" 
              startIcon={<DownloadIcon />}
              onClick={handleOpenExportDialog}
            >
              Export Selected
            </Button>
          </>
        )}
      </Box>
      
      {/* Search and basic filters */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            variant="outlined"
            placeholder="Search leads..."
            value={searchQuery}
            onChange={handleSearch}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
          />
        </Grid>
        <Grid item xs={12} md={3}>
          <FormControl fullWidth variant="outlined">
            <InputLabel id="status-filter-label">Status</InputLabel>
            <Select
              labelId="status-filter-label"
              id="status-filter"
              name="status"
              value={filters.status}
              onChange={handleFilterChange}
              label="Status"
            >
              <MenuItem value="">All Statuses</MenuItem>
              {LEAD_STATUS_OPTIONS.map(option => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} md={3}>
          <FormControl fullWidth variant="outlined">
            <InputLabel id="product-filter-label">Product</InputLabel>
            <Select
              labelId="product-filter-label"
              id="product-filter"
              name="productId"
              value={filters.productId}
              onChange={handleFilterChange}
              label="Product"
            >
              <MenuItem value="">All Products</MenuItem>
              {products.map(product => (
                <MenuItem key={product.id} value={product.id}>
                  {product.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
      </Grid>
      
      {/* Main content with filters and lead list */}
      <Grid container spacing={3}>
        {/* Filter panel */}
        <Grid item xs={12} md={3}>
          <FilterPanel
            onFilterChange={handleAdvancedFilterChange}
            initialValues={filters}
            onFilterReset={handleFilterReset}
            onFilterSave={handleFilterSave}
          />
          
          {/* Filter presets */}
          {filterPresets.length > 0 && (
            <Paper sx={{ p: 2, mt: 2 }}>
              <Typography variant="h6" sx={{ mb: 1 }}>Saved Filters</Typography>
              <List dense>
                {filterPresets.map(preset => (
                  <ListItem key={preset.id} disablePadding>
                    <ListItemButton onClick={() => handleApplyPreset(preset)}>
                      <ListItemText primary={preset.name} />
                    </ListItemButton>
                  </ListItem>
                ))}
              </List>
            </Paper>
          )}
        </Grid>
        
        {/* Lead list */}
        <Grid item xs={12} md={9}>
          <SortableTable
            columns={tableColumns}
            data={leads}
            initialSort={{ field: sortBy, direction: sortDir }}
            onRowClick={(lead) => handleSelectLead(lead.id)}
            selectedRows={selectedLeads}
            onSelectRow={handleToggleLeadSelection}
            onSelectAll={handleSelectAllLeads}
            loading={loading}
            pagination={true}
            totalCount={totalLeads}
            page={page}
            rowsPerPage={limit}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
            emptyMessage={
              <Box>
                <Typography variant="body1" color="text.secondary">
                  No leads found. Try adjusting your filters or search criteria.
                </Typography>
                <Button 
                  variant="outlined" 
                  startIcon={<ResetIcon />}
                  onClick={handleFilterReset}
                  sx={{ mt: 2 }}
                >
                  Reset Filters
                </Button>
              </Box>
            }
            renderActions={renderActionButtons}
            serverSideSort={handleServerSideSort}
            stickyHeader={true}
            maxHeight={650}
          />
        </Grid>
      </Grid>

      {/* Tag Dialog */}
      <Dialog open={tagDialogOpen} onClose={handleTagDialogClose}>
        <DialogTitle>
          {tagOperation === 'add' ? 'Add Tag' : 'Remove Tag'} for {selectedLeads.length} Leads
        </DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Tag"
            fullWidth
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            variant="outlined"
            placeholder="Enter tag name"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleTagDialogClose}>Cancel</Button>
          <Button 
            onClick={handleApplyTag} 
            variant="contained" 
            color="primary"
            startIcon={tagOperation === 'add' ? <AddIcon /> : <CloseIcon />}
            disabled={!newTag}
          >
            {tagOperation === 'add' ? 'Add Tag' : 'Remove Tag'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Status Update Dialog */}
      <Dialog open={statusDialogOpen} onClose={handleStatusDialogClose}>
        <DialogTitle>
          Update Status for {selectedLeads.length} Leads
        </DialogTitle>
        <DialogContent>
          <FormControl fullWidth margin="dense">
            <InputLabel>New Status</InputLabel>
            <Select
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value)}
              label="New Status"
            >
              {LEAD_STATUS_OPTIONS.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleStatusDialogClose}>Cancel</Button>
          <Button 
            onClick={handleUpdateStatus} 
            variant="contained" 
            color="primary"
            startIcon={<CheckIcon />}
            disabled={!newStatus}
          >
            Update Status
          </Button>
        </DialogActions>
      </Dialog>

      {/* Score Dialog */}
      <BatchScoreDialog
        open={scoreDialogOpen}
        onClose={handleCloseScoreDialog}
        leadIds={selectedLeads}
        onComplete={handleScoreComplete}
      />

      {/* Batch Enrichment Dialog */}
      <Dialog
        open={enrichmentOpen}
        onClose={handleCloseEnrichment}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>
          Lead Enrichment
          <IconButton
            edge="end"
            color="inherit"
            onClick={handleCloseEnrichment}
            aria-label="close"
            sx={{ position: 'absolute', right: 8, top: 8 }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <BatchEnrichment />
        </DialogContent>
      </Dialog>

      {/* Export Dialog */}
      <Dialog open={exportDialogOpen} onClose={handleCloseExportDialog}>
        <DialogTitle>Export Leads</DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 2 }}>
            Export {selectedLeads.length} selected lead(s).
          </Typography>
          <FormControl fullWidth>
            <InputLabel id="export-format-label">Export Format</InputLabel>
            <Select
              labelId="export-format-label"
              id="export-format"
              value={exportFormat}
              label="Export Format"
              onChange={handleExportFormatChange}
            >
              <MenuItem value="csv">CSV</MenuItem>
              {/* Add additional formats as needed */}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseExportDialog} startIcon={<CloseIcon />}>
            Cancel
          </Button>
          <Button 
            onClick={handleExportConfirm} 
            variant="contained" 
            startIcon={<DownloadIcon />}
          >
            Export
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default LeadList; 