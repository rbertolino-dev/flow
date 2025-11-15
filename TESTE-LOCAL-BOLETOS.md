# 🧪 Guia de Teste Local - Boletos com Asaas

## Pré-requisitos para Testar

✅ Projeto rodando localmente (`npm run dev`)
✅ Supabase conectado
✅ Conta Asaas criada (sandbox)
✅ API Key do Asaas (sandbox)

---

## Fase 1: Testar Backend (Edge Function)

### Passo 1: Verificar Edge Function Localmente

```bash
# Terminal na pasta do projeto
cd C:\Users\Rubens\lovable\agilize

# Ver funções disponíveis
supabase functions list

# Ou testar diretamente
supabase functions invoke asaas-create-boleto --body '{
  "organizationId": "seu-org-id",
  "leadId": "seu-lead-id",
  "customer": {
    "name": "Teste",
    "cpfCnpj": "12345678901"
  },
  "boleto": {
    "valor": 10.00,
    "dataVencimento": "2025-12-31"
  }
}'
```

### Passo 2: Testar via Supabase Dashboard

1. Abra Supabase Dashboard
2. Edge Functions > `asaas-create-boleto`
3. Aba "Invoke"
4. Cole este JSON:

```json
{
  "organizationId": "COLE_SEU_ORG_ID",
  "leadId": "COLE_SEU_LEAD_ID",
  "customer": {
    "name": "João Teste",
    "cpfCnpj": "12345678901",
    "email": "teste@email.com"
  },
  "boleto": {
    "valor": 50.00,
    "dataVencimento": "2025-02-28",
    "descricao": "Teste de boleto"
  }
}
```

5. Clique "Invoke"
6. **Resultado esperado:**
```json
{
  "success": true,
  "boleto": { /* dados salvos */ },
  "download_url": "https://..."
}
```

### Troubleshooting Backend

```
Erro: "Configuração não encontrada"
→ Você não configurou a API Key do Asaas ainda

Erro: "Cliente inválido"
→ CPF/CNPJ ou email inválido

Erro: "Network error"
→ Problema de conexão com Asaas
```

---

## Fase 2: Testar Banco de Dados

### Passo 1: Verificar Migração

```sql
-- Execute no SQL Editor do Supabase:
SELECT * FROM information_schema.tables 
WHERE table_name = 'whatsapp_boletos';

-- Deve retornar a tabela se migração foi aplicada
```

### Passo 2: Verificar RLS

```sql
-- Ver políticas de segurança
SELECT * FROM pg_policies 
WHERE tablename = 'whatsapp_boletos';

-- Deve listar as 3 policies
```

### Passo 3: Verificar Índices

```sql
-- Ver índices da tabela
SELECT * FROM pg_indexes 
WHERE tablename = 'whatsapp_boletos';

-- Deve listar 4 índices
```

### Passo 4: Verificar Dados

```sql
-- Ver boletos criados
SELECT * FROM whatsapp_boletos 
WHERE organization_id = 'seu-org-id' 
LIMIT 10;

-- Ver total de boletos
SELECT COUNT(*) FROM whatsapp_boletos;
```

---

## Fase 3: Testar Frontend (React)

### Passo 1: Verificar Imports

Abra seu projeto e teste se os imports funcionam:

```typescript
// Teste no console do navegador ou em um arquivo .tsx
import { useAsaasBoletos } from "@/hooks/useAsaasBoletos";
import { AsaasBoletoForm } from "@/components/whatsapp/workflows/AsaasBoletoForm";
import { BoletosList } from "@/components/whatsapp/workflows/BoletosList";

// Se não der erro de import, componentes estão instalados ✅
```

### Passo 2: Testar Hook Manualmente

Crie um arquivo temporário para testar:

**`src/pages/TestBoletos.tsx`**

