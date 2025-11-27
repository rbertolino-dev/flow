export type WorkflowPeriodicity =
  | "daily"
  | "weekly"
  | "biweekly"
  | "monthly"
  | "custom";

export type WorkflowStatus = "active" | "paused" | "completed";

export type WorkflowTriggerType = "fixed" | "before" | "after" | "status";

export type WorkflowTemplateMode = "existing" | "custom";

export interface WorkflowListContact {
  lead_id?: string | null;
  phone: string;
  name?: string | null;
  instance_id?: string | null;
  variables?: Record<string, string>;
}

export interface WorkflowList {
  id: string;
  organization_id: string;
  name: string;
  description?: string | null;
  list_type: "list" | "single";
  contacts: WorkflowListContact[];
  default_instance_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkflowAttachment {
  id: string;
  organization_id: string;
  workflow_id: string;
  file_url: string;
  file_name: string;
  file_type?: string | null;
  file_size?: number | null;
  created_at: string;
}

export interface WorkflowContactAttachment {
  id: string;
  organization_id: string;
  workflow_id: string;
  lead_id: string;
  contact_phone: string;
  file_url: string;
  file_name: string;
  file_type?: string | null;
  file_size?: number | null;
  month_reference?: string | null; // Formato MM/YYYY (ex: "01/2025")
  metadata?: Record<string, any>; // Slots de informação do PDF
  created_at: string;
  updated_at: string;
}

export interface WorkflowGroup {
  id: string;
  organization_id: string;
  group_id: string; // ID do grupo na Evolution API
  group_name: string;
  instance_id: string;
  participant_count?: number | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface MonthlyAttachment {
  month_reference: string; // Formato MM/YYYY
  file: File;
}

export type ApprovalStatus = "pending" | "approved" | "rejected" | "skipped";

export interface WorkflowApproval {
  id: string;
  organization_id: string;
  workflow_id: string;
  scheduled_message_id?: string | null;
  lead_id: string;
  contact_phone: string;
  contact_name?: string | null;
  message_body: string;
  attachment_url?: string | null;
  attachment_type?: string | null;
  attachment_name?: string | null;
  approval_date?: string | null;
  status: ApprovalStatus;
  approved_by?: string | null;
  approved_at?: string | null;
  rejection_reason?: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkflowTemplateRef {
  id?: string;
  name?: string;
  content?: string;
  media_url?: string | null;
  media_type?: string | null;
}

export interface WorkflowEnvio {
  id: string;
  organization_id: string;
  workflow_list_id: string;
  default_instance_id?: string | null;
  name: string;
  workflow_type: string;
  recipient_mode: "list" | "single" | "group";
  group_id?: string | null;
  periodicity: WorkflowPeriodicity;
  days_of_week?: string[] | null;
  day_of_month?: number | null;
  custom_interval_value?: number | null;
  custom_interval_unit?: "day" | "week" | "month" | null;
  send_time: string;
  timezone: string;
  start_date: string;
  end_date?: string | null;
  trigger_type: WorkflowTriggerType;
  trigger_offset_days: number;
  template_mode: WorkflowTemplateMode;
  message_template_id?: string | null;
  message_body?: string | null;
  observations?: string | null;
  is_active: boolean;
  status: WorkflowStatus;
  next_run_at?: string | null;
  last_run_at?: string | null;
  requires_approval?: boolean;
  approval_deadline_hours?: number | null;
  list?: WorkflowList | null;
  group?: WorkflowGroup | null; // Novo campo
  attachments?: WorkflowAttachment[];
  contact_attachments?: WorkflowContactAttachment[];
  template?: WorkflowTemplateRef | null;
}

export interface WorkflowFilters {
  status: "all" | WorkflowStatus;
  type: "all" | string;
  listId: "all" | string;
  search: string;
  dateFrom?: string | null;
  dateTo?: string | null;
}

export interface WorkflowFormValues {
  id?: string;
  name: string;
  workflow_type: string;
  recipientMode: "list" | "single" | "group";
  workflow_list_id?: string;
  single_lead_id?: string;
  group_id?: string;
  default_instance_id?: string;
  periodicity: WorkflowPeriodicity;
  days_of_week: string[];
  day_of_month?: number | null;
  custom_interval_value?: number | null;
  custom_interval_unit?: "day" | "week" | "month" | null;
  send_time: string;
  timezone: string;
  start_date: string;
  end_date?: string | null;
  trigger_type: WorkflowTriggerType;
  trigger_offset_days: number;
  template_mode: WorkflowTemplateMode;
  message_template_id?: string | null;
  message_body?: string | null;
  observations?: string | null;
  is_active: boolean;
  requires_approval?: boolean;
  approval_deadline_hours?: number | null;
  attachments?: WorkflowAttachment[];
  contact_attachments?: Record<string, File>; // lead_id -> File (para anexos gerais)
  contact_attachments_metadata?: Record<string, Record<string, any>>; // lead_id -> metadata
  monthly_attachments?: Record<string, MonthlyAttachment[]>; // lead_id -> [{month_reference, file}]
  gerar_boleto?: boolean; // Se deve gerar boleto automaticamente
  boleto_valor?: number; // Valor do boleto
  boleto_vencimento?: string; // Data de vencimento (yyyy-MM-dd)
  boleto_descricao?: string; // Descrição do boleto
}

export interface LeadOption {
  id: string;
  name: string;
  phone: string;
  email?: string;
}

