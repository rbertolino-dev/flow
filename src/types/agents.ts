export type AgentStatus = "draft" | "active" | "paused" | "archived";

export interface Agent {
  id: string;
  organization_id: string;
  name: string;
  description?: string | null;
  language?: string | null;
  persona?: Record<string, unknown> | null;
  policies?: Record<string, unknown>[] | null;
  prompt_instructions?: string | null;
  temperature?: number | null;
  model?: string | null;
  status: AgentStatus;
  version: number;
  openai_assistant_id?: string | null;
  evolution_instance_id?: string | null;
  evolution_config_id?: string | null;
  test_mode: boolean;
  allow_fallback: boolean;
  metadata?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface AgentVersion {
  id: string;
  agent_id: string;
  version: number;
  snapshot: Record<string, unknown>;
  change_summary?: string | null;
  created_at: string;
}

export interface AgentUsageMetric {
  id: string;
  agent_id: string;
  metric_date: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  total_requests: number;
  total_cost: number;
  metadata?: Record<string, unknown> | null;
}

export interface AgentFormValues {
  name: string;
  description?: string;
  language?: string;
  model?: string;
  prompt_instructions?: string;
  temperature?: number;
  test_mode?: boolean;
  allow_fallback?: boolean;
  evolution_config_id?: string;
  metadata?: Record<string, unknown>;
}

export interface CreateAgentPayload extends AgentFormValues {
  organization_id: string;
}

export type UpdateAgentPayload = Partial<
  AgentFormValues & {
    status: AgentStatus;
    version: number;
  }
>;

