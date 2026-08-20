import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Button,
  Chip,
  Card,
  CardContent,
  Tabs,
  Tab,
  CircularProgress,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  TextField,
  DialogActions,
  Alert,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutlined';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import SendIcon from '@mui/icons-material/Send';
import LaunchIcon from '@mui/icons-material/Launch';

import { api } from '../api/client';
import { SystemNotification, NotificationSummary } from '../types';

export const Notifications: React.FC = () => {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<SystemNotification[]>([]);
  const [summary, setSummary] = useState<NotificationSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [sweeping, setSweeping] = useState(false);
  const [currentTab, setCurrentTab] = useState('all');
  const [webhookDialogOpen, setWebhookDialogOpen] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState('https://hooks.slack.com/services/DEMO/WEBHOOK/123');
  const [webhookStatus, setWebhookStatus] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const params: any = { limit: 100 };
      if (currentTab === 'unused') params.category = 'unused_agent';
      else if (currentTab === 'active') params.category = 'active_agent';
      else if (currentTab === 'security') params.category = 'security';
      else if (currentTab === 'unread') params.is_read = false;

      const [notes, sum] = await Promise.all([
        api.getNotifications(params),
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
    loadData();
  }, [currentTab]);

  const handleTriggerSweep = async () => {
    try {
      setSweeping(true);
      const res = await api.triggerAlertSweep();
      setSummary(res.summary);
      await loadData();
    } catch (err) {
      console.error('Failed to trigger alert sweep:', err);
    } finally {
      setSweeping(false);
    }
  };

  const handleMarkRead = async (id: number) => {
    try {
      await api.markNotificationRead(id);
      loadData();
    } catch (err) {
      console.error('Failed to mark read:', err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.markAllNotificationsRead();
      loadData();
    } catch (err) {
      console.error('Failed to mark all read:', err);
    }
  };

  const handleTestWebhook = async () => {
    try {
      setWebhookStatus('Sending payload to webhook...');
      const res = await api.testWebhook(webhookUrl, 'AIMS Unused Agent Alert', 'FinanceBot is stale for 35 days.');
      setWebhookStatus(`Webhook simulation successful! Delivered to ${res.target_url}`);
    } catch (err) {
      setWebhookStatus('Failed to send test webhook.');
    }
  };

  const getSeverityIcon = (sev: string) => {
    switch (sev) {
      case 'critical':
        return <ErrorOutlineIcon color="error" />;
      case 'warning':
        return <WarningAmberIcon color="warning" />;
      default:
        return <InfoOutlinedIcon color="info" />;
    }
  };

  const getCategoryChip = (cat: string) => {
    switch (cat) {
      case 'unused_agent':
        return <Chip label="Unused Agent Alert" size="small" color="warning" sx={{ fontWeight: 600 }} />;
      case 'active_agent':
        return <Chip label="Active Agent Telemetry" size="small" color="success" sx={{ fontWeight: 600 }} />;
      case 'security':
        return <Chip label="Security Denial" size="small" color="error" sx={{ fontWeight: 600 }} />;
      default:
        return <Chip label="System Governance" size="small" color="default" sx={{ fontWeight: 600 }} />;
    }
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800, mb: 0.5 }}>
            Governance Notifications & Alert Hub
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Continuous telemetry and alerting engine for unused and currently active AI agents.
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1.5 }}>
          <Button
            variant="outlined"
            color="primary"
            startIcon={<SendIcon />}
            onClick={() => setWebhookDialogOpen(true)}
            sx={{ textTransform: 'none', borderRadius: 2 }}
          >
            Webhook Integration
          </Button>
          <Button
            variant="contained"
            color="primary"
            startIcon={sweeping ? <CircularProgress size={18} color="inherit" /> : <PlayArrowIcon />}
            onClick={handleTriggerSweep}
            disabled={sweeping}
            sx={{ textTransform: 'none', borderRadius: 2 }}
          >
            Run Alert Sweep
          </Button>
        </Box>
      </Box>

      {/* KPI Cards */}
      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Paper sx={{ p: 2.5, borderRadius: 3, border: '1px solid #e2e8f0' }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
              TOTAL UNREAD ALERTS
            </Typography>
            <Typography variant="h4" color="error.main" sx={{ my: 0.5, fontWeight: 800 }}>
              {summary?.total_unread || 0}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Active pending governance items
            </Typography>
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Paper sx={{ p: 2.5, borderRadius: 3, border: '1px solid #e2e8f0' }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
              UNUSED AGENT WARNINGS
            </Typography>
            <Typography variant="h4" color="warning.main" sx={{ my: 0.5, fontWeight: 800 }}>
              {summary?.unused_agent_alerts || 0}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Stale, idle & auto-revoked agents
            </Typography>
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Paper sx={{ p: 2.5, borderRadius: 3, border: '1px solid #e2e8f0' }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
              ACTIVE AGENT TELEMETRY
            </Typography>
            <Typography variant="h4" color="success.main" sx={{ my: 0.5, fontWeight: 800 }}>
              {summary?.active_agent_alerts || 0}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Live traffic & risk score spikes
            </Typography>
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Paper sx={{ p: 2.5, borderRadius: 3, border: '1px solid #e2e8f0' }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
              SECURITY SCOPE DENIALS
            </Typography>
            <Typography variant="h4" color="error.dark" sx={{ my: 0.5, fontWeight: 800 }}>
              {summary?.security_alerts || 0}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Unauthorized resource access
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* Main Content Area */}
      <Paper sx={{ borderRadius: 3, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        <Box sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0' }}>
          <Tabs
            value={currentTab}
            onChange={(_, val) => setCurrentTab(val)}
            indicatorColor="primary"
            textColor="primary"
          >
            <Tab label="All Alerts" value="all" sx={{ textTransform: 'none', fontWeight: 700 }} />
            <Tab label={`Unused AI Agents (${summary?.unused_agent_alerts || 0})`} value="unused" sx={{ textTransform: 'none', fontWeight: 700 }} />
            <Tab label={`Active AI Agents (${summary?.active_agent_alerts || 0})`} value="active" sx={{ textTransform: 'none', fontWeight: 700 }} />
            <Tab label={`Security (${summary?.security_alerts || 0})`} value="security" sx={{ textTransform: 'none', fontWeight: 700 }} />
            <Tab label={`Unread Only (${summary?.total_unread || 0})`} value="unread" sx={{ textTransform: 'none', fontWeight: 700 }} />
          </Tabs>

          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              size="small"
              startIcon={<DoneAllIcon />}
              onClick={handleMarkAllRead}
              disabled={!summary || summary.total_unread === 0}
              sx={{ textTransform: 'none' }}
            >
              Mark all as read
            </Button>
            <IconButton onClick={loadData}>
              <RefreshIcon />
            </IconButton>
          </Box>
        </Box>

        <Box sx={{ p: 3 }}>
          {loading ? (
            <Box sx={{ p: 6, textAlign: 'center' }}>
              <CircularProgress />
            </Box>
          ) : notifications.length === 0 ? (
            <Box sx={{ p: 6, textAlign: 'center' }}>
              <NotificationsActiveIcon color="action" sx={{ fontSize: 48, mb: 1, opacity: 0.5 }} />
              <Typography variant="h6" color="text.secondary">
                No Notifications Found
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Run an Alert Sweep or check back later.
              </Typography>
            </Box>
          ) : (
            <Grid container spacing={2}>
              {notifications.map((n) => (
                <Grid size={{ xs: 12 }} key={n.id}>
                  <Card
                    elevation={0}
                    sx={{
                      borderRadius: 2.5,
                      border: '1px solid',
                      borderColor: n.is_read ? '#e2e8f0' : '#93c5fd',
                      backgroundColor: n.is_read ? '#ffffff' : '#f0f7ff',
                      transition: 'all 0.2s ease',
                      '&:hover': { boxShadow: '0 4px 12px rgba(0,0,0,0.05)' },
                    }}
                  >
                    <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                          {getSeverityIcon(n.severity)}
                          <Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.3 }}>
                              <Typography variant="h6" sx={{ fontSize: '1rem', fontWeight: 700 }}>
                                {n.title}
                              </Typography>
                              {getCategoryChip(n.category)}
                              {!n.is_read && (
                                <Chip label="NEW" size="small" color="error" sx={{ height: 20, fontSize: '0.65rem', fontWeight: 700 }} />
                              )}
                            </Box>
                            <Typography variant="body2" color="text.secondary">
                              {n.message}
                            </Typography>
                          </Box>
                        </Box>

                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          {n.agent_id && (
                            <Button
                              size="small"
                              variant="outlined"
                              endIcon={<LaunchIcon />}
                              onClick={() => navigate(`/agents/${n.agent_id}`)}
                              sx={{ textTransform: 'none' }}
                            >
                              Agent Profile
                            </Button>
                          )}
                          {!n.is_read && (
                            <Button
                              size="small"
                              variant="text"
                              onClick={() => handleMarkRead(n.id)}
                              sx={{ textTransform: 'none' }}
                            >
                              Mark Read
                            </Button>
                          )}
                        </Box>
                      </Box>
                      <Box sx={{ mt: 1.5, display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Typography variant="caption" color="text.disabled">
                          Timestamp: {new Date(n.created_at).toLocaleString()}
                        </Typography>
                        {n.agent_id && (
                          <Typography variant="caption" color="primary.main" sx={{ fontWeight: 600 }}>
                            Agent ID: {n.agent_id}
                          </Typography>
                        )}
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}
        </Box>
      </Paper>

      {/* Webhook Dialog */}
      <Dialog open={webhookDialogOpen} onClose={() => setWebhookDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Webhook Integration Simulator</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Simulate real-time alert delivery to external endpoints such as Slack, Microsoft Teams, or Email.
          </Typography>
          <TextField
            fullWidth
            label="Target Webhook URL"
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
            margin="normal"
            size="small"
          />
          {webhookStatus && (
            <Alert severity={webhookStatus.includes('successful') ? 'success' : 'info'} sx={{ mt: 2 }}>
              {webhookStatus}
            </Alert>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setWebhookDialogOpen(false)} sx={{ textTransform: 'none' }}>
            Close
          </Button>
          <Button variant="contained" onClick={handleTestWebhook} startIcon={<SendIcon />} sx={{ textTransform: 'none' }}>
            Test Webhook Dispatch
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
