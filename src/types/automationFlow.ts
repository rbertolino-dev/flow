import { AutomationActionType } from "./followUp";

// Re-exportar para uso em outros módulos
export type { AutomationActionType };

// Tipos de nós do canvas
export type FlowNodeType = 'trigger' | 'action' | 'wait' | 'condition' | 'end';

// Tipos de gatilhos
export type TriggerType = 
  | 'lead_created'
  | 'tag_added'
  | 'tag_removed'
  | 'stage_changed'
  | 'field_changed'
  | 'date_trigger'
  | 'relative_date'
  | 'google_calendar_event'
  | 'lead_return_date'
  | 'last_message_sent';

// Tipos de espera
export type WaitType = 'delay' | 'until_date' | 'until_field';

// Operadores de condição
export type ConditionOperator = 
  | 'equals'
  | 'not_equals'
  | 'greater_than'
  | 'less_than'
  | 'contains'
  | 'not_contains'
  | 'exists'
  | 'not_exists';

// Status do fluxo
export type FlowStatus = 'draft' | 'active' | 'paused';

// Status da execução
export type ExecutionStatus = 'running' | 'waiting' | 'completed' | 'paused' | 'error';

// Configuração de gatilho
export interface TriggerConfig {
  triggerType: TriggerType;
  tag_id?: string;
  stage_id?: string;
  field?: string;
  value?: any;
  date?: string; // ISO string
  days_before?: number;
  conditions?: Record<string, any>;
}

// Configuração de ação (reaproveita tipos existentes)
export interface ActionConfig {
  actionType: AutomationActionType;
  [key: string]: any; // Configuração específica da ação
}

// Configuração de espera
export interface WaitConfig {
  waitType: WaitType;
  delay_value?: number;
  delay_unit?: 'minutes' | 'hours' | 'days';
  date?: string; // ISO string
  field?: string;
  operator?: ConditionOperator;
  value?: any;
}

// Configuração de condição
export interface ConditionConfig {
  field?: string;
  tag_id?: string;
  stage_id?: string;
  operator: ConditionOperator;
  value?: any;
}

// Nó do canvas
export interface FlowNode {
  id: string;
  type: FlowNodeType;
  position: { x: number; y: number };
  data: {
    label: string;
    config: TriggerConfig | ActionConfig | WaitConfig | ConditionConfig | Record<string, any>;
  };
}

// Conexão entre nós
export interface FlowEdge {
  id: string;
  source: string; // node id
  target: string; // node id
  sourceHandle?: string; // Para condições: 'yes' | 'no'
  targetHandle?: string;
}

// Dados do fluxo (canvas)
export interface FlowData {
  nodes: FlowNode[];
  edges: FlowEdge[];
}

// Fluxo de automação completo
export interface AutomationFlow {
  id: string;
  organizationId: string;
  name: string;
  description?: string;
  status: FlowStatus;
  flowData: FlowData;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Execução de fluxo
export interface FlowExecution {
  id: string;
  flowId: string;
  leadId: string;
  organizationId: string;
  currentNodeId?: string;
  status: ExecutionStatus;
  executionData: Record<string, any>;
  startedAt: Date;
  completedAt?: Date;
  nextExecutionAt?: Date;
  createdBy?: string;
}

// Tipos para o editor
export interface NodeData {
  label: string;
  config: Record<string, any>;
  onConfigChange?: (config: Record<string, any>) => void;
}

// Tipos para validação
export interface FlowValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