```tsx
import { useAsaasBoletos } from "@/hooks/useAsaasBoletos";
import { Button } from "@/components/ui/button";

export function TestBoletos() {
  const { boletos, createBoleto, isCreatingBoleto } = useAsaasBoletos();

  const handleTestCreate = async () => {
    try {
      const result = await createBoleto({
        leadId: "seu-lead-id",
        customer: {
          name: "Teste",
          cpfCnpj: "12345678901",
        },
        boleto: {
          valor: 25.50,
          dataVencimento: "2025-12-31",
          descricao: "Boleto de teste",
        },
      });
      console.log("Sucesso!", result);
    } catch (error) {
      console.error("Erro:", error);
    }
  };

  return (
    <div className="p-4 space-y-4">
      <h1>Teste de Boletos</h1>

      <Button onClick={handleTestCreate} disabled={isCreatingBoleto}>
        {isCreatingBoleto ? "Criando..." : "Criar Boleto de Teste"}
      </Button>

      <div>
        <h2>Boletos Carregados: {boletos.length}</h2>
        <pre>{JSON.stringify(boletos, null, 2)}</pre>
      </div>
    </div>
  );
}
```

Adicione rota:
```tsx
// Em seu roteamento
<Route path="/test-boletos" element={<TestBoletos />} />
```

Acesse: `http://localhost:5173/test-boletos`

### Passo 3: Testar Componente Formulário

```tsx
import { AsaasBoletoForm } from "@/components/whatsapp/workflows/AsaasBoletoForm";

export function TestAsaasBoletoForm() {
  return (
    <div className="p-4">
      <AsaasBoletoForm
        leadId="seu-lead-id"
        leadName="João Teste"
        leadEmail="joao@email.com"
        leadPhone="11 99999-9999"
        leadCpfCnpj="12345678901"
        onSuccess={(boleto) => {
          console.log("Boleto criado:", boleto);
          alert("Boleto criado com sucesso!");
        }}
      />
    </div>
  );
}
```

### Passo 4: Testar Componente Lista

```tsx
import { BoletosList } from "@/components/whatsapp/workflows/BoletosList";

export function TestBoletosList() {
  return (
    <div className="p-4">
      <BoletosList leadId="seu-lead-id" />
    </div>
  );
}
```

---

## Fase 4: Teste de Integração Completa

### Teste Manual no Fluxo Real

1. Abra seu projeto: `http://localhost:5173`

2. Navegue até: **Fluxo Automatizado > Workflows**

3. Clique em **"Novo Workflow"**

4. Tipo: **Cobrança**

5. Você deve ver:
   - ✅ Campo "Gerar Boleto" (se integrou)
   - ✅ Botão "Gerar Boleto"

6. Clique em **"Gerar Boleto"**

7. Preencha:
   - Valor: 100.00
   - Vencimento: 28/02/2025
   - Descrição: Teste de cobrança

8. Clique em **"Gerar Boleto"**

9. **Resultado esperado:**
   - ✅ Dialog mostra "Boleto Gerado com Sucesso"
   - ✅ Mostra código de barras
   - ✅ Botão "Download PDF"
   - ✅ Botão "Link do Boleto"

---

## Teste com Asaas Sandbox

### Passo 1: Configurar Asaas Sandbox

1. Acesse: https://asaas.com
2. Crie conta (free)
3. Dashboard > Configurações > Integrações > API
4. Copie API Key (deve estar em modo SANDBOX)

### Passo 2: Configurar no Sistema

1. **Fluxo Automatizado > Integração Asaas**
2. Preencha:
   - Ambiente: **Sandbox** (teste)
   - API Key: [Cole sua chave]
   - Base URL: `https://www.asaas.com/api/v3` (padrão)
3. Clique em **"Salvar configuração"**
4. Clique em **"Testar conexão"**
5. **Resultado esperado:** "Conexão Asaas OK" ✅

### Passo 3: Gerar Boleto de Teste

1. Siga o "Teste Manual" acima
2. Clique em **"Download PDF"**
3. Deve baixar um arquivo PDF ✅

### Passo 4: Verificar no Asaas

