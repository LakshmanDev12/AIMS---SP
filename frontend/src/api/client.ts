import axios from 'axios';
import {
  Agent,
  Credential,
  AuditLogEntry,
  RegisterAgentPayload,
  RegisterAgentResponse,
  RotateCredentialResponse,
  QuarterlyReport,
  DashboardData,
  SystemNotification,
  NotificationSummary,
  SimulationType,
  SandboxResult,
} from '../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});
export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const api = {
  // Agent endpoints
  getAgents: async (skip = 0, limit = 100): Promise<Agent[]> => {
    const res = await apiClient.get<Agent[]>('/agents', { params: { skip, limit } });
    return res.data;
  },

  getAgent: async (agentId: string): Promise<Agent> => {
    const res = await apiClient.get<Agent>(`/agents/${agentId}`);
    return res.data;
  },

  registerAgent: async (payload: RegisterAgentPayload): Promise<RegisterAgentResponse> => {
    const res = await apiClient.post<RegisterAgentResponse>('/agents/register', payload);
    return res.data;
  },

  getCredentials: async (agentId: string): Promise<Credential[]> => {
    const res = await apiClient.get<Credential[]>(`/credentials/${agentId}`);
    return res.data;
  },

  rotateCredential: async (agentId: string, token: string): Promise<RotateCredentialResponse> => {
    const res = await apiClient.post<RotateCredentialResponse>(
      '/credentials/rotate',
      { agent_id: agentId },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return res.data;
  },

  // Lifecycle actions (require admin token)
  suspendAgent: async (agentId: string, adminToken: string) => {
    const res = await apiClient.post(
      `/agents/suspend/${agentId}`,
      {},
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );
    return res.data;
  },

  reactivateAgent: async (agentId: string, adminToken: string): Promise<RegisterAgentResponse> => {
    const res = await apiClient.post<RegisterAgentResponse>(
      `/agents/reactivate/${agentId}`,
      {},
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );
    return res.data;
  },

  decommissionAgent: async (agentId: string, adminToken: string) => {
    const res = await apiClient.post(
      `/agents/decommission/${agentId}`,
      {},
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );
    return res.data;
  },

  // Notification & Governance Alert endpoints
  getNotifications: async (params?: {
    category?: string;
    severity?: string;
    is_read?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<SystemNotification[]> => {
    const res = await apiClient.get<SystemNotification[]>('/notifications', { params });
    return res.data;
  },

  getNotificationSummary: async (): Promise<NotificationSummary> => {
    const res = await apiClient.get<NotificationSummary>('/notifications/summary');
    return res.data;
  },

  markNotificationRead: async (id: number): Promise<SystemNotification> => {
    const res = await apiClient.put<SystemNotification>(`/notifications/${id}/read`);
    return res.data;
  },

  markAllNotificationsRead: async (category?: string): Promise<{ updated_count: number }> => {
    const res = await apiClient.put<{ updated_count: number }>('/notifications/read-all', null, {
      params: category ? { category } : {},
    });
    return res.data;
  },

  triggerAlertSweep: async (): Promise<{ new_notifications_generated: number; summary: NotificationSummary }> => {
    const res = await apiClient.post('/notifications/trigger-sweep');
    return res.data;
  },

  testWebhook: async (targetUrl: string, title?: string, message?: string) => {
    const res = await apiClient.post('/notifications/test-webhook', {
      target_url: targetUrl,
      title,
      message,
    });
    return res.data;
  },

  // Governance & Review endpoints
  getDashboard: async (): Promise<DashboardData> => {
    const res = await apiClient.get<DashboardData>('/dashboard');
    return res.data;
  },

  getQuarterlyReport: async (): Promise<QuarterlyReport> => {
    const res = await apiClient.get<QuarterlyReport>('/reviews/quarterly');
    return res.data;
  },

  detectStaleAgents: async (): Promise<{ newly_stale_count: number; agent_ids: string[] }> => {
    const res = await apiClient.post('/reviews/detect-stale');
    return res.data;
  },

  autoRevokeStale: async (): Promise<{ revoked_count: number; agent_ids: string[] }> => {
    const res = await apiClient.post('/reviews/auto-revoke');
    return res.data;
  },

  getAuditLogs: async (agentId?: string, limit = 100): Promise<AuditLogEntry[]> => {
    const res = await apiClient.get<AuditLogEntry[]>('/audit-logs', {
      params: { ...(agentId ? { agent_id: agentId } : {}), limit },
    });
    return res.data;
  },

  getHealth: async (): Promise<{ status: string }> => {
    const res = await apiClient.get('/health');
    return res.data;
  },

  // Security Sandbox endpoints
  simulateSandboxAction: async (agentId: string, simulationType: SimulationType): Promise<SandboxResult> => {
    const res = await apiClient.post<SandboxResult>('/sandbox/simulate', {
      agent_id: agentId,
      simulation_type: simulationType,
    });
    return res.data;
  },

  // Compliance Export endpoints
  exportComplianceCsv: (): string => {
    return `${API_BASE_URL}/reviews/export/csv`;
  },

  exportComplianceJson: (): string => {
    return `${API_BASE_URL}/reviews/export/json`;
  },
};

