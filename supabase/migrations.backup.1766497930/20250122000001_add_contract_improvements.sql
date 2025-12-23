-- Tabela de posições de assinatura no PDF
CREATE TABLE IF NOT EXISTS contract_signature_positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  signer_type text NOT NULL CHECK (signer_type IN ('user', 'client', 'rubric')),
  page_number integer NOT NULL,
  x_position real NOT NULL,
  y_position real NOT NULL,
  width real DEFAULT 60,
  height real DEFAULT 30,
  created_at timestamptz DEFAULT now()
);

-- Tabela de logs de envio de contratos
CREATE TABLE IF NOT EXISTS contract_send_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  sent_via text NOT NULL CHECK (sent_via IN ('whatsapp', 'email')),
  recipient_phone text,
  recipient_email text,
  download_link text NOT NULL,  -- Link permanente, não expira
  sent_at timestamptz DEFAULT now(),
  sent_by uuid REFERENCES auth.users(id)
);

-- Tabela de configurações Google Drive por cliente
CREATE TABLE IF NOT EXISTS client_google_drive_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  access_token text NOT NULL,
  refresh_token text NOT NULL,
  token_expires_at timestamptz NOT NULL,
  google_email text,
  google_drive_folder_id text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(lead_id, organization_id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_contract_signature_positions_contract ON contract_signature_positions(contract_id);
CREATE INDEX IF NOT EXISTS idx_contract_send_logs_contract ON contract_send_logs(contract_id);
CREATE INDEX IF NOT EXISTS idx_client_gdrive_configs_lead ON client_google_drive_configs(lead_id, organization_id);

-- RLS Policies
ALTER TABLE contract_signature_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_send_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_google_drive_configs ENABLE ROW LEVEL SECURITY;

-- Policies para contract_signature_positions
DROP POLICY IF EXISTS "Users can view signature positions for their org contracts" ON contract_signature_positions;
CREATE POLICY "Users can view signature positions for their org contracts"
  ON contract_signature_positions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM contracts c
      JOIN organization_members om ON om.organization_id = c.organization_id
      WHERE c.id = contract_signature_positions.contract_id
        AND om.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can manage signature positions for their org contracts" ON contract_signature_positions;
CREATE POLICY "Users can manage signature positions for their org contracts"
  ON contract_signature_positions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM contracts c
      JOIN organization_members om ON om.organization_id = c.organization_id
      WHERE c.id = contract_signature_positions.contract_id
        AND om.user_id = auth.uid()
    )
  );

-- Policies para contract_send_logs
DROP POLICY IF EXISTS "Users can view send logs for their org contracts" ON contract_send_logs;
CREATE POLICY "Users can view send logs for their org contracts"
  ON contract_send_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM contracts c
      JOIN organization_members om ON om.organization_id = c.organization_id
      WHERE c.id = contract_send_logs.contract_id
        AND om.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can create send logs for their org contracts" ON contract_send_logs;
CREATE POLICY "Users can create send logs for their org contracts"
  ON contract_send_logs FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM contracts c
      JOIN organization_members om ON om.organization_id = c.organization_id
      WHERE c.id = contract_send_logs.contract_id
        AND om.user_id = auth.uid()
    )
  );

-- Policies para client_google_drive_configs
DROP POLICY IF EXISTS "Users can view GDrive configs for their org leads" ON client_google_drive_configs;
CREATE POLICY "Users can view GDrive configs for their org leads"
  ON client_google_drive_configs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = client_google_drive_configs.organization_id
        AND om.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can manage GDrive configs for their org leads" ON client_google_drive_configs;
CREATE POLICY "Users can manage GDrive configs for their org leads"
  ON client_google_drive_configs FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = client_google_drive_configs.organization_id
        AND om.user_id = auth.uid()
    )
  );

