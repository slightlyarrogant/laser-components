import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Chip,
  Divider,
  Grid,
  Typography,
  Skeleton,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { formatDistanceToNow, format } from 'date-fns';
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

const UserDetail = ({ user, loading, error }) => {
  const { checkPermission } = useAuth();

  if (loading) {
    return (
      <Card>
        <CardHeader title={<Skeleton width="60%" />} />
        <Divider />
        <CardContent>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <Skeleton variant="text" height={40} />
            </Grid>
            <Grid item xs={12}>
              <Skeleton variant="text" height={40} />
            </Grid>
            <Grid item xs={12}>
              <Skeleton variant="text" height={40} />
            </Grid>
          </Grid>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent>
          <Typography color="error">Error: {error}</Typography>
          <Button
            component={RouterLink}
            to="/admin/users"
            startIcon={<ArrowBackIcon />}
            sx={{ mt: 2 }}
          >
            Back to User List
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!user) {
    return (
      <Card>
        <CardContent>
          <Typography>User not found</Typography>
          <Button
            component={RouterLink}
            to="/admin/users"
            startIcon={<ArrowBackIcon />}
            sx={{ mt: 2 }}
          >
            Back to User List
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader
        title={<Typography variant="h5">User Details</Typography>}
        action={
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              component={RouterLink}
              to="/admin/users"
              variant="outlined"
              startIcon={<ArrowBackIcon />}
            >
              Back
            </Button>
            {checkPermission('users', 'update') && (
              <Button
                component={RouterLink}
                to={`/admin/users/${user.id}/edit`}
                variant="contained"
                color="primary"
                startIcon={<EditIcon />}
              >
                Edit
              </Button>
            )}
          </Box>
        }
      />
      <Divider />
      <CardContent>
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle1" color="text.secondary">
              Email
            </Typography>
            <Typography variant="body1">{user.email}</Typography>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle1" color="text.secondary">
              Role
            </Typography>
            <Chip 
              label={user.role} 
              color={getRoleColor(user.role)} 
              size="small" 
            />
          </Grid>
          
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle1" color="text.secondary">
              Created
            </Typography>
            <Typography variant="body1">
              {user.createdAt ? (
                <>
                  {format(new Date(user.createdAt), 'PPP')}
                  <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary' }}>
                    ({formatDistanceToNow(new Date(user.createdAt), { addSuffix: true })})
                  </Typography>
                </>
              ) : (
                'N/A'
              )}
            </Typography>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle1" color="text.secondary">
              Last Updated
            </Typography>
            <Typography variant="body1">
              {user.updatedAt ? (
                <>
                  {format(new Date(user.updatedAt), 'PPP')}
                  <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary' }}>
                    ({formatDistanceToNow(new Date(user.updatedAt), { addSuffix: true })})
                  </Typography>
                </>
              ) : (
                'N/A'
              )}
            </Typography>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );
};

export default UserDetail; 