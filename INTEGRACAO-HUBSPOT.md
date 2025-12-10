# 🔗 Integração HubSpot - Documentação Completa

## 📋 Visão Geral

Esta integração permite sincronizar contatos do HubSpot CRM com o sistema, importando automaticamente novos contatos e mantendo os dados atualizados através de webhooks.

### ✨ Funcionalidades

- ✅ Sincronização de contatos do HubSpot para o sistema
- ✅ Importação automática de novos contatos
- ✅ Atualização de contatos existentes
- ✅ Webhooks para sincronização em tempo real
- ✅ Mapeamento personalizado de campos
- ✅ Sincronização incremental (apenas contatos novos/atualizados)
- ✅ Suporte a paginação para grandes volumes
- ✅ Multi-tenancy (isolamento por organização)

---

## 🔐 Autenticação HubSpot

O HubSpot oferece duas formas de autenticação:

### 1. **Private App Access Token** (Recomendado - Mais Simples)

**Como Funciona:**
- Token único que não expira
- Ideal para integrações server-to-server
- Não requer OAuth

**Como Obter:**
1. Acesse [HubSpot Developer Portal](https://developers.hubspot.com/)
2. Vá em **Account Setup** > **Private Apps**
3. Clique em **Create a private app**
4. Dê um nome ao app (ex: "Agilize CRM Integration")
5. Configure os escopos necessários:
   - `crm.objects.contacts.read` - Ler contatos
   - `crm.objects.contacts.write` - Escrever contatos (opcional)
6. Copie o **Access Token** gerado

**Vantagens:**
- ✅ Configuração simples
- ✅ Token não expira
- ✅ Ideal para integrações internas

**Desvantagens:**
- ⚠️ Token único por conta HubSpot
- ⚠️ Se exposto, precisa ser regenerado

### 2. **OAuth 2.0** (Para Apps Públicos)

**Como Funciona:**
- Fluxo OAuth padrão
- Cada organização conecta sua própria conta HubSpot
- Tokens podem ser renovados automaticamente

**Como Configurar:**
1. Acesse [HubSpot Developer Portal](https://developers.hubspot.com/)
2. Crie um novo **App**
3. Configure OAuth:
   - Redirect URL: `https://[SEU-SUPABASE-URL]/functions/v1/hubspot-oauth-callback`
   - Scopes: `contacts`, `crm.objects.contacts.read`
4. Obtenha **Client ID** e **Client Secret**

**Vantagens:**
- ✅ Mais seguro (tokens por organização)
- ✅ Renovação automática
- ✅ Ideal para múltiplas organizações

**Desvantagens:**
- ⚠️ Requer implementação de OAuth
- ⚠️ Mais complexo de configurar

---

## 📡 API do HubSpot - Endpoints Principais

### 1. **Listar Contatos**

**Endpoint:** `GET /crm/v3/objects/contacts`

**Parâmetros:**
- `limit`: Número de resultados (padrão: 10, máximo: 100)
- `after`: Token de paginação
- `properties`: Propriedades a retornar (ex: `firstname,lastname,email,phone`)
- `associations`: Associações a incluir

**Exemplo de Requisição:**
```bash
GET https://api.hubapi.com/crm/v3/objects/contacts?limit=100&properties=firstname,lastname,email,phone,company
Authorization: Bearer {ACCESS_TOKEN}
```

**Resposta:**
```json
{
  "results": [
    {
      "id": "12345678",
      "properties": {
        "firstname": "João",
        "lastname": "Silva",
        "email": "joao@example.com",
        "phone": "+5511999999999",
        "company": "Empresa XYZ"
      },
      "createdAt": "2024-01-15T10:30:00.000Z",
      "updatedAt": "2024-01-20T14:20:00.000Z"
    }
  ],
  "paging": {
    "next": {
      "after": "abc123"
    }
  }
}
```

### 2. **Buscar Contato Específico**

**Endpoint:** `GET /crm/v3/objects/contacts/{contactId}`

### 3. **Criar Contato**

**Endpoint:** `POST /crm/v3/objects/contacts`

### 4. **Atualizar Contato**

**Endpoint:** `PATCH /crm/v3/objects/contacts/{contactId}`

---

## 🗂️ Propriedades Padrão de Contatos HubSpot

### Propriedades Básicas
- `firstname` - Nome
- `lastname` - Sobrenome
- `email` - Email
- `phone` - Telefone
- `company` - Empresa
- `website` - Website
- `jobtitle` - Cargo
- `lifecyclestage` - Estágio do ciclo de vida
- `hubspot_owner_id` - ID do proprietário

### Propriedades de Data
- `createdate` - Data de criação
- `lastmodifieddate` - Última modificação
- `closedate` - Data de fechamento

### Propriedades Customizadas
- Qualquer propriedade customizada criada no HubSpot
- Formato: `custom_property_name`

**Documentação Completa:** [HubSpot Contact Properties](https://developers.hubspot.com/docs/api/crm/contacts)

---

## 🔄 Webhooks HubSpot

### Eventos Disponíveis

O HubSpot permite configurar webhooks para os seguintes eventos:

- `contact.creation` - Novo contato criado
- `contact.propertyChange` - Propriedade de contato alterada
- `contact.deletion` - Contato deletado
- `contact.privacyDeletion` - Contato deletado por privacidade

### Configuração de Webhook

1. Acesse **Settings** > **Integrations** > **Private Apps** no HubSpot
2. Selecione seu app
3. Vá em **Webhooks**
4. Adicione URL: `https://[SEU-SUPABASE-URL]/functions/v1/hubspot-webhook`
5. Selecione os eventos desejados

**Formato do Webhook:**
```json
{
  "subscriptionId": 12345,
  "portalId": 123456,
  "occurredAt": 1234567890,
  "subscriptionType": "contact.creation",
  "eventId": "abc123",
  "objectId": 12345678,
  "properties": {
    "firstname": "João",
    "lastname": "Silva",
    "email": "joao@example.com"
  }
}
```

---

## 🗄️ Estrutura do Banco de Dados

### Tabela: `hubspot_configs`

Armazena as configurações de integração por organização:

```sql
CREATE TABLE hubspot_configs (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL,
  access_token TEXT NOT NULL,  -- Token de acesso
  portal_id TEXT,              -- ID do portal HubSpot (opcional)
  is_active BOOLEAN DEFAULT true,
  last_sync_at TIMESTAMPTZ,    -- Última sincronização
  sync_settings JSONB,         -- Configurações de sincronização
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

### Tabela: `hubspot_contact_sync` (Opcional)

Rastreia sincronizações individuais:

```sql
CREATE TABLE hubspot_contact_sync (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL,
  hubspot_contact_id TEXT NOT NULL,
  lead_id UUID REFERENCES leads(id),
  last_synced_at TIMESTAMPTZ,
  sync_status TEXT,  -- 'success', 'error', 'pending'
  error_message TEXT,
  UNIQUE(organization_id, hubspot_contact_id)
);
```

---

## 🔄 Fluxo de Sincronização

### 1. Sincronização Manual

1. Usuário clica em "Sincronizar Contatos"
2. Sistema busca configuração HubSpot da organização
3. Faz requisição à API do HubSpot com paginação
4. Para cada contato:
   - Mapeia campos HubSpot → Sistema
   - Verifica se lead já existe (por email ou telefone)
   - Cria novo lead ou atualiza existente
5. Salva timestamp da última sincronização

### 2. Sincronização Automática (Webhook)

1. HubSpot envia webhook quando contato é criado/atualizado
2. Edge Function recebe webhook
3. Valida assinatura (se configurado)
4. Busca ou cria lead correspondente
5. Atualiza dados do lead

### 3. Sincronização Incremental

- Usa `last_sync_at` para buscar apenas contatos modificados
- Filtra por `lastmodifieddate` na API do HubSpot
- Mais eficiente para grandes volumes

---

## 📊 Mapeamento de Campos

### Mapeamento Padrão HubSpot → Sistema

| HubSpot | Sistema | Tipo |
|---------|---------|------|
| `firstname` + `lastname` | `name` | String (concatenação) |
| `email` | `email` | String |
| `phone` | `phone` | String (normalizado) |
| `company` | `company` | String |
| `lifecyclestage` | `status` | String (mapeado) |
| `hubspot_owner_id` | `assigned_to` | String |
| `createdate` | `created_at` | Timestamp |
| `lastmodifieddate` | `updated_at` | Timestamp |

### Mapeamento de Status

| HubSpot Lifecycle Stage | Sistema Status |
|------------------------|----------------|
| `subscriber` | `new` |
| `lead` | `new` |
| `marketingqualifiedlead` | `new` |
| `salesqualifiedlead` | `contacted` |
| `opportunity` | `qualified` |
| `customer` | `won` |
| `evangelist` | `won` |

---

## 🚀 Configuração Inicial

### Passo 1: Obter Token de Acesso

1. Acesse [HubSpot Developer Portal](https://developers.hubspot.com/)
2. Crie um Private App
3. Configure escopos: `crm.objects.contacts.read`
4. Copie o Access Token

### Passo 2: Configurar no Sistema

1. Acesse **Configurações** > **Integrações** > **HubSpot**
2. Cole o Access Token
3. (Opcional) Configure Portal ID
4. Clique em **Salvar**
5. Teste a conexão

### Passo 3: Configurar Webhook (Opcional)

1. No HubSpot, vá em **Settings** > **Integrations** > **Private Apps**
2. Selecione seu app
3. Adicione webhook URL
4. Selecione eventos: `contact.creation`, `contact.propertyChange`

---

## 📝 Limites e Considerações

### Limites da API HubSpot

- **Rate Limit:** 100 requests/10 segundos (por portal)
- **Batch Size:** Máximo 100 contatos por requisição
- **Pagination:** Usar `after` token para próximas páginas

### Boas Práticas

1. **Implementar Rate Limiting:** Respeitar limites da API
2. **Usar Paginação:** Processar em lotes
3. **Sincronização Incremental:** Evitar buscar todos os contatos sempre
4. **Tratamento de Erros:** Logs detalhados para debugging
5. **Validação de Dados:** Validar antes de inserir no banco

---

## 🔍 O que Mais Pode Ser Integrado

Além de contatos, o HubSpot oferece APIs para:

### 1. **Companies (Empresas)**
- Endpoint: `/crm/v3/objects/companies`
- Útil para enriquecer dados de leads com informações da empresa

### 2. **Deals (Oportunidades)**
- Endpoint: `/crm/v3/objects/deals`
- Sincronizar oportunidades de venda

### 3. **Tickets (Chamados)**
- Endpoint: `/crm/v3/objects/tickets`
- Integrar sistema de suporte

### 4. **Engagements (Interações)**
- Endpoint: `/engagements/v1/engagements`
- Histórico de emails, ligações, reuniões

### 5. **Lists (Listas)**
- Endpoint: `/contacts/v1/lists`
- Sincronizar listas de marketing

### 6. **Workflows**
- Endpoint: `/automation/v3/workflows`
- Integrar automações do HubSpot

---

## 📚 Referências

- [HubSpot API Documentation](https://developers.hubspot.com/docs/api/overview)
- [Contacts API](https://developers.hubspot.com/docs/api/crm/contacts)
- [Webhooks Guide](https://developers.hubspot.com/docs/api/webhooks)
- [Rate Limits](https://developers.hubspot.com/docs/api/rate-limits)
- [Contact Properties](https://developers.hubspot.com/docs/api/crm/contacts#properties)

---

## ✅ Checklist de Implementação

- [x] Documentação completa
- [ ] Migration SQL para `hubspot_configs`
- [ ] Edge Function: `hubspot-sync-contacts`
- [ ] Edge Function: `hubspot-webhook`
- [ ] Edge Function: `hubspot-test-connection`
- [ ] Hook React: `useHubSpotConfigs`
- [ ] Componente React: `HubSpotIntegrationPanel`
- [ ] Atualizar `useIntegrationStatus`
- [ ] Testes de integração

---

**Última Atualização:** 2024-01-XX

