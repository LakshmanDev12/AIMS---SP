import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  TextField,
  InputAdornment,
  MenuItem,
  IconButton,
  CircularProgress,
  Tooltip,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import RefreshIcon from '@mui/icons-material/Refresh';
import { api } from '../api/client';
import { AuditLogEntry } from '../types';
import { StatusChip } from '../components/StatusChip';
import { useNotification } from '../context/NotificationContext';

export const AuditLogs: React.FC = () => {
  const { showError } = useNotification();
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [actionFilter, setActionFilter] = useState<string>('ALL');
  const [resultFilter, setResultFilter] = useState<string>('ALL');
  const [page, setPage] = useState<number>(0);
  const [rowsPerPage, setRowsPerPage] = useState<number>(15);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getAuditLogs(undefined, 250);
      setLogs(data);
    } catch (err: any) {
      showError(err.response?.data?.detail || 'Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  }, [showError]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const filteredLogs = logs.filter((entry) => {
    const matchesSearch =
      (entry.agent_id && entry.agent_id.toLowerCase().includes(search.toLowerCase())) ||
      (entry.reason && entry.reason.toLowerCase().includes(search.toLowerCase())) ||
      entry.action.toLowerCase().includes(search.toLowerCase());

    const matchesAction = actionFilter === 'ALL' || entry.action === actionFilter;
    const matchesResult = resultFilter === 'ALL' || entry.result === resultFilter;

    return matchesSearch && matchesAction && matchesResult;
  });

  const handleChangePage = (_: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const paginatedLogs = filteredLogs.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  return (
    <Box sx={{ py: 2 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800, color: '#1e293b' }}>
            System Audit Logs
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Immutable audit record of all identity registrations, access evaluations, and lifecycle mutations
          </Typography>
        </Box>
        <Tooltip title="Refresh Logs">
          <IconButton onClick={fetchLogs} color="primary">
            <RefreshIcon />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Filters Bar */}
      <Paper sx={{ p: 2, mb: 3, borderRadius: 3, border: '1px solid #e2e8f0' }}>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
          <TextField
            size="small"
            placeholder="Search by Agent ID, action, or reason..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            sx={{ flexGrow: 1, minWidth: 260 }}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon color="action" />
                  </InputAdornment>
                ),
              },
            }}
          />

          <TextField
            select
            size="small"
            label="Action"
            value={actionFilter}
            onChange={(e) => {
              setActionFilter(e.target.value);
              setPage(0);
            }}
            sx={{ minWidth: 170 }}
          >
            <MenuItem value="ALL">All Actions</MenuItem>
            <MenuItem value="REGISTER">REGISTER</MenuItem>
            <MenuItem value="ACCESS_ATTEMPT">ACCESS_ATTEMPT</MenuItem>
            <MenuItem value="ROTATE">ROTATE</MenuItem>
            <MenuItem value="SUSPEND">SUSPEND</MenuItem>
            <MenuItem value="REACTIVATE">REACTIVATE</MenuItem>
            <MenuItem value="DECOMMISSION">DECOMMISSION</MenuItem>
            <MenuItem value="AUTO_REVOKE">AUTO_REVOKE</MenuItem>
          </TextField>

          <TextField
            select
            size="small"
            label="Result"
            value={resultFilter}
            onChange={(e) => {
              setResultFilter(e.target.value);
              setPage(0);
            }}
            sx={{ minWidth: 140 }}
          >
            <MenuItem value="ALL">All Results</MenuItem>
            <MenuItem value="SUCCESS">SUCCESS</MenuItem>
            <MenuItem value="DENIED">DENIED</MenuItem>
          </TextField>
        </Box>
      </Paper>

      {/* Logs Table */}
      <Paper sx={{ borderRadius: 3, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        <TableContainer>
          <Table size="small">
            <TableHead sx={{ backgroundColor: '#f8fafc' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>Timestamp</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Agent ID</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Action</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Result</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Reason / Details</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 6 }}>
                    <CircularProgress size={32} />
                  </TableCell>
                </TableRow>
              ) : paginatedLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 6 }}>
                    <Typography variant="body2" color="text.secondary">
                      No matching audit log entries found.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedLogs.map((log) => (
                  <TableRow key={log.log_id} hover>
                    <TableCell sx={{ color: 'text.secondary', fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
                      {new Date(log.timestamp).toLocaleString()}
                    </TableCell>
                    <TableCell sx={{ fontFamily: 'monospace', fontWeight: 600 }}>
                      {log.agent_id || <span style={{ color: '#94a3b8' }}>System / Unauth</span>}
                    </TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>{log.action}</TableCell>
                    <TableCell>
                      <StatusChip
                        status={log.result === 'SUCCESS' ? 'ACTIVE' : 'REVOKED'}
                        size="small"
                      />
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

        <TablePagination
          rowsPerPageOptions={[10, 15, 25, 50]}
          component="div"
          count={filteredLogs.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
      </Paper>
    </Box>
  );
};
