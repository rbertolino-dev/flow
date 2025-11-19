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
  guardrails?: string | null;
  few_shot_examples?: string | null;
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
  // Evolution OpenAI bot configuration
  trigger_type?: string | null;
  trigger_operator?: string | null;
  trigger_value?: string | null;
  expire?: number | null;
  keyword_finish?: string | null;
  delay_message?: number | null;
  unknown_message?: string | null;
  listening_from_me?: boolean | null;
  stop_bot_from_me?: boolean | null;
  keep_open?: boolean | null;
  debounce_time?: number | null;
  ignore_jids?: string[] | null;
  response_format?: string | null;
  split_messages?: number | null;
  function_url?: string | null;
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
  guardrails?: string;
  few_shot_examples?: string;
  temperature?: number;
  test_mode?: boolean;
  allow_fallback?: boolean;
  evolution_config_id?: string;
  metadata?: Record<string, unknown>;
  // Evolution OpenAI bot configuration
  trigger_type?: string;
  trigger_operator?: string;
  trigger_value?: string;
  expire?: number;
  keyword_finish?: string;
  delay_message?: number;
  unknown_message?: string;
  listening_from_me?: boolean;
  stop_bot_from_me?: boolean;
  keep_open?: boolean;
  debounce_time?: number;
  ignore_jids?: string[];
  response_format?: string;
  split_messages?: number;
  function_url?: string;
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

