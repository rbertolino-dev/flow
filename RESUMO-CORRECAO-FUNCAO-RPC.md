# 🔧 Correção: Função RPC can_create_evolution_instance Não Existe

## ❌ Erros Encontrados

1. **Primeiro erro:** Função não existe
   ```
   Could not find the function public.can_create_evolution_instance(_org_id) in the schema cache
   ```

2. **Segundo erro:** Operador incorreto para arrays
   ```
   operator does not exist: organization_feature[] ? unknown
   ```

3. **Terceiro problema:** Função muito restritiva
   - Retornava `false` quando organização não tinha registro
   - Retornava `false` quando `enabled_features` estava vazio
   - Bloqueava organizações que deveriam ter acesso

## ✅ Solução

A função precisa ser criada no banco de dados do Supabase.

---

## 📋 Como Aplicar (Método Rápido)

### Via Supabase Dashboard:

1. **Acesse:** https://supabase.com/dashboard/project/ogeljmbhqxpfjbpnbwog/sql/new

2. **Cole este SQL:**

```sql
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
  SELECT * INTO org_limits
  FROM organization_limits
  WHERE organization_id = _org_id;
  
  -- Se não existe registro, permitir (compatibilidade - organizações antigas)
  IF org_limits IS NULL THEN
    RETURN TRUE;
  END IF;
  
  -- Verificar se a feature evolution_instances está habilitada (usando array de enums)
  -- enabled_features é organization_feature[] (array de enums), não JSONB
  -- Se enabled_features está vazio ou NULL, permitir (compatibilidade)
  -- Se enabled_features tem valores, verificar se evolution_instances está presente
  IF org_limits.enabled_features IS NOT NULL AND 
     array_length(org_limits.enabled_features, 1) IS NOT NULL AND
     array_length(org_limits.enabled_features, 1) > 0 THEN
    -- Se há features definidas, verificar se evolution_instances está presente
    IF NOT ('evolution_instances'::public.organization_feature = ANY(org_limits.enabled_features)) THEN
      RETURN FALSE;
    END IF;
  END IF;
  -- Se enabled_features está vazio/NULL, permitir (compatibilidade)
  
  SELECT COUNT(*) INTO current_count
  FROM evolution_config
  WHERE organization_id = _org_id;
  
  -- Verificar limite (usar max_evolution_instances se disponível, senão max_instances)
  IF org_limits.max_evolution_instances IS NULL THEN
    IF org_limits.max_instances IS NULL THEN
      RETURN TRUE;
    ELSE
      RETURN current_count < org_limits.max_instances;
    END IF;
  ELSE
    RETURN current_count < org_limits.max_evolution_instances;
  END IF;
END;
$$;
```

3. **Clique em RUN**

4. **Pronto!** A função está criada.

---

## ✅ Verificação

Após aplicar, teste criar uma instância novamente. O erro deve desaparecer.

---

## 📄 Arquivos Criados

- `fix-can-create-evolution-instance.sql` - SQL para aplicar
- `APLICAR-FUNCAO-CAN-CREATE-EVOLUTION-INSTANCE.md` - Guia completo
- `supabase/migrations/20251223122708_fix_can_create_evolution_instance.sql` - Migration criada

---

**Aplique o SQL acima no Supabase Dashboard e teste novamente!**

