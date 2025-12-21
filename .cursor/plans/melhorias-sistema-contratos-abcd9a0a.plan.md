<!-- abcd9a0a-bf77-4b62-9019-987a6a3a4c57 462880f2-e3fc-4354-8208-12bfe0cedd32 -->
# Melhorias no Módulo de Contratos

## Objetivo

Implementar 5 melhorias principais no módulo de contratos:

1. Upload de imagem de assinatura (PNG/JPG) além do desenho com mouse
2. Builder visual de PDF para marcar posições de assinatura
3. Indicador de contratos criados no mês
4. Envio de contrato assinado para cliente (link de download)
5. Integração Google Drive OAuth individual por cliente

---

## 1. Upload de Imagem de Assinatura

### Arquivos a modificar:

- `src/components/contracts/SignatureCanvas.tsx` - Adicionar opção de upload de imagem
- `src/components/contracts/ContractSignatureDialog.tsx` - Adicionar toggle entre desenho/upload
- `src/pages/SignContract.tsx` - Adicionar opção de upload para cliente

### Implementação:

- Adicionar botão "Upload Imagem" ao lado de "Desenhar Assinatura"
- Aceitar apenas PNG/JPG (validar tipo MIME)
- Converter imagem para base64 PNG antes de salvar
- Redimensionar imagem se muito grande (máx 800x300px)
- Manter compatibilidade com assinatura desenhada (canvas)

---

## 2. Builder Visual de PDF

### Arquivos a criar:

- `src/components/contracts/ContractPdfBuilder.tsx` - Componente principal do builder
- `src/lib/pdfAnnotationUtils.ts` - Utilitários para anotar PDF

### Arquivos a modificar:

- `src/pages/Contracts.tsx` - Adicionar botão "Configurar Assinaturas" no contrato
- `src/lib/contractPdfGenerator.ts` - Modificar para usar posições definidas no builder

### Implementação:

- Upload de PDF via input file
- Renderizar PDF usando `react-pdf` ou `pdfjs-dist`
- Permitir clicar no PDF para marcar posições de assinatura
- Salvar posições (x, y, página) em `contract_signature_positions` (nova tabela)
- Suportar múltiplas assinaturas (usuário, cliente, rubrica)
- Visualizar preview das posições marcadas
- Ao gerar PDF final, inserir assinaturas nas posições definidas

### Nova tabela SQL:

```sql
CREATE TABLE contract_signature_positions (
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
```

---

## 3. Indicador de Contratos do Mês

### Arquivos a modificar:

- `src/pages/Contracts.tsx` - Adicionar card de estatísticas no topo
- `src/hooks/useContracts.ts` - Adicionar query para contar contratos do mês

### Implementação:

- Query SQL: `COUNT(*) WHERE created_at >= inicio_do_mes AND created_at <= fim_do_mes`
- Exibir card destacado com:
  - Número de contratos criados no mês atual
  - Comparação com mês anterior (↑ ou ↓)
  - Gráfico simples (opcional)
- Posicionar no topo da página, antes da lista de contratos

---

## 4. Envio de Contrato Assinado

### Arquivos a criar:

- `src/components/contracts/SendContractDialog.tsx` - Dialog para enviar contrato
- `supabase/functions/send-contract-signed/index.ts` - Edge function para envio

### Arquivos a modificar:

- `src/pages/Contracts.tsx` - Adicionar botão "Enviar ao Cliente" (só aparece se assinado)
- `src/components/contracts/ContractViewer.tsx` - Adicionar botão de envio
- `src/hooks/useContracts.ts` - Adicionar função `sendContractToClient`

### Implementação:

- Verificar se contrato tem ambas assinaturas (user + client)
- Se não tiver, mostrar erro e não permitir envio
- Gerar link de download permanente (não expira)
- Opções de envio:
  - WhatsApp: usar Evolution API (se configurado)
  - Email: usar serviço de email (Resend/SendGrid)
- Mensagem padrão: "Seu contrato assinado está disponível para download: [link]"
- Salvar log de envio em `contract_send_logs` (nova tabela)

### Nova tabela SQL:

```sql
CREATE TABLE contract_send_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  sent_via text NOT NULL CHECK (sent_via IN ('whatsapp', 'email')),
  recipient_phone text,
  recipient_email text,
  download_link text NOT NULL,
  sent_at timestamptz DEFAULT now(),
  sent_by uuid REFERENCES auth.users(id)
);
```

---

## 5. Integração Google Drive OAuth Individual

### Arquivos a criar:

