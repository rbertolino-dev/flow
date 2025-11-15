# 📋 Geração Automática de Boletos com Asaas

## 📌 Visão Geral

Este documento descreve como a geração de boletos bancários foi integrada ao sistema de workflows automatizados usando a API do Asaas.

## ✨ Funcionalidades

### 1. Geração Automática de Boletos
- Criar boletos diretamente na interface
- Download automático do PDF
- Link do boleto para compartilhamento
- Código de barras e linha digitável

### 2. Rastreamento de Boletos
- Tabela `whatsapp_boletos` para registrar todos os boletos
- Associação com leads, workflows e mensagens
- Histórico completo de cobranças

### 3. Gerenciamento
- Listar boletos por lead ou workflow
- Atualizar status automaticamente
- Deletar boletos se necessário
- Visualizar PDFs e links

---

## 🔧 Arquitetura Técnica

### Banco de Dados

#### Tabela: `whatsapp_boletos`

```sql
CREATE TABLE public.whatsapp_boletos (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  lead_id uuid NOT NULL,
  workflow_id uuid,
  scheduled_message_id uuid,
  asaas_payment_id text UNIQUE NOT NULL,
  asaas_customer_id text NOT NULL,
  valor decimal(10, 2) NOT NULL,
  data_vencimento date NOT NULL,
  descricao text,
  referencia_externa text,
  boleto_url text,
  boleto_pdf_url text,
  linha_digitavel text,
  codigo_barras text,
  nosso_numero text,
  status text,
  data_pagamento date,
  valor_pago decimal(10, 2),
  criado_por uuid,
  criado_em timestamptz,
  atualizado_em timestamptz
);
```

**Campos-chave:**
- `asaas_payment_id`: ID único do pagamento no Asaas
- `boleto_pdf_url`: URL para download do PDF
- `status`: Estado do boleto (pending, open, paid, cancelled, overdue, refunded)

---

### Edge Functions

#### 1. `asaas-create-boleto`

**Objetivo:** Criar um boleto no Asaas e registrar no banco de dados

**Endpoint:** `/functions/asaas-create-boleto`

**Requisição:**
```typescript
interface CreateBoletoPayload {
  organizationId: string;
  leadId: string;
  workflowId?: string;
  scheduledMessageId?: string;
  customer: {
    name: string;
    cpfCnpj?: string;
    email?: string;
    phone?: string;
  };
  boleto: {
    valor: number;
    dataVencimento: string; // yyyy-MM-dd
    descricao?: string;
    referenciaExterna?: string;
  };
}
```

**Resposta:**
```typescript
{
  success: true,
  boleto: {
    id: string,
    asaas_payment_id: string,
    valor: number,
    data_vencimento: string,
    boleto_pdf_url: string,
    boleto_url: string,
    status: string,
    // ... outros campos
  },
  payment: { /* dados do Asaas */ },
  download_url: string
}
```

**Fluxo:**
1. Valida `organizationId` e `leadId`
2. Busca configuração Asaas da organização
3. Procura ou cria cliente no Asaas
4. Cria boleto com tipo `BILLINGTYPE: "BOLETO"`
5. Gera PDF do boleto
6. Registra tudo no banco de dados local
7. Retorna URLs de download

---

### React Hooks

#### `useAsaasBoletos()`

**Funcionalidades:**
- `getBoletosByLead(leadId)`: Buscar boletos de um lead
- `getBoletosByWorkflow(workflowId)`: Buscar boletos de um workflow
- `createBoleto(payload)`: Criar novo boleto
- `updateBoletoStatus(id, status)`: Atualizar status
- `deleteBoleto(id)`: Remover boleto

**Exemplo de uso:**
```typescript
const { 
  boletos, 
  createBoleto, 
  isCreatingBoleto 
} = useAsaasBoletos();

await createBoleto({
  leadId: "uuid-do-lead",
  customer: {
    name: "João Silva",
    cpfCnpj: "12345678901",
    email: "joao@email.com",
  },
  boleto: {
    valor: 500.50,
    dataVencimento: "2025-02-28",
    descricao: "Fatura #001",
  },
});
```

---

### Componentes React

#### 1. `AsaasBoletoForm`

**Propriedades:**
```typescript
interface AsaasBoletoFormProps {
  leadId: string;
  leadName: string;
  leadEmail?: string;
  leadPhone?: string;
  leadCpfCnpj?: string;
  onSuccess?: (boleto: any) => void;
}
```

**Funcionalidades:**
- Botão para abrir formulário
- Entrada de valor, data de vencimento, descrição
- Exibição de boleto gerado
- Download de PDF e link
- Callback ao sucesso

**Uso:**
```tsx
<AsaasBoletoForm
  leadId={lead.id}
  leadName={lead.name}
  leadEmail={lead.email}
  leadPhone={lead.phone}
  leadCpfCnpj={lead.cpf_cnpj}
  onSuccess={(boleto) => console.log("Boleto criado:", boleto)}
/>
```

#### 2. `BoletosList`

**Propriedades:**
```typescript
interface BoletoListProps {
  leadId?: string;
  workflowId?: string;
}
```

**Funcionalidades:**
- Tabela com todos os boletos
- Filtro por lead ou workflow
- Status com cores
- Downloads de PDF
- Opção de deletar

**Uso:**
```tsx
<BoletosList leadId={lead.id} />
```

---

## 🚀 Como Implementar nos Workflows

