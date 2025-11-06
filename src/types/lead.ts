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
  notes?: string;
  activities: Activity[];
  tags?: Tag[];
  stageId?: string;
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
  tags?: Tag[];
}
