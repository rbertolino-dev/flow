# 🚀 Aplicar Migração: Fluxos de Automação

## ⚠️ IMPORTANTE
Esta migração **DEVE** ser aplicada antes de usar o módulo de Fluxos de Automação.

---

## 📋 Passo a Passo

### 1️⃣ Acessar o SQL Editor do Supabase

**URL:** https://supabase.com/dashboard/project/orcbxgajfhgmjobsjlix/sql/new

### 2️⃣ Copiar o Conteúdo da Migration

Abra o arquivo:
```
agilize/supabase/migrations/20250125000000_create_automation_flows.sql
```

**Copie TODO o conteúdo** do arquivo.

### 3️⃣ Colar e Executar

1. Cole o conteúdo completo no SQL Editor
2. Clique em **RUN** (ou pressione `Ctrl+Enter`)
3. Aguarde a confirmação de sucesso

### 4️⃣ Verificar se Funcionou

Vá em **Table Editor** no Dashboard e verifique se as seguintes tabelas foram criadas:

- ✅ `automation_flows` - Tabela de fluxos de automação
- ✅ `flow_executions` - Tabela de execuções de fluxos

---

## 🔍 Se Der Erro

### Erro: "function update_updated_at_column() does not exist"

Se aparecer este erro, execute primeiro este SQL:

```sql
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

Depois, execute a migration novamente.

### Erro: "function update_updated_at_column() does not exist"

Se aparecer este erro, execute primeiro este SQL:

```sql
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public;
```

Depois, execute a migration novamente.

---

## ✅ Após Aplicar

1. Recarregue a página do módulo de Fluxos de Automação
2. O erro deve desaparecer
3. Você poderá criar novos fluxos normalmente

