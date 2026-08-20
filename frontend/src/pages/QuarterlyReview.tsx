import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  CircularProgress,
  Alert,
  IconButton,
  Tooltip,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import WarningIcon from '@mui/icons-material/Warning';
import AssignmentLateIcon from '@mui/icons-material/AssignmentLate';
import SecurityIcon from '@mui/icons-material/Security';
import FileDownloadIcon from '@mui/icons-material/FileDownload';

import { api } from '../api/client';
import { QuarterlyReport } from '../types';
import { StatusChip } from '../components/StatusChip';
import { RiskBadge } from '../components/RiskBadge';
import { useNotification } from '../context/NotificationContext';

export const QuarterlyReview: React.FC = () => {
  const navigate = useNavigate();
  const { showError } = useNotification();
  const [report, setReport] = useState<QuarterlyReport | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getQuarterlyReport();
      setReport(data);
    } catch (err: any) {
      showError(err.response?.data?.detail || 'Failed to load quarterly report');
    } finally {
      setLoading(false);
    }
  }, [showError]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  if (loading && !report) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ py: 2 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800, color: '#1e293b' }}>
            Quarterly Governance Report
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Generated at {report?.generated_at ? new Date(report.generated_at).toLocaleString() : '—'}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
          <Button
            variant="outlined"
            color="primary"
            size="small"
            startIcon={<FileDownloadIcon />}
            href={api.exportComplianceCsv()}
            download
            sx={{ textTransform: 'none', borderRadius: 2, fontWeight: 600 }}
          >
            Export CSV
          </Button>
          <Button
            variant="outlined"
            color="primary"
            size="small"
            startIcon={<FileDownloadIcon />}
            href={api.exportComplianceJson()}
            download
            sx={{ textTransform: 'none', borderRadius: 2, fontWeight: 600 }}
          >
            Export JSON
          </Button>
          <Tooltip title="Refresh Report">
            <IconButton onClick={fetchReport} color="primary">
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Summary Cards */}
      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card sx={{ borderRadius: 3, border: '1px solid #e2e8f0' }}>
            <CardContent sx={{ p: 2.5 }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                TOTAL AUDITED IDENTITIES
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 800, mt: 0.5 }}>
                {report?.total_agents || 0}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card sx={{ borderRadius: 3, border: '1px solid #e2e8f0' }}>
            <CardContent sx={{ p: 2.5 }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                STALE AGENTS FLAGGED
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 800, color: '#d97706', mt: 0.5 }}>
                {report?.stale_agents?.length || 0}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card sx={{ borderRadius: 3, border: '1px solid #e2e8f0' }}>
            <CardContent sx={{ p: 2.5 }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                OVERDUE FOR ROTATION (&gt;90d)
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 800, color: '#dc2626', mt: 0.5 }}>
                {report?.agents_without_rotation_90d?.length || 0}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card sx={{ borderRadius: 3, border: '1px solid #e2e8f0' }}>
            <CardContent sx={{ p: 2.5 }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                ACTIVE POSTURE
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 800, color: '#059669', mt: 0.5 }}>
                {report?.by_status?.['active'] || report?.by_status?.['ACTIVE'] || 0}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Overdue Rotation & Stale Warnings */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        {/* Agents without Rotation */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper sx={{ p: 3, borderRadius: 3, border: '1px solid #e2e8f0', height: '100%' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <AssignmentLateIcon color="error" />
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                Overdue Credential Rotations (&gt;90d)
              </Typography>
            </Box>

            {report?.agents_without_rotation_90d && report.agents_without_rotation_90d.length > 0 ? (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600 }}>Agent Name</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Agent ID</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600 }}>Action</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {report.agents_without_rotation_90d.map((a) => (
                      <TableRow key={a.agent_id} hover>
                        <TableCell sx={{ fontWeight: 600 }}>{a.agent_name}</TableCell>
                        <TableCell sx={{ fontFamily: 'monospace' }}>{a.agent_id}</TableCell>
                        <TableCell align="right">
                          <Button
                            size="small"
                            onClick={() => navigate(`/agents/${a.agent_id}`)}
                            sx={{ textTransform: 'none' }}
                          >
                            Inspect
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Alert severity="success" sx={{ borderRadius: 2 }}>
                All eligible agents have undergone credential rotation within policy window.
              </Alert>
            )}
          </Paper>
        </Grid>

        {/* Stale Agents */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper sx={{ p: 3, borderRadius: 3, border: '1px solid #e2e8f0', height: '100%' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <WarningIcon color="warning" />
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                Stale Inactive Agents
              </Typography>
            </Box>

            {report?.stale_agents && report.stale_agents.length > 0 ? (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600 }}>Agent</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Risk Score</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600 }}>Action</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {report.stale_agents.map((a) => (
                      <TableRow key={a.agent_id} hover>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {a.agent_name}
                          </Typography>
                          <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>
                            {a.agent_id}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <RiskBadge score={a.risk_score} />
                        </TableCell>
                        <TableCell align="right">
                          <Button
                            size="small"
                            onClick={() => navigate(`/agents/${a.agent_id}`)}
                            sx={{ textTransform: 'none' }}
                          >
                            Inspect
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Alert severity="success" sx={{ borderRadius: 2 }}>
                No active agents are currently marked stale.
              </Alert>
            )}
          </Paper>
        </Grid>
      </Grid>

      {/* Top Risk Agents Table */}
      <Paper sx={{ p: 3, borderRadius: 3, border: '1px solid #e2e8f0' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <SecurityIcon color="primary" />
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Top Governance Risk Rankings
          </Typography>
        </Box>

        <TableContainer>
          <Table>
            <TableHead sx={{ backgroundColor: '#f8fafc' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>Agent Identity</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Risk Score</TableCell>
                <TableCell align="right" sx={{ fontWeight: 600 }}>Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {report?.top_risk_agents && report.top_risk_agents.length > 0 ? (
                report.top_risk_agents.map((a) => (
                  <TableRow key={a.agent_id} hover>
                    <TableCell>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                        {a.agent_name}
                      </Typography>
                      <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>
                        {a.agent_id}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <StatusChip status={a.status} />
                    </TableCell>
                    <TableCell>
                      <RiskBadge score={a.risk_score} showLabel />
                    </TableCell>
                    <TableCell align="right">
                      <Button
                        size="small"
                        onClick={() => navigate(`/agents/${a.agent_id}`)}
                        sx={{ textTransform: 'none' }}
                      >
                        View Profile
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} align="center">
                    No risk ranking data available.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
};
