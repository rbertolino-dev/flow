# 🔧 Aplicar Função can_create_evolution_instance

## ❌ Problema

A função RPC `can_create_evolution_instance` não existe no banco de dados, causando erro:

```
Could not find the function public.can_create_evolution_instance(_org_id) in the schema cache
```

## ✅ Solução

Aplicar a função diretamente no Supabase via SQL Editor.

---

## 📋 Passo a Passo

### Método 1: Via Supabase Dashboard (Recomendado)

1. **Acesse o Supabase Dashboard:**
   - URL: https://supabase.com/dashboard/project/ogeljmbhqxpfjbpnbwog
   - Faça login se necessário

2. **Vá em SQL Editor:**
   - Menu lateral esquerdo → **SQL Editor**
   - Ou acesse diretamente: https://supabase.com/dashboard/project/ogeljmbhqxpfjbpnbwog/sql/new

3. **Cole o SQL:**
   - Abra o arquivo: `fix-can-create-evolution-instance.sql`
   - **Copie TODO o conteúdo**
   - Cole no SQL Editor

4. **Execute:**
   - Clique em **RUN** (ou pressione Ctrl+Enter)
   - Aguarde confirmação de sucesso

5. **Verificar:**
   - Deve aparecer mensagem de sucesso
   - A função agora está disponível

---

## 📄 SQL para Aplicar

```sql
-- Criar função can_create_evolution_instance
-- Esta função verifica se a organização pode criar uma nova instância Evolution

CREATE OR REPLACE FUNCTION public.can_create_evolution_instance(_org_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  org_limits RECORD;
  current_count INTEGER;
BEGIN
  -- Buscar limites da organização
  SELECT * INTO org_limits
  FROM organization_limits
  WHERE organization_id = _org_id;
  
  -- Se não existe registro, não pode criar
  IF org_limits IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Verificar se a feature evolution_instances está habilitada (usando JSONB)
  IF org_limits.enabled_features IS NULL OR 
     NOT (org_limits.enabled_features ? 'evolution_instances') THEN
    RETURN FALSE;
  END IF;
  
  -- Contar instâncias atuais da organização
  SELECT COUNT(*) INTO current_count
  FROM evolution_config
  WHERE organization_id = _org_id;
  
  -- Se max_instances é NULL, sem limite
  IF org_limits.max_instances IS NULL THEN
    RETURN TRUE;
  END IF;
  
  -- Verificar se está dentro do limite
  RETURN current_count < org_limits.max_instances;
END;
$$;

-- Comentário para documentação
COMMENT ON FUNCTION public.can_create_evolution_instance(UUID) IS 'Verifica se a organização pode criar uma nova instância Evolution baseado nos limites configurados';
```

---

## ✅ Verificação

Após aplicar, teste novamente criar uma instância. O erro deve desaparecer.

---

## 🔍 Se Ainda Der Erro

1. Verifique se a função foi criada:
   ```sql
   SELECT routine_name 
   FROM information_schema.routines 
   WHERE routine_schema = 'public' 
     AND routine_name = 'can_create_evolution_instance';
   ```

2. Verifique se a tabela `organization_limits` existe:
   ```sql
   SELECT * FROM organization_limits LIMIT 1;
   ```

3. Verifique se a tabela `evolution_config` existe:
   ```sql
   SELECT * FROM evolution_config LIMIT 1;
   ```

---

**Arquivo SQL:** `fix-can-create-evolution-instance.sql`

