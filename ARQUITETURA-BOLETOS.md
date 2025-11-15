# 🏗️ Arquitetura: Geração de Boletos

## 🎯 Visão Geral

```
┌─────────────────────────────────────────────────────────────────┐
│                    INTERFACE DO USUÁRIO                         │
│  PeriodicWorkflows > WorkflowFormDrawer > AsaasBoletoForm       │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
        ┌──────────────────────────────────┐
        │    useAsaasBoletos Hook          │
        │  (React Query + Supabase Client) │
        └────────────────┬─────────────────┘
                         │
                         ▼
        ┌──────────────────────────────────┐
        │   Supabase Functions Client      │
        │  invoke("asaas-create-boleto")   │
        └────────────────┬─────────────────┘
                         │
                         ▼
        ┌──────────────────────────────────┐
        │   Edge Function (Deno)           │
        │  asaas-create-boleto/index.ts    │
        └────────────────┬─────────────────┘
                         │
        ┌────────────────┼────────────────┐
        │                │                │
        ▼                ▼                ▼
    ┌─────────┐  ┌──────────────┐  ┌──────────────┐
    │ Supabase│  │   Asaas API  │  │   Asaas PDF  │
    │Database │  │  (Payments)  │  │  Generator   │
    └─────────┘  └──────────────┘  └──────────────┘
        │                │                │
        └────────────────┼────────────────┘
                         │
                         ▼
    ┌──────────────────────────────────────┐
    │   Supabase Client (Frontend)          │
    │   Recebe sucesso + URLs + Dados      │
    └──────────────────┬───────────────────┘
                       │
                       ▼
         ┌──────────────────────────────┐
         │  Exibe Confirmação           │
         │  Downloads PDF/Link          │
         │  Atualiza Lista de Boletos   │
         └──────────────────────────────┘
```

---

## 📊 Estrutura de Dados

### 1. Banco de Dados (Supabase PostgreSQL)

```
whatsapp_boletos
├── id (uuid)
├── organization_id (uuid) → organizations
├── lead_id (uuid) → leads
├── workflow_id (uuid) → whatsapp_workflows
├── scheduled_message_id (uuid) → scheduled_messages
├── asaas_payment_id (text, UNIQUE)
├── asaas_customer_id (text)
├── valor (decimal)
├── data_vencimento (date)
├── boleto_url (text)
├── boleto_pdf_url (text)
├── codigo_barras (text)
├── linha_digitavel (text)
├── status (text) → pending/open/paid/cancelled/overdue/refunded
├── criado_em (timestamp)
└── atualizado_em (timestamp)

Índices:
├── idx_whatsapp_boletos_org
├── idx_whatsapp_boletos_lead
├── idx_whatsapp_boletos_workflow
└── idx_whatsapp_boletos_asaas_payment_id

RLS Policies:
├── SELECT: apenas membros da org
├── INSERT: apenas membros da org
└── UPDATE: apenas membros da org
```

### 2. API Asaas

```
Customers (Clientes)
├── GET /customers?email=...
└── POST /customers
    ├── name
    ├── cpfCnpj
    ├── email
    └── mobilePhone

Payments (Boletos)
├── POST /payments
│   ├── customer (ID do cliente)
│   ├── billingType: "BOLETO"
│   ├── value
│   ├── dueDate
│   ├── description
│   └── externalReference
└── GET /payments/{id}/pdf
    └── { url: "..." }
```

### 3. Response do Asaas

```json
{
  "id": "cus_xxxxx",
  "dateCreated": "2025-01-15T10:30:00Z",
  "customer": "pay_xxxxx",
  "paymentLink": "https://asaas.com/payment/...",
  "invoiceUrl": "https://asaas.com/invoice/...",
  "billingType": "BOLETO",
  "value": 500.50,
  "netValue": 495.50,
  "dueDate": "2025-02-28",
  "status": "PENDING",
  "description": "Cobrança via workflow",
  "bankSlipUrl": "https://asaas.com/boleto/...",
  "barCode": "12345.67890 12345.678901 12345.678901 1 12345678901234",
  "nossoNumero": "123456789",
  "externalReference": "WF-uuid"
}
```

---

## 🔄 Fluxo de Dados Completo

### Cenário: Usuário Gera Boleto Manual

