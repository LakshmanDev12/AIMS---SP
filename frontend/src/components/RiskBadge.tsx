import React from 'react';
import { Box, Typography } from '@mui/material';

interface RiskBadgeProps {
  score: number;
  showLabel?: boolean;
}

export const RiskBadge: React.FC<RiskBadgeProps> = ({ score, showLabel = false }) => {
  let bgColor = '#10b981'; // Green
  let textColor = '#ffffff';
  let label = 'Low';

  if (score >= 60) {
    bgColor = '#ef4444'; // Red
    label = 'Critical';
  } else if (score >= 35) {
    bgColor = '#f59e0b'; // Amber
    label = 'Moderate';
  }

  return (
    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>
      <Box
        sx={{
          backgroundColor: bgColor,
          color: textColor,
          fontWeight: 700,
          fontSize: '0.75rem',
          px: 1,
          py: 0.25,
          borderRadius: '12px',
          minWidth: '32px',
          textAlign: 'center',
          boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
        }}
      >
        {score}
      </Box>
      {showLabel && (
        <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 500 }}>
          ({label})
        </Typography>
      )}
    </Box>
  );
};
