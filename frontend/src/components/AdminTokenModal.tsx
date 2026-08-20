import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  Alert,
} from '@mui/material';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';

interface AdminTokenModalProps {
  open: boolean;
  onClose: () => void;
}

export const AdminTokenModal: React.FC<AdminTokenModalProps> = ({ open, onClose }) => {
  const { adminToken, setAdminToken, clearAdminToken } = useAuth();
  const { showSuccess } = useNotification();
  const [tokenInput, setTokenInput] = useState(adminToken);

  const handleSave = () => {
    setAdminToken(tokenInput);
    showSuccess('Admin token updated for current session');
    onClose();
  };

  const handleClear = () => {
    setTokenInput('');
    clearAdminToken();
    showSuccess('Admin token cleared');
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <AdminPanelSettingsIcon color="primary" />
        Configure Admin / Caller Token
      </DialogTitle>
      <DialogContent dividers>
        <Alert severity="info" sx={{ mb: 2 }}>
          Lifecycle management endpoints (suspend, reactivate, decommission) require an
          <strong> admin-scoped</strong> bearer token (e.g. from <code>AuditBot</code>).
        </Alert>

        <Typography variant="body2" color="text.secondary" gutterBottom>
          Enter the bearer token to use for privileged actions:
        </Typography>

        <TextField
          fullWidth
          multiline
          rows={3}
          value={tokenInput}
          onChange={(e) => setTokenInput(e.target.value)}
          placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
          variant="outlined"
          sx={{ mt: 1 }}
        />
      </DialogContent>
      <DialogActions sx={{ p: 2, justifyContent: 'space-between' }}>
        <Button color="error" onClick={handleClear} disabled={!adminToken}>
          Clear Token
        </Button>
        <BoxActions>
          <Button onClick={onClose} sx={{ mr: 1 }}>
            Cancel
          </Button>
          <Button onClick={handleSave} variant="contained">
            Save Token
          </Button>
        </BoxActions>
      </DialogActions>
    </Dialog>
  );
};

const BoxActions: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div>{children}</div>
);
