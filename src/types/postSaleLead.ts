import { Tag } from "@/hooks/useTags";

export interface PostSaleStage {
  id: string;
  name: string;
  color: string;
  position: number;
}

export interface PostSaleActivity {
  id: string;
  type: 'whatsapp' | 'call' | 'note' | 'status_change';
  content: string;
  timestamp: Date;
  user: string;
  direction?: 'incoming' | 'outgoing';
  user_name?: string | null;
}

export interface PostSaleLead {
  id: string;
  name: string;
  phone: string;
  email?: string;
  company?: string;
  value?: number;
  status: string;
  source: string;
  assignedTo: string;
  lastContact: Date;
  createdAt: Date;
  notes?: string;
  activities: PostSaleActivity[];
  tags?: Tag[];
  stageId?: string;
  originalLeadId?: string;
  transferredAt?: Date;
  transferredBy?: string;
}

