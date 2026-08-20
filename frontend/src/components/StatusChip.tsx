import React from 'react';
import { Chip, ChipProps } from '@mui/material';
import { AgentStatus, CredentialStatus } from '../types';

interface StatusChipProps {
  status: AgentStatus | CredentialStatus | string;
  size?: ChipProps['size'];
}

export const StatusChip: React.FC<StatusChipProps> = ({ status, size = 'small' }) => {
  const normalized = status.toUpperCase();

  let color: ChipProps['color'] = 'default';
  let label = status;

  switch (normalized) {
    case 'ACTIVE':
      color = 'success';
      label = 'Active';
      break;
    case 'STALE':
      color = 'warning';
      label = 'Stale';
      break;
    case 'SUSPENDED':
      color = 'info';
      label = 'Suspended';
      break;
    case 'REVOKED':
      color = 'error';
      label = 'Revoked';
      break;
    case 'DECOMMISSIONED':
      color = 'default';
      label = 'Decommissioned';
      break;
    case 'ROTATED':
      color = 'secondary';
      label = 'Rotated';
      break;
    case 'EXPIRED':
      color = 'error';
      label = 'Expired';
      break;
    default:
      color = 'default';
      label = status;
  }

  return (
    <Chip
      label={label}
      color={color}
      size={size}
      variant={normalized === 'ACTIVE' ? 'filled' : 'outlined'}
      sx={{
        fontWeight: 600,
        textTransform: 'capitalize',
        fontSize: size === 'small' ? '0.75rem' : '0.85rem',
      }}
    />
  );
};
