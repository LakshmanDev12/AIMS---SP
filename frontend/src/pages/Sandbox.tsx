import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Button,
  Chip,
  Card,
  CardContent,
  CircularProgress,
  Divider,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Alert,
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import SecurityIcon from '@mui/icons-material/Security';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorOutlinedIcon from '@mui/icons-material/ErrorOutlined';
import LockIcon from '@mui/icons-material/Lock';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import SpeedIcon from '@mui/icons-material/Speed';

import { api } from '../api/client';
import { Agent, SimulationType, SandboxResult } from '../types';

interface SimulationOption {
  type: SimulationType;
  label: string;
  description: string;
  expectedResult: 'SUCCESS' | 'DEPENDS';
  color: 'success' | 'error' | 'warning' | 'info';
  icon: React.ReactNode;
}

const SIMULATION_OPTIONS: SimulationOption[] = [
  {
    type: 'valid_read',
    label: '✅ Valid Read Request',
    description: 'Execute a legitimate GET /reports request using agent credentials. Expects 200 OK if agent has read scope.',
    expectedResult: 'SUCCESS',
    color: 'success',
    icon: <CheckCircleIcon />,
  },
  {
    type: 'unauthorized_admin',
    label: '🚨 Unauthorized Admin Breach',
    description: 'Attempt access to admin resource GET /admin/settings. Scope enforcement fires 403 Forbidden and emits a CRITICAL security notification.',
    expectedResult: 'DEPENDS',
    color: 'error',
    icon: <LockIcon />,
  },
  {
    type: 'unauthorized_write',
    label: '⚠️ Unauthorized Write Attempt',
    description: 'POST /reports write access with insufficient scope. Security interceptor blocks and logs the attempt.',
    expectedResult: 'DEPENDS',
    color: 'warning',
    icon: <ErrorOutlinedIcon />,
  },
  {
    type: 'rotate_token',
    label: '🔄 Credential Rotation',
    description: 'Immediately rotate agent JWT. Old token is invalidated (ROTATED status). A fresh credential is issued.',
    expectedResult: 'SUCCESS',
    color: 'info',
    icon: <AutorenewIcon />,
  },
  {
    type: 'burst_traffic',
    label: '⚡ Rapid Burst Traffic',
    description: 'Simulate 5 rapid-fire API requests in sequence. Triggers Anomaly Detection WARNING notification.',
    expectedResult: 'SUCCESS',
    color: 'warning',
    icon: <SpeedIcon />,
  },
];

