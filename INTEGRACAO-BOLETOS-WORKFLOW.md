# 🔗 Guia de Integração: Boletos nos Workflows

## Objetivo
Adicionar a funcionalidade de gerar boletos automaticamente quando se cria um workflow de cobrança.

---

## 1️⃣ Componentes Envolvidos

### Arquivos Principais
```
src/
├── components/whatsapp/workflows/
│   ├── WorkflowFormDrawer.tsx          ← Formulário principal (EDITAR AQUI)
│   ├── AsaasBoletoForm.tsx             ← Novo componente (JÁ CRIADO)
│   └── BoletosList.tsx                 ← Novo componente (JÁ CRIADO)
├── hooks/
│   ├── useWhatsAppWorkflows.ts         ← Hook de workflows (PODE EDITAR)
│   └── useAsaasBoletos.ts              ← Novo hook (JÁ CRIADO)
└── pages/
    └── PeriodicWorkflows.tsx           ← Página principal
```

---

## 2️⃣ Passo a Passo de Implementação

### PASSO 1: Adicionar Imports no WorkflowFormDrawer

**Arquivo:** `src/components/whatsapp/workflows/WorkflowFormDrawer.tsx`

**Localize a seção de imports e adicione:**

```typescript
import { AsaasBoletoForm } from "./AsaasBoletoForm";
import { BoletosList } from "./BoletosList";
```

---

### PASSO 2: Exibir Componente de Boleto no Formulário

**Arquivo:** `src/components/whatsapp/workflows/WorkflowFormDrawer.tsx`

**Procure pela seção onde o formulário é renderizado (busque por `workflow_type === "cobranca"`)**

**Adicione este trecho onde faz sentido (após seleção do tipo de cobrança):**

```tsx
{values.workflow_type === "cobranca" && (
  <div className="space-y-4 border-t pt-4">
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800 space-y-1">
      <p className="font-semibold">💡 Gerar Boleto</p>
      <p>
        Você pode gerar um boleto bancário para cada cliente selecionado. 
        Os boletos serão rastreados e associados a este workflow.
      </p>
    </div>

    {/* Mostrar lista de boletos existentes se houver workflow_id */}
    {workflow?.id && (
      <div className="mt-4">
        <BoletosList workflowId={workflow.id} />
      </div>
    )}
  </div>
)}
```

---

### PASSO 3: Exibir Componente de Boleto por Lead

**Se o formulário permite selecionar leads individuais:**

```tsx
{values.workflow_type === "cobranca" && selectedLead && (
  <div className="space-y-3 border-t pt-4">
    <Label className="text-sm font-semibold">Gerar Boleto para {selectedLead.name}</Label>
    
    <AsaasBoletoForm
      leadId={selectedLead.id}
      leadName={selectedLead.name}
      leadEmail={selectedLead.email}
      leadPhone={selectedLead.phone}
      leadCpfCnpj={selectedLead.cpf_cnpj}
      onSuccess={(boleto) => {
        toast({
          title: "Boleto gerado com sucesso",
          description: `Boleto para ${selectedLead.name} criado`,
        });
      }}
    />

    {/* Mostrar boletos deste lead */}
    <BoletosList leadId={selectedLead.id} />
  </div>
)}
```

---

### PASSO 4: Integração Automática (Opcional)

**Para gerar boletos automaticamente ao salvar o workflow:**

**Arquivo:** `src/hooks/useWhatsAppWorkflows.ts`

**Localize a função `createWorkflow` e adicione:**

```typescript
const createWorkflow = useMutation({
  mutationFn: async (payload: PersistWorkflowArgs) => {
    // ... lógica existente de criação ...

    // NOVO: Gerar boletos automaticamente para workflows de cobrança
    if (payload.workflow_type === "cobranca" && payload.contact_attachments?.length > 0) {
      try {
        const contacts = payload.contact_attachments;
        
        for (const contact of contacts) {
          await supabase.functions.invoke("asaas-create-boleto", {
            body: {
              organizationId: activeOrgId,
              leadId: contact.lead_id,
              workflowId: workflow.id,
              customer: {
                name: contact.contact_name || contact.contact_phone,
                email: contact.contact_email,
                phone: contact.contact_phone,
              },
              boleto: {
                valor: payload.cobranca_valor || 0,
                dataVencimento: payload.cobranca_vencimento || new Date().toISOString().split('T')[0],
                descricao: `Cobrança: ${workflow.name}`,
                referenciaExterna: `WF-${workflow.id}`,
              },
            },
          });
        }
      } catch (error) {
        console.error("Erro ao gerar boletos automáticos:", error);
        // Não falhar o workflow se boleto falhar
      }
    }

    return workflow;
  },
  // ... resto da configuração ...
});
```

---

## 3️⃣ Fluxo de Uso do Usuário

### Cenário A: Gerar Boleto Manual

```
1. Usuário vai a "Fluxo Automatizado" > "Workflows"
2. Clica em "Novo Workflow"
3. Tipo: Cobrança
4. Seleciona um lead
5. Clica em "Gerar Boleto"
6. Preenche dados:
   - Valor: 500.00
   - Vencimento: 28/02/2025
   - Descrição: Fatura #001
7. Clica em "Gerar Boleto"
8. Sistema:
   - Cria cliente no Asaas se não existir
   - Cria boleto
   - Gera PDF
   - Salva no banco de dados
9. Exibe opções:
   - Download PDF
   - Abrir link do boleto
```

