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
  | 'send_whatsapp_template' // Usar template de mensagem existente
  | 'add_tag'
  | 'remove_tag' // Remover tag do lead
  | 'move_stage'
  | 'add_note'
  | 'add_to_call_queue'
  | 'update_field'
  | 'update_value' // Atualizar valor do lead especificamente
  | 'apply_template' // Aplicar outro template de follow-up
  | 'wait_delay' // Aguardar tempo antes de próxima ação
  | 'create_reminder' // Criar lembrete/tarefa
  | 'remove_from_call_queue'; // Remover da fila de ligações

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

