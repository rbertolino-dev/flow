# 🔧 Correção: Coluna base_url em asaas_configs

## Problema
A coluna `base_url` não existe na tabela `asaas_configs`, causando erro ao salvar configuração do Asaas:
```
Could not find the 'base_url' column of 'asaas_configs' in the schema cache
```

## Solução

### Opção 1: Aplicar via Supabase SQL Editor (Recomendado)

1. Acesse: https://supabase.com/dashboard/project/ogeljmbhqxpfjbpnbwog/sql/new
2. Cole o SQL abaixo e execute:

```sql
-- ==========================================
-- CORREÇÃO: Adicionar coluna base_url em asaas_configs
-- ==========================================

-- 1. Adicionar coluna base_url se não existir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'asaas_configs'
    AND column_name = 'base_url'
  ) THEN
    ALTER TABLE public.asaas_configs
    ADD COLUMN base_url text NOT NULL DEFAULT 'https://www.asaas.com/api/v3';

    COMMENT ON COLUMN public.asaas_configs.base_url IS 'URL base da API Asaas (sandbox ou produção)';
    
    RAISE NOTICE 'Coluna base_url adicionada em asaas_configs';
  ELSE
    RAISE NOTICE 'Coluna base_url já existe em asaas_configs';
  END IF;
END $$;

-- 2. Garantir que a tabela asaas_configs existe com todas as colunas
CREATE TABLE IF NOT EXISTS public.asaas_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  environment text NOT NULL DEFAULT 'sandbox' CHECK (environment IN ('sandbox', 'production')),
  api_key text NOT NULL,
  base_url text NOT NULL DEFAULT 'https://www.asaas.com/api/v3',
  created_by uuid REFERENCES public.profiles(id) DEFAULT auth.uid(),
  updated_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Garantir índice único
CREATE UNIQUE INDEX IF NOT EXISTS idx_asaas_configs_org
  ON public.asaas_configs (organization_id);

-- 4. Habilitar RLS
ALTER TABLE public.asaas_configs ENABLE ROW LEVEL SECURITY;

-- 5. Criar políticas RLS se não existirem
DO $$
BEGIN
  -- Política SELECT
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename = 'asaas_configs'
    AND policyname = 'Asaas config: members can select'
  ) THEN
    CREATE POLICY "Asaas config: members can select"
      ON public.asaas_configs
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1
          FROM public.organization_members om
          WHERE om.organization_id = asaas_configs.organization_id
            AND om.user_id = auth.uid()
        )
        OR public.user_is_org_admin(auth.uid(), asaas_configs.organization_id)
        OR public.is_pubdigital_user(auth.uid())
      );
  END IF;

  -- Política INSERT
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename = 'asaas_configs'
    AND policyname = 'Asaas config: members can insert'
  ) THEN
    CREATE POLICY "Asaas config: members can insert"
      ON public.asaas_configs
      FOR INSERT
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.organization_members om
          WHERE om.organization_id = asaas_configs.organization_id
            AND om.user_id = auth.uid()
        )
        OR public.user_is_org_admin(auth.uid(), asaas_configs.organization_id)
        OR public.is_pubdigital_user(auth.uid())
      );
  END IF;

  -- Política UPDATE
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename = 'asaas_configs'
    AND policyname = 'Asaas config: members can update'
  ) THEN
    CREATE POLICY "Asaas config: members can update"
      ON public.asaas_configs
      FOR UPDATE
      USING (
        EXISTS (
          SELECT 1
          FROM public.organization_members om
          WHERE om.organization_id = asaas_configs.organization_id
            AND om.user_id = auth.uid()
        )
        OR public.user_is_org_admin(auth.uid(), asaas_configs.organization_id)
        OR public.is_pubdigital_user(auth.uid())
      );
  END IF;
END $$;

-- 6. Atualizar registros existentes que não têm base_url
UPDATE public.asaas_configs
SET base_url = 'https://www.asaas.com/api/v3'
WHERE base_url IS NULL OR base_url = '';
```

3. Após executar, aguarde alguns segundos para o schema cache atualizar
4. Recarregue a página da aplicação

### Opção 2: Usar arquivo SQL local

O arquivo `scripts/aplicar-fix-asaas-base-url.sql` contém o mesmo SQL e pode ser usado.

## Verificação

Após aplicar, verifique se a coluna foi criada:

```sql
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'asaas_configs'
AND column_name = 'base_url';
```

Deve retornar:
- `column_name`: `base_url`
- `data_type`: `text`
- `column_default`: `'https://www.asaas.com/api/v3'`

## Nota sobre Tabelas de Workflows

Os erros sobre `whatsapp_workflows` e `whatsapp_workflow_approvals` são tratados automaticamente pelo código (retorna array vazio). A migration `20250124000000_fix_workflows_tables_and_columns.sql` já deve ter criado essas tabelas. Se os erros persistirem, verifique se a migration foi aplicada.

