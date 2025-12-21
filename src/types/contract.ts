export type ContractStatus = 'draft' | 'sent' | 'signed' | 'expired' | 'cancelled';
export type SignerType = 'user' | 'client';
export type StorageType = 'supabase' | 'firebase' | 's3' | 'custom';

export interface ContractTemplate {
  id: string;
  organization_id: string;
  name: string;
  description?: string;
  content: string;
  variables: string[];
  cover_page_url?: string; // URL da folha de rosto (imagem de fundo)
  is_active: boolean;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface Contract {
  id: string;
  organization_id: string;
  template_id?: string;
  lead_id: string;
  category_id?: string; // Nova: categoria do contrato
  contract_number: string;
  content: string;
  pdf_url?: string;
  signed_pdf_url?: string;
  signature_token?: string; // Token para acesso público à página de assinatura
  whatsapp_message_template?: string; // Template personalizado da mensagem WhatsApp
  status: ContractStatus;
  expires_at?: string;
  signed_at?: string;
  sent_at?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
  // Relacionamentos (opcionais, carregados via JOIN)
  template?: ContractTemplate;
  category?: ContractCategory; // Nova: categoria relacionada
  lead?: {
    id: string;
    name: string;
    phone: string;
    email?: string;
    company?: string;
  };
}

export interface ContractSignature {
  id: string;
  contract_id: string;
  signer_type: SignerType;
  signer_name: string;
  signature_data: string; // base64 PNG
  signed_at: string;
  ip_address?: string;
  user_agent?: string; // Navegador/dispositivo usado
  device_info?: Record<string, any>; // Informações do dispositivo (JSONB)
  geolocation?: Record<string, any>; // Localização aproximada (JSONB, opcional)
  validation_hash?: string; // Hash SHA-256 para validação de integridade
  signed_ip_country?: string; // País do IP de origem
  created_at: string;
}

export interface ContractStorageConfig {
  id: string;
  organization_id?: string;
  storage_type: StorageType; // Não usado mais (storage principal sempre é Supabase)
  config: Record<string, any>; // Não usado mais (storage principal sempre é Supabase)
  is_active: boolean; // Não usado mais (storage principal sempre é Supabase)
  // Campos de backup storage (opcional)
  backup_storage_type?: StorageType;
  backup_config?: Record<string, any>;
  backup_is_active?: boolean;
  created_at: string;
  updated_at: string;
}

// Variáveis disponíveis para templates
export const CONTRACT_VARIABLES = {
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

export type ContractVariableKey = keyof typeof CONTRACT_VARIABLES;

// ============================================
// NOVAS INTERFACES: Melhorias do Módulo
// ============================================

// Sistema de Categorias/Tags
export interface ContractCategory {
  id: string;
  organization_id: string;
  name: string;
  color: string; // Cor hexadecimal (ex: #3b82f6)
  icon?: string; // Nome do ícone lucide-react
  description?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Sistema de Lembretes Automáticos
export type ReminderType = 'signature_due' | 'expiration_approaching' | 'follow_up' | 'custom' | 'expiration_warning' | 'unsigned_reminder';
export type ReminderSentVia = 'whatsapp' | 'email' | 'sms' | 'system' | 'both';

export interface ContractReminder {
  id: string;
  contract_id: string;
  reminder_type: ReminderType;
  scheduled_at: string; // Quando o lembrete deve ser enviado
  sent_at?: string; // Quando foi enviado (null = não enviado ainda)
  message?: string; // Mensagem personalizada
  sent_via?: ReminderSentVia; // Como foi enviado
  created_by?: string;
  created_at: string;
  updated_at: string;
  // Relacionamentos
  contract?: Contract;
}

// Sistema de Auditoria
export type AuditAction = 
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

export interface ContractAuditLog {
  id: string;
  contract_id: string;
  user_id?: string; // null para ações públicas/anônimas
  action: AuditAction;
  details: Record<string, any>; // Detalhes adicionais da ação
  old_value?: Record<string, any>; // Valor anterior (para updates)
  new_value?: Record<string, any>; // Valor novo (para updates)
  ip_address?: string;
  user_agent?: string;
  timestamp: string;
  // Relacionamentos
  contract?: Contract;
  user?: {
    id: string;
    email?: string;
    name?: string;
  };
}