```
1. INTERFACE
   ├─ Usuário abre AsaasBoletoForm
   ├─ Preenche: valor, vencimento, descrição
   └─ Clica "Gerar Boleto"

2. HOOK (useAsaasBoletos)
   ├─ Valida dados localmente
   ├─ Prepara payload
   └─ Chama supabase.functions.invoke()

3. EDGE FUNCTION (Servidor)
   ├─ Recebe payload
   ├─ Valida organizationId
   ├─ Busca config Asaas do banco
   ├─ Procura cliente no Asaas
   │  ├─ Se não encontrar
   │  └─ Cria novo cliente
   ├─ Cria boleto (billingType: BOLETO)
   ├─ Gera PDF via Asaas
   └─ Insere em whatsapp_boletos

4. BANCO DE DADOS (Supabase)
   ├─ Insere registro em whatsapp_boletos
   ├─ RLS verifica permissão
   └─ Retorna dados completos

5. RESPOSTA AO CLIENTE
   ├─ JSON com sucesso
   ├─ URLs (PDF, boleto)
   ├─ Dados do boleto
   └─ Status: PENDING

6. INTERFACE (React Query)
   ├─ Recebe resposta
   ├─ Invalida cache
   ├─ Exibe confirmação
   ├─ Botões de download
   └─ Atualiza tabela
```

---

## 🔐 Segurança

### Multi-Tenancy

```
┌─ Organization A
│  ├─ User 1 → vê apenas boletos da Org A
│  ├─ User 2 → vê apenas boletos da Org A
│  └─ whatsapp_boletos.organization_id = A
│
└─ Organization B
   ├─ User 3 → vê apenas boletos da Org B
   ├─ User 4 → vê apenas boletos da Org B
   └─ whatsapp_boletos.organization_id = B
```

### RLS Policies

```sql
-- SELECT: Membro da org OU admin OU pubdigital user
WHERE organization_id IN (
  SELECT organization_id FROM organization_members 
  WHERE user_id = auth.uid()
)

-- INSERT: Mesma lógica
WITH CHECK (
  organization_id IN (
    SELECT organization_id FROM organization_members 
    WHERE user_id = auth.uid()
  )
)

-- UPDATE: Mesma lógica
USING (...)
WITH CHECK (...)
```

### API Key Asaas

```
Armazenamento:
├─ Tabela: asaas_configs
├─ Campo: api_key (sensível)
└─ Acesso: Apenas via Edge Function

Uso:
├─ Frontend: NUNCA vê a chave
├─ Edge Function: Busca da tabela
├─ Asaas API: Recebe via header
└─ Resposta: Não inclui a chave
```

---

## 📈 Performance

### Índices Otimizados

```
CREATE INDEX idx_whatsapp_boletos_org
  ON whatsapp_boletos (organization_id);
  
CREATE INDEX idx_whatsapp_boletos_lead
  ON whatsapp_boletos (lead_id);

CREATE INDEX idx_whatsapp_boletos_workflow
  ON whatsapp_boletos (workflow_id);

CREATE INDEX idx_whatsapp_boletos_asaas_payment_id
  ON whatsapp_boletos (asaas_payment_id UNIQUE);
```

### Queries Esperadas

```
-- Listar boletos da org
SELECT * FROM whatsapp_boletos 
WHERE organization_id = ?
ORDER BY criado_em DESC
→ Usa índice: idx_whatsapp_boletos_org

-- Boletos de um lead
SELECT * FROM whatsapp_boletos 
WHERE organization_id = ? AND lead_id = ?
→ Usa índice: idx_whatsapp_boletos_lead

-- Boletos de um workflow
SELECT * FROM whatsapp_boletos 
WHERE organization_id = ? AND workflow_id = ?
→ Usa índice: idx_whatsapp_boletos_workflow

-- Buscar por ID Asaas
SELECT * FROM whatsapp_boletos 
WHERE asaas_payment_id = ?
→ Usa índice: idx_whatsapp_boletos_asaas_payment_id (UNIQUE)
```

---

## 🧪 Testes

### Testes Unitários