- `src/services/contractStorage/GoogleDriveStorageService.ts` - Implementação Google Drive
- `src/components/contracts/GoogleDriveConnectDialog.tsx` - Dialog para conectar Google Drive
- `supabase/functions/google-drive-oauth-init/index.ts` - Iniciar OAuth
- `supabase/functions/google-drive-oauth-callback/index.ts` - Callback OAuth
- `src/hooks/useGoogleDriveOAuth.ts` - Hook para gerenciar OAuth

### Arquivos a modificar:

- `src/services/contractStorage/StorageFactory.ts` - Adicionar suporte a Google Drive
- `src/services/contractStorage/BackupService.ts` - Usar Google Drive se cliente conectado
- `src/components/contracts/ContractViewer.tsx` - Adicionar botão "Salvar no Google Drive"

### Nova tabela SQL:

```sql
CREATE TABLE client_google_drive_configs (
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
```

### Implementação:

- OAuth flow similar ao Gmail (usar `gmail-oauth-init` como base)
- Escopos necessários: `https://www.googleapis.com/auth/drive.file`
- Após OAuth, criar pasta no Google Drive do cliente: "Contratos [Nome da Empresa]"
- Salvar `folder_id` para usar em uploads futuros
- Ao fazer backup, verificar se cliente tem Google Drive conectado
- Se sim, fazer upload para pasta do cliente no Google Drive
- Se não, usar backup configurado pelo Super Admin (Supabase/Firebase/S3)

### Fluxo de Backup:

1. Contrato assinado → **SEMPRE salvar no Supabase primeiro** (storage principal obrigatório)
2. Verificar se cliente tem Google Drive conectado
3. Se SIM → Upload **ADICIONAL** para Google Drive do cliente (backup extra/redundante)
4. Se backup storage configurado (Firebase/S3) → Upload **ADICIONAL** também (backup redundante)

**IMPORTANTE:**

- Supabase é **sempre** o storage principal (obrigatório)
- Google Drive e outros storages são backups **adicionais/redundantes**
- Mesmo que cliente tenha Google Drive, o contrato **sempre** fica salvo no Supabase

---

## Migrações SQL Necessárias

### Arquivo: `supabase/migrations/20250122000001_add_contract_improvements.sql`

```sql
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
  download_link text NOT NULL,
  expires_at timestamptz NOT NULL,
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
CREATE POLICY "Users can view GDrive configs for their org leads"
  ON client_google_drive_configs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = client_google_drive_configs.organization_id
        AND om.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage GDrive configs for their org leads"
  ON client_google_drive_configs FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = client_google_drive_configs.organization_id
        AND om.user_id = auth.uid()
    )
  );
```

---

## Dependências NPM Necessárias

```json
{
  "react-pdf": "^7.5.1",
  "pdfjs-dist": "^3.11.174",
  "
  
googleapis": "^128.0.0"
}
```

---

## Ordem de Implementação Recomendada

1. **Upload de Imagem de Assinatura** (mais simples, base para outras)
2. **Indicador de Contratos do Mês** (estatística simples)
3. **Envio de Contrato Assinado** (funcionalidade independente)
4. **Builder Visual de PDF** (mais complexo, requer bibliotecas PDF)
5. **Integração Google Drive** (mais complexo, requer OAuth e APIs)

---

## Notas Importantes

- Manter compatibilidade com funcionalidades existentes
- Todas as novas tabelas devem ter RLS habilitado
- Google Drive OAuth deve seguir padrão do Gmail OAuth existente
- Builder de PDF deve funcionar offline (sem servidor)
- Links de download devem expirar após 7 dias por segurança
- Validar sempre se contrato está assinado antes de enviar

### To-dos

- [ ] Adicionar opção de upload de imagem (PNG/JPG) no SignatureCanvas além do desenho com mouse
- [ ] Modificar ContractSignatureDialog para ter toggle entre desenho e upload de imagem
- [ ] Adicionar indicador destacado de contratos criados no mês atual na página Contracts
- [ ] Criar SendContractDialog para enviar contrato assinado via WhatsApp/Email com link de download
- [ ] Criar edge function send-contract-signed para gerar link temporário e enviar via WhatsApp/Email
- [ ] Criar ContractPdfBuilder para upload de PDF e marcar posições de assinatura clicando no PDF
- [ ] Integrar builder de PDF com contractPdfGenerator para usar posições definidas ao gerar PDF final
- [ ] Criar GoogleDriveStorageService implementando StorageService para upload no Google Drive
- [ ] Criar edge functions e hooks para OAuth do Google Drive individual por cliente
- [ ] Integrar Google Drive no BackupService para salvar contratos na pasta do cliente quando conectado
- [ ] Criar migration SQL com tabelas: contract_signature_positions, contract_send_logs, client_google_drive_configs