import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import {
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  CircularProgress,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  IconButton,
  LinearProgress,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Tooltip,
  Typography,
  Checkbox,
} from '@mui/material';
import {
  Add as AddIcon,
  Refresh as RefreshIcon,
  Cancel as CancelIcon,
  Replay as ReplayIcon,
  Info as InfoIcon,
  Error as ErrorIcon,
  CheckCircle as CheckCircleIcon,
  Pending as PendingIcon,
  MoreVert as MoreVertIcon,
} from '@mui/icons-material';

import * as enrichmentService from '../../services/api/enrichmentService';
import * as leadService from '../../services/api/leadService';

/**
 * Component for batch lead enrichment management
 * @param {Object} props - Component props
 * @param {boolean} props.open - Whether the dialog is open
 * @param {Function} props.onClose - Function to call when dialog is closed
 * @param {Array<number>} props.leadIds - Array of lead IDs to enrich
 * @param {Function} props.onComplete - Function to call when enrichment completes
 */
const BatchEnrichment = ({ open, onClose, leadIds = [], onComplete }) => {
  // State for batches list
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Pagination state
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  
  // Selected batch details
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [batchDetailsOpen, setBatchDetailsOpen] = useState(false);
  const [batchDetailsLoading, setBatchDetailsLoading] = useState(false);
  
  // New batch dialog
  const [newBatchDialogOpen, setNewBatchDialogOpen] = useState(false);
  const [selectedLeads, setSelectedLeads] = useState([]);
  const [availableLeads, setAvailableLeads] = useState([]);
  const [leadsLoading, setLeadsLoading] = useState(false);
  const [batchName, setBatchName] = useState('');
  const [batchDescription, setBatchDescription] = useState('');
  const [creatingBatch, setCreatingBatch] = useState(false);
  
  // Initialize with provided leadIds if present
  useEffect(() => {
    if (leadIds && leadIds.length > 0) {
      setSelectedLeads(leadIds);
    }
  }, [leadIds]);
  
  // Load batches on mount and when pagination changes
  useEffect(() => {
    if (open) {
      fetchBatches();
    }
  }, [page, rowsPerPage, open]);
  
  // Periodically refresh active batches
  useEffect(() => {
    const hasActiveBatches = batches.some(
      batch => batch.status === 'PENDING' || batch.status === 'PROCESSING'
    );
    
    if (hasActiveBatches && open) {
      const interval = setInterval(() => {
        fetchBatches(false); // Silent refresh (no loading indicator)
        
        // Also refresh selected batch details if open
        if (selectedBatch && batchDetailsOpen) {
          fetchBatchDetails(selectedBatch.id, false);
        }
      }, 5000);
      
      return () => clearInterval(interval);
    }
  }, [batches, selectedBatch, batchDetailsOpen, open]);

  // Function to handle dialog close
  const handleDialogClose = () => {
    if (onClose) {
      onClose();
    }
  };
  
  // Function to handle completion
  const handleComplete = () => {
    if (onComplete) {
      onComplete();
    }
    handleDialogClose();
  };
  
  // Fetch batches list
  const fetchBatches = async (showLoading = true) => {
    try {
      if (showLoading) {
        setLoading(true);
      }
      
      const result = await enrichmentService.getEnrichmentBatches({
        page: page + 1, // API uses 1-based pagination
        limit: rowsPerPage,
      });
      
      setBatches(result.data);
      setTotalCount(result.pagination.total);
      setError(null);
    } catch (err) {
      console.error('Error fetching batches:', err);
      setError('Failed to load enrichment batches. Please try again.');
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  };
  
  // Fetch batch details
  const fetchBatchDetails = async (batchId, showLoading = true) => {
    try {
      if (showLoading) {
        setBatchDetailsLoading(true);
      }
      
      const batchDetails = await enrichmentService.getEnrichmentBatchById(batchId);
      setSelectedBatch(batchDetails);
    } catch (err) {
      console.error(`Error fetching batch ${batchId} details:`, err);
      setError(`Failed to load batch details. ${err.message}`);
    } finally {
      if (showLoading) {
        setBatchDetailsLoading(false);
      }
    }
  };
  
  // Handle opening batch details dialog
  const handleOpenBatchDetails = (batch) => {
    setSelectedBatch(batch);
    setBatchDetailsOpen(true);
    fetchBatchDetails(batch.id);
  };
  
  // Handle closing batch details dialog
  const handleCloseBatchDetails = () => {
    setBatchDetailsOpen(false);
  };
  
  // Handle pagination changes
  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };
  
  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };
  
  // Handle canceling a batch
  const handleCancelBatch = async (batchId) => {
    try {
      await enrichmentService.cancelEnrichmentBatch(batchId);
      
      // Refresh batches list
      fetchBatches();
      
      // Refresh batch details if open
      if (selectedBatch && selectedBatch.id === batchId && batchDetailsOpen) {
        fetchBatchDetails(batchId);
      }
    } catch (err) {
      console.error(`Error canceling batch ${batchId}:`, err);
      setError(`Failed to cancel batch. ${err.message}`);
    }
  };
  
  // Handle restarting a job
  const handleRestartJob = async (jobId) => {
    try {
      await enrichmentService.restartEnrichmentJob(jobId);
      
      // Refresh batch details if open
      if (selectedBatch && batchDetailsOpen) {
        fetchBatchDetails(selectedBatch.id);
      }
    } catch (err) {
      console.error(`Error restarting job ${jobId}:`, err);
      setError(`Failed to restart job. ${err.message}`);
    }
  };
  
  // Open new batch dialog
  const handleOpenNewBatchDialog = async () => {
    try {
      setLeadsLoading(true);
      setNewBatchDialogOpen(true);
      
      // Fetch leads that might need enrichment
      const leadsResult = await leadService.getLeads();
      setAvailableLeads(leadsResult.data);
    } catch (err) {
      console.error('Error fetching leads:', err);
      setError('Failed to load leads for batch creation.');
    } finally {
      setLeadsLoading(false);
    }
  };
  
  // Close new batch dialog
  const handleCloseNewBatchDialog = () => {
    setNewBatchDialogOpen(false);
    setSelectedLeads([]);
    setBatchName('');
    setBatchDescription('');
  };
  
  // Toggle lead selection
  const handleToggleLeadSelection = (leadId) => {
    if (selectedLeads.includes(leadId)) {
      setSelectedLeads(selectedLeads.filter(id => id !== leadId));
    } else {
      setSelectedLeads([...selectedLeads, leadId]);
    }
  };
  
  // Create a new batch (original function for the New Batch dialog)
  const handleCreateBatch = async () => {
    if (selectedLeads.length === 0) {
      setError('Please select at least one lead for the batch.');
      return;
    }
    
    try {
      setCreatingBatch(true);
      
      await enrichmentService.createEnrichmentBatch(selectedLeads, {
        name: batchName || `Enrichment Batch ${new Date().toLocaleString()}`,
        description: batchDescription,
      });
      
      // Close dialog and refresh batches list
      handleCloseNewBatchDialog();
      fetchBatches();
    } catch (err) {
      console.error('Error creating batch:', err);
      setError(`Failed to create enrichment batch. ${err.message}`);
    } finally {
      setCreatingBatch(false);
    }
  };
  
  // Create a new batch with provided leadIds
  const handleCreateBatchWithSelected = async () => {
    if (selectedLeads.length === 0) {
      setError('Please select at least one lead for the batch.');
      return;
    }
    
    try {
      setCreatingBatch(true);
      
      await enrichmentService.createEnrichmentBatch(selectedLeads, {
        name: batchName || `Enrichment Batch ${new Date().toLocaleString()}`,
        description: batchDescription,
      });
      
      // Run onComplete callback
      handleComplete();
      
      // Close dialog and refresh batches list
      handleCloseNewBatchDialog();
      fetchBatches();
    } catch (err) {
      console.error('Error creating batch:', err);
      setError(`Failed to create enrichment batch. ${err.message}`);
    } finally {
      setCreatingBatch(false);
    }
  };
  
  // Get status chip color
  const getStatusColor = (status) => {
    const statusColors = {
      PENDING: 'default',
      PROCESSING: 'primary',
      COMPLETED: 'success',
      FAILED: 'error',
    };
    
    return statusColors[status] || 'default';
  };
  
  // Get status icon
  const getStatusIcon = (status) => {
    switch (status) {
      case 'PENDING':
        return <PendingIcon fontSize="small" />;
      case 'PROCESSING':
        return <CircularProgress size={16} thickness={6} />;
      case 'COMPLETED':
        return <CheckCircleIcon fontSize="small" />;
      case 'FAILED':
        return <ErrorIcon fontSize="small" />;
      default:
        return <InfoIcon fontSize="small" />;
    }
  };
  
  return (
    <Dialog
      open={open}
      onClose={handleDialogClose}
      maxWidth="lg"
      fullWidth
    >
      <DialogTitle>Lead Enrichment</DialogTitle>
      <DialogContent>
        {leadIds && leadIds.length > 0 ? (
          <Box sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Enrich Selected Leads
            </Typography>
            <Typography gutterBottom>
              {`You are about to enrich ${leadIds.length} selected lead(s).`}
            </Typography>
            <TextField
              label="Batch Name"
              value={batchName}
              onChange={(e) => setBatchName(e.target.value)}
              fullWidth
              placeholder="Leave empty for auto-generated name"
              margin="normal"
            />
            <TextField
              label="Description"
              value={batchDescription}
              onChange={(e) => setBatchDescription(e.target.value)}
              fullWidth
              multiline
              rows={2}
              margin="normal"
            />
            <Box sx={{ mt: 2, mb: 2, display: 'flex', justifyContent: 'space-between' }}>
              <Button 
                onClick={handleDialogClose}
                disabled={creatingBatch}
              >
                Cancel
              </Button>
              <Button 
                variant="contained" 
                color="primary"
                onClick={handleCreateBatchWithSelected}
                disabled={creatingBatch}
                startIcon={creatingBatch ? <CircularProgress size={20} /> : <AddIcon />}
              >
                {creatingBatch ? 'Creating...' : 'Start Enrichment'}
              </Button>
            </Box>
          </Box>
        ) : (
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="h6" component="h2">
                Lead Enrichment Batches
              </Typography>
              <Button
                variant="contained"
                color="primary"
                startIcon={<AddIcon />}
                onClick={handleOpenNewBatchDialog}
              >
                New Batch
              </Button>
            </Box>
            
            {error && (
              <Box sx={{ mb: 2 }}>
                <Typography color="error">{error}</Typography>
              </Box>
            )}
            
            <Card>
              <CardContent sx={{ p: 0 }}>
                {loading ? (
                  <Box sx={{ p: 2, textAlign: 'center' }}>
                    <CircularProgress />
                  </Box>
                ) : batches.length > 0 ? (
                  <>
                    <TableContainer>
                      <Table>
                        <TableHead>
                          <TableRow>
                            <TableCell>Name</TableCell>
                            <TableCell>Status</TableCell>
                            <TableCell>Progress</TableCell>
                            <TableCell>Created</TableCell>
                            <TableCell>Jobs</TableCell>
                            <TableCell align="right">Actions</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {batches.map((batch) => (
                            <TableRow key={batch.id} hover>
                              <TableCell>
                                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                  <Typography variant="body1" component="div">
                                    {batch.name}
                                  </Typography>
                                </Box>
                                {batch.description && (
                                  <Typography variant="caption" color="text.secondary">
                                    {batch.description.length > 50 
                                      ? `${batch.description.substring(0, 50)}...`
                                      : batch.description}
                                  </Typography>
                                )}
                              </TableCell>
                              <TableCell>
                                <Chip
                                  label={batch.status}
                                  color={getStatusColor(batch.status)}
                                  size="small"
                                  icon={getStatusIcon(batch.status)}
                                />
                              </TableCell>
                              <TableCell>
                                <Box sx={{ display: 'flex', alignItems: 'center', flexDirection: 'column' }}>
                                  <Box sx={{ width: '100%', mr: 1 }}>
                                    <LinearProgress
                                      variant="determinate"
                                      value={(batch.completedJobs / batch.totalJobs) * 100}
                                      sx={{ height: 8, borderRadius: 4 }}
                                    />
                                  </Box>
                                  <Box sx={{ mt: 0.5 }}>
                                    <Typography variant="caption">{`${batch.completedJobs}/${batch.totalJobs} (${Math.round((batch.completedJobs / batch.totalJobs) * 100)}%)`}</Typography>
                                  </Box>
                                </Box>
                              </TableCell>
                              <TableCell>
                                <Typography variant="body2">
                                  {new Date(batch.createdAt).toLocaleString()}
                                </Typography>
                                {batch.createdBy && (
                                  <Typography variant="caption" color="text.secondary">
                                    by {batch.createdBy}
                                  </Typography>
                                )}
                              </TableCell>
                              <TableCell>
                                <Typography variant="body2">
                                  {batch.totalJobs} total
                                </Typography>
                                {batch.failedJobs > 0 && (
                                  <Typography variant="caption" color="error">
                                    {batch.failedJobs} failed
                                  </Typography>
                                )}
                              </TableCell>
                              <TableCell align="right">
                                <IconButton
                                  onClick={() => handleOpenBatchDetails(batch)}
                                  size="small"
                                >
                                  <InfoIcon fontSize="small" />
                                </IconButton>
                                {(batch.status === 'PENDING' || batch.status === 'PROCESSING') && (
                                  <IconButton
                                    onClick={() => handleCancelBatch(batch.id)}
                                    size="small"
                                    color="error"
                                  >
                                    <CancelIcon fontSize="small" />
                                  </IconButton>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                    <TablePagination
                      rowsPerPageOptions={[5, 10, 25]}
                      component="div"
                      count={totalCount}
                      rowsPerPage={rowsPerPage}
                      page={page}
                      onPageChange={handleChangePage}
                      onRowsPerPageChange={handleChangeRowsPerPage}
                    />
                  </>
                ) : (
                  <Box sx={{ p: 3, textAlign: 'center' }}>
                    <Typography color="textSecondary">
                      No enrichment batches found. Create a new batch to get started.
                    </Typography>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleDialogClose}>Close</Button>
      </DialogActions>
      
      {/* Batch Details Dialog */}
      <Dialog
        open={batchDetailsOpen}
        onClose={handleCloseBatchDetails}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {selectedBatch ? selectedBatch.name : 'Batch Details'}
        </DialogTitle>
        <DialogContent dividers>
          {batchDetailsLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
              <CircularProgress />
            </Box>
          ) : selectedBatch ? (
            <Box>
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" gutterBottom>Status</Typography>
                  <Chip
                    label={selectedBatch.status}
                    color={getStatusColor(selectedBatch.status)}
                    icon={getStatusIcon(selectedBatch.status)}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" gutterBottom>Progress</Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Box sx={{ width: '100%', mr: 1 }}>
                      <LinearProgress
                        variant="determinate"
                        value={(selectedBatch.completedJobs / selectedBatch.totalJobs) * 100}
                        sx={{ height: 10, borderRadius: 5 }}
                      />
                    </Box>
                    <Box>
                      <Typography variant="body2">{`${Math.round((selectedBatch.completedJobs / selectedBatch.totalJobs) * 100)}%`}</Typography>
                    </Box>
                  </Box>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" gutterBottom>Created</Typography>
                  <Typography variant="body2">
                    {new Date(selectedBatch.createdAt).toLocaleString()}
                  </Typography>
                  {selectedBatch.createdBy && (
                    <Typography variant="caption" color="text.secondary">
                      by {selectedBatch.createdBy}
                    </Typography>
                  )}
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" gutterBottom>Completion</Typography>
                  <Typography variant="body2">
                    {selectedBatch.completedAt ? new Date(selectedBatch.completedAt).toLocaleString() : 'Not completed yet'}
                  </Typography>
                </Grid>
              </Grid>
              
              {selectedBatch.description && (
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle2" gutterBottom>Description</Typography>
                  <Typography variant="body2">{selectedBatch.description}</Typography>
                </Box>
              )}
              
              <Typography variant="h6" gutterBottom>Enrichment Jobs</Typography>
              
              <TableContainer component={Paper} sx={{ mb: 3 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Lead</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Fields Enriched</TableCell>
                      <TableCell>Updated</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {selectedBatch.jobs && selectedBatch.jobs.length > 0 ? (
                      selectedBatch.jobs.map(job => (
                        <TableRow key={job.id} hover>
                          <TableCell>
                            <Typography variant="body2">{job.leadName}</Typography>
                            <Typography variant="caption" color="text.secondary">
                              ID: {job.leadId}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={job.status}
                              color={getStatusColor(job.status)}
                              size="small"
                              icon={getStatusIcon(job.status)}
                            />
                            {job.error && (
                              <Tooltip title={job.error}>
                                <Box component="span" sx={{ ml: 1 }}>
                                  <ErrorIcon fontSize="small" color="error" />
                                </Box>
                              </Tooltip>
                            )}
                          </TableCell>
                          <TableCell>
                            {job.fieldsEnriched && job.fieldsEnriched.length > 0 ? (
                              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                {job.fieldsEnriched.map(field => (
                                  <Chip
                                    key={field}
                                    label={field}
                                    size="small"
                                    variant="outlined"
                                  />
                                ))}
                              </Box>
                            ) : (
                              <Typography variant="caption" color="text.secondary">
                                {job.status === 'COMPLETED' ? 'No fields enriched' : 'Pending enrichment'}
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell>
                            {job.updatedAt ? new Date(job.updatedAt).toLocaleString() : '-'}
                          </TableCell>
                          <TableCell align="right">
                            {job.status === 'FAILED' && (
                              <IconButton
                                onClick={() => handleRestartJob(job.id)}
                                size="small"
                                color="primary"
                              >
                                <ReplayIcon fontSize="small" />
                              </IconButton>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={5} align="center">
                          <Typography variant="body2" color="text.secondary">
                            No jobs found for this batch.
                          </Typography>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          ) : (
            <Box sx={{ p: 2, textAlign: 'center' }}>
              <Typography color="text.secondary">Batch details not available.</Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseBatchDetails}>Close</Button>
          {selectedBatch && selectedBatch.status === 'FAILED' && (
            <Button
              variant="outlined"
              color="primary"
              startIcon={<RefreshIcon />}
              onClick={() => handleRestartJob(selectedBatch.id)}
            >
              Restart Batch
            </Button>
          )}
        </DialogActions>
      </Dialog>
      
      {/* New Batch Dialog */}
      <Dialog
        open={newBatchDialogOpen}
        onClose={creatingBatch ? undefined : handleCloseNewBatchDialog}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Create New Enrichment Batch</DialogTitle>
        <DialogContent dividers>
          <Box sx={{ mb: 3 }}>
            <TextField
              label="Batch Name"
              value={batchName}
              onChange={(e) => setBatchName(e.target.value)}
              fullWidth
              placeholder="Leave empty for auto-generated name"
              margin="normal"
            />
            <TextField
              label="Description"
              value={batchDescription}
              onChange={(e) => setBatchDescription(e.target.value)}
              fullWidth
              multiline
              rows={2}
              margin="normal"
            />
          </Box>
          
          <Typography variant="subtitle1" gutterBottom>
            Select Leads for Enrichment
          </Typography>
          
          {leadsLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
              <CircularProgress />
            </Box>
          ) : availableLeads.length > 0 ? (
            <TableContainer component={Paper} variant="outlined">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell padding="checkbox">
                      <Checkbox
                        indeterminate={
                          selectedLeads.length > 0 && selectedLeads.length < availableLeads.length
                        }
                        checked={
                          availableLeads.length > 0 && selectedLeads.length === availableLeads.length
                        }
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedLeads(availableLeads.map((lead) => lead.id));
                          } else {
                            setSelectedLeads([]);
                          }
                        }}
                      />
                    </TableCell>
                    <TableCell>Lead</TableCell>
                    <TableCell>Last Enrichment</TableCell>
                    <TableCell>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {availableLeads.map((lead) => (
                    <TableRow
                      key={lead.id}
                      hover
                      onClick={() => handleToggleLeadSelection(lead.id)}
                      selected={selectedLeads.includes(lead.id)}
                    >
                      <TableCell padding="checkbox">
                        <Checkbox checked={selectedLeads.includes(lead.id)} />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{lead.name}</Typography>
                        {lead.email && (
                          <Typography variant="caption" color="text.secondary">
                            {lead.email}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        {lead.lastEnriched ? (
                          <Tooltip title={new Date(lead.lastEnriched).toLocaleString()}>
                            <Typography variant="body2">
                              {new Date(lead.lastEnriched).toLocaleDateString()}
                            </Typography>
                          </Tooltip>
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            Never
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={lead.status}
                          color={
                            lead.status === 'NEW'
                              ? 'primary'
                              : lead.status === 'QUALIFIED'
                              ? 'success'
                              : lead.status === 'LOST'
                              ? 'error'
                              : 'default'
                          }
                          size="small"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Box sx={{ p: 2, textAlign: 'center' }}>
              <Typography color="text.secondary">
                No leads available for enrichment.
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={handleCloseNewBatchDialog}
            disabled={creatingBatch}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            color="primary"
            onClick={handleCreateBatch}
            disabled={selectedLeads.length === 0 || creatingBatch}
            startIcon={creatingBatch ? <CircularProgress size={24} /> : <AddIcon />}
          >
            {creatingBatch ? 'Creating...' : 'Create Batch'}
          </Button>
        </DialogActions>
      </Dialog>
    </Dialog>
  );
};

BatchEnrichment.propTypes = {
  open: PropTypes.bool,
  onClose: PropTypes.func,
  leadIds: PropTypes.array,
  onComplete: PropTypes.func
};

export default BatchEnrichment; 