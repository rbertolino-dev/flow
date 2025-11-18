export type LeadStatus = "novo" | "contatado" | "proposta" | "negociacao" | "ganho" | "perdido" | string;

export type ActivityType = "whatsapp" | "call" | "note" | "status_change";

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