1. Acesse https://asaas.com
2. Dashboard > Pagamentos
3. Deve aparecer o boleto que criou
4. Status: "Aberto" ou "Pendente"

---

## Teste de Cenários

### Cenário 1: Sucesso

**Entrada:**
- Valor: 100.00
- Vencimento: 28/02/2025
- Lead com CPF/email válido

**Resultado esperado:**
- ✅ Boleto criado
- ✅ PDF disponível
- ✅ Aparece na lista
- ✅ Status: "pending" ou "open"

---

### Cenário 2: Erro - Valor Inválido

**Entrada:**
- Valor: 0
- Vencimento: 28/02/2025

**Resultado esperado:**
- ❌ Erro: "Valor deve ser maior que 0"
- ❌ Botão "Gerar" desabilitado

---

### Cenário 3: Erro - Data no Passado

**Entrada:**
- Valor: 100.00
- Vencimento: 01/01/2020

**Resultado esperado:**
- ❌ Erro: "Data não pode ser no passado"

---

### Cenário 4: Erro - API Key Inválida

**Entrada:**
- API Key: "chave-falsa"
- Tentar criar boleto

**Resultado esperado:**
- ❌ Erro claro: "Erro ao criar boleto"
- ❌ Verifique logs do Supabase

---

## Teste de Performance

### Medir Tempo de Criação

```typescript
const handleTestPerformance = async () => {
  const startTime = performance.now();
  
  await createBoleto({...});
  
  const endTime = performance.now();
  const duration = endTime - startTime;
  
  console.log(`Tempo: ${duration.toFixed(2)}ms`);
  // Esperado: < 2000ms (2 segundos)
};
```

---

## Teste de Segurança

### Verificar RLS

```typescript
// Tente acessar boletos de outra organização
// Resultado esperado: Erro de permissão
const { data, error } = await supabase
  .from("whatsapp_boletos")
  .select("*")
  .eq("organization_id", "outra-org-id");

// Se RLS funciona: error "access denied"
```

---

## Checklist de Testes

- [ ] **Backend:**
  - [ ] Edge Function invocável
  - [ ] Retorna sucesso
  - [ ] PDF gera
  - [ ] Dados salvos no banco

- [ ] **Banco:**
  - [ ] Tabela criada
  - [ ] Índices presentes
  - [ ] RLS ativo
  - [ ] Dados íntegros

- [ ] **Frontend:**
  - [ ] Componentes importam
  - [ ] Hook funciona
  - [ ] Formulário renderiza
  - [ ] Lista renderiza

- [ ] **Integração:**
  - [ ] Gerar boleto manualmente
  - [ ] Download PDF
  - [ ] Ver em lista
  - [ ] Filtrar por lead

- [ ] **Asaas:**
  - [ ] API Key válida
  - [ ] Boleto criado no Asaas
  - [ ] Status correto
  - [ ] Boleto aparece no dashboard

---

## Comando Rápido para Tudo

```bash
# Limpar e reconstruir
npm run clean
npm install
npm run build
npm run dev

# Verificar erros
npm run lint

# Teste unitário (se tiver)
npm run test
```

---

## Se Algo Quebrar

### Verificar Logs

```bash
# Supabase Dashboard > Edge Functions > asaas-create-boleto > Logs
# Procure por erros recentes
```

### Limpar Estado Local

```bash
# Limpar localStorage
localStorage.clear();

# Recarregar página
location.reload();

# Limpar cache do navegador
Ctrl + Shift + Delete
```

### Resetar Banco (se necessário)

```sql
-- ⚠️ CUIDADO: Isso deleta TODOS os boletos
DELETE FROM whatsapp_boletos;

-- Ou se migração deu erro:
DROP TABLE whatsapp_boletos CASCADE;
-- Depois reaplique a migração
```

---

## Próximo Passo

Após testar tudo com sucesso:

1. Commit das mudanças
2. Push para GitHub
3. Deploy em produção (Asaas Production)
4. Treinar usuários

---

**Bom teste! 🧪**

