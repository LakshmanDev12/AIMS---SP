import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Alert,
  IconButton,
  Tooltip,
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';
import KeyIcon from '@mui/icons-material/Key';

interface TokenDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  agentId: string;
  token: string;
  expiresAt: string;
}

export const TokenDialog: React.FC<TokenDialogProps> = ({
  open,
  onClose,
  title,
  agentId,
  token,
  expiresAt,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const textArea = document.createElement('textarea');
      textArea.value = token;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <KeyIcon color="primary" />
        {title}
      </DialogTitle>
      <DialogContent dividers>
        <Alert severity="warning" sx={{ mb: 2 }}>
          <strong>Important:</strong> This bearer token is displayed <strong>once</strong>. Copy and
          store it securely. Once this dialog is closed, the token cannot be retrieved again from the
          system.
        </Alert>

        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Agent ID:
          </Typography>
          <Typography variant="subtitle2" sx={{ fontFamily: 'monospace', fontWeight: 600 }}>
            {agentId}
          </Typography>
        </Box>

        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Expires At:
          </Typography>
          <Typography variant="body2">{new Date(expiresAt).toLocaleString()}</Typography>
        </Box>

        <Box sx={{ mb: 1 }}>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            JWT Bearer Token:
          </Typography>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: 'action.hover',
              p: 1.5,
              borderRadius: 1,
              border: '1px solid',
              borderColor: 'divider',
              position: 'relative',
            }}
          >
            <Typography
              variant="caption"
              sx={{
                fontFamily: 'monospace',
                wordBreak: 'break-all',
                flexGrow: 1,
                userSelect: 'all',
                maxHeight: '120px',
                overflowY: 'auto',
                pr: 4,
              }}
            >
              {token}
            </Typography>
            <Tooltip title={copied ? 'Copied!' : 'Copy to clipboard'}>
              <IconButton
                onClick={handleCopy}
                size="small"
                color={copied ? 'success' : 'primary'}
                sx={{ position: 'absolute', top: 8, right: 8 }}
              >
                {copied ? <CheckIcon fontSize="small" /> : <ContentCopyIcon fontSize="small" />}
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={handleCopy} startIcon={copied ? <CheckIcon /> : <ContentCopyIcon />}>
          {copied ? 'Copied' : 'Copy Token'}
        </Button>
        <Button onClick={onClose} variant="contained">
          Done
        </Button>
      </DialogActions>
    </Dialog>
  );
};
