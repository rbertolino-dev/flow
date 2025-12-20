// Tipos para o módulo Contrato Digital
// Reutiliza conceitos do módulo de contratos mas com namespace separado

export type DigitalContractStatus = 'draft' | 'sent' | 'signed' | 'expired' | 'cancelled';
export type DigitalSignerType = 'user' | 'client';

export interface DigitalContractTemplate {
  id: string;
  organization_id: string;
  name: string;
  description?: string;
  content: string;
  variables: string[];
  cover_page_url?: string;
  is_active: boolean;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface DigitalContract {
  id: string;
  organization_id: string;
  template_id?: string;
  lead_id: string;
  category_id?: string;
  contract_number: string;
  content: string;
  pdf_url?: string;
  signed_pdf_url?: string;
  signature_token?: string;
  whatsapp_message_template?: string;
  status: DigitalContractStatus;
  expires_at?: string;
  signed_at?: string;
  sent_at?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
  // Relacionamentos
  template?: DigitalContractTemplate;
  category?: DigitalContractCategory;
  lead?: {
    id: string;
    name: string;
    phone: string;
    email?: string;
    company?: string;
  };
}

export interface DigitalContractSignature {
  id: string;
  contract_id: string;
  signer_type: DigitalSignerType;
  signer_name: string;
  signature_data: string; // base64 PNG
  signed_at: string;
  ip_address?: string;
  user_agent?: string;
  device_info?: Record<string, any>;
  geolocation?: Record<string, any>;
  validation_hash?: string;
  signed_ip_country?: string;
  created_at: string;
}

export interface DigitalContractCategory {
  id: string;
  organization_id: string;
  name: string;
  color: string;
  icon?: string;
  description?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type DigitalReminderType = 'signature_due' | 'expiration_approaching' | 'follow_up' | 'custom' | 'expiration_warning' | 'unsigned_reminder';
export type DigitalReminderSentVia = 'whatsapp' | 'email' | 'sms' | 'system' | 'both';

export interface DigitalContractReminder {
  id: string;
  contract_id: string;
  reminder_type: DigitalReminderType;
  scheduled_at: string;
  sent_at?: string;
  message?: string;
  sent_via?: DigitalReminderSentVia;
  created_by?: string;
  created_at: string;
  updated_at: string;
  contract?: DigitalContract;
}

export type DigitalAuditAction = 
  | 'created' 
  | 'updated' 
  | 'deleted' 
  | 'sent' 
  | 'signed' 
  | 'cancelled' 
  | 'expired' 
  | 'viewed' 
  | 'downloaded' 
  | 'pdf_generated' 
  | 'reminder_sent'
  | 'category_changed' 
  | 'status_changed';

export interface DigitalContractAuditLog {
  id: string;
  contract_id: string;
  user_id?: string;
  action: DigitalAuditAction;
  details: Record<string, any>;
  old_value?: Record<string, any>;
  new_value?: Record<string, any>;
  ip_address?: string;
  user_agent?: string;
  timestamp: string;
  contract?: DigitalContract;
  user?: {
    id: string;
    email?: string;
    name?: string;
  };
}

// Variáveis disponíveis para templates
export const DIGITAL_CONTRACT_VARIABLES = {
  nome: '{{nome}}',
  telefone: '{{telefone}}',
  email: '{{email}}',
  empresa: '{{empresa}}',
  valor: '{{valor}}',
  data_hoje: '{{data_hoje}}',
  data_vencimento: '{{data_vencimento}}',
  numero_contrato: '{{numero_contrato}}',
  etapa_funil: '{{etapa_funil}}',
  produto: '{{produto}}',
} as const;

export type DigitalContractVariableKey = keyof typeof DIGITAL_CONTRACT_VARIABLES;

// Helper para validar IDs
export function isValidDigitalContractId(id: string | null | undefined): boolean {
  if (!id) return false;
  if (typeof id !== 'string') return false;
  if (id.trim() === '') return false;
  // Verificar se é UUID válido (formato básico)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id.trim());
}