```typescript
// Hook: useAsaasBoletos
test("createBoleto", async () => {
  const { createBoleto } = useAsaasBoletos();
  const result = await createBoleto({...});
  expect(result.boleto.id).toBeDefined();
});

// Componente: AsaasBoletoForm
test("renders form", () => {
  render(<AsaasBoletoForm leadId="..." />);
  expect(screen.getByText("Gerar Boleto")).toBeInTheDocument();
});

// Edge Function: asaas-create-boleto
test("creates boleto", async () => {
  const response = await createBoleto({...});
  expect(response.success).toBe(true);
});
```

### Testes de Integração

```
1. Criar boleto manual
   ✓ Valida dados
   ✓ Cria cliente no Asaas
   ✓ Cria boleto
   ✓ Gera PDF
   ✓ Salva no banco

2. Listar boletos
   ✓ Filtra por lead
   ✓ Filtra por workflow
   ✓ Respeita RLS

3. Download
   ✓ PDF disponível
   ✓ Link funciona
```

---

## 🚨 Tratamento de Erros

### Cenários de Erro

```
1. API Key não configurada
   └─ Edge Function retorna: { error: "Config not found" }

2. Cliente inválido
   └─ Asaas retorna: { error: "Invalid customer" }
   └─ Edge Function retorna: { error: "Failed to create customer" }

3. Boleto não criado
   └─ Asaas retorna: { error: "Invalid payment" }
   └─ Edge Function retorna: { error: "Failed to create boleto" }

4. PDF não gera
   └─ Asaas retorna: { error: "PDF generation failed" }
   └─ Edge Function continua (graceful fallback)

5. Banco de dados falha
   └─ Edge Function retorna: { error: "Database error" }
   └─ Status: 201 com payment (boleto criado no Asaas)
```

### Logs

```typescript
// Edge Function registra:
console.log("Boleto criado:", paymentData.id);
console.log("PDF URL:", boleoPdfUrl);
console.error("Erro ao criar boleto:", error);

// Supabase > Edge Functions > Logs
// Busque por "asaas-create-boleto" para ver erros
```

---

## 📞 Integração com Sistemas

### Com Workflows

```
Workflow (cobranca) criado
    ↓
    ├─ Se automático:
    │  └─ Para cada lead → Cria boleto automaticamente
    │
    └─ Se manual:
       └─ Usuário clica "Gerar Boleto" → AsaasBoletoForm
```

### Com WhatsApp

```
Boleto criado
    ↓
    ├─ Guardar boleto_url ou boleto_pdf_url
    ├─ Enviar via WhatsApp:
    │  ├─ Texto: "Seu boleto está pronto"
    │  └─ PDF: Anexo do boleto
    │
    └─ Usuário clica para pagar
```

### Com CRM

```
Lead com boleto
    ├─ Página do lead mostra <BoletosList leadId={lead.id} />
    ├─ Lista todos os boletos daquele cliente
    ├─ Downloads e status visíveis
    └─ Histórico completo de cobranças
```

---

## 🔄 Sincronização de Status

```
Fluxo futuro (pode ser adicionado):

1. Webhook Asaas → Supabase
   └─ Notifica quando boleto é pago

2. Supabase trigger
   └─ Atualiza status em whatsapp_boletos

3. Frontend percebe mudança
   └─ Via Realtime do Supabase
   └─ Atualiza UI em tempo real

Exemplo de payload webhook:
{
  "event": "PAYMENT_CONFIRMED",
  "payment": {
    "id": "pay_xxxxx",
    "status": "RECEIVED",
    "value": 500.50
  }
}
```

---

## 📊 Métricas

### Para Monitorar

```
1. Taxa de sucesso
   = (Boletos criados) / (Tentativas) * 100

2. Tempo médio de criação
   = Soma de durações / Quantidade

3. Boletos por organização
   = COUNT(whatsapp_boletos) GROUP BY organization_id

4. Status de boletos
   = COUNT(*) GROUP BY status

5. Erros por tipo
   = COUNT(erros) GROUP BY tipo_erro
```

### Dashboard Supabase

```sql
-- Total de boletos
SELECT COUNT(*) FROM whatsapp_boletos;

-- Por organização
SELECT organization_id, COUNT(*) FROM whatsapp_boletos 
GROUP BY organization_id;

-- Por status
SELECT status, COUNT(*) FROM whatsapp_boletos 
GROUP BY status;

-- Valor total
SELECT SUM(valor) FROM whatsapp_boletos 
WHERE status = 'paid';
```

---

**Arquitetura completa documentada. Pronto para implementação!**

