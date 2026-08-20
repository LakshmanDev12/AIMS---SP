import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  FormGroup,
  FormControlLabel,
  Checkbox,
  FormHelperText,
  Alert,
  CircularProgress,
  Card,
  CardContent,
  Divider,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import SecurityIcon from '@mui/icons-material/Security';
import { api } from '../api/client';
import { TokenDialog } from '../components/TokenDialog';
import { useNotification } from '../context/NotificationContext';
import { RegisterAgentResponse } from '../types';

export const RegisterAgent: React.FC = () => {
  const navigate = useNavigate();
  const { showSuccess, showError } = useNotification();

  const [agentName, setAgentName] = useState('');
  const [purpose, setPurpose] = useState('');
  const [owningTeam, setOwningTeam] = useState('');
  const [scopes, setScopes] = useState<string[]>(['read']);
  const [loading, setLoading] = useState(false);
  const [registeredData, setRegisteredData] = useState<RegisterAgentResponse | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleScopeChange = (scope: string) => {
    if (scopes.includes(scope)) {
      setScopes(scopes.filter((s) => s !== scope));
    } else {
      setScopes([...scopes, scope]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!agentName.trim()) {
      showError('Agent name is required');
      return;
    }

    if (scopes.length === 0) {
      showError('At least one scope must be selected');
      return;
    }

    setLoading(true);
    try {
      const res = await api.registerAgent({
        agent_name: agentName.trim(),
        purpose: purpose.trim() || undefined,
        owning_team: owningTeam.trim() || undefined,
        scopes,
      });

      setRegisteredData(res);
      setDialogOpen(true);
      showSuccess(`Agent ${agentName} registered successfully!`);
    } catch (err: any) {
      showError(err.response?.data?.detail || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    navigate('/');
  };

  return (
    <Box sx={{ py: 2, maxWidth: 800, mx: 'auto' }}>
      <Button
        startIcon={<ArrowBackIcon />}
        onClick={() => navigate('/')}
        sx={{ mb: 2, textTransform: 'none' }}
      >
        Back to Agents
      </Button>

      <Paper sx={{ p: 4, borderRadius: 3, border: '1px solid #e2e8f0' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
          <Box sx={{ p: 1.2, borderRadius: 2, backgroundColor: '#eff6ff', color: '#2563eb' }}>
            <PersonAddIcon fontSize="medium" />
          </Box>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 800, color: '#1e293b' }}>
              Register New Agent Identity
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Provision a new machine identity, configure least-privilege scopes, and issue a cryptographic JWT credential
            </Typography>
          </Box>
        </Box>

        <Divider sx={{ mb: 3 }} />

        <form onSubmit={handleSubmit}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <TextField
              label="Agent Name"
              required
              fullWidth
              placeholder="e.g. FinanceBot, IngestionAgent"
              value={agentName}
              onChange={(e) => setAgentName(e.target.value)}
              helperText="Unique identifier friendly name for the agent service"
            />

            <TextField
              label="Owning Team / Department"
              fullWidth
              placeholder="e.g. Data Engineering, Finance Ops"
              value={owningTeam}
              onChange={(e) => setOwningTeam(e.target.value)}
              helperText="The human team responsible for this agent identity"
            />

            <TextField
              label="Business Purpose"
              fullWidth
              multiline
              rows={2}
              placeholder="e.g. Nightly batch ingestion from upstream ledger"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              helperText="Specific task or system function this agent executes"
            />

            {/* Scopes Section */}
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, display: 'flex', alignItems: 'center', gap: 0.8 }}>
                <SecurityIcon fontSize="small" color="primary" />
                Approved Access Scopes
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
                Grant only the minimum required privileges following least privilege principles.
              </Typography>

              <Card variant="outlined" sx={{ borderRadius: 2, backgroundColor: '#f8fafc' }}>
                <CardContent sx={{ p: 2 }}>
                  <FormGroup>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={scopes.includes('read')}
                          onChange={() => handleScopeChange('read')}
                          color="primary"
                        />
                      }
                      label={
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            read
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Allows read-only access to query reports and metadata endpoints
                          </Typography>
                        </Box>
                      }
                      sx={{ mb: 1.5, alignItems: 'flex-start' }}
                    />

                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={scopes.includes('write')}
                          onChange={() => handleScopeChange('write')}
                          color="primary"
                        />
                      }
                      label={
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            write
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Allows writing records and publishing pipeline reports
                          </Typography>
                        </Box>
                      }
                      sx={{ mb: 1.5, alignItems: 'flex-start' }}
                    />

                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={scopes.includes('admin')}
                          onChange={() => handleScopeChange('admin')}
                          color="error"
                        />
                      }
                      label={
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 600, color: '#dc2626' }}>
                            admin
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Full administrative privileges including lifecycle control and configuration
                          </Typography>
                        </Box>
                      }
                      sx={{ alignItems: 'flex-start' }}
                    />
                  </FormGroup>

                  {scopes.length === 0 && (
                    <FormHelperText error sx={{ mt: 1 }}>
                      You must select at least one scope.
                    </FormHelperText>
                  )}
                </CardContent>
              </Card>
            </Box>

            <Alert severity="info" sx={{ borderRadius: 2 }}>
              Upon registration, a 90-day cryptographically signed JWT bearer token will be generated.
              It will only be shown <strong>once</strong>.
            </Alert>

            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, mt: 1 }}>
              <Button onClick={() => navigate('/')} disabled={loading}>
                Cancel
              </Button>
              <Button
                type="submit"
                variant="contained"
                size="large"
                disabled={loading}
                startIcon={loading ? <CircularProgress size={20} /> : <PersonAddIcon />}
                sx={{ textTransform: 'none', px: 4, borderRadius: 2 }}
              >
                {loading ? 'Registering...' : 'Register Agent'}
              </Button>
            </Box>
          </Box>
        </form>
      </Paper>

      {registeredData && (
        <TokenDialog
          open={dialogOpen}
          onClose={handleDialogClose}
          title="Agent Registration Complete"
          agentId={registeredData.agent_id}
          token={registeredData.token}
          expiresAt={registeredData.expires_at}
        />
      )}
    </Box>
  );
};