export const Sandbox: React.FC = () => {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');
  const [selectedSimulation, setSelectedSimulation] = useState<SimulationType | null>(null);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<{ sim: SimulationOption; result: SandboxResult; ts: number }[]>([]);
  const consoleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.getAgents().then(setAgents).catch(console.error);
  }, []);

  useEffect(() => {
    if (consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }
  }, [results]);

  const selectedAgent = agents.find((a) => a.agent_id === selectedAgentId);

  const handleRun = async () => {
    if (!selectedAgentId || !selectedSimulation) return;
    setLoading(true);
    try {
      const result = await api.simulateSandboxAction(selectedAgentId, selectedSimulation);
      const sim = SIMULATION_OPTIONS.find((o) => o.type === selectedSimulation)!;
      setResults((prev) => [...prev, { sim, result, ts: Date.now() }]);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 1440, mx: 'auto', pb: 6 }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
          <Typography
            variant="h1"
            sx={{
              fontFamily: 'Manrope, sans-serif',
              fontSize: '28px',
              fontWeight: 800,
              letterSpacing: '-0.02em',
              color: '#10151F',
            }}
          >
            Interactive Security Sandbox
          </Typography>
          <Chip
            label="LIVE"
            size="small"
            sx={{
              fontWeight: 800,
              fontSize: '0.7rem',
              bgcolor: '#E7F7EF',
              color: '#0F9D63',
              borderRadius: '20px',
            }}
          />
        </Box>
        <Typography sx={{ fontSize: '13.5px', color: '#8A93A6', fontWeight: 500 }}>
          Demonstrate scope enforcement, credential rotation, security alerts, and anomaly detection in real-time.
        </Typography>
      </Box>

      <Grid container spacing={2.5}>
        {/* LEFT: Control Panel */}
        <Grid size={{ xs: 12, md: 5 }}>
          <Paper
            sx={{
              p: 3,
              borderRadius: '14px',
              border: '1px solid #E7EAEF',
              bgcolor: '#FFFFFF',
              boxShadow: '0 1px 2px rgba(16,21,31,0.04), 0 8px 24px rgba(16,21,31,0.05)',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <Typography sx={{ fontFamily: 'Manrope, sans-serif', fontSize: '15px', fontWeight: 700, color: '#10151F', mb: 2 }}>
              Control Panel
            </Typography>

            {/* Agent Selector */}
            <FormControl fullWidth sx={{ mb: 2.5 }}>
              <InputLabel sx={{ fontSize: '13px' }}>Select AI Agent Identity</InputLabel>
              <Select
                value={selectedAgentId}
                label="Select AI Agent Identity"
                onChange={(e) => setSelectedAgentId(e.target.value)}
                sx={{
                  borderRadius: '10px',
                  bgcolor: '#F6F7F9',
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: '#E7EAEF' },
                }}
              >
                {agents.map((a) => (
                  <MenuItem key={a.agent_id} value={a.agent_id}>
                    <Box>
                      <Typography sx={{ fontSize: '13px', fontWeight: 600, color: '#10151F' }}>{a.agent_name}</Typography>
                      <Typography sx={{ fontSize: '11px', color: '#8A93A6', fontFamily: 'JetBrains Mono, monospace' }}>
                        {a.agent_id} · Scopes: [{a.approved_scopes.join(', ')}] · Risk: {a.risk_score}
                      </Typography>
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Selected Agent Info Card */}
            {selectedAgent && (
              <Card elevation={0} sx={{ mb: 2.5, backgroundColor: '#F8FAFC', border: '1px solid #E2E9FD', borderRadius: '10px' }}>
                <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                  <Typography sx={{ fontSize: '12.5px', fontWeight: 700, color: '#2B4EE6' }}>
                    Active Identity: {selectedAgent.agent_name}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 0.8, mt: 1, flexWrap: 'wrap' }}>
                    {selectedAgent.approved_scopes.map((s) => (
                      <Box
                        key={s}
                        sx={{
                          fontSize: '10.5px',
                          fontWeight: 700,
                          px: '8px',
                          py: '2px',
                          borderRadius: '12px',
                          bgcolor: s === 'admin' ? '#FCEAE8' : s === 'write' ? '#FDF3E3' : '#EAF4FE',
                          color: s === 'admin' ? '#D6392B' : s === 'write' ? '#C4740A' : '#4C9EF0',
                          border: `1px solid ${s === 'admin' ? '#F3C3BE' : s === 'write' ? '#F3D9A6' : '#C7E3FB'}`,
                        }}
                      >
                        {s}
                      </Box>
                    ))}
                  </Box>
                  <Typography sx={{ fontSize: '11px', color: '#8A93A6', mt: 1, display: 'block' }}>
                    Status: {selectedAgent.status} · Risk Score: {selectedAgent.risk_score}/100
                  </Typography>
                </CardContent>
              </Card>
            )}

            {/* Simulation Selector */}
            <Typography sx={{ fontSize: '11px', fontWeight: 700, color: '#8A93A6', textTransform: 'uppercase', letterSpacing: '0.04em', mb: 1 }}>
              Select Simulation Scenario
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.2, mb: 3 }}>
              {SIMULATION_OPTIONS.map((opt) => (
                <Card
                  key={opt.type}
                  elevation={0}
                  sx={{
                    border: '1.5px solid',
                    borderColor: selectedSimulation === opt.type ? '#2B4EE6' : '#E7EAEF',
                    borderRadius: '10px',
                    transition: 'all 0.18s ease',
                    backgroundColor: selectedSimulation === opt.type ? '#EEF1FE' : '#FFFFFF',
                    cursor: 'pointer',
                    '&:hover': {
                      borderColor: '#2B4EE6',
                      transform: 'translateY(-1px)',
                    },
                  }}
                  onClick={() => setSelectedSimulation(opt.type)}
                >
                  <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                    <Typography sx={{ fontSize: '13px', fontWeight: 700, color: '#10151F' }}>
                      {opt.label}
                    </Typography>
                    <Typography sx={{ fontSize: '11.5px', color: '#8A93A6', lineHeight: 1.4, mt: 0.3 }}>
                      {opt.description}
                    </Typography>
                  </CardContent>
                </Card>
              ))}
            </Box>

            {/* Run Button */}
            <Button
              fullWidth
              onClick={handleRun}
              disabled={!selectedAgentId || !selectedSimulation || loading}
              startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <PlayArrowIcon />}
              sx={{
                background: 'linear-gradient(135deg,#4364EE,#7B4EF0)',
                color: '#fff',
                py: '12px',
                borderRadius: '10px',
                fontSize: '13.5px',
                fontWeight: 700,
                textTransform: 'none',
                mt: 'auto',
                boxShadow: '0 4px 14px rgba(87,78,230,0.35)',
                '&:hover': {
                  background: 'linear-gradient(135deg,#3857db,#6a3ee0)',
                },
                '&.Mui-disabled': {
                  bgcolor: '#E7EAEF',
                  color: '#8A93A6',
                },
              }}
            >
              {loading ? 'Executing...' : 'Execute Simulation'}
            </Button>
          </Paper>
        </Grid>

        {/* RIGHT: Live Console (Clean Light & Grey Theme) */}
        <Grid size={{ xs: 12, md: 7 }}>
          <Paper
            sx={{
              p: 3,
              borderRadius: '14px',
              border: '1px solid #E7EAEF',
              bgcolor: '#FFFFFF',
              boxShadow: '0 1px 2px rgba(16,21,31,0.04), 0 8px 24px rgba(16,21,31,0.05)',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Console Header */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box
                  sx={{
                    width: 30,
                    height: 30,
                    borderRadius: '9px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'linear-gradient(155deg,#4364EE,#2540B8)',
                    color: '#fff',
                  }}
                >
                  <SecurityIcon sx={{ fontSize: 16 }} />
                </Box>
                <Typography sx={{ fontFamily: 'Manrope, sans-serif', fontSize: '15px', fontWeight: 700, color: '#10151F' }}>
                  Live Execution Console
                </Typography>
              </Box>

              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#0F9D63' }} />
                <Typography sx={{ fontSize: '11px', color: '#0F9D63', fontWeight: 800 }}>LIVE</Typography>
                {results.length > 0 && (
                  <Button
                    size="small"
                    onClick={() => setResults([])}
                    sx={{ textTransform: 'none', fontSize: '11px', color: '#8A93A6', ml: 1 }}
                  >
                    Clear Console
                  </Button>
                )}
              </Box>
            </Box>

            {/* Console Box (Crisp Light Theme) */}
            <Box
              ref={consoleRef}
              sx={{
                flexGrow: 1,
                backgroundColor: '#F6F7F9',
                border: '1px solid #E7EAEF',
                borderRadius: '12px',
                p: 2,
                overflowY: 'auto',
                minHeight: 420,
                maxHeight: 560,
              }}
            >
              {results.length === 0 ? (
                <Box sx={{ color: '#8A93A6', textAlign: 'center', mt: 14 }}>
                  <SecurityIcon sx={{ fontSize: 44, mb: 1, color: '#BAC2D1' }} />
                  <Typography sx={{ fontSize: '13.5px', fontWeight: 600, color: '#4A5468' }}>
                    Select an agent and a simulation type, then click Execute.
                  </Typography>
                  <Typography sx={{ fontSize: '12px', color: '#8A93A6', mt: 0.5 }}>
                    Real-time execution telemetry and policy response will stream here.
                  </Typography>
                </Box>
              ) : (
                results.map(({ sim, result, ts }) => {
                  const isSuccess = result.result === 'SUCCESS';
                  return (
                    <Box
                      key={ts}
                      sx={{
                        mb: 2,
                        p: 2,
                        borderRadius: '10px',
                        bgcolor: '#FFFFFF',
                        border: '1px solid #E7EAEF',
                        borderLeft: `4px solid ${isSuccess ? '#0F9D63' : '#D6392B'}`,
                        boxShadow: '0 1px 3px rgba(16,21,31,0.04)',
                      }}
                    >
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.8 }}>
                        <Typography sx={{ fontSize: '11px', color: '#8A93A6', fontFamily: 'JetBrains Mono, monospace' }}>
                          [{new Date(ts).toLocaleTimeString()}] AIMS Security Sandbox
                        </Typography>
                        <Box
                          sx={{
                            fontSize: '11px',
                            fontWeight: 700,
                            px: '8px',
                            py: '2px',
                            borderRadius: '12px',
                            bgcolor: isSuccess ? '#E7F7EF' : '#FCEAE8',
                            color: isSuccess ? '#0F9D63' : '#D6392B',
                          }}
                        >
                          HTTP {result.status_code} — {result.result}
                        </Box>
                      </Box>

                      <Typography sx={{ color: '#2B4EE6', fontWeight: 700, fontSize: '13.5px', mb: 0.5 }}>
                        ❯ {sim.label}
                      </Typography>

                      <Typography sx={{ color: '#10151F', fontSize: '12.5px', mb: 0.8, lineHeight: 1.4 }}>
                        <b>Policy Output:</b> {result.reason}
                      </Typography>

                      {result.security_alert_generated && (
                        <Box sx={{ mb: 0.8, p: '6px 10px', borderRadius: '6px', bgcolor: '#FDF3E3', border: '1px solid #F3D9A6', color: '#C4740A', fontSize: '12px', fontWeight: 600 }}>
                          ⚠️ CRITICAL security notification dispatched to Notifications Hub
                        </Box>
                      )}

                      {result.new_credential_id && (
                        <Box sx={{ mb: 0.8, p: '6px 10px', borderRadius: '6px', bgcolor: '#F3E8FF', border: '1px solid #E9D5FF', color: '#7C3AED', fontSize: '12px', fontFamily: 'JetBrains Mono, monospace' }}>
                          🔑 New Credential ID: {result.new_credential_id}
                        </Box>
                      )}

                      {result.new_token_sample && (
                        <Box sx={{ mb: 0.8, p: '6px 10px', borderRadius: '6px', bgcolor: '#F3E8FF', border: '1px solid #E9D5FF', color: '#7C3AED', fontSize: '11.5px', fontFamily: 'JetBrains Mono, monospace' }}>
                          🔐 Token Sample: {result.new_token_sample}
                        </Box>
                      )}

                      {result.requests_executed && (
                        <Box sx={{ mb: 0.8, p: '6px 10px', borderRadius: '6px', bgcolor: '#FFF3E0', border: '1px solid #FED7AA', color: '#EA7A17', fontSize: '12px', fontWeight: 600 }}>
                          ⚡ {result.requests_executed} burst requests executed — Anomaly alert emitted
                        </Box>
                      )}

                      <Typography sx={{ color: '#8A93A6', fontSize: '11px', mt: 0.5 }}>
                        Agent: <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>{result.agent_id}</span>
                      </Typography>
                    </Box>
                  );
                })
              )}
            </Box>

            {/* Stats Footer */}
            {results.length > 0 && (
              <>
                <Divider sx={{ my: 2, borderColor: '#F0F2F5' }} />
                <Box sx={{ display: 'flex', gap: 3, justifyContent: 'space-around' }}>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography sx={{ fontSize: '10.5px', color: '#8A93A6', fontWeight: 700, textTransform: 'uppercase' }}>TOTAL RUNS</Typography>
                    <Typography sx={{ fontFamily: 'Manrope, sans-serif', fontSize: '20px', fontWeight: 800, color: '#10151F' }}>{results.length}</Typography>
                  </Box>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography sx={{ fontSize: '10.5px', color: '#0F9D63', fontWeight: 700, textTransform: 'uppercase' }}>ALLOWED</Typography>
                    <Typography sx={{ fontFamily: 'Manrope, sans-serif', fontSize: '20px', fontWeight: 800, color: '#0F9D63' }}>
                      {results.filter((r) => r.result.result === 'SUCCESS').length}
                    </Typography>
                  </Box>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography sx={{ fontSize: '10.5px', color: '#D6392B', fontWeight: 700, textTransform: 'uppercase' }}>BLOCKED</Typography>
                    <Typography sx={{ fontFamily: 'Manrope, sans-serif', fontSize: '20px', fontWeight: 800, color: '#D6392B' }}>
                      {results.filter((r) => r.result.result === 'DENIED').length}
                    </Typography>
                  </Box>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography sx={{ fontSize: '10.5px', color: '#C4740A', fontWeight: 700, textTransform: 'uppercase' }}>ALERTS FIRED</Typography>
                    <Typography sx={{ fontFamily: 'Manrope, sans-serif', fontSize: '20px', fontWeight: 800, color: '#C4740A' }}>
                      {results.filter((r) => r.result.security_alert_generated).length}
                    </Typography>
                  </Box>
                </Box>
              </>
            )}
          </Paper>
        </Grid>
      </Grid>

      {/* Compliance Export Section */}
      <Paper
        sx={{
          mt: 2.5,
          p: 3,
          borderRadius: '14px',
          border: '1px solid #E7EAEF',
          bgcolor: '#FFFFFF',
          boxShadow: '0 1px 2px rgba(16,21,31,0.04), 0 2px 10px rgba(16,21,31,0.035)',
        }}
      >
        <Typography sx={{ fontFamily: 'Manrope, sans-serif', fontSize: '16px', fontWeight: 700, color: '#10151F', mb: 0.5 }}>
          Compliance & Audit Export (SOC 2 / NIST AI RMF)
        </Typography>
        <Typography sx={{ fontSize: '13px', color: '#8A93A6', mb: 2 }}>
          Export a complete machine-readable governance attestation package covering all AI agent identities,
          credential hashes, scope approvals, risk scores, and access history.
        </Typography>
        <Alert severity="info" sx={{ mb: 2.5, borderRadius: '10px', fontSize: '12.5px' }}>
          Zero raw tokens stored — only SHA-256 hashes. Database breach cannot expose usable credentials.
        </Alert>
        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
          <Button
            variant="contained"
            color="success"
            href={api.exportComplianceCsv()}
            download
            sx={{ textTransform: 'none', borderRadius: '9px', fontWeight: 700, fontSize: '13px', px: 2 }}
          >
            ⬇ Download Governance Report (CSV)
          </Button>
          <Button
            variant="outlined"
            color="primary"
            href={api.exportComplianceJson()}
            download
            sx={{ textTransform: 'none', borderRadius: '9px', fontWeight: 700, fontSize: '13px', px: 2 }}
          >
            ⬇ Download Compliance Package (JSON)
          </Button>
        </Box>
      </Paper>
    </Box>
  );
};
