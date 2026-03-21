import type { LeadBudgetSummary, LeadBudgetPreview } from "@/lib/leadBudgetSummary";

export type { LeadBudgetSummary, LeadBudgetPreview } from "@/lib/leadBudgetSummary";

export type LeadStatus = "novo" | "contatado" | "proposta" | "negociacao" | "ganho" | "perdido" | string;

export type ActivityType = "whatsapp" | "call" | "note" | "status_change";

export interface LeadAssignee {
  userId: string;
  fullName: string | null;
  email: string;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
}

export interface Activity {
  id: string;
  type: ActivityType;
  content: string;
  timestamp: Date;
  user: string;
  direction?: 'incoming' | 'outgoing';
  user_name?: string | null;
}

export interface Lead {
  id: string;
  name: string;
  phone: string;
  email?: string;
  company?: string;
  /** Valor exibido no funil: soma dos orçamentos aprovados, se houver; senão estimativa manual (`estimatedValueStored`). */
  value?: number;
  /** Valor salvo em `leads.value` (estimativa manual); pode diferir de `value` quando há orçamentos aprovados. */
  estimatedValueStored?: number;
  status: LeadStatus;
  source: string;
  assignedTo: string;
  /** Responsáveis explícitos (tabela lead_assignees); vazio = usar só assignedTo legado */
  assignees?: LeadAssignee[];
  lastContact: Date;
  createdAt: Date;
  returnDate?: Date;
  sourceInstanceId?: string;
  sourceInstanceName?: string;
  notes?: string;
  activities: Activity[];
  tags?: Tag[];
  stageId?: string;
  has_unread_messages?: boolean;
  last_message_at?: string;
  unread_message_count?: number;
  call_count?: number;
  excluded_from_funnel?: boolean;
  productId?: string;
  product?: {
    id: string;
    name: string;
    price: number;
    category: string;
  };
  cpf_cnpj?: string | null;
  /** Data de nascimento (YYYY-MM-DD) */
  birthDate?: string | null;
  address?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  /** CEP somente dígitos (até 8) */
  postalCode?: string | null;
  /** Preenchido pelo useLeads a partir da tabela budgets */
  budgetSummary?: LeadBudgetSummary;
  /** Até 3 orçamentos mais recentes no card; totalCount para "ver outros" */
  budgetsPreview?: { previews: LeadBudgetPreview[]; totalCount: number };
}

export interface CallQueueItem {
  id: string;
  leadId: string;
  leadName: string;
  phone: string;
  scheduledFor?: Date;
  priority: "high" | "medium" | "low";
  status: "pending" | "completed" | "rescheduled";
  notes?: string;
  tags?: Tag[]; // Tags do lead
  queueTags?: Tag[]; // Tags específicas da ligação
  callNotes?: string;
  callCount: number;
  completedBy?: string;
  completedAt?: Date;
  assignedToUserId?: string;
  assignedToUserName?: string;
  assignedToUserEmail?: string;
  leadCreatedAt?: Date;
}
