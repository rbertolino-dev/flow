export interface FollowUpTemplate {
  id: string;
  organizationId: string;
  name: string;
  description?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  steps: FollowUpTemplateStep[];
}

export type AutomationActionType = 
  | 'send_whatsapp'
  | 'add_tag'
  | 'move_stage'
  | 'add_note'
  | 'add_to_call_queue'
  | 'update_field';

export interface FollowUpStepAutomation {
  id: string;
  stepId: string;
  actionType: AutomationActionType;
  actionConfig: Record<string, any>; // Configuração específica da ação
  executionOrder: number;
  isActive: boolean;
  createdAt: Date;
}

export interface FollowUpTemplateStep {
  id: string;
  templateId: string;
  stepOrder: number;
  title: string;
  description?: string;
  tip?: string; // Dica ou exemplo para a etapa
  createdAt: Date;
  automations?: FollowUpStepAutomation[]; // Automações da etapa
}

export interface LeadFollowUp {
  id: string;
  leadId: string;
  templateId: string;
  templateName: string;
  startedAt: Date;
  completedAt?: Date;
  steps: LeadFollowUpStep[];
}

export interface LeadFollowUpStep {
  stepId: string;
  stepOrder: number;
  title: string;
  description?: string;
  tip?: string;
  completed: boolean;
  completedAt?: Date;
}

