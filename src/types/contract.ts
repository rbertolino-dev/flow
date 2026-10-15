export type ContractStatus = 'draft' | 'sent' | 'signed' | 'expired' | 'cancelled';
export type SignerType = 'user' | 'client';
export type StorageType = 'supabase' | 'firebase' | 's3' | 'custom';

/** Texto padrão se o template/contrato não tiver termos configurados */
export const DEFAULT_CONTRACT_ACCEPTANCE_TERMS = `Ao assinar eletronicamente este documento, declaro que:

1. Li e compreendi o conteúdo completo do contrato exibido nesta página (incluindo o PDF, quando disponível);
2. Concordo com todas as cláusulas e condições nele descritas;
3. Autorizo a coleta da minha assinatura eletrônica, identificação (nome e CPF) e código de verificação via WhatsApp, bem como o registro de data/hora, IP e dados do dispositivo para fins de prova do aceite;
4. Reconheço que esta assinatura eletrônica tem validade nos termos da Lei nº 14.063/2020 (assinatura eletrônica simples).

Em caso de dúvidas, entre em contato com a empresa responsável antes de assinar.`;

export interface ContractTemplate {
  id: string;
  organization_id: string;
  name: string;
  description?: string;
  content: string;
  /** Termos exibidos ao cliente na hora de assinar */
  acceptance_terms?: string | null;
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
  /** Título editável exibido no PDF (fallback: nome do template) */
  title?: string | null;
  content: string;
  pdf_url?: string;
  signed_pdf_url?: string;
  signature_token?: string; // Token para acesso público à página de assinatura
  whatsapp_message_template?: string; // Template personalizado da mensagem WhatsApp
  /** Instância Evolution usada no envio (OTP deve usar a mesma) */
  whatsapp_instance_id?: string | null;
  /** Termos de aceite exibidos na assinatura */
  acceptance_terms?: string | null;
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
  device_info?: Record<string, unknown>; // Informações do dispositivo (JSONB)
  geolocation?: Record<string, unknown>; // Localização aproximada (JSONB, opcional)
  validation_hash?: string; // Hash SHA-256 para validação de integridade
  signed_ip_country?: string; // País do IP de origem
  /** CPF do signatário (apenas dígitos) */
  signer_cpf?: string;
  /** OTP WhatsApp verificado */
  otp_verified?: boolean;
  otp_verified_at?: string;
  /** Ex: cpf_whatsapp_otp */
  identity_verification_method?: string;
  terms_accepted?: boolean;
  terms_accepted_at?: string;
  /** Snapshot dos termos aceitos no momento da assinatura */
  accepted_terms_snapshot?: string | null;
  created_at: string;
}

export interface ContractStorageConfig {
  id: string;
  organization_id?: string;
  storage_type: StorageType; // Não usado mais (storage principal sempre é Supabase)
  config: Record<string, unknown>; // Não usado mais (storage principal sempre é Supabase)
  is_active: boolean; // Não usado mais (storage principal sempre é Supabase)
  // Campos de backup storage (opcional)
  backup_storage_type?: StorageType;
  backup_config?: Record<string, unknown>;
  backup_is_active?: boolean;
  created_at: string;
  updated_at: string;
}

// Variáveis disponíveis para templates
// Divididas em: Remetente (Empresa/Organização) e Destinatário (Cliente/Lead)

// Variáveis do DESTINATÁRIO (Cliente/Lead)
export const CONTRACT_VARIABLES_DESTINATARIO = {
  // Dados básicos
  nome: '{{nome}}',
  telefone: '{{telefone}}',
  email: '{{email}}',
  empresa: '{{empresa}}',
  cpf_cnpj: '{{cpf_cnpj}}',
  // Dados do funil
  valor: '{{valor}}',
  etapa_funil: '{{etapa_funil}}',
  status: '{{status}}',
  produto: '{{produto}}',
  // Dados adicionais
  origem: '{{origem}}',
  notas: '{{notas}}',
  data_criacao: '{{data_criacao}}',
  ultimo_contato: '{{ultimo_contato}}',
} as const;

// Variáveis do REMETENTE (Empresa/Organização)
export const CONTRACT_VARIABLES_REMETENTE = {
  // Dados básicos
  empresa_nome: '{{empresa_nome}}',
  empresa_cpf_cnpj: '{{empresa_cpf_cnpj}}',
  empresa_endereco: '{{empresa_endereco}}',
  empresa_cidade: '{{empresa_cidade}}',
  empresa_estado: '{{empresa_estado}}',
  empresa_perfil: '{{empresa_perfil}}',
  empresa_regime_tributario: '{{empresa_regime_tributario}}',
  empresa_tipo_negocio: '{{empresa_tipo_negocio}}',
  empresa_tagline: '{{empresa_tagline}}',
  // Redes sociais
  empresa_instagram: '{{empresa_instagram}}',
  empresa_facebook: '{{empresa_facebook}}',
  empresa_linkedin: '{{empresa_linkedin}}',
  empresa_twitter: '{{empresa_twitter}}',
  empresa_youtube: '{{empresa_youtube}}',
  empresa_website: '{{empresa_website}}',
} as const;

// Variáveis gerais do contrato
export const CONTRACT_VARIABLES_GERAIS = {
  data_hoje: '{{data_hoje}}',
  data_vencimento: '{{data_vencimento}}',
  numero_contrato: '{{numero_contrato}}',
} as const;

// Todas as variáveis (compatibilidade com código existente)
export const CONTRACT_VARIABLES = {
  ...CONTRACT_VARIABLES_DESTINATARIO,
  ...CONTRACT_VARIABLES_REMETENTE,
  ...CONTRACT_VARIABLES_GERAIS,
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
  details: Record<string, unknown>; // Detalhes adicionais da ação
  old_value?: Record<string, unknown>; // Valor anterior (para updates)
  new_value?: Record<string, unknown>; // Valor novo (para updates)
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