### Cenário B: Gerar Boletos em Lote

```
1. Usuário cria workflow com múltiplos leads
2. Sistema gera boleto para cada lead
3. Boletos aparecem na lista com status
4. Usuário pode:
   - Visualizar todos os boletos
   - Baixar PDF individual
   - Atualizar status manualmente
```

---

## 4️⃣ Estrutura de Dados do Boleto

```typescript
interface Boleto {
  id: string;                           // UUID único
  organization_id: string;              // Isolamento por org
  lead_id: string;                      // Lead associado
  workflow_id?: string;                 // Workflow associado
  asaas_payment_id: string;             // ID no Asaas
  asaas_customer_id: string;            // Cliente no Asaas
  valor: number;                        // Valor em reais
  data_vencimento: string;              // Data no formato YYYY-MM-DD
  boleto_pdf_url: string;               // URL para download PDF
  boleto_url: string;                   // Link do boleto no Asaas
  codigo_barras: string;                // Código de barras
  linha_digitavel: string;              // Linha digitável
  status: string;                       // pending | open | paid | etc
  criado_em: string;                    // ISO timestamp
}
```

---

## 5️⃣ Exemplo Completo Mínimo

### Forma simples para começar:

**Arquivo:** `src/components/my-custom-page.tsx`

```tsx
import { useAsaasBoletos } from "@/hooks/useAsaasBoletos";
import { AsaasBoletoForm } from "@/components/whatsapp/workflows/AsaasBoletoForm";
import { BoletosList } from "@/components/whatsapp/workflows/BoletosList";

export function MyPage() {
  const selectedLead = { /* ... */ };
  
  return (
    <div className="space-y-6">
      <h2>Gerenciar Boletos</h2>

      {/* Gerar novo boleto */}
      <AsaasBoletoForm
        leadId={selectedLead.id}
        leadName={selectedLead.name}
        leadEmail={selectedLead.email}
        onSuccess={(boleto) => {
          console.log("Boleto criado:", boleto);
        }}
      />

      {/* Listar boletos */}
      <BoletosList leadId={selectedLead.id} />
    </div>
  );
}
```

---

## 6️⃣ Handlers Importantes

### Quando o Boleto é Gerado:

1. **Frontend** chama `useAsaasBoletos().createBoleto()`
2. **Edge Function** `asaas-create-boleto` é invocada
3. Edge Function:
   - Busca config Asaas
   - Cria/busca cliente
   - Cria boleto
   - Gera PDF
   - Salva no banco
4. **Frontend** recebe dados e exibe links de download

### Callbacks Disponíveis:

```typescript
const { createBoleto } = useAsaasBoletos();

// Com tratamento de erro
try {
  const result = await createBoleto({
    leadId: "...",
    customer: { /* ... */ },
    boleto: { /* ... */ }
  });
  
  // result.boleto => dados salvos
  // result.download_url => URL para download PDF
  // result.payment => dados do Asaas
} catch (error) {
  console.error("Erro:", error);
}
```

---

## 7️⃣ API Asaas - Endpoints Utilizados

### 1. Buscar/Criar Cliente
```
GET  /customers?email=...
POST /customers
```

### 2. Criar Boleto
```
POST /payments
Body: {
  customer: string,
  billingType: "BOLETO",
  value: number,
  dueDate: string,
  description: string
}
```

### 3. Gerar PDF
```
GET /payments/{paymentId}/pdf
Response: { url: string }
```

---

## 8️⃣ Troubleshooting Comum

| Problema | Solução |
|----------|---------|
| "Configuração não encontrada" | Salvar API Key em Fluxo Automatizado > Integração Asaas |
| "Cliente não criado" | Fornecer CPF/CNPJ ou email válido |
| "PDF não gera" | Verificar permissões da API Key |
| "Boleto não aparece" | Recarregar página ou verificar filtros |
| "Erro na função" | Verificar logs do Supabase > Edge Functions |

---

## 9️⃣ Testes Recomendados

```typescript
// Teste 1: Criar boleto simples
test("Criar boleto", async () => {
  const result = await createBoleto({
    leadId: "test-id",
    customer: { name: "Teste" },
    boleto: { valor: 100, dataVencimento: "2025-12-31" }
  });
  
  expect(result.boleto.id).toBeDefined();
  expect(result.boleto_pdf_url).toBeDefined();
});

// Teste 2: Listar boletos
test("Listar boletos", async () => {
  const boletos = await getBoletosByLead("test-id");
  expect(Array.isArray(boletos)).toBe(true);
});

// Teste 3: Componentes renderizam
test("AsaasBoletoForm renderiza", () => {
  render(
    <AsaasBoletoForm
      leadId="test"
      leadName="Teste"
    />
  );
  expect(screen.getByText("Gerar Boleto")).toBeInTheDocument();
});
```

---

## 🔟 Checklist de Implementação

- [ ] Aplicar migração `20251115020000_add_boleto_tracking.sql`
- [ ] Deploy Edge Function `asaas-create-boleto`
- [ ] Adicionar imports em `WorkflowFormDrawer.tsx`
- [ ] Adicionar `<AsaasBoletoForm />` ao formulário
- [ ] Adicionar `<BoletosList />` ao formulário
- [ ] Testar criação de boleto manualmente
- [ ] Testar download de PDF
- [ ] Testar integração automática (opcional)
- [ ] Documentar nos comentários do código
- [ ] Treinar usuários

---

**Última atualização:** Janeiro 2025

