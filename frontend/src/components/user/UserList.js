import React, { useState, useEffect } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Box,
  Button,
  Chip,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TableSortLabel,
  TextField,
  Typography,
  IconButton,
  Tooltip,
  Grid,
  MenuItem,
  Select,
  InputLabel,
  FormControl,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { formatDistanceToNow } from 'date-fns';
import { useAuth } from '../../contexts/AuthContext';

// Get role color for user role chip
const getRoleColor = (role) => {
  switch (role) {
    case 'ADMIN':
      return 'error';
    case 'RESEARCHER':
      return 'primary';
    case 'SALES':
      return 'success';
    default:
      return 'default';
  }
};

const UserList = ({ onDelete }) => {
  const { checkPermission } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Pagination state
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  
  // Sorting state
  const [orderBy, setOrderBy] = useState('email');
  const [order, setOrder] = useState('asc');
  
  // Filtering state
  const [filters, setFilters] = useState({
    email: '',
    role: ''
  });

  // Fetch users when component mounts
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/users');
        
        if (!response.ok) {
          throw new Error(`Failed to fetch users: ${response.statusText}`);
        }
        
        const data = await response.json();
        setUsers(data);
      } catch (err) {
        console.error('Error fetching users:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    
    fetchUsers();
  }, []);

  // Handle sort request
  const handleRequestSort = (property) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
  };

  // Handle filter change
  const handleFilterChange = (event) => {
    const { name, value } = event.target;
    setFilters(prev => ({
      ...prev,
      [name]: value
    }));
    setPage(0); // Reset to first page when filter changes
  };

  // Handle page change
  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  // Handle rows per page change
  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // Delete user handler
  const handleDelete = async (userId) => {
    if (window.confirm('Are you sure you want to delete this user?')) {
      try {
        const response = await fetch(`/api/users/${userId}`, {
          method: 'DELETE',
        });
        
        if (!response.ok) {
          throw new Error(`Failed to delete user: ${response.statusText}`);
        }
        
        // Remove user from state
        setUsers(users.filter(user => user.id !== userId));
        
        // Call parent callback if provided
        if (onDelete) {
          onDelete(userId);
        }
      } catch (err) {
        console.error('Error deleting user:', err);
        setError(err.message);
      }
    }
  };

  // Filter users based on filter criteria
  const filteredUsers = users.filter(user => {
    return (
      user.email.toLowerCase().includes(filters.email.toLowerCase()) &&
      (filters.role === '' || user.role === filters.role)
    );
  });

  // Sort users
  const sortedUsers = [...filteredUsers].sort((a, b) => {
    const aValue = a[orderBy];
    const bValue = b[orderBy];
    
    if (order === 'asc') {
      return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
    } else {
      return bValue < aValue ? -1 : bValue > aValue ? 1 : 0;
    }
  });

  // Paginate users
  const paginatedUsers = sortedUsers.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  if (loading) {
    return <Typography>Loading users...</Typography>;
  }

  if (error) {
    return <Typography color="error">Error: {error}</Typography>;
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h5" component="h1">
          Users
        </Typography>
        
        {checkPermission('users', 'create') && (
          <Button
            component={RouterLink}
            to="/admin/users/new"
            variant="contained"
            color="primary"
            startIcon={<AddIcon />}
          >
            Add User
          </Button>
        )}
      </Box>
      
      {/* Filters */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} md={6}>
          <TextField
            name="email"
            label="Filter by Email"
            variant="outlined"
            fullWidth
            value={filters.email}
            onChange={handleFilterChange}
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <FormControl fullWidth>
            <InputLabel id="role-filter-label">Filter by Role</InputLabel>
            <Select
              labelId="role-filter-label"
              name="role"
              value={filters.role}
              label="Filter by Role"
              onChange={handleFilterChange}
            >
              <MenuItem value="">All Roles</MenuItem>
              <MenuItem value="ADMIN">Admin</MenuItem>
              <MenuItem value="RESEARCHER">Researcher</MenuItem>
              <MenuItem value="SALES">Sales</MenuItem>
            </Select>
          </FormControl>
        </Grid>
      </Grid>
      
      {/* Users Table */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>
                <TableSortLabel
                  active={orderBy === 'email'}
                  direction={orderBy === 'email' ? order : 'asc'}
                  onClick={() => handleRequestSort('email')}
                >
                  Email
                </TableSortLabel>
              </TableCell>
              <TableCell>
                <TableSortLabel
                  active={orderBy === 'role'}
                  direction={orderBy === 'role' ? order : 'asc'}
                  onClick={() => handleRequestSort('role')}
                >
                  Role
                </TableSortLabel>
              </TableCell>
              <TableCell>
                <TableSortLabel
                  active={orderBy === 'createdAt'}
                  direction={orderBy === 'createdAt' ? order : 'asc'}
                  onClick={() => handleRequestSort('createdAt')}
                >
                  Created
                </TableSortLabel>
              </TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {paginatedUsers.length > 0 ? (
              paginatedUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    <Chip 
                      label={user.role} 
                      color={getRoleColor(user.role)} 
                      size="small" 
                    />
                  </TableCell>
                  <TableCell>
                    {user.createdAt ? formatDistanceToNow(new Date(user.createdAt), { addSuffix: true }) : 'N/A'}
                  </TableCell>
                  <TableCell align="right">
                    {checkPermission('users', 'update') && (
                      <Tooltip title="Edit User">
                        <IconButton 
                          component={RouterLink} 
                          to={`/admin/users/${user.id}/edit`}
                          color="primary"
                          size="small"
                        >
                          <EditIcon />
                        </IconButton>
                      </Tooltip>
                    )}
                    {checkPermission('users', 'delete') && (
                      <Tooltip title="Delete User">
                        <IconButton 
                          onClick={() => handleDelete(user.id)}
                          color="error"
                          size="small"
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Tooltip>
                    )}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={4} align="center">
                  No users found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
      
      {/* Pagination */}
      <TablePagination
        rowsPerPageOptions={[5, 10, 25]}
        component="div"
        count={filteredUsers.length}
        rowsPerPage={rowsPerPage}
        page={page}
        onPageChange={handleChangePage}
        onRowsPerPageChange={handleChangeRowsPerPage}
      />
    </Box>
  );
};

export default UserList; 