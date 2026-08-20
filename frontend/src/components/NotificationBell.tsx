import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  IconButton,
  Badge,
  Popover,
  Box,
  Typography,
  Divider,
  List,
  ListItem,
  ListItemText,
  Chip,
  Button,
  Tabs,
  Tab,
  CircularProgress,
} from '@mui/material';
import NotificationsIcon from '@mui/icons-material/Notifications';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutlined';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import LaunchIcon from '@mui/icons-material/Launch';

import { api } from '../api/client';
import { SystemNotification, NotificationSummary } from '../types';

export const NotificationBell: React.FC = () => {
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);
  const [notifications, setNotifications] = useState<SystemNotification[]>([]);
  const [summary, setSummary] = useState<NotificationSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [tabIndex, setTabIndex] = useState(0);

  const fetchNotificationData = async () => {
    try {
      setLoading(true);
      const [notes, sum] = await Promise.all([
        api.getNotifications({ limit: 10 }),
        api.getNotificationSummary(),
      ]);
      setNotifications(notes);
      setSummary(sum);
    } catch (err) {
      console.error('Failed to load notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotificationData();
    const interval = setInterval(fetchNotificationData, 30000); // refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
    fetchNotificationData();
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleMarkRead = async (id: number) => {
    try {
      await api.markNotificationRead(id);
      fetchNotificationData();
    } catch (err) {
      console.error('Failed to mark read:', err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.markAllNotificationsRead();
      fetchNotificationData();
    } catch (err) {
      console.error('Failed to mark all read:', err);
    }
  };

  const open = Boolean(anchorEl);
  const id = open ? 'notification-popover' : undefined;

  const filteredNotifications = notifications.filter((n) => {
    if (tabIndex === 1) return n.category === 'unused_agent';
    if (tabIndex === 2) return n.category === 'active_agent';
    return true;
  });

  const getSeverityIcon = (sev: string) => {
    switch (sev) {
      case 'critical':
        return <ErrorOutlineIcon color="error" fontSize="small" />;
      case 'warning':
        return <WarningAmberIcon color="warning" fontSize="small" />;
      default:
        return <InfoOutlinedIcon color="info" fontSize="small" />;
    }
  };

  const getCategoryChip = (cat: string) => {
    switch (cat) {
      case 'unused_agent':
        return <Chip label="Unused Agent" size="small" color="warning" variant="outlined" sx={{ height: 20, fontSize: '0.65rem' }} />;
      case 'active_agent':
        return <Chip label="Active Agent" size="small" color="success" variant="outlined" sx={{ height: 20, fontSize: '0.65rem' }} />;
      case 'security':
        return <Chip label="Security" size="small" color="error" variant="outlined" sx={{ height: 20, fontSize: '0.65rem' }} />;
      default:
        return <Chip label="System" size="small" color="default" variant="outlined" sx={{ height: 20, fontSize: '0.65rem' }} />;
    }
  };

  return (
    <>
      <IconButton onClick={handleClick} color="inherit" aria-describedby={id}>
        <Badge badgeContent={summary?.total_unread || 0} color="error">
          <NotificationsIcon />
        </Badge>
      </IconButton>

      <Popover
        id={id}
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{
          paper: {
            sx: { width: 380, maxHeight: 520, borderRadius: 3, boxShadow: '0 10px 30px rgba(0,0,0,0.12)' },
          },
        }}
      >
        <Box sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              Governance Alerts
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Unused AI Agents & Active Agent Telemetry
            </Typography>
          </Box>
          {summary && summary.total_unread > 0 && (
            <Button size="small" onClick={handleMarkAllRead} sx={{ textTransform: 'none', fontSize: '0.75rem' }}>
              Mark all read
            </Button>
          )}
        </Box>
        <Divider />

        <Tabs
          value={tabIndex}
          onChange={(_, v) => setTabIndex(v)}
          variant="fullWidth"
          indicatorColor="primary"
          textColor="primary"
          sx={{ borderBottom: 1, borderColor: 'divider', minHeight: 38 }}
        >
          <Tab label={`All (${notifications.length})`} sx={{ py: 0.5, minHeight: 38, fontSize: '0.75rem', fontWeight: 600 }} />
          <Tab label={`Unused (${summary?.unused_agent_alerts || 0})`} sx={{ py: 0.5, minHeight: 38, fontSize: '0.75rem', fontWeight: 600 }} />
          <Tab label={`Active (${summary?.active_agent_alerts || 0})`} sx={{ py: 0.5, minHeight: 38, fontSize: '0.75rem', fontWeight: 600 }} />
        </Tabs>

        <Box sx={{ maxHeight: 340, overflowY: 'auto' }}>
          {loading && notifications.length === 0 ? (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <CircularProgress size={24} />
            </Box>
          ) : filteredNotifications.length === 0 ? (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <CheckCircleIcon color="success" sx={{ fontSize: 36, mb: 1, opacity: 0.7 }} />
              <Typography variant="body2" color="text.secondary">
                No alerts in this category
              </Typography>
            </Box>
          ) : (
            <List disablePadding>
              {filteredNotifications.map((n) => (
                <React.Fragment key={n.id}>
                  <ListItem
                    sx={{
                      py: 1.5,
                      px: 2,
                      alignItems: 'flex-start',
                      backgroundColor: n.is_read ? 'transparent' : '#f0f7ff',
                      cursor: n.agent_id ? 'pointer' : 'default',
                      transition: 'background-color 0.2s',
                      '&:hover': { backgroundColor: n.is_read ? '#f8fafc' : '#e0f2fe' },
                    }}
                    onClick={() => {
                      if (!n.is_read) handleMarkRead(n.id);
                      if (n.agent_id) {
                        navigate(`/agents/${n.agent_id}`);
                        handleClose();
                      }
                    }}
                  >
                    <Box sx={{ mr: 1.5, mt: 0.3 }}>{getSeverityIcon(n.severity)}</Box>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.3 }}>
                          <Typography variant="subtitle2" sx={{ fontSize: '0.85rem', fontWeight: n.is_read ? 500 : 700 }}>
                            {n.title}
                          </Typography>
                          {getCategoryChip(n.category)}
                        </Box>
                      }
                      secondary={
                        <>
                          <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.78rem', mb: 0.5, lineHeight: 1.3 }}>
                            {n.message}
                          </Typography>
                          <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.7rem' }}>
                            {new Date(n.created_at).toLocaleString()}
                          </Typography>
                        </>
                      }
                    />
                  </ListItem>
                  <Divider component="li" />
                </React.Fragment>
              ))}
            </List>
          )}
        </Box>

        <Divider />
        <Box sx={{ p: 1.5, display: 'flex', justifyContent: 'center' }}>
          <Button
            size="small"
            variant="contained"
            color="primary"
            fullWidth
            endIcon={<LaunchIcon />}
            onClick={() => {
              navigate('/notifications');
              handleClose();
            }}
            sx={{ textTransform: 'none', borderRadius: 2 }}
          >
            Open Notifications & Alert Hub
          </Button>
        </Box>
      </Popover>
    </>
  );
};
