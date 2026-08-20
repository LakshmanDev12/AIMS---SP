import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';
import { NotificationProvider } from './context/NotificationContext';
import { AuthProvider } from './context/AuthContext';
import { Layout } from './components/Layout';

import { Dashboard } from './pages/Dashboard';
import { AgentList } from './pages/AgentList';
import { AgentDetail } from './pages/AgentDetail';
import { RegisterAgent } from './pages/RegisterAgent';
import { QuarterlyReview } from './pages/QuarterlyReview';
import { AuditLogs } from './pages/AuditLogs';
import { Notifications } from './pages/Notifications';
import { Sandbox } from './pages/Sandbox';

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#2563eb', // Indigo-Blue
      dark: '#1d4ed8',
      light: '#60a5fa',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#64748b',
    },
    success: {
      main: '#10b981',
    },
    warning: {
      main: '#f59e0b',
    },
    error: {
      main: '#ef4444',
    },
    background: {
      default: '#f8fafc',
      paper: '#ffffff',
    },
    text: {
      primary: '#0f172a',
      secondary: '#64748b',
    },
  },
  typography: {
    fontFamily: [
      'Inter',
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      'Roboto',
      'sans-serif',
    ].join(','),
    h4: {
      fontWeight: 800,
      letterSpacing: '-0.02em',
    },
    h5: {
      fontWeight: 700,
      letterSpacing: '-0.01em',
    },
    h6: {
      fontWeight: 700,
      letterSpacing: '-0.01em',
    },
  },
  shape: {
    borderRadius: 10,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderColor: '#f1f5f9',
          padding: '12px 16px',
        },
        head: {
          color: '#475569',
          fontWeight: 700,
          fontSize: '0.82rem',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        },
      },
    },
  },
});

export const App: React.FC = () => {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <NotificationProvider>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Layout />}>
                <Route index element={<AgentList />} />
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="agents/register" element={<RegisterAgent />} />
                <Route path="agents/:id" element={<AgentDetail />} />
                <Route path="reviews" element={<QuarterlyReview />} />
                <Route path="notifications" element={<Notifications />} />
                <Route path="sandbox" element={<Sandbox />} />
                <Route path="audit-logs" element={<AuditLogs />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </NotificationProvider>
    </ThemeProvider>
  );
};

export default App;
