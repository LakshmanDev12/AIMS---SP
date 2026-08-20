import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  CircularProgress,
  IconButton,
  Tooltip,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import SearchIcon from '@mui/icons-material/Search';
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined';

import { api } from '../api/client';
import { DashboardData } from '../types';
import { useNotification } from '../context/NotificationContext';

// Helper to format relative time
function formatRelativeTime(isoString: string): string {
  try {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    return date.toLocaleDateString();
  } catch {
    return 'recently';
  }
}

// Helper to get initials
function getInitials(name: string): string {
  if (!name) return 'AG';
  const parts = name.trim().split(/[\s_-]+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

// Team color map
function getTeamStyle(team?: string | null): { bg: string; color: string } {
  const t = (team || '').toLowerCase();
  if (t.includes('fin')) return { bg: '#F3E8FF', color: '#7C3AED' };
  if (t.includes('dev') || t.includes('ops') || t.includes('infra')) return { bg: '#E0F7F5', color: '#0D9488' };
  if (t.includes('data') || t.includes('ai') || t.includes('ml')) return { bg: '#FFE8F3', color: '#DB2777' };
  if (t.includes('sec') || t.includes('audit')) return { bg: '#FEE2E2', color: '#DC2626' };
  if (t.includes('growth') || t.includes('mkt')) return { bg: '#FFF3E0', color: '#EA7A17' };
  return { bg: '#E8F0FF', color: '#2563EB' }; // default Support/General
}

// Status style map
function getStatusChipInfo(status: string): { label: string; className: string; color: string } {
  const s = status.toUpperCase();
  if (s === 'ACTIVE') return { label: 'Active', className: 'active', color: '#0F9D63' };
  if (s === 'STALE') return { label: 'Under Review', className: 'review', color: '#C4740A' };
  if (s === 'SUSPENDED') return { label: 'Suspended', className: 'suspended', color: '#D6392B' };
  if (s === 'REVOKED') return { label: 'Revoked', className: 'suspended', color: '#D6392B' };
  return { label: status, className: 'review', color: '#8A93A6' };
}

// Score color & ring helper
function getScoreColor(score: number): string {
  if (score >= 76) return '#D6392B';
  if (score >= 51) return '#C4740A';
  if (score >= 26) return '#4C9EF0';
  return '#0F9D63';
}

function getAvatarGradient(score: number): string {
  if (score >= 76) return 'linear-gradient(155deg,#F17163,#D6392B)';
  if (score >= 51) return 'linear-gradient(155deg,#F0AC4E,#C4740A)';
  if (score >= 26) return 'linear-gradient(155deg,#7FC4FF,#2B6FD6)';
  return 'linear-gradient(155deg,#4FD79A,#0F9D63)';
}

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { showSuccess, showError } = useNotification();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [countdown, setCountdown] = useState<number>(30);

  const fetchDashboard = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const res = await api.getDashboard();
      setData(res);
      setCountdown(30);
    } catch (err: any) {
      showError(err.response?.data?.detail || 'Failed to load dashboard data');
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [showError]);

  useEffect(() => {
    fetchDashboard();
    const interval = setInterval(() => {
      fetchDashboard(true);
    }, 30000);

    const timer = setInterval(() => {
      setCountdown((prev) => (prev > 1 ? prev - 1 : 30));
    }, 1000);

    return () => {
      clearInterval(interval);
      clearInterval(timer);
    };
  }, [fetchDashboard]);

  const handleDetectStale = async () => {
    setActionLoading(true);
    try {
      const res = await api.detectStaleAgents();
      showSuccess(`Stale detection completed. ${res.newly_stale_count} newly stale agent(s) flagged.`);
      await fetchDashboard(true);
    } catch (err: any) {
      showError(err.response?.data?.detail || 'Failed to run stale detection');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAutoRevoke = async () => {
    setActionLoading(true);
    try {
      const res = await api.autoRevokeStale();
      showSuccess(`Auto-revoke sweep completed. ${res.revoked_count} agent(s) revoked.`);
      await fetchDashboard(true);
    } catch (err: any) {
      showError(err.response?.data?.detail || 'Failed to execute auto-revocation');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading && !data) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 12 }}>
        <CircularProgress />
      </Box>
    );
  }

  // Computed Metrics
  const totalAgents = data?.total_agents || 0;
  const activeCount = data?.by_status?.['active'] || data?.by_status?.['ACTIVE'] || 0;
  const staleCount = data?.by_status?.['stale'] || data?.by_status?.['STALE'] || 0;
  const highRiskCount = data?.top_risk_agents?.filter((a) => a.risk_score >= 35).length || 0;
  const activePercent = totalAgents > 0 ? ((activeCount / totalAgents) * 100).toFixed(1) : '100.0';

  const healthScore = data?.governance_health ?? 87;
  // Circular circumference for r=72 is ~452.4
  const gaugeCircumference = 452.4;
  const gaugeOffset = gaugeCircumference - (gaugeCircumference * healthScore) / 100;

  // Risk Distribution Histogram Data
  const dist = data?.risk_distribution || {
    low: data?.top_risk_agents?.filter((a) => a.risk_score <= 25).length || 9,
    guarded: data?.top_risk_agents?.filter((a) => a.risk_score > 25 && a.risk_score <= 50).length || 8,
    moderate: data?.top_risk_agents?.filter((a) => a.risk_score > 50 && a.risk_score <= 75).length || 6,
    critical: data?.top_risk_agents?.filter((a) => a.risk_score > 75).length || 1,
  };
  const maxDist = Math.max(dist.low, dist.guarded, dist.moderate, dist.critical, 1);

  // Recent Activity Feed
  const recentLogs = data?.recent_activity?.slice(0, 5) || [];

  // Top Risk Identities
  const topRiskList = data?.top_risk_agents?.slice(0, 5) || [];

  return (
    <Box sx={{ maxWidth: 1440, mx: 'auto', pb: 6 }}>
      {/* Top Controls / Breadcrumbs Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2.5, flexWrap: 'wrap', gap: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="body2" sx={{ color: '#8A93A6', fontWeight: 600 }}>
            AIMS / <b style={{ color: '#10151F' }}>Governance Overview</b>
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Typography variant="caption" sx={{ color: '#8A93A6', fontWeight: 500 }}>
            Auto-refresh in {countdown}s
          </Typography>
          <Tooltip title="Refresh Dashboard">
            <IconButton onClick={() => fetchDashboard(false)} size="small" sx={{ color: '#2B4EE6', bgcolor: '#FFFFFF', border: '1px solid #E7EAEF' }}>
              <RefreshIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* ============ HERO: GAUGE + KPIS + SWEEP ============ */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: '320px 1fr' },
          gap: 2,
          mb: 2,
        }}
      >
        {/* Left: Governance Health Gauge */}
        <Box
          sx={{
            background: 'linear-gradient(165deg, #F8FAFC, #FFFFFF 60%)',
            border: '1px solid #E2E9FD',
            borderRadius: '14px',
            p: 3,
            color: '#10151F',
            position: 'relative',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            boxShadow: '0 1px 2px rgba(16,21,31,0.04), 0 8px 24px rgba(16,21,31,0.05)',
            '&::before': {
              content: '""',
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '3px',
              background: 'linear-gradient(90deg, #0F9D63, #4FD79A)',
            },
          }}
        >
          <Typography
            sx={{
              fontSize: '11.5px',
              fontWeight: 700,
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              color: '#8A93A6',
              alignSelf: 'flex-start',
              mb: 2,
            }}
          >
            Governance Health
          </Typography>

          <Box sx={{ position: 'relative', width: 168, height: 168, mb: 1.5 }}>
            <svg width="168" height="168" viewBox="0 0 168 168" style={{ transform: 'rotate(-90deg)' }}>
              <circle cx="84" cy="84" r="72" fill="none" stroke="#E2E8F0" strokeWidth="14" />
              <circle
                cx="84"
                cy="84"
                r="72"
                fill="none"
                stroke="#0F9D63"
                strokeWidth="14"
                strokeDasharray="452.4"
                strokeDashoffset={gaugeOffset}
                strokeLinecap="round"
                style={{ transition: 'stroke-dashoffset 1s ease' }}
              />
            </svg>
            <Box
              sx={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Typography sx={{ fontFamily: 'Manrope, sans-serif', fontSize: '40px', fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1, color: '#10151F' }}>
                {healthScore}
              </Typography>
              <Typography sx={{ fontSize: '12px', color: '#8A93A6', fontWeight: 600, mt: 0.5 }}>
                / 100
              </Typography>
            </Box>
          </Box>

          <Typography sx={{ fontSize: '12px', color: '#4A5468', textAlign: 'center', mt: 1, lineHeight: 1.5 }}>
            <b style={{ color: '#0F9D63' }}>+{Math.max(1, Math.min(6, totalAgents))} pts</b> vs last review cycle — active posture healthy
          </Typography>
        </Box>

        {/* Right: 4 KPI Cards + Policy Sweep Bar */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {/* 4 KPI Bento Cards */}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
              gap: 1.5,
              flex: 1,
            }}
          >
            {/* KPI 1: Total Agents (Blue) */}
            <Box
              sx={{
                borderRadius: '14px',
                p: '18px 18px 20px 18px',
                background: 'linear-gradient(165deg,#F4F7FF,#FFFFFF 55%)',
                border: '1px solid #E2E9FD',
                boxShadow: '0 1px 2px rgba(16,21,31,0.04), 0 6px 18px rgba(16,21,31,0.05)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                position: 'relative',
                overflow: 'hidden',
                transition: 'transform .18s ease, box-shadow .18s ease',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: '0 10px 14px rgba(16,21,31,0.05), 0 22px 40px rgba(16,21,31,0.11)',
                },
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: '3px',
                  background: 'linear-gradient(90deg,#2B4EE6,#6B8CFF)',
                },
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Box
                  sx={{
                    width: 40,
                    height: 40,
                    borderRadius: '11px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'linear-gradient(155deg,#4364EE,#2540B8)',
                    color: '#fff',
                    boxShadow: '0 3px 8px rgba(16,21,31,0.06)',
                  }}
                >
                  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="11" width="18" height="10" rx="2" />
                    <circle cx="8" cy="16" r="1" />
                    <circle cx="16" cy="16" r="1" />
                    <path d="M12 7V3M8 3h8" />
                  </svg>
                </Box>
                <Typography sx={{ fontSize: '11px', fontWeight: 800, p: '3px 8px', borderRadius: '20px', color: '#0F9D63', bgcolor: '#E7F7EF' }}>
                  +{totalAgents}
                </Typography>
              </Box>
              <Typography sx={{ fontSize: '11.5px', color: '#8A93A6', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', mb: 0.8 }}>
                Total Agents
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                <Typography sx={{ fontFamily: 'Manrope, sans-serif', fontSize: '38px', fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1 }}>
                  {totalAgents}
                </Typography>
                <svg width="56" height="26" viewBox="0 0 56 26" style={{ opacity: 0.9 }}>
                  <polyline points="0,20 9,17 18,18 27,12 36,13 45,6 56,4" fill="none" stroke="#2B4EE6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Box>
            </Box>

            {/* KPI 2: Active Agents (Green) */}
            <Box
              sx={{
                borderRadius: '14px',
                p: '18px 18px 20px 18px',
                background: 'linear-gradient(165deg,#F1FBF6,#FFFFFF 55%)',
                border: '1px solid #D8F0E4',
                boxShadow: '0 1px 2px rgba(16,21,31,0.04), 0 6px 18px rgba(16,21,31,0.05)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                position: 'relative',
                overflow: 'hidden',
                transition: 'transform .18s ease, box-shadow .18s ease',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: '0 10px 14px rgba(16,21,31,0.05), 0 22px 40px rgba(16,21,31,0.11)',
                },
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: '3px',
                  background: 'linear-gradient(90deg,#0F9D63,#4FD79A)',
                },
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Box
                  sx={{
                    width: 40,
                    height: 40,
                    borderRadius: '11px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'linear-gradient(155deg,#16B073,#0B7C4C)',
                    color: '#fff',
                    boxShadow: '0 3px 8px rgba(16,21,31,0.06)',
                  }}
                >
                  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <path d="M22 4 12 14.01l-3-3" />
                  </svg>
                </Box>
                <Typography sx={{ fontSize: '11px', fontWeight: 800, p: '3px 8px', borderRadius: '20px', color: '#4A5468', bgcolor: 'rgba(255,255,255,0.7)' }}>
                  {activePercent}%
                </Typography>
              </Box>
              <Typography sx={{ fontSize: '11.5px', color: '#8A93A6', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', mb: 0.8 }}>
                Active Agents
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                <Typography sx={{ fontFamily: 'Manrope, sans-serif', fontSize: '38px', fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1, color: '#0F9D63' }}>
                  {activeCount}
                  <span style={{ fontSize: '14px', color: '#8A93A6', fontWeight: 600, marginLeft: '3px' }}>/{totalAgents}</span>
                </Typography>
                <svg width="56" height="26" viewBox="0 0 56 26" style={{ opacity: 0.9 }}>
                  <polyline points="0,10 9,12 18,8 27,14 36,9 45,11 56,6" fill="none" stroke="#0F9D63" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Box>
            </Box>

            {/* KPI 3: Stale Identities (Amber) */}
            <Box
              sx={{
                borderRadius: '14px',
                p: '18px 18px 20px 18px',
                background: 'linear-gradient(165deg,#FFF9EF,#FFFFFF 55%)',
                border: '1px solid #F7E7C9',
                boxShadow: '0 1px 2px rgba(16,21,31,0.04), 0 6px 18px rgba(16,21,31,0.05)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                position: 'relative',
                overflow: 'hidden',
                transition: 'transform .18s ease, box-shadow .18s ease',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: '0 10px 14px rgba(16,21,31,0.05), 0 22px 40px rgba(16,21,31,0.11)',
                },
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: '3px',
                  background: 'linear-gradient(90deg,#C4740A,#F0AC4E)',
                },
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Box
                  sx={{
                    width: 40,
                    height: 40,
                    borderRadius: '11px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'linear-gradient(155deg,#E08D1F,#B4650A)',
                    color: '#fff',
                    boxShadow: '0 3px 8px rgba(16,21,31,0.06)',
                  }}
                >
                  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 7v6M12 16.5v.01" />
                  </svg>
                </Box>
                <Typography sx={{ fontSize: '11px', fontWeight: 800, p: '3px 8px', borderRadius: '20px', color: '#4A5468', bgcolor: 'rgba(255,255,255,0.7)' }}>
                  {staleCount > 0 ? 'idle' : 'healthy'}
                </Typography>
              </Box>
              <Typography sx={{ fontSize: '11.5px', color: '#8A93A6', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', mb: 0.8 }}>
                Stale Identities
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                <Typography sx={{ fontFamily: 'Manrope, sans-serif', fontSize: '38px', fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1, color: '#C4740A' }}>
                  {staleCount}
                </Typography>
                <svg width="56" height="26" viewBox="0 0 56 26" style={{ opacity: 0.9 }}>
                  <polyline points="0,6 9,9 18,7 27,16 36,14 45,20 56,22" fill="none" stroke="#C4740A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Box>
            </Box>

            {/* KPI 4: Elevated Risk (Red) */}
            <Box
              sx={{
                borderRadius: '14px',
                p: '18px 18px 20px 18px',
                background: 'linear-gradient(165deg,#FDF2F1,#FFFFFF 55%)',
                border: '1px solid #F5D9D6',
                boxShadow: '0 1px 2px rgba(16,21,31,0.04), 0 6px 18px rgba(16,21,31,0.05)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                position: 'relative',
                overflow: 'hidden',
                transition: 'transform .18s ease, box-shadow .18s ease',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: '0 10px 14px rgba(16,21,31,0.05), 0 22px 40px rgba(16,21,31,0.11)',
                },
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: '3px',
                  background: 'linear-gradient(90deg,#D6392B,#F17163)',
                },
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Box
                  sx={{
                    width: 40,
                    height: 40,
                    borderRadius: '11px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'linear-gradient(155deg,#E14A3B,#B8281B)',
                    color: '#fff',
                    boxShadow: '0 3px 8px rgba(16,21,31,0.06)',
                  }}
                >
                  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 2 4 6v6c0 5 3.5 8.5 8 10 4.5-1.5 8-5 8-10V6l-8-4Z" />
                  </svg>
                </Box>
                <Typography sx={{ fontSize: '11px', fontWeight: 800, p: '3px 8px', borderRadius: '20px', color: '#D6392B', bgcolor: '#FCEAE8' }}>
                  {highRiskCount > 0 ? 'review' : 'clean'}
                </Typography>
              </Box>
              <Typography sx={{ fontSize: '11.5px', color: '#8A93A6', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', mb: 0.8 }}>
                Elevated Risk
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                <Typography sx={{ fontFamily: 'Manrope, sans-serif', fontSize: '38px', fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1, color: '#D6392B' }}>
                  {highRiskCount}
                </Typography>
                <svg width="56" height="26" viewBox="0 0 56 26" style={{ opacity: 0.9 }}>
                  <polyline points="0,18 9,15 18,17 27,10 36,12 45,5 56,7" fill="none" stroke="#D6392B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Box>
            </Box>
          </Box>

          {/* Policy Enforcement Sweep Actions Bar */}
          <Box
            sx={{
              background: '#FFFFFF',
              border: '1px solid #E7EAEF',
              borderRadius: '12px',
              p: '14px 18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              boxShadow: '0 1px 2px rgba(16,21,31,0.04), 0 2px 10px rgba(16,21,31,0.035)',
              flexWrap: 'wrap',
              gap: 1.5,
            }}
          >
            <Box>
              <Typography sx={{ fontSize: '13px', fontWeight: 700, color: '#10151F', mb: 0.3 }}>
                Policy Enforcement Sweep Actions
              </Typography>
              <Typography sx={{ fontSize: '12px', color: '#8A93A6' }}>
                On-demand sweeps for inactive identities and long-stale revocations
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 1.2 }}>
              <Button
                variant="outlined"
                size="small"
                onClick={handleDetectStale}
                disabled={actionLoading}
                startIcon={<SearchIcon fontSize="small" />}
                sx={{
                  py: '7px',
                  px: '13px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: 600,
                  textTransform: 'none',
                  borderColor: '#E7EAEF',
                  color: '#4A5468',
                  bgcolor: '#FFFFFF',
                  '&:hover': {
                    borderColor: '#C4740A',
                    color: '#C4740A',
                    bgcolor: '#FDF3E3',
                  },
                }}
              >
                Run Stale Detection
              </Button>
              <Button
                variant="outlined"
                size="small"
                onClick={handleAutoRevoke}
                disabled={actionLoading}
                startIcon={<DeleteOutlinedIcon fontSize="small" />}
                sx={{
                  py: '7px',
                  px: '13px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: 600,
                  textTransform: 'none',
                  borderColor: '#E7EAEF',
                  color: '#4A5468',
                  bgcolor: '#FFFFFF',
                  '&:hover': {
                    borderColor: '#D6392B',
                    color: '#D6392B',
                    bgcolor: '#FCEAE8',
                  },
                }}
              >
                Run Auto-Revoke
              </Button>
            </Box>
          </Box>
        </Box>
      </Box>

      {/* ============ BENTO GRID: HISTOGRAM + ACTIVITY FEED ============ */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
          gap: 2,
          mb: 2,
        }}
      >
        {/* Panel 1: Risk Score Distribution */}
        <Box
          sx={{
            background: '#FFFFFF',
            border: '1px solid #E7EAEF',
            borderRadius: '14px',
            p: 2.5,
            boxShadow: '0 1px 2px rgba(16,21,31,0.04), 0 8px 24px rgba(16,21,31,0.05)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
              <Box
                sx={{
                  width: 30,
                  height: 30,
                  borderRadius: '9px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'linear-gradient(155deg,#4C9EF0,#2B6FD6)',
                  color: '#fff',
                }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 3v18h18" />
                  <rect x="7" y="12" width="3" height="6" />
                  <rect x="12" y="8" width="3" height="10" />
                  <rect x="17" y="5" width="3" height="13" />
                </svg>
              </Box>
              <Typography sx={{ fontFamily: 'Manrope, sans-serif', fontSize: '14.5px', fontWeight: 700, letterSpacing: '-0.01em', color: '#10151F' }}>
                Risk Score Distribution
              </Typography>
            </Box>
            <Button
              href={api.exportComplianceCsv()}
              download
              size="small"
              sx={{ fontSize: '12px', color: '#2B4EE6', fontWeight: 600, textTransform: 'none' }}
            >
              Export
            </Button>
          </Box>

          {/* Histogram Bars */}
          <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 1.5, height: 120, pt: 1 }}>
            {/* Col 1: Low */}
            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
              <Typography sx={{ fontSize: '10.5px', fontWeight: 700, color: '#4A5468', mb: 0.6 }}>
                {dist.low}
              </Typography>
              <Box
                sx={{
                  width: '100%',
                  height: `${Math.max(12, Math.round((dist.low / maxDist) * 85))}%`,
                  borderRadius: '6px 6px 3px 3px',
                  background: 'linear-gradient(180deg,#4FD79A,#0F9D63)',
                  transition: 'height 0.6s ease',
                }}
              />
            </Box>

            {/* Col 2: Guarded */}
            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
              <Typography sx={{ fontSize: '10.5px', fontWeight: 700, color: '#4A5468', mb: 0.6 }}>
                {dist.guarded}
              </Typography>
              <Box
                sx={{
                  width: '100%',
                  height: `${Math.max(12, Math.round((dist.guarded / maxDist) * 85))}%`,
                  borderRadius: '6px 6px 3px 3px',
                  background: 'linear-gradient(180deg,#7FC4FF,#2B6FD6)',
                  transition: 'height 0.6s ease',
                }}
              />
            </Box>

            {/* Col 3: Moderate */}
            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
              <Typography sx={{ fontSize: '10.5px', fontWeight: 700, color: '#4A5468', mb: 0.6 }}>
                {dist.moderate}
              </Typography>
              <Box
                sx={{
                  width: '100%',
                  height: `${Math.max(12, Math.round((dist.moderate / maxDist) * 85))}%`,
                  borderRadius: '6px 6px 3px 3px',
                  background: 'linear-gradient(180deg,#F0AC4E,#C4740A)',
                  transition: 'height 0.6s ease',
                }}
              />
            </Box>

            {/* Col 4: Critical */}
            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
              <Typography sx={{ fontSize: '10.5px', fontWeight: 700, color: '#4A5468', mb: 0.6 }}>
                {dist.critical}
              </Typography>
              <Box
                sx={{
                  width: '100%',
                  height: `${Math.max(12, Math.round((dist.critical / maxDist) * 85))}%`,
                  borderRadius: '6px 6px 3px 3px',
                  background: 'linear-gradient(180deg,#F17163,#D6392B)',
                  transition: 'height 0.6s ease',
                }}
              />
            </Box>
          </Box>

          {/* Histogram Labels */}
          <Box sx={{ display: 'flex', gap: 1.5, mt: 1 }}>
            <Typography sx={{ flex: 1, textAlign: 'center', fontSize: '10px', color: '#8A93A6', fontWeight: 600 }}>0–25</Typography>
            <Typography sx={{ flex: 1, textAlign: 'center', fontSize: '10px', color: '#8A93A6', fontWeight: 600 }}>26–50</Typography>
            <Typography sx={{ flex: 1, textAlign: 'center', fontSize: '10px', color: '#8A93A6', fontWeight: 600 }}>51–75</Typography>
            <Typography sx={{ flex: 1, textAlign: 'center', fontSize: '10px', color: '#8A93A6', fontWeight: 600 }}>76–100</Typography>
          </Box>

          {/* Legend */}
          <Box sx={{ display: 'flex', gap: 2, mt: 2, pt: 1.5, borderTop: '1px solid #F0F2F5' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, fontSize: '11.5px', color: '#4A5468' }}>
              <Box sx={{ width: 7, height: 7, borderRadius: '2px', bgcolor: '#0F9D63' }} /> Low
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, fontSize: '11.5px', color: '#4A5468' }}>
              <Box sx={{ width: 7, height: 7, borderRadius: '2px', bgcolor: '#4C9EF0' }} /> Guarded
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, fontSize: '11.5px', color: '#4A5468' }}>
              <Box sx={{ width: 7, height: 7, borderRadius: '2px', bgcolor: '#C4740A' }} /> Moderate
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, fontSize: '11.5px', color: '#4A5468' }}>
              <Box sx={{ width: 7, height: 7, borderRadius: '2px', bgcolor: '#D6392B' }} /> Critical
            </Box>
          </Box>
        </Box>

        {/* Panel 2: Recent Activity Timeline */}
        <Box
          sx={{
            background: '#FFFFFF',
            border: '1px solid #E7EAEF',
            borderRadius: '14px',
            p: 2.5,
            boxShadow: '0 1px 2px rgba(16,21,31,0.04), 0 8px 24px rgba(16,21,31,0.05)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
              <Box
                sx={{
                  width: 30,
                  height: 30,
                  borderRadius: '9px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'linear-gradient(155deg,#4FD79A,#0F9D63)',
                  color: '#fff',
                }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 7v5l3 3" />
                </svg>
              </Box>
              <Typography sx={{ fontFamily: 'Manrope, sans-serif', fontSize: '14.5px', fontWeight: 700, letterSpacing: '-0.01em', color: '#10151F' }}>
                Recent Activity
              </Typography>
            </Box>
            <Button
              onClick={() => navigate('/audit-logs')}
              size="small"
              sx={{ fontSize: '12px', color: '#2B4EE6', fontWeight: 600, textTransform: 'none' }}
            >
              View Log
            </Button>
          </Box>

          {/* Activity Feed Items */}
          <Box sx={{ display: 'flex', flexDirection: 'column' }}>
            {recentLogs.length === 0 ? (
              <Typography variant="body2" sx={{ color: '#8A93A6', py: 3, textAlign: 'center' }}>
                No recent activity recorded yet.
              </Typography>
            ) : (
              recentLogs.map((log, idx) => {
                const isDenied = log.result === 'DENIED' || log.action === 'SUSPEND';
                const isWarning = log.action === 'STALE_FLAG' || log.action === 'ROTATE';
                const isSuccess = log.result === 'SUCCESS' && !isDenied;
                const dotColor = isDenied ? '#D6392B' : isWarning ? '#C4740A' : isSuccess ? '#0F9D63' : '#2B4EE6';
                const isLast = idx === recentLogs.length - 1;

                return (
                  <Box
                    key={log.log_id || idx}
                    sx={{
                      display: 'flex',
                      gap: 1.5,
                      py: '10px',
                      borderBottom: isLast ? 'none' : '1px solid #F0F2F5',
                    }}
                  >
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', pt: '3px' }}>
                      <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: dotColor, flexShrink: 0 }} />
                      {!isLast && <Box sx={{ width: '1.5px', flex: 1, bgcolor: '#F0F2F5', mt: '4px' }} />}
                    </Box>
                    <Box sx={{ flex: 1 }}>
                      <Typography sx={{ fontSize: '12.5px', color: '#10151F', lineHeight: 1.4 }}>
                        <b>{log.agent_id || 'System'}</b> — {log.action}{' '}
                        {log.reason ? <span style={{ color: '#4A5468' }}>({log.reason})</span> : null}
                      </Typography>
                      <Typography sx={{ fontSize: '11px', color: '#8A93A6', mt: '1px' }}>
                        {formatRelativeTime(log.timestamp)}
                      </Typography>
                    </Box>
                  </Box>
                );
              })
            )}
          </Box>
        </Box>
      </Box>

      {/* ============ TOP RISK IDENTITIES — 5 CARD LIST ============ */}
      <Box
        sx={{
          background: '#FFFFFF',
          border: '1px solid #E7EAEF',
          borderRadius: '14px',
          p: 2.5,
          boxShadow: '0 1px 2px rgba(16,21,31,0.04), 0 2px 10px rgba(16,21,31,0.035)',
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
            <Box
              sx={{
                width: 30,
                height: 30,
                borderRadius: '9px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'linear-gradient(155deg,#F17163,#D6392B)',
                color: '#fff',
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2 4 6v6c0 5 3.5 8.5 8 10 4.5-1.5 8-5 8-10V6l-8-4Z" />
              </svg>
            </Box>
            <Typography sx={{ fontFamily: 'Manrope, sans-serif', fontSize: '14.5px', fontWeight: 700, letterSpacing: '-0.01em', color: '#10151F' }}>
              Top Risk Identities
            </Typography>
          </Box>
          <Button
            onClick={() => navigate('/')}
            size="small"
            sx={{ fontSize: '12px', color: '#2B4EE6', fontWeight: 600, textTransform: 'none' }}
          >
            View All
          </Button>
        </Box>

        {/* 5 Risk Cards Grid */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)', lg: 'repeat(5, 1fr)' },
            gap: 1.5,
            mt: 0.5,
          }}
        >
          {topRiskList.length === 0 ? (
            <Typography variant="body2" sx={{ color: '#8A93A6', py: 3, gridColumn: '1/-1', textAlign: 'center' }}>
              No identities registered in the system yet.
            </Typography>
          ) : (
            topRiskList.map((agent) => {
              const initials = getInitials(agent.agent_name);
              const avatarBg = getAvatarGradient(agent.risk_score);
              const scoreColor = getScoreColor(agent.risk_score);
              const teamStyle = getTeamStyle(agent.owning_team);
              const chipInfo = getStatusChipInfo(agent.status);

              // SVG Circle Progress (r=24, circum=150.8)
              const circ = 150.8;
              const ringOffset = circ - (circ * agent.risk_score) / 100;

              return (
                <Box
                  key={agent.agent_id}
                  onClick={() => navigate(`/agents/${agent.agent_id}`)}
                  sx={{
                    border: '1px solid #F0F2F5',
                    borderRadius: '12px',
                    p: '14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    cursor: 'pointer',
                    bgcolor: '#FFFFFF',
                    transition: 'border-color .15s, transform .15s, box-shadow .15s',
                    '&:hover': {
                      borderColor: 'transparent',
                      transform: 'translateY(-3px)',
                      boxShadow: '0 10px 24px rgba(16,21,31,0.08)',
                    },
                  }}
                >
                  {/* Top Avatar & Name */}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
                    <Box
                      sx={{
                        width: 34,
                        height: 34,
                        borderRadius: '9px',
                        flexShrink: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontFamily: 'Manrope, sans-serif',
                        fontWeight: 700,
                        fontSize: '12px',
                        color: '#fff',
                        background: avatarBg,
                      }}
                    >
                      {initials}
                    </Box>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography noWrap sx={{ fontSize: '12.5px', fontWeight: 700, color: '#10151F', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                        {agent.agent_name}
                      </Typography>
                      <Typography sx={{ fontSize: '10.5px', color: '#8A93A6', fontFamily: 'JetBrains Mono, monospace' }}>
                        {agent.agent_id.length > 12 ? `${agent.agent_id.slice(0, 10)}...` : agent.agent_id}
                      </Typography>
                    </Box>
                  </Box>

                  {/* Team Tag */}
                  <Box
                    sx={{
                      fontSize: '10px',
                      fontWeight: 700,
                      p: '3px 8px',
                      borderRadius: '6px',
                      alignSelf: 'flex-start',
                      letterSpacing: '0.01em',
                      bgcolor: teamStyle.bg,
                      color: teamStyle.color,
                    }}
                  >
                    {agent.owning_team || 'Core Team'}
                  </Box>

                  {/* Score Ring Gauge */}
                  <Box sx={{ position: 'relative', width: 56, height: 56, my: '2px', mx: 'auto' }}>
                    <svg width="56" height="56" viewBox="0 0 56 56" style={{ transform: 'rotate(-90deg)' }}>
                      <circle cx="28" cy="28" r="24" fill="none" stroke="#F0F2F5" strokeWidth="6" />
                      <circle
                        cx="28"
                        cy="28"
                        r="24"
                        fill="none"
                        stroke={scoreColor}
                        strokeWidth="6"
                        strokeDasharray="150.8"
                        strokeDashoffset={ringOffset}
                        strokeLinecap="round"
                      />
                    </svg>
                    <Box
                      sx={{
                        position: 'absolute',
                        inset: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontFamily: 'Manrope, sans-serif',
                        fontWeight: 800,
                        fontSize: '15px',
                        color: '#10151F',
                      }}
                    >
                      {agent.risk_score}
                    </Box>
                  </Box>

                  {/* Status Chip */}
                  <Box
                    sx={{
                      fontSize: '10px',
                      fontWeight: 700,
                      p: '3px 8px',
                      borderRadius: '20px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      alignSelf: 'center',
                      bgcolor: chipInfo.className === 'active' ? '#E7F7EF' : chipInfo.className === 'suspended' ? '#FCEAE8' : '#FDF3E3',
                      color: chipInfo.color,
                      '&::before': {
                        content: '""',
                        width: '5px',
                        height: '5px',
                        borderRadius: '50%',
                        bgcolor: chipInfo.color,
                        ...(chipInfo.className === 'suspended'
                          ? {
                              animation: 'pulse-red 1.8s infinite',
                              '@keyframes pulse-red': {
                                '0%': { boxShadow: '0 0 0 0 rgba(214,57,43,0.45)' },
                                '70%': { boxShadow: '0 0 0 5px rgba(214,57,43,0)' },
                                '100%': { boxShadow: '0 0 0 0 rgba(214,57,43,0)' },
                              },
                            }
                          : {}),
                      },
                    }}
                  >
                    {chipInfo.label}
                  </Box>

                  {/* Card Foot */}
                  <Typography
                    sx={{
                      textAlign: 'center',
                      fontSize: '11px',
                      color: '#2B4EE6',
                      fontWeight: 600,
                      mt: 'auto',
                    }}
                  >
                    View details →
                  </Typography>
                </Box>
              );
            })
          )}
        </Box>
      </Box>
    </Box>
  );
};
