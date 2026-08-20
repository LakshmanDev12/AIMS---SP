import React, { useState } from 'react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import {
  Box,
  Drawer,
  AppBar,
  Toolbar,
  List,
  Typography,
  Divider,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  IconButton,
  Button,
  Chip,
  Container,
} from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import PeopleIcon from '@mui/icons-material/People';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import AssessmentIcon from '@mui/icons-material/Assessment';
import HistoryIcon from '@mui/icons-material/History';
import SecurityIcon from '@mui/icons-material/Security';
import MenuIcon from '@mui/icons-material/Menu';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import ScienceIcon from '@mui/icons-material/Science';
import { AdminTokenModal } from './AdminTokenModal';
import { NotificationBell } from './NotificationBell';
import { useAuth } from '../context/AuthContext';

const DRAWER_WIDTH = 250;

const menuItems = [
  { text: 'Dashboard', icon: <DashboardIcon />, path: '/dashboard' },
  { text: 'Agent Directory', icon: <PeopleIcon />, path: '/' },
  { text: 'Register Agent', icon: <PersonAddIcon />, path: '/agents/register' },
  { text: 'Security Sandbox', icon: <ScienceIcon />, path: '/sandbox' },
  { text: 'Notifications & Alerts', icon: <NotificationsActiveIcon />, path: '/notifications' },
  { text: 'Quarterly Reviews', icon: <AssessmentIcon />, path: '/reviews' },
  { text: 'Audit Logs', icon: <HistoryIcon />, path: '/audit-logs' },
];

export const Layout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { hasAdminToken } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [adminModalOpen, setAdminModalOpen] = useState(false);

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const drawerContent = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box sx={{ p: 2.5, display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <SecurityIcon color="primary" sx={{ fontSize: 32 }} />
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 800, lineHeight: 1.1, letterSpacing: '-0.5px' }}>
            AIMS
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Agent Identity Mgmt
          </Typography>
        </Box>
      </Box>
      <Divider />
      <List sx={{ flexGrow: 1, px: 1.5, py: 2 }}>
        {menuItems.map((item) => {
          const selected =
            item.path === '/'
              ? location.pathname === '/' || location.pathname.startsWith('/agents/') && location.pathname !== '/agents/register'
              : location.pathname.startsWith(item.path);

          return (
            <ListItem key={item.text} disablePadding sx={{ mb: 0.8 }}>
              <ListItemButton
                selected={selected}
                onClick={() => {
                  navigate(item.path);
                  setMobileOpen(false);
                }}
                sx={{
                  borderRadius: 2,
                  '&.Mui-selected': {
                    backgroundColor: 'primary.main',
                    color: 'primary.contrastText',
                    '&:hover': {
                      backgroundColor: 'primary.dark',
                    },
                    '& .MuiListItemIcon-root': {
                      color: 'primary.contrastText',
                    },
                  },
                }}
              >
                <ListItemIcon sx={{ minWidth: 40, color: selected ? 'inherit' : 'text.secondary' }}>
                  {item.icon}
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Typography sx={{ fontSize: '0.92rem', fontWeight: selected ? 600 : 500 }}>
                      {item.text}
                    </Typography>
                  }
                />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>
      <Divider />
      <Box sx={{ p: 2 }}>
        <Box
          sx={{
            p: 1.5,
            borderRadius: 2,
            backgroundColor: 'background.paper',
            border: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary' }}>
              ADMIN TOKEN
            </Typography>
            <Chip
              label={hasAdminToken ? 'Configured' : 'Missing'}
              color={hasAdminToken ? 'success' : 'default'}
              size="small"
              sx={{ height: 20, fontSize: '0.65rem' }}
            />
          </Box>
          <Button
            fullWidth
            size="small"
            variant="outlined"
            startIcon={<AdminPanelSettingsIcon />}
            onClick={() => setAdminModalOpen(true)}
            sx={{ textTransform: 'none', fontSize: '0.8rem' }}
          >
            {hasAdminToken ? 'Edit Token' : 'Set Token'}
          </Button>
        </Box>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f8fafc' }}>
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          width: { sm: `calc(100% - ${DRAWER_WIDTH}px)` },
          ml: { sm: `${DRAWER_WIDTH}px` },
          backgroundColor: '#ffffff',
          color: 'text.primary',
          borderBottom: '1px solid #e2e8f0',
        }}
      >
        <Toolbar sx={{ justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <IconButton
              color="inherit"
              edge="start"
              onClick={handleDrawerToggle}
              sx={{ mr: 2, display: { sm: 'none' } }}
            >
              <MenuIcon />
            </IconButton>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#1e293b' }}>
              Agent Identity & Governance Platform
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <NotificationBell />
            <Chip
              label="API: Online"
              size="small"
              color="success"
              variant="outlined"
              sx={{ fontWeight: 600 }}
            />
            <Button
              size="small"
              variant="contained"
              color="primary"
              startIcon={<PersonAddIcon />}
              onClick={() => navigate('/agents/register')}
              sx={{ textTransform: 'none', borderRadius: 2 }}
            >
              Register Agent
            </Button>
          </Box>
        </Toolbar>
      </AppBar>

      <Box
        component="nav"
        sx={{ width: { sm: DRAWER_WIDTH }, flexShrink: { sm: 0 } }}
      >
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: 'block', sm: 'none' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: DRAWER_WIDTH },
          }}
        >
          {drawerContent}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', sm: 'block' },
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: DRAWER_WIDTH,
              borderRight: '1px solid #e2e8f0',
            },
          }}
          open
        >
          {drawerContent}
        </Drawer>
      </Box>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: { sm: `calc(100% - ${DRAWER_WIDTH}px)` },
          mt: 8,
        }}
      >
        <Container maxWidth="xl" sx={{ px: { xs: 1, sm: 2 } }}>
          <Outlet />
        </Container>
      </Box>

      <AdminTokenModal open={adminModalOpen} onClose={() => setAdminModalOpen(false)} />
    </Box>
  );
};
