# 🔍 Diagnóstico de Erro SQL

Para identificar o problema exato, preciso saber:

## ❓ Qual foi a mensagem de erro?

Por favor, me informe:
1. **Mensagem de erro completa** (copie e cole)
2. **Linha onde parou** (se houver)
3. **Qual parte do script** estava executando quando deu erro

---

## 🔧 Scripts Disponíveis (em ordem de complexidade)

### 1. Versão Mínima (RECOMENDADA PRIMEIRO)
**Arquivo:** `supabase/fixes/20251215_CRIAR_TABELAS_MINIMO.sql`
- Apenas cria tabelas
- Políticas RLS muito simples
- Menos propenso a erros

### 2. Versão Simplificada
**Arquivo:** `supabase/fixes/20251215_CRIAR_TABELAS_SIMPLES.sql`
- Cria tabelas + políticas mais completas
- Remove políticas antigas antes

### 3. Versão Completa
**Arquivo:** `supabase/fixes/20251215_CRIAR_TABELAS_ASSISTENTE_FALTANTES.sql`
- Versão mais completa
- Pode falhar se funções não existirem

---

## 🧪 Teste Passo a Passo

Se os scripts acima falharem, teste cada parte separadamente:

### Teste 1: Apenas criar tabelas (sem RLS)
```sql
CREATE TABLE IF NOT EXISTS public.assistant_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT,
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.assistant_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES public.assistant_conversations(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  function_name TEXT NOT NULL,
  parameters JSONB NOT NULL DEFAULT '{}'::jsonb,
  result JSONB,
  success BOOLEAN NOT NULL DEFAULT true,
  error_message TEXT,
  tokens_used INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Se este teste funcionar, o problema está nas políticas RLS.

---

## 📝 Informações Necessárias

Para ajudar melhor, preciso saber:

1. **Erro exato:**
   ```
   [Cole aqui a mensagem de erro completa]
   ```

2. **Qual script você executou:**
   - [ ] `20251215_CRIAR_TABELAS_MINIMO.sql`
   - [ ] `20251215_CRIAR_TABELAS_SIMPLES.sql`
   - [ ] `20251215_CRIAR_TABELAS_ASSISTENTE_FALTANTES.sql`

3. **Em qual parte parou:**
   - [ ] Criação de tabelas
   - [ ] Criação de índices
   - [ ] Habilitação de RLS
   - [ ] Criação de políticas
   - [ ] Criação de triggers

---

**Execute o script mínimo e me envie a mensagem de erro exata!**



