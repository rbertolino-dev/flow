import type { LeadBudgetSummary } from "@/lib/leadBudgetSummary";

export type { LeadBudgetSummary } from "@/lib/leadBudgetSummary";

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
  value?: number;
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
  /** Preenchido pelo useLeads a partir da tabela budgets */
  budgetSummary?: LeadBudgetSummary;
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