### Cenário 1: Gerar Boleto ao Criar Workflow

**Arquivo:** `src/components/whatsapp/workflows/WorkflowFormDrawer.tsx`

**Passo 1:** Importar componente
```typescript
import { AsaasBoletoForm } from "./AsaasBoletoForm";
```

**Passo 2:** Adicionar ao formulário
```tsx
{values.workflow_type === "cobranca" && selectedLead && (
  <section className="space-y-3">
    <Label className="text-sm font-semibold">Gerar Boleto</Label>
    <AsaasBoletoForm
      leadId={selectedLead.id}
      leadName={selectedLead.name}
      leadEmail={selectedLead.email}
      leadPhone={selectedLead.phone}
      leadCpfCnpj={selectedLead.cpf_cnpj}
      onSuccess={(boleto) => {
        // Opcional: associar boleto ao workflow
        console.log("Boleto gerado:", boleto);
      }}
    />
  </section>
)}
```

### Cenário 2: Listar Boletos de um Lead

**Arquivo:** `src/pages/CRM.tsx` ou `LeadDetail.tsx`

**Passo 1:** Importar
```typescript
import { BoletosList } from "@/components/whatsapp/workflows/BoletosList";
```

**Passo 2:** Adicionar à página
```tsx
<div className="space-y-6">
  {/* ... outros conteúdos ... */}
  <BoletosList leadId={lead.id} />
</div>
```

### Cenário 3: Integração Automática com Workflow

**Arquivo:** `src/hooks/useWhatsAppWorkflows.ts`

**Modificação:**
```typescript
const createWorkflow = useMutation({
  mutationFn: async (payload: PersistWorkflowArgs) => {
    // ... lógica existente ...

    // Se workflow for de cobrança e tiver leads
    if (payload.workflow_type === "cobranca") {
      for (const contact of listContacts) {
        // Criar boleto automático
        await supabase.functions.invoke("asaas-create-boleto", {
          body: {
            organizationId: activeOrgId,
            leadId: contact.lead_id,
            workflowId: workflow.id,
            customer: {
              name: contact.name || contact.phone,
              email: contact.email,
              phone: contact.phone,
            },
            boleto: {
              valor: payload.cobranca_valor || 0,
              dataVencimento: payload.cobranca_vencimento,
              descricao: `Cobrança via workflow: ${workflow.name}`,
              referenciaExterna: workflow.id,
            },
          },
        });
      }
    }

    return workflow;
  },
});
```

---

## 📋 Passo a Passo: Implementação

### Fase 1: Banco de Dados

1. Aplicar migração no Supabase:
   - Arquivo: `supabase/migrations/20251115020000_add_boleto_tracking.sql`
   - Copie todo o conteúdo
   - Abra Supabase Dashboard > SQL Editor
   - Cole e execute

### Fase 2: Edge Functions

1. Deploy `asaas-create-boleto`:
   ```bash
   supabase functions deploy asaas-create-boleto
   ```

### Fase 3: Frontend

1. Adicione hook: `src/hooks/useAsaasBoletos.ts`
2. Adicione componentes:
   - `src/components/whatsapp/workflows/AsaasBoletoForm.tsx`
   - `src/components/whatsapp/workflows/BoletosList.tsx`
3. Integre nos workflows conforme cenários acima

### Fase 4: Testes

```typescript
// Teste 1: Criar boleto
const { createBoleto } = useAsaasBoletos();
await createBoleto({
  leadId: "test-lead-id",
  customer: { name: "Teste", cpfCnpj: "12345678901" },
  boleto: { 
    valor: 100, 
    dataVencimento: "2025-12-31" 
  }
});

// Teste 2: Listar boletos
<BoletosList leadId="test-lead-id" />

// Teste 3: Download PDF
// Clique no botão de download no componente
```

---

## 🔐 Segurança

### RLS Policies
- Apenas membros da organização podem ver boletos
- Boletos estão isolados por `organization_id`
- Usuários só veem boletos de sua organização

### API Key Asaas
- Armazenada na tabela `asaas_configs`
- Sensível: usar `type="password"` em formulários
- Usar Edge Function para não expor ao frontend

---

## 📊 Exemplos de Status do Boleto

| Status | Descrição |
|--------|-----------|
| `pending` | Boleto criado, aguardando processamento |
| `open` | Boleto disponível para pagamento |
| `paid` | Pagamento recebido |
| `cancelled` | Boleto cancelado |
| `overdue` | Vencido sem pagamento |
| `refunded` | Reembolsado |

---

## 🐛 Troubleshooting

### Erro: "Configuração Asaas não encontrada"
- Verifique se configurou a API Key em Fluxo Automatizado > Integração Asaas
- Verifique se está na organização correta

### Erro: "Cliente não encontrado no Asaas"
- Providencie CPF/CNPJ ou email válido
- Verifique se a API Key tem permissão

### PDF não gera
- Verifique se a API Key tem permissão para gerar PDFs
- Tente regenerar o boleto

### Boleto não aparece na lista
- Verifique se está filtrando por lead/workflow correto
- Recarregue a página

---

## 📚 Referências

- [Documentação Asaas API](https://docs.asaas.com/)
- [Endpoint de Pagamentos](https://docs.asaas.com/reference/payment)
- [Tipos de Cobrança](https://docs.asaas.com/reference/billingtype)

---

**Última atualização:** Janeiro 2025

