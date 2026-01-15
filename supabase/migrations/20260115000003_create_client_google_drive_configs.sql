-- Tabela de configurações Google Drive por cliente
-- Permite que cada cliente tenha seu próprio Google Drive conectado para backup de contratos

CREATE TABLE IF NOT EXISTS client_google_drive_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  access_token text NOT NULL,
  refresh_token text NOT NULL,
  token_expires_at timestamptz NOT NULL,
  google_email text,
  google_drive_folder_id text, -- ID da pasta criada no Google Drive do cliente
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(lead_id, organization_id)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_client_gdrive_configs_lead ON client_google_drive_configs(lead_id, organization_id);
CREATE INDEX IF NOT EXISTS idx_client_gdrive_configs_active ON client_google_drive_configs(is_active) WHERE is_active = true;

-- RLS Policies
ALTER TABLE client_google_drive_configs ENABLE ROW LEVEL SECURITY;

-- Policy: Usuários podem ver configurações de Google Drive dos leads de sua organização
CREATE POLICY "Users can view GDrive configs for their org leads"
  ON client_google_drive_configs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = client_google_drive_configs.organization_id
        AND om.user_id = auth.uid()
    )
  );

-- Policy: Usuários podem gerenciar configurações de Google Drive dos leads de sua organização
CREATE POLICY "Users can manage GDrive configs for their org leads"
  ON client_google_drive_configs FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = client_google_drive_configs.organization_id
        AND om.user_id = auth.uid()
    )
  );

-- Comentários para documentação
COMMENT ON TABLE client_google_drive_configs IS 'Configurações de Google Drive por cliente (lead). Cada cliente pode ter seu próprio Google Drive conectado para backup de contratos.';
COMMENT ON COLUMN client_google_drive_configs.lead_id IS 'ID do lead/cliente que possui o Google Drive';
COMMENT ON COLUMN client_google_drive_configs.organization_id IS 'ID da organização (para isolamento multi-tenant)';
COMMENT ON COLUMN client_google_drive_configs.access_token IS 'Token de acesso do Google OAuth (expira em ~1 hora)';
COMMENT ON COLUMN client_google_drive_configs.refresh_token IS 'Token de refresh para renovar access_token';
COMMENT ON COLUMN client_google_drive_configs.token_expires_at IS 'Data/hora de expiração do access_token';
COMMENT ON COLUMN client_google_drive_configs.google_email IS 'Email da conta Google conectada';
COMMENT ON COLUMN client_google_drive_configs.google_drive_folder_id IS 'ID da pasta criada no Google Drive do cliente para armazenar contratos';
COMMENT ON COLUMN client_google_drive_configs.is_active IS 'Indica se a configuração está ativa (pode ser desativada sem deletar)';
