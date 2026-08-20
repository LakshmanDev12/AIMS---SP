import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Button,
  CircularProgress,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import SearchIcon from '@mui/icons-material/Search';
import VisibilityIcon from '@mui/icons-material/Visibility';

import { api } from '../api/client';
import { Agent } from '../types';
import { useNotification } from '../context/NotificationContext';

// Format date helper
function formatLastActive(dateStr?: string | null): { text: string; isNever: boolean } {
  if (!dateStr) return { text: 'Never', isNever: true };
  try {
    const d = new Date(dateStr);
    return { text: d.toLocaleString(), isNever: false };
  } catch {
    return { text: 'Never', isNever: true };
  }
}

// Risk helper
function getRiskInfo(score: number): { label: string; gradient: string } {
  if (score >= 76) return { label: 'Critical', gradient: 'linear-gradient(155deg,#F17163,#D6392B)' };
  if (score >= 51) return { label: 'Moderate', gradient: 'linear-gradient(155deg,#F0AC4E,#C4740A)' };
  if (score >= 26) return { label: 'Guarded', gradient: 'linear-gradient(155deg,#7FC4FF,#2B6FD6)' };
  return { label: 'Low', gradient: 'linear-gradient(155deg,#4FD79A,#0F9D63)' };
}

// Status badge helper
function getStatusBadgeStyle(status: string): { text: string; sx: Record<string, any> } {
  const s = status.toUpperCase();
  if (s === 'ACTIVE') {
    return {
      text: 'Active',
      sx: {
        background: '#0F9D63',
        color: '#FFFFFF',
      },
    };
  }
  if (s === 'STALE') {
    return {
      text: 'Under Review',
      sx: {
        background: '#FDF3E3',
        color: '#C4740A',
        border: '1px solid #F3D9A6',
      },
    };
  }
  if (s === 'SUSPENDED') {
    return {
      text: 'Suspended',
      sx: {
        background: '#FCEAE8',
        color: '#D6392B',
        border: '1px solid #F3C3BE',
      },
    };
  }
  if (s === 'REVOKED') {
    return {
      text: 'Revoked',
      sx: {
        background: '#FCEAE8',
        color: '#D6392B',
        border: '1px solid #F3C3BE',
      },
    };
  }
  return {
    text: 'Decommissioned',
    sx: {
      background: '#FFFFFF',
      color: '#8A93A6',
      border: '1px solid #E7EAEF',
    },
  };
}

// Scope chip styles
function getScopeChipStyle(scope: string): { color: string; border: string; bg: string } {
  const sc = scope.toLowerCase();
  if (sc === 'admin') return { color: '#D6392B', border: '#F3C3BE', bg: '#FCEAE8' };
  if (sc === 'write') return { color: '#C4740A', border: '#F3D9A6', bg: '#FDF3E3' };
  return { color: '#4C9EF0', border: '#C7E3FB', bg: '#EAF4FE' };
}

