import React, { useState, useEffect } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Box,
  Button,
  Chip,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  TextField,
  InputAdornment,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  CircularProgress,
} from '@mui/material';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import SearchIcon from '@mui/icons-material/Search';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import VisibilityIcon from '@mui/icons-material/Visibility';
import TravelExploreIcon from '@mui/icons-material/TravelExplore';

import { 
    fetchResearchList, 
    deleteResearch, 
    discoverLeadsForResearchItem 
} from '../../services/api/researchService';

const ApplicationList = () => {
  const [researchItems, setResearchItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Filter state
  const [nameFilter, setNameFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  
  // Add state for lead discovery status
  const [discoveringLeads, setDiscoveringLeads] = useState({}); // Track by researchId
  
  useEffect(() => {
    const fetchResearchItems = async () => {
      try {
        setLoading(true);
        // Define params for fetching (initially fetch all non-rejected)
        const params = {
            searchTerm: nameFilter, // Use nameFilter for search
            status: statusFilter || 'DRAFT,IN_PROGRESS,COMPLETED,ARCHIVED,PENDING_APPROVAL,AI_DISCOVERED,REVIEWED' // Fetch all relevant statuses if filter is empty
        }
        const response = await fetchResearchList(params); 
        setResearchItems(response.data.data || []);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching research items:', err);
        setError('Failed to load research items. Please try again later.');
        setLoading(false);
      }
    };
    
    fetchResearchItems();
  }, [nameFilter, statusFilter]); // Re-fetch when filters change
  
  // Handle application deletion
  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this research item?')) {
      try {
        await deleteResearch(id);
        setResearchItems(researchItems.filter(item => item.id !== id));
      } catch (err) {
        console.error('Error deleting research item:', err);
        setError('Failed to delete research item. Please try again.');
      }
    }
  };
  
  // Handle lead discovery click
  const handleDiscoverLeads = async (researchId) => {
      setDiscoveringLeads(prev => ({ ...prev, [researchId]: true }));
      setError(null); // Clear previous errors
      try {
          const response = await discoverLeadsForResearchItem(researchId);
          // Display success message (e.g., using a toast notification library)
          alert(response.data.message || 'Lead discovery initiated successfully.'); 
      } catch (err) {
          console.error(`Error discovering leads for research ${researchId}:`, err);
          const errorMsg = err.response?.data?.message || 'Failed to start lead discovery.';
          setError(`Lead Discovery Error: ${errorMsg}`); // Display error
          alert(`Lead Discovery Error: ${errorMsg}`); // Also alert for visibility
      } finally {
          setDiscoveringLeads(prev => ({ ...prev, [researchId]: false }));
      }
  };
  
  // Filter applications based on search criteria
  const filteredResearchItems = researchItems.filter(researchItem => {
    const nameMatch = researchItem.applicationName.toLowerCase().includes(nameFilter.toLowerCase());
    const statusMatch = statusFilter === '' || researchItem.status === statusFilter;
    return nameMatch && statusMatch;
  });
  
  // Get status chip color
  const getStatusColor = (status) => {
    return status === 'ACTIVE' ? 'success' : 'error';
  };
  
  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Applications
        </Typography>
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddCircleOutlineIcon />}
          component={RouterLink}
          to="/applications/new"
        >
          Add New Application
        </Button>
      </Box>
      
      {/* Filter Section */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <TextField
            label="Search by Name"
            value={nameFilter}
            onChange={(e) => setNameFilter(e.target.value)}
            sx={{ flexGrow: 1 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
          />
          <FormControl sx={{ minWidth: 150 }}>
            <InputLabel>Status</InputLabel>
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              label="Status"
            >
              <MenuItem value="">All (Excl. Rejected)</MenuItem>
              <MenuItem value="DRAFT">Draft</MenuItem>
              <MenuItem value="AI_DISCOVERED">AI Discovered</MenuItem>
              <MenuItem value="PENDING_APPROVAL">Pending Approval</MenuItem>
              <MenuItem value="REVIEWED">Reviewed</MenuItem>
              <MenuItem value="IN_PROGRESS">In Progress</MenuItem>
              <MenuItem value="COMPLETED">Completed</MenuItem>
              <MenuItem value="ARCHIVED">Archived</MenuItem>
            </Select>
          </FormControl>
        </Box>
      </Paper>
      
      {/* Applications Table */}
      <Paper>
        {error && (
          <Box sx={{ p: 2, color: 'error.main' }}>
            <Typography>{error}</Typography>
          </Box>
        )}
        
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Application Name</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Industry Sector</TableCell>
                <TableCell>Last Updated</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} align="center">
                    Loading research items...
                  </TableCell>
                </TableRow>
              ) : filteredResearchItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center">
                    No research items found.
                  </TableCell>
                </TableRow>
              ) : (
                filteredResearchItems.map((researchItem) => (
                  <TableRow key={researchItem.id}>
                    <TableCell>{researchItem.applicationName}</TableCell>
                    <TableCell>
                      <Chip 
                        label={researchItem.status} 
                        color={getStatusColor(researchItem.status)} 
                        size="small" 
                      />
                    </TableCell>
                    <TableCell>{researchItem.industrySector || 'N/A'}</TableCell>
                    <TableCell>{new Date(researchItem.updatedAt).toLocaleString()}</TableCell>
                    <TableCell align="right">
                      <IconButton
                        component={RouterLink}
                        to={`/research/${researchItem.id}`}
                        color="info"
                        size="small"
                        title="View details"
                      >
                        <VisibilityIcon />
                      </IconButton>
                      <IconButton
                        component={RouterLink}
                        to={`/research/${researchItem.id}/edit`}
                        color="primary"
                        size="small"
                        title="Edit research item"
                      >
                        <EditIcon />
                      </IconButton>
                      <IconButton
                        onClick={() => handleDiscoverLeads(researchItem.id)}
                        color="secondary" 
                        size="small"
                        title="Discover potential leads for this application"
                        // Disable button while discovery is in progress for this item
                        disabled={discoveringLeads[researchItem.id]}
                      >
                        {/* Show loading indicator or icon */} 
                        {discoveringLeads[researchItem.id] ? 
                           <CircularProgress size={20} /> : 
                           <TravelExploreIcon />
                        }
                      </IconButton>
                      <IconButton
                        onClick={() => handleDelete(researchItem.id)}
                        color="error"
                        size="small"
                        title="Delete research item"
                      >
                        <DeleteIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
};

export default ApplicationList; 