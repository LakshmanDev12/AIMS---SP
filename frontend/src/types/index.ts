export type AgentStatus = 'ACTIVE' | 'STALE' | 'SUSPENDED' | 'REVOKED' | 'DECOMMISSIONED';

export type CredentialStatus = 'ACTIVE' | 'ROTATED' | 'REVOKED' | 'EXPIRED';

export interface Agent {
  agent_id: string;
  agent_name: string;
  purpose: string | null;
  owning_team: string | null;
  approved_scopes: string[];
  status: AgentStatus;
  creation_date: string;
  expiry_date: string | null;
  last_api_call: string | null;
  risk_score: number;
}

export interface Credential {
  credential_id: string;
  agent_id: string;
  token_hash: string;
  issued_at: string;
  expires_at: string;
  status: CredentialStatus;
}

export interface AuditLogEntry {
  log_id: string;
  agent_id: string | null;
  action: string;
  result: 'SUCCESS' | 'DENIED' | string;
  reason: string | null;
  timestamp: string;
}

export interface RegisterAgentPayload {
  agent_name: string;
  purpose?: string;
  owning_team?: string;
  scopes: string[];
}

export interface RegisterAgentResponse {
  agent_id: string;
  token: string;
  expires_at: string;
}

export interface RotateCredentialResponse {
  agent_id: string;
  credential_id: string;
  token: string;
  expires_at: string;
}

export interface QuarterlyReport {
  generated_at: string;
  total_agents: number;
  by_status: Record<string, number>;
  governance_health?: number;
  risk_distribution?: {
    low: number;
    guarded: number;
    moderate: number;
    critical: number;
  };
  stale_agents: Array<{
    agent_id: string;
    agent_name: string;
    risk_score: number;
  }>;
  agents_without_rotation_90d: Array<{
    agent_id: string;
    agent_name: string;
  }>;
  top_risk_agents: Array<{
    agent_id: string;
    agent_name: string;
    risk_score: number;
    status: string;
    owning_team?: string | null;
  }>;
}

export interface DashboardData extends QuarterlyReport {
  recent_activity: Array<{
    log_id?: number;
    agent_id: string | null;
    action: string;
    result: string;
    reason?: string | null;
    timestamp: string;
  }>;
}

export type NotificationCategory = 'unused_agent' | 'active_agent' | 'security' | 'system';
export type NotificationSeverity = 'critical' | 'warning' | 'info';

export interface SystemNotification {
  id: number;
  agent_id: string | null;
  category: NotificationCategory;
  severity: NotificationSeverity;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
  meta_data?: string | null;
}

export interface NotificationSummary {
  total_unread: number;
  total_notifications: number;
  unused_agent_alerts: number;
  active_agent_alerts: number;
  security_alerts: number;
}

export type SimulationType = 'valid_read' | 'unauthorized_admin' | 'unauthorized_write' | 'rotate_token' | 'burst_traffic';

export interface SandboxResult {
  status_code: number;
  result: 'SUCCESS' | 'DENIED';
  reason: string;
  agent_id: string;
  agent_name?: string;
  security_alert_generated?: boolean;
  new_credential_id?: string;
  new_token_sample?: string;
  requests_executed?: number;
  payload?: Record<string, unknown>;
  timestamp: string;
}


