import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Button,
  Chip,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  Tabs,
  Tab,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import PauseCircleIcon from '@mui/icons-material/PauseCircle';
import PlayCircleIcon from '@mui/icons-material/PlayCircle';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import KeyIcon from '@mui/icons-material/Key';
import HistoryIcon from '@mui/icons-material/History';
import SecurityIcon from '@mui/icons-material/Security';

import { api } from '../api/client';
import { Agent, Credential, AuditLogEntry, RegisterAgentResponse, RotateCredentialResponse } from '../types';
import { StatusChip } from '../components/StatusChip';
import { RiskBadge } from '../components/RiskBadge';
import { TokenDialog } from '../components/TokenDialog';
import { useNotification } from '../context/NotificationContext';
import { useAuth } from '../context/AuthContext';

export const AgentDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showSuccess, showError } = useNotification();
  const { adminToken } = useAuth();

  const [agent, setAgent] = useState<Agent | null>(null);
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [tabValue, setTabValue] = useState<number>(0);

  // Dialog states
  const [rotateDialogOpen, setRotateDialogOpen] = useState<boolean>(false);
  const [rotateTokenInput, setRotateTokenInput] = useState<string>('');
  const [actionDialogOpen, setActionDialogOpen] = useState<boolean>(false);
  const [actionType, setActionType] = useState<'suspend' | 'reactivate' | 'decommission' | null>(null);
  const [actionAdminToken, setActionAdminToken] = useState<string>(adminToken);
  const [actionLoading, setActionLoading] = useState<boolean>(false);

  // Token reveal dialog state
  const [newCredentialData, setNewCredentialData] = useState<{
    token: string;
    expiresAt: string;
    title: string;
  } | null>(null);

  const fetchAgentData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [agentRes, credsRes, logsRes] = await Promise.all([
        api.getAgent(id),
        api.getCredentials(id),
        api.getAuditLogs(id, 100),
      ]);
      setAgent(agentRes);
      setCredentials(credsRes);
      setAuditLogs(logsRes);
    } catch (err: any) {
      showError(err.response?.data?.detail || 'Failed to load agent details');
    } finally {
      setLoading(false);
    }
  }, [id, showError]);

  useEffect(() => {
    fetchAgentData();
  }, [fetchAgentData]);

  useEffect(() => {
    setActionAdminToken(adminToken);
  }, [adminToken]);

  const handleRotate = async () => {
    if (!id) return;
    const tokenToUse = rotateTokenInput.trim() || adminToken.trim();
    if (!tokenToUse) {
      showError('Please provide either this agent\'s current token or an admin token');
      return;
    }

    setActionLoading(true);
    try {
      const res: RotateCredentialResponse = await api.rotateCredential(id, tokenToUse);
      showSuccess('Credential rotated successfully!');
      setRotateDialogOpen(false);
      setRotateTokenInput('');
      setNewCredentialData({
        token: res.token,
        expiresAt: res.expires_at,
        title: 'New Rotated Credential Issued',
      });
      await fetchAgentData();
    } catch (err: any) {
      showError(err.response?.data?.detail || 'Credential rotation failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleExecuteLifecycleAction = async () => {
    if (!id || !actionType) return;
    if (!actionAdminToken.trim()) {
      showError('Admin token is required for lifecycle actions');
      return;
    }

    setActionLoading(true);
    try {
      if (actionType === 'suspend') {
        await api.suspendAgent(id, actionAdminToken.trim());
        showSuccess('Agent suspended successfully');
      } else if (actionType === 'reactivate') {
        const res: RegisterAgentResponse = await api.reactivateAgent(id, actionAdminToken.trim());
        showSuccess('Agent reactivated successfully!');
        setNewCredentialData({
          token: res.token,
          expiresAt: res.expires_at,
          title: 'Agent Reactivated — New Credential Issued',
        });
      } else if (actionType === 'decommission') {
        await api.decommissionAgent(id, actionAdminToken.trim());
        showSuccess('Agent decommissioned and credentials revoked');
      }

      setActionDialogOpen(false);
      await fetchAgentData();
    } catch (err: any) {
      showError(err.response?.data?.detail || `Failed to ${actionType} agent`);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading && !agent) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!agent) {
    return (
      <Box sx={{ py: 4, textAlign: 'center' }}>
        <Typography variant="h6" color="error">
          Agent not found
        </Typography>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/')} sx={{ mt: 2 }}>
          Back to Directory
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ py: 2 }}>
      {/* Back button */}
      <Button
        startIcon={<ArrowBackIcon />}
        onClick={() => navigate('/')}
        sx={{ mb: 2, textTransform: 'none' }}
      >
        Back to Directory
      </Button>

      {/* Agent Card Header */}
      <Paper sx={{ p: 3, mb: 3, borderRadius: 3, border: '1px solid #e2e8f0' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 2 }}>
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
              <Typography variant="h4" sx={{ fontWeight: 800, color: '#1e293b' }}>
                {agent.agent_name}
              </Typography>
              <StatusChip status={agent.status} />
              <RiskBadge score={agent.risk_score} showLabel />
            </Box>
            <Typography variant="body2" sx={{ fontFamily: 'monospace', color: 'text.secondary', mb: 1 }}>
              ID: {agent.agent_id}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {agent.purpose || 'No purpose description provided'}
            </Typography>
          </Box>

          {/* Action Buttons */}
          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
            <Button
              variant="outlined"
              color="primary"
              size="small"
              startIcon={<AutorenewIcon />}
              onClick={() => setRotateDialogOpen(true)}
              disabled={agent.status !== 'ACTIVE' && agent.status !== 'STALE'}
              sx={{ textTransform: 'none', borderRadius: 2 }}
            >
              Rotate Credential
            </Button>

            {agent.status === 'ACTIVE' || agent.status === 'STALE' ? (
              <Button
                variant="outlined"
                color="warning"
                size="small"
                startIcon={<PauseCircleIcon />}
                onClick={() => {
                  setActionType('suspend');
                  setActionDialogOpen(true);
                }}
                sx={{ textTransform: 'none', borderRadius: 2 }}
              >
                Suspend
              </Button>
            ) : agent.status === 'SUSPENDED' ? (
              <Button
                variant="contained"
                color="success"
                size="small"
                startIcon={<PlayCircleIcon />}
                onClick={() => {
                  setActionType('reactivate');
                  setActionDialogOpen(true);
                }}
                sx={{ textTransform: 'none', borderRadius: 2 }}
              >
                Reactivate
              </Button>
            ) : null}

            {agent.status !== 'DECOMMISSIONED' && agent.status !== 'REVOKED' && (
              <Button
                variant="outlined"
                color="error"
                size="small"
                startIcon={<DeleteForeverIcon />}
                onClick={() => {
                  setActionType('decommission');
                  setActionDialogOpen(true);
                }}
                sx={{ textTransform: 'none', borderRadius: 2 }}
              >
                Decommission
              </Button>
            )}
          </Box>
        </Box>

        <Divider sx={{ my: 2.5 }} />

        {/* Metadata Details Grid */}
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, display: 'block' }}>
              OWNING TEAM
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 600, mt: 0.5 }}>
              {agent.owning_team || 'Unassigned'}
            </Typography>
          </Grid>

          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, display: 'block' }}>
              APPROVED SCOPES
            </Typography>
            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
              {agent.approved_scopes.map((s) => (
                <Chip key={s} label={s} size="small" variant="outlined" sx={{ fontSize: '0.75rem' }} />
              ))}
            </Box>
          </Grid>

          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, display: 'block' }}>
              CREATED DATE
            </Typography>
            <Typography variant="body2" sx={{ mt: 0.5 }}>
              {new Date(agent.creation_date).toLocaleDateString()}
            </Typography>
          </Grid>

          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, display: 'block' }}>
              LAST API ACTIVITY
            </Typography>
            <Typography variant="body2" sx={{ mt: 0.5 }}>
              {agent.last_api_call ? new Date(agent.last_api_call).toLocaleString() : 'Never used'}
            </Typography>
          </Grid>
        </Grid>
      </Paper>

      {/* Tabs for Credentials & Audit Logs */}
      <Paper sx={{ borderRadius: 3, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}>
          <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)}>
            <Tab label={`Credential History (${credentials.length})`} icon={<KeyIcon fontSize="small" />} iconPosition="start" />
            <Tab label={`Agent Audit Logs (${auditLogs.length})`} icon={<HistoryIcon fontSize="small" />} iconPosition="start" />
          </Tabs>
        </Box>

        {/* Tab 0: Credential History */}
        {tabValue === 0 && (
          <TableContainer>
            <Table>
              <TableHead sx={{ backgroundColor: '#f8fafc' }}>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>Credential ID</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Issued At</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Expires At</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {credentials.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} align="center">
                      No credential records found.
                    </TableCell>
                  </TableRow>
                ) : (
                  credentials.map((cred) => (
                    <TableRow key={cred.credential_id} hover>
                      <TableCell sx={{ fontFamily: 'monospace', fontWeight: 600 }}>
                        {cred.credential_id}
                      </TableCell>
                      <TableCell>
                        <StatusChip status={cred.status} />
                      </TableCell>
                      <TableCell>{new Date(cred.issued_at).toLocaleString()}</TableCell>
                      <TableCell>{new Date(cred.expires_at).toLocaleString()}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {/* Tab 1: Audit Logs */}
        {tabValue === 1 && (
          <TableContainer>
            <Table>
              <TableHead sx={{ backgroundColor: '#f8fafc' }}>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>Timestamp</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Action</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Result</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Reason / Details</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {auditLogs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} align="center">
                      No audit events for this agent.
                    </TableCell>
                  </TableRow>
                ) : (
                  auditLogs.map((log) => (
                    <TableRow key={log.log_id} hover>
                      <TableCell sx={{ color: 'text.secondary', fontSize: '0.82rem' }}>
                        {new Date(log.timestamp).toLocaleString()}
                      </TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>{log.action}</TableCell>
                      <TableCell>
                        <StatusChip status={log.result === 'SUCCESS' ? 'ACTIVE' : 'REVOKED'} size="small" />
                      </TableCell>
                      <TableCell sx={{ color: 'text.secondary', fontSize: '0.85rem' }}>
                        {log.reason || '—'}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {/* Rotate Dialog */}
      <Dialog open={rotateDialogOpen} onClose={() => setRotateDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <AutorenewIcon color="primary" />
          Rotate Agent Credential
        </DialogTitle>
        <DialogContent dividers>
          <Alert severity="info" sx={{ mb: 2 }}>
            Rotating will immediately invalidate the agent's current active JWT token and issue a fresh one.
          </Alert>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Enter the agent's current active token (or an admin token):
          </Typography>
          <TextField
            fullWidth
            multiline
            rows={3}
            placeholder={adminToken ? 'Using configured admin token (or paste current token)' : 'Paste current bearer token...'}
            value={rotateTokenInput}
            onChange={(e) => setRotateTokenInput(e.target.value)}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setRotateDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleRotate}
            variant="contained"
            disabled={actionLoading}
            startIcon={actionLoading ? <CircularProgress size={18} /> : <AutorenewIcon />}
          >
            {actionLoading ? 'Rotating...' : 'Rotate Now'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Lifecycle Action Dialog */}
      <Dialog open={actionDialogOpen} onClose={() => setActionDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <SecurityIcon color="warning" />
          Confirm {actionType ? actionType.toUpperCase() : ''} Action
        </DialogTitle>
        <DialogContent dividers>
          <Alert severity={actionType === 'decommission' ? 'error' : 'warning'} sx={{ mb: 2 }}>
            {actionType === 'suspend' && 'Suspending will block all API calls until reactivated.'}
            {actionType === 'reactivate' && 'Reactivating will restore access and automatically issue a fresh credential.'}
            {actionType === 'decommission' && 'Decommissioning is irreversible and immediately revokes all credentials.'}
          </Alert>

          <Typography variant="body2" color="text.secondary" gutterBottom>
            Admin Bearer Token:
          </Typography>
          <TextField
            fullWidth
            multiline
            rows={3}
            placeholder="Paste admin-scoped bearer token (e.g. AuditBot)..."
            value={actionAdminToken}
            onChange={(e) => setActionAdminToken(e.target.value)}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setActionDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleExecuteLifecycleAction}
            variant="contained"
            color={actionType === 'decommission' ? 'error' : actionType === 'suspend' ? 'warning' : 'success'}
            disabled={actionLoading || !actionAdminToken.trim()}
          >
            {actionLoading ? 'Processing...' : `Confirm ${actionType}`}
          </Button>
        </DialogActions>
      </Dialog>

      {/* New Token Dialog Reveal */}
      {newCredentialData && (
        <TokenDialog
          open={Boolean(newCredentialData)}
          onClose={() => setNewCredentialData(null)}
          title={newCredentialData.title}
          agentId={agent.agent_id}
          token={newCredentialData.token}
          expiresAt={newCredentialData.expiresAt}
        />
      )}
    </Box>
  );
};