export const AgentList: React.FC = () => {
  const navigate = useNavigate();
  const { showError } = useNotification();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [page, setPage] = useState<number>(0);
  const [rowsPerPage, setRowsPerPage] = useState<number>(10);

  const fetchAgents = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getAgents(0, 500);
      setAgents(data);
    } catch (err: any) {
      showError(err.response?.data?.detail || 'Failed to load agents list');
    } finally {
      setLoading(false);
    }
  }, [showError]);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  const filteredAgents = agents.filter((agent) => {
    const matchesSearch =
      agent.agent_name.toLowerCase().includes(search.toLowerCase()) ||
      agent.agent_id.toLowerCase().includes(search.toLowerCase()) ||
      (agent.owning_team && agent.owning_team.toLowerCase().includes(search.toLowerCase())) ||
      (agent.purpose && agent.purpose.toLowerCase().includes(search.toLowerCase()));

    const matchesStatus = statusFilter === 'ALL' || agent.status.toUpperCase() === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const handleChangePage = (_: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const paginatedAgents = filteredAgents.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  return (
    <Box sx={{ maxWidth: 1440, mx: 'auto', pb: 6 }}>
      {/* ============ PAGE HEADER ============ */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          mb: 2.5,
          flexWrap: 'wrap',
          gap: 1.5,
        }}
      >
        <Box>
          <Typography
            variant="h1"
            sx={{
              fontFamily: 'Manrope, sans-serif',
              fontSize: '28px',
              fontWeight: 800,
              letterSpacing: '-0.02em',
              color: '#10151F',
              mb: 0.5,
            }}
          >
            Agent Directory
          </Typography>
          <Typography sx={{ fontSize: '13.5px', color: '#8A93A6', fontWeight: 500 }}>
            Manage AI identity cards, access scopes, and lifecycle states
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
          <Box
            onClick={fetchAgents}
            title="Refresh"
            sx={{
              width: 34,
              height: 34,
              borderRadius: '9px',
              border: '1px solid #E7EAEF',
              bgcolor: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#2B4EE6',
              transition: 'background .15s',
              '&:hover': { bgcolor: '#F0F2F5' },
            }}
          >
            <RefreshIcon fontSize="small" />
          </Box>
          <Button
            onClick={() => navigate('/agents/register')}
            startIcon={<PersonAddIcon />}
            sx={{
              background: 'linear-gradient(135deg,#4364EE,#7B4EF0)',
              color: '#fff',
              border: 'none',
              py: '9px',
              px: '15px',
              borderRadius: '9px',
              fontSize: '13px',
              fontWeight: 600,
              textTransform: 'none',
              boxShadow: '0 4px 14px rgba(87,78,230,0.35)',
              '&:hover': {
                background: 'linear-gradient(135deg,#3857db,#6a3ee0)',
              },
            }}
          >
            Register Agent
          </Button>
        </Box>
      </Box>

      {/* ============ FILTER BAR ============ */}
      <Box
        sx={{
          background: '#FFFFFF',
          border: '1px solid #E7EAEF',
          borderRadius: '14px',
          boxShadow: '0 1px 2px rgba(16,21,31,0.04), 0 2px 10px rgba(16,21,31,0.035)',
          p: '14px',
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          mb: 2.5,
          flexWrap: 'wrap',
        }}
      >
        <Box
          sx={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            gap: 1.2,
            background: '#F6F7F9',
            border: '1px solid #E7EAEF',
            borderRadius: '10px',
            px: 2,
            py: '9px',
            minWidth: 260,
          }}
        >
          <SearchIcon sx={{ fontSize: 18, color: '#8A93A6', flexShrink: 0 }} />
          <input
            type="text"
            placeholder="Search name, ID, team, purpose…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            style={{
              border: 'none',
              background: 'transparent',
              outline: 'none',
              fontSize: '13.5px',
              color: '#10151F',
              fontFamily: 'Inter, sans-serif',
              width: '100%',
            }}
          />
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.4 }}>
          <Typography
            sx={{
              fontSize: '10.5px',
              color: '#8A93A6',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              pl: '2px',
            }}
          >
            Status
          </Typography>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(0);
            }}
            style={{
              appearance: 'none',
              WebkitAppearance: 'none',
              fontFamily: 'Inter, sans-serif',
              fontSize: '13px',
              fontWeight: 600,
              color: '#10151F',
              background: `#F6F7F9 url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%238A93A6' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E") no-repeat right 12px center / 14px`,
              border: '1px solid #E7EAEF',
              borderRadius: '9px',
              padding: '9px 34px 9px 13px',
              cursor: 'pointer',
              minWidth: '170px',
              outline: 'none',
            }}
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="STALE">Under Review</option>
            <option value="SUSPENDED">Suspended</option>
            <option value="REVOKED">Revoked</option>
            <option value="DECOMMISSIONED">Decommissioned</option>
          </select>
        </Box>
      </Box>

      {/* ============ TABLE PANEL ============ */}
      <Box
        sx={{
          background: '#FFFFFF',
          border: '1px solid #E7EAEF',
          borderRadius: '14px',
          boxShadow: '0 1px 2px rgba(16,21,31,0.04), 0 8px 24px rgba(16,21,31,0.05)',
          overflow: 'hidden',
        }}
      >
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow sx={{ background: '#F6F7F9' }}>
                <TableCell sx={{ fontSize: '10.5px', fontWeight: 700, color: '#8A93A6', textTransform: 'uppercase', letterSpacing: '0.05em', py: '14px', px: '18px', borderBottom: '1px solid #E7EAEF' }}>
                  Agent Identity
                </TableCell>
                <TableCell sx={{ fontSize: '10.5px', fontWeight: 700, color: '#8A93A6', textTransform: 'uppercase', letterSpacing: '0.05em', py: '14px', px: '18px', borderBottom: '1px solid #E7EAEF' }}>
                  Team / Purpose
                </TableCell>
                <TableCell sx={{ fontSize: '10.5px', fontWeight: 700, color: '#8A93A6', textTransform: 'uppercase', letterSpacing: '0.05em', py: '14px', px: '18px', borderBottom: '1px solid #E7EAEF' }}>
                  Scopes
                </TableCell>
                <TableCell sx={{ fontSize: '10.5px', fontWeight: 700, color: '#8A93A6', textTransform: 'uppercase', letterSpacing: '0.05em', py: '14px', px: '18px', borderBottom: '1px solid #E7EAEF' }}>
                  Status
                </TableCell>
                <TableCell sx={{ fontSize: '10.5px', fontWeight: 700, color: '#8A93A6', textTransform: 'uppercase', letterSpacing: '0.05em', py: '14px', px: '18px', borderBottom: '1px solid #E7EAEF' }}>
                  Risk
                </TableCell>
                <TableCell sx={{ fontSize: '10.5px', fontWeight: 700, color: '#8A93A6', textTransform: 'uppercase', letterSpacing: '0.05em', py: '14px', px: '18px', borderBottom: '1px solid #E7EAEF' }}>
                  Last Active
                </TableCell>
                <TableCell align="center" sx={{ fontSize: '10.5px', fontWeight: 700, color: '#8A93A6', textTransform: 'uppercase', letterSpacing: '0.05em', py: '14px', px: '18px', borderBottom: '1px solid #E7EAEF' }}>
                  Action
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 8 }}>
                    <CircularProgress size={32} />
                  </TableCell>
                </TableRow>
              ) : paginatedAgents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 8 }}>
                    <Typography variant="body2" sx={{ color: '#8A93A6' }}>
                      No matching agents found.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedAgents.map((agent) => {
                  const risk = getRiskInfo(agent.risk_score);
                  const statusBadge = getStatusBadgeStyle(agent.status);
                  const lastActive = formatLastActive(agent.last_api_call);

                  return (
                    <TableRow
                      key={agent.agent_id}
                      hover
                      onClick={() => navigate(`/agents/${agent.agent_id}`)}
                      sx={{
                        cursor: 'pointer',
                        transition: 'background .15s',
                        '&:hover': { bgcolor: '#F6F7F9' },
                      }}
                    >
                      {/* Identity Name & ID */}
                      <TableCell sx={{ py: '16px', px: '18px', borderBottom: '1px solid #F0F2F5' }}>
                        <Typography sx={{ fontSize: '13.5px', fontWeight: 700, color: '#10151F' }}>
                          {agent.agent_name}
                        </Typography>
                        <Typography sx={{ fontSize: '11px', color: '#8A93A6', fontFamily: 'JetBrains Mono, monospace', mt: '2px' }}>
                          {agent.agent_id}
                        </Typography>
                      </TableCell>

                      {/* Team & Purpose */}
                      <TableCell sx={{ py: '16px', px: '18px', borderBottom: '1px solid #F0F2F5' }}>
                        <Typography sx={{ fontSize: '13px', fontWeight: 600, color: '#10151F' }}>
                          {agent.owning_team || 'Core Team'}
                        </Typography>
                        <Typography noWrap sx={{ fontSize: '11.5px', color: '#8A93A6', mt: '2px', maxWidth: 220, textOverflow: 'ellipsis', overflow: 'hidden' }}>
                          {agent.purpose || 'General AI agent identity'}
                        </Typography>
                      </TableCell>

                      {/* Scopes */}
                      <TableCell sx={{ py: '16px', px: '18px', borderBottom: '1px solid #F0F2F5' }}>
                        <Box sx={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                          {agent.approved_scopes.map((scope) => {
                            const style = getScopeChipStyle(scope);
                            return (
                              <Box
                                key={scope}
                                sx={{
                                  fontSize: '11px',
                                  fontWeight: 700,
                                  px: '10px',
                                  py: '3px',
                                  borderRadius: '20px',
                                  border: `1px solid ${style.border}`,
                                  bgcolor: style.bg,
                                  color: style.color,
                                }}
                              >
                                {scope}
                              </Box>
                            );
                          })}
                        </Box>
                      </TableCell>

                      {/* Status Badge */}
                      <TableCell sx={{ py: '16px', px: '18px', borderBottom: '1px solid #F0F2F5' }}>
                        <Box
                          sx={{
                            fontSize: '11.5px',
                            fontWeight: 700,
                            px: '12px',
                            py: '5px',
                            borderRadius: '20px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            ...statusBadge.sx,
                          }}
                        >
                          {statusBadge.text}
                        </Box>
                      </TableCell>

                      {/* Risk Score */}
                      <TableCell sx={{ py: '16px', px: '18px', borderBottom: '1px solid #F0F2F5' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Box
                            sx={{
                              width: 30,
                              height: 30,
                              borderRadius: '9px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontFamily: 'Manrope, sans-serif',
                              fontWeight: 800,
                              fontSize: '12.5px',
                              color: '#fff',
                              background: risk.gradient,
                              flexShrink: 0,
                            }}
                          >
                            {agent.risk_score}
                          </Box>
                          <Typography sx={{ fontSize: '12px', color: '#8A93A6', fontWeight: 600 }}>
                            {risk.label}
                          </Typography>
                        </Box>
                      </TableCell>

                      {/* Last Active */}
                      <TableCell sx={{ py: '16px', px: '18px', borderBottom: '1px solid #F0F2F5' }}>
                        <Typography
                          sx={{
                            fontSize: '12.5px',
                            color: lastActive.isNever ? '#8A93A6' : '#4A5468',
                            fontFamily: lastActive.isNever ? 'inherit' : 'Inter, sans-serif',
                          }}
                        >
                          {lastActive.text}
                        </Typography>
                      </TableCell>

                      {/* Action */}
                      <TableCell align="center" sx={{ py: '16px', px: '18px', borderBottom: '1px solid #F0F2F5' }} onClick={(e) => e.stopPropagation()}>
                        <Box
                          onClick={() => navigate(`/agents/${agent.agent_id}`)}
                          sx={{
                            width: 32,
                            height: 32,
                            borderRadius: '9px',
                            border: '1px solid #E7EAEF',
                            bgcolor: '#FFFFFF',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            color: '#2B4EE6',
                            transition: 'all .15s',
                            '&:hover': {
                              bgcolor: '#EEF1FE',
                              borderColor: '#2B4EE6',
                            },
                          }}
                        >
                          <VisibilityIcon sx={{ fontSize: 16 }} />
                        </Box>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Pagination */}
        <TablePagination
          rowsPerPageOptions={[5, 10, 25, 50]}
          component="div"
          count={filteredAgents.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          sx={{
            borderTop: '1px solid #F0F2F5',
            color: '#4A5468',
            '& .MuiTablePagination-select': {
              borderRadius: '6px',
            },
          }}
        />
      </Box>
    </Box>
  );
};
