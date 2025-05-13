import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  AppBar,
  Box,
  Toolbar,
  Typography,
  Button,
  Container,
  IconButton,
  Menu,
  MenuItem,
  Divider,
  ListItemIcon,
  ListItemText,
  Avatar,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import SettingsIcon from '@mui/icons-material/Settings';
import TagIcon from '@mui/icons-material/Tag';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import CachedIcon from '@mui/icons-material/Cached';
import PeopleIcon from '@mui/icons-material/People';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import LogoutIcon from '@mui/icons-material/Logout';
import AnalyticsIcon from '@mui/icons-material/BarChart';
import DataUsageIcon from '@mui/icons-material/DataUsage';
import TimelineIcon from '@mui/icons-material/Timeline';
import ActivityIcon from '@mui/icons-material/Whatshot';
import ScienceIcon from '@mui/icons-material/Science';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import { useAuth } from '../../contexts/AuthContext';

const Navigation = () => {
  const { user, checkPermission, logout, isAuthenticated } = useAuth();
  const [anchorElNav, setAnchorElNav] = React.useState(null);
  const [anchorElSettings, setAnchorElSettings] = React.useState(null);
  const [anchorElAdmin, setAnchorElAdmin] = React.useState(null);
  const [anchorElUser, setAnchorElUser] = React.useState(null);
  const [anchorElAnalytics, setAnchorElAnalytics] = React.useState(null);
  const [anchorElResearch, setAnchorElResearch] = React.useState(null);

  const handleOpenNavMenu = (event) => {
    setAnchorElNav(event.currentTarget);
  };

  const handleCloseNavMenu = () => {
    setAnchorElNav(null);
  };
  
  const handleOpenSettingsMenu = (event) => {
    setAnchorElSettings(event.currentTarget);
  };
  
  const handleCloseSettingsMenu = () => {
    setAnchorElSettings(null);
  };
  
  const handleOpenAdminMenu = (event) => {
    setAnchorElAdmin(event.currentTarget);
  };
  
  const handleCloseAdminMenu = () => {
    setAnchorElAdmin(null);
  };
  
  const handleOpenUserMenu = (event) => {
    setAnchorElUser(event.currentTarget);
  };
  
  const handleCloseUserMenu = () => {
    setAnchorElUser(null);
  };
  
  const handleOpenAnalyticsMenu = (event) => {
    setAnchorElAnalytics(event.currentTarget);
  };
  
  const handleCloseAnalyticsMenu = () => {
    setAnchorElAnalytics(null);
  };
  
  const handleOpenResearchMenu = (event) => {
    setAnchorElResearch(event.currentTarget);
  };
  
  const handleCloseResearchMenu = () => {
    setAnchorElResearch(null);
  };
  
  const handleLogout = () => {
    logout();
    handleCloseUserMenu();
  };

  const pages = [
    { title: 'Dashboard', path: '/' },
    { title: 'Products', path: '/products' },
    { title: 'Categories', path: '/categories' },
    { title: 'Applications', path: '/applications' },
    { title: 'Research', path: '/research' },
    { title: 'Organization Search', path: '/organizations/search' },
    { title: 'Leads', path: '/leads' },
  ];
  
  const adminMenuItems = [
    { 
      title: 'User Management', 
      path: '/admin/users', 
      icon: <PeopleIcon fontSize="small" />,
      permission: { resource: 'users', action: 'read' }
    },
    { 
      title: 'Cache Management', 
      path: '/admin/cache', 
      icon: <CachedIcon fontSize="small" />,
      permission: null // Assuming no special permission needed for cache
    },
  ];
  
  const settingsMenuItems = [
    { title: 'Tag Management', path: '/settings/tags', icon: <TagIcon fontSize="small" /> },
  ];
  
  const userMenuItems = [
    { title: 'Profile', path: '/profile', icon: <AccountCircleIcon fontSize="small" /> },
  ];

  const analyticsMenuItems = [
    { 
      title: 'Dashboard', 
      path: '/analytics/dashboard', 
      icon: <DataUsageIcon fontSize="small" />,
      permission: null // Available to all logged-in users
    },
    { 
      title: 'Activity Logs', 
      path: '/analytics/activity', 
      icon: <ActivityIcon fontSize="small" />,
      permission: { resource: 'analytics', action: 'read' }
    },
    { 
      title: 'Reports', 
      path: '/analytics/reports', 
      icon: <TimelineIcon fontSize="small" />,
      permission: { resource: 'analytics', action: 'read' }
    },
  ];

  const researchMenuItems = [
    {
      title: 'View All Research',
      path: '/research',
      icon: <ScienceIcon fontSize="small" />,
      permission: { resource: 'research', action: 'read' }
    },
    {
      title: 'Review AI Discoveries',
      path: '/research/review',
      icon: <ScienceIcon fontSize="small" color="warning" />,
      permission: { resource: 'research', action: 'update' }
    },
    {
      title: 'Create New Research',
      path: '/research/new',
      icon: <AddCircleOutlineIcon fontSize="small" />,
      permission: { resource: 'research', action: 'create' }
    },
  ];

  return (
    <AppBar position="static">
      <Container maxWidth="xl">
        <Toolbar disableGutters>
          {/* Logo for larger screens */}
          <Typography
            variant="h6"
            noWrap
            component={RouterLink}
            to="/"
            sx={{
              mr: 2,
              display: { xs: 'none', md: 'flex' },
              fontWeight: 700,
              color: 'inherit',
              textDecoration: 'none',
            }}
          >
            Laser Components
          </Typography>

          {/* Mobile menu */}
          <Box sx={{ flexGrow: 1, display: { xs: 'flex', md: 'none' } }}>
            <IconButton
              size="large"
              aria-label="menu"
              aria-controls="menu-appbar"
              aria-haspopup="true"
              onClick={handleOpenNavMenu}
              color="inherit"
            >
              <MenuIcon />
            </IconButton>
            <Menu
              id="menu-appbar"
              anchorEl={anchorElNav}
              anchorOrigin={{
                vertical: 'bottom',
                horizontal: 'left',
              }}
              keepMounted
              transformOrigin={{
                vertical: 'top',
                horizontal: 'left',
              }}
              open={Boolean(anchorElNav)}
              onClose={handleCloseNavMenu}
              sx={{
                display: { xs: 'block', md: 'none' },
              }}
            >
              {pages.map((page) => (
                <MenuItem 
                  key={page.title} 
                  onClick={handleCloseNavMenu}
                  component={RouterLink}
                  to={page.path}
                >
                  <Typography textAlign="center">{page.title}</Typography>
                </MenuItem>
              ))}
              <Divider />
              <MenuItem disabled>
                <ListItemIcon>
                  <ScienceIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText>Research</ListItemText>
              </MenuItem>
              <MenuItem onClick={handleCloseNavMenu}>
                <ListItemIcon>
                  <SettingsIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText>Settings</ListItemText>
              </MenuItem>
              {settingsMenuItems.map((item) => (
                <MenuItem 
                  key={item.title} 
                  onClick={handleCloseNavMenu}
                  component={RouterLink}
                  to={item.path}
                  sx={{ pl: 4 }}
                >
                  <ListItemIcon>
                    {item.icon}
                  </ListItemIcon>
                  <ListItemText>{item.title}</ListItemText>
                </MenuItem>
              ))}
              <Divider />
              {adminMenuItems.map((item) => (
                (!item.permission || checkPermission(item.permission.resource, item.permission.action)) && (
                  <MenuItem 
                    key={item.title} 
                    onClick={handleCloseNavMenu}
                    component={RouterLink}
                    to={item.path}
                  >
                    <ListItemIcon>
                      {item.icon}
                    </ListItemIcon>
                    <ListItemText>{item.title}</ListItemText>
                  </MenuItem>
                )
              ))}
              {isAuthenticated && (
                <>
                  <Divider />
                  {userMenuItems.map((item) => (
                    <MenuItem
                      key={item.title}
                      onClick={handleCloseNavMenu}
                      component={RouterLink}
                      to={item.path}
                    >
                      <ListItemIcon>
                        {item.icon}
                      </ListItemIcon>
                      <ListItemText>{item.title}</ListItemText>
                    </MenuItem>
                  ))}
                  <MenuItem onClick={handleLogout}>
                    <ListItemIcon>
                      <LogoutIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText>Logout</ListItemText>
                  </MenuItem>
                </>
              )}
            </Menu>
          </Box>

          {/* Logo for mobile */}
          <Typography
            variant="h6"
            noWrap
            component={RouterLink}
            to="/"
            sx={{
              mr: 2,
              display: { xs: 'flex', md: 'none' },
              flexGrow: 1,
              fontWeight: 700,
              color: 'inherit',
              textDecoration: 'none',
            }}
          >
            Laser Components
          </Typography>

          {/* Desktop menu */}
          <Box sx={{ flexGrow: 1, display: { xs: 'none', md: 'flex' } }}>
            {pages.map((page) => (
              <Button
                key={page.title}
                component={RouterLink}
                to={page.path}
                sx={{ my: 2, color: 'white', display: 'block' }}
              >
                {page.title}
              </Button>
            ))}
            
            {/* Research dropdown menu for desktop */}
            <Button
              sx={{ my: 2, color: 'white', display: 'block' }}
              onClick={handleOpenResearchMenu}
              endIcon={<KeyboardArrowDownIcon />}
            >
              Research
            </Button>
            <Menu
              id="research-menu"
              anchorEl={anchorElResearch}
              open={Boolean(anchorElResearch)}
              onClose={handleCloseResearchMenu}
              anchorOrigin={{
                vertical: 'bottom',
                horizontal: 'left',
              }}
              transformOrigin={{
                vertical: 'top',
                horizontal: 'left',
              }}
            >
              {researchMenuItems.map((item) => (
                (!item.permission || checkPermission(item.permission.resource, item.permission.action)) && (
                  <MenuItem 
                    key={item.title} 
                    onClick={handleCloseResearchMenu}
                    component={RouterLink}
                    to={item.path}
                  >
                    <ListItemIcon>
                      {item.icon}
                    </ListItemIcon>
                    <ListItemText>{item.title}</ListItemText>
                  </MenuItem>
                )
              ))}
            </Menu>
            
            {/* Admin dropdown menu for desktop */}
            <Button
              sx={{ my: 2, color: 'white', display: 'block' }}
              onClick={handleOpenAdminMenu}
              endIcon={<KeyboardArrowDownIcon />}
            >
              Admin
            </Button>
            <Menu
              id="admin-menu"
              anchorEl={anchorElAdmin}
              open={Boolean(anchorElAdmin)}
              onClose={handleCloseAdminMenu}
              anchorOrigin={{
                vertical: 'bottom',
                horizontal: 'left',
              }}
              transformOrigin={{
                vertical: 'top',
                horizontal: 'left',
              }}
            >
              {adminMenuItems.map((item) => (
                (!item.permission || checkPermission(item.permission.resource, item.permission.action)) && (
                  <MenuItem 
                    key={item.title} 
                    onClick={handleCloseAdminMenu}
                    component={RouterLink}
                    to={item.path}
                  >
                    <ListItemIcon>
                      {item.icon}
                    </ListItemIcon>
                    <ListItemText>{item.title}</ListItemText>
                  </MenuItem>
                )
              ))}
            </Menu>
            
            {/* Settings dropdown menu for desktop */}
            <Button
              sx={{ my: 2, color: 'white', display: 'block' }}
              onClick={handleOpenSettingsMenu}
              endIcon={<KeyboardArrowDownIcon />}
            >
              Settings
            </Button>
            <Menu
              id="settings-menu"
              anchorEl={anchorElSettings}
              open={Boolean(anchorElSettings)}
              onClose={handleCloseSettingsMenu}
              anchorOrigin={{
                vertical: 'bottom',
                horizontal: 'left',
              }}
              transformOrigin={{
                vertical: 'top',
                horizontal: 'left',
              }}
            >
              {settingsMenuItems.map((item) => (
                <MenuItem 
                  key={item.title} 
                  onClick={handleCloseSettingsMenu}
                  component={RouterLink}
                  to={item.path}
                >
                  <ListItemIcon>
                    {item.icon}
                  </ListItemIcon>
                  <ListItemText>{item.title}</ListItemText>
                </MenuItem>
              ))}
            </Menu>

            {/* Analytics dropdown menu for desktop */}
            <Button
              sx={{ my: 2, color: 'white', display: 'block' }}
              onClick={handleOpenAnalyticsMenu}
              endIcon={<KeyboardArrowDownIcon />}
            >
              Analytics
            </Button>
            <Menu
              id="analytics-menu"
              anchorEl={anchorElAnalytics}
              open={Boolean(anchorElAnalytics)}
              onClose={handleCloseAnalyticsMenu}
              anchorOrigin={{
                vertical: 'bottom',
                horizontal: 'left',
              }}
              transformOrigin={{
                vertical: 'top',
                horizontal: 'left',
              }}
            >
              {analyticsMenuItems.map((item) => (
                (!item.permission || checkPermission(item.permission.resource, item.permission.action)) && (
                  <MenuItem 
                    key={item.title} 
                    onClick={handleCloseAnalyticsMenu}
                    component={RouterLink}
                    to={item.path}
                  >
                    <ListItemIcon>
                      {item.icon}
                    </ListItemIcon>
                    <ListItemText>{item.title}</ListItemText>
                  </MenuItem>
                )
              ))}
            </Menu>
          </Box>

          {/* Auth buttons */}
          <Box sx={{ flexGrow: 0 }}>
            {isAuthenticated ? (
              <>
                <IconButton
                  onClick={handleOpenUserMenu}
                  color="inherit"
                  sx={{ p: 0, ml: 1 }}
                >
                  <Avatar alt={user?.email} sx={{ bgcolor: 'secondary.main' }}>
                    {user?.email?.[0]?.toUpperCase() || 'U'}
                  </Avatar>
                </IconButton>
                <Menu
                  id="user-menu"
                  anchorEl={anchorElUser}
                  open={Boolean(anchorElUser)}
                  onClose={handleCloseUserMenu}
                  anchorOrigin={{
                    vertical: 'bottom',
                    horizontal: 'right',
                  }}
                  transformOrigin={{
                    vertical: 'top',
                    horizontal: 'right',
                  }}
                >
                  {userMenuItems.map((item) => (
                    <MenuItem
                      key={item.title}
                      onClick={handleCloseUserMenu}
                      component={RouterLink}
                      to={item.path}
                    >
                      <ListItemIcon>
                        {item.icon}
                      </ListItemIcon>
                      <ListItemText>{item.title}</ListItemText>
                    </MenuItem>
                  ))}
                  <Divider />
                  <MenuItem onClick={handleLogout}>
                    <ListItemIcon>
                      <LogoutIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText>Logout</ListItemText>
                  </MenuItem>
                </Menu>
              </>
            ) : (
              <Button 
                color="inherit" 
                component={RouterLink} 
                to="/login"
              >
                Login
              </Button>
            )}
          </Box>
        </Toolbar>
      </Container>
    </AppBar>
  );
};

export default Navigation; 