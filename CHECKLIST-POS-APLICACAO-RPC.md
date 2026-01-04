# ✅ Checklist Pós-Aplicação da Função RPC

## 🎯 Função Aplicada: `get_organization_limits`

Após aplicar o SQL no Supabase, siga este checklist:

---

## 1. ✅ Verificar se a Função Foi Criada

**No Supabase SQL Editor, execute:**
```sql
SELECT 
  routine_name,
  routine_type,
  data_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'get_organization_limits';
```

**Resultado esperado:**
- Deve retornar 1 linha com `routine_name = 'get_organization_limits'`
- `routine_type = 'FUNCTION'`
- `data_type = 'TABLE'`

---

## 2. ✅ Testar a Função Manualmente

**No Supabase SQL Editor, execute:**
```sql
-- Substitua 'SEU-ORG-ID-AQUI' por um UUID de organização real
SELECT * FROM get_organization_limits('SEU-ORG-ID-AQUI'::uuid);
```

**Resultado esperado:**
- Deve retornar 1 linha com:
  - `max_leads`: INTEGER ou NULL
  - `current_leads_count`: BIGINT (número de leads)

**Se retornar erro:**
- Verifique se a organização existe
- Verifique se a tabela `organization_limits` existe
- Verifique se a tabela `leads` existe

---

## 3. ✅ Verificar Permissões RLS

**A função usa `SECURITY DEFINER`, então:**
- ✅ Já tem permissões para acessar as tabelas
- ✅ Não precisa de políticas RLS adicionais
- ✅ Os GRANTs já foram aplicados (authenticated e anon)

**Verificar permissões:**
```sql
SELECT 
  grantee,
  privilege_type
FROM information_schema.routine_privileges
WHERE routine_schema = 'public'
  AND routine_name = 'get_organization_limits';
```

**Resultado esperado:**
- Deve ter `authenticated` e `anon` com `EXECUTE`

---

## 4. ✅ Testar via API REST (Simular Frontend)

**No Supabase Dashboard → API → REST:**
- Endpoint: `/rest/v1/rpc/get_organization_limits`
- Method: POST
- Headers:
  ```
  Content-Type: application/json
  apikey: SUA_ANON_KEY
  Authorization: Bearer SEU_TOKEN_JWT
  ```
- Body:
  ```json
  {
    "_org_id": "SEU-ORG-ID-AQUI"
  }
  ```

**Resultado esperado:**
- Status: 200 OK
- Body: Array com 1 objeto contendo `max_leads` e `current_leads_count`

**Se retornar 404:**
- A função não foi criada corretamente
- Re-execute o SQL da migration

**Se retornar 401/403:**
- Problema de autenticação/autorização
- Verifique se o token JWT é válido

---

## 5. ✅ Testar no Frontend (Aplicação)

**Passos:**
1. Abra a aplicação no navegador
2. Abra o Console do DevTools (F12)
3. Vá para a página de importação de leads
4. Clique em "Importar Leads"
5. Verifique o console:
   - ❌ **ANTES**: Erro 404 em `/rpc/get_organization_limits`
   - ✅ **DEPOIS**: Sem erro 404, função retorna dados

**Se ainda aparecer erro 404:**
- Limpe o cache do navegador (Ctrl+Shift+Delete)
- Recarregue a página (Ctrl+F5)
- Verifique se o SQL foi aplicado no banco correto

---

## 6. ✅ Verificar Logs do Supabase

**No Supabase Dashboard → Logs → API:**
- Procure por chamadas a `/rest/v1/rpc/get_organization_limits`
- Verifique se há erros 404 ou 500

**Se houver erros:**
- Verifique a mensagem de erro
- Execute a função manualmente no SQL Editor para ver o erro completo

---

## 7. ✅ Verificar Performance

**A função deve ser rápida (< 100ms):**
- Se for lenta, verifique se há índices nas tabelas:
  ```sql
  -- Verificar índices
  SELECT 
    tablename,
    indexname
  FROM pg_indexes
  WHERE schemaname = 'public'
    AND tablename IN ('organization_limits', 'leads');
  ```

**Índices necessários:**
- `organization_limits(organization_id)` - Já existe
- `leads(organization_id, deleted_at)` - Recomendado

---

## 8. ✅ Testar Cenários Especiais

### Cenário 1: Organização sem limites configurados
```sql
-- Deve retornar: max_leads = NULL, current_leads_count = contagem real
SELECT * FROM get_organization_limits('ORG-SEM-LIMITES'::uuid);
```

### Cenário 2: Organização sem leads
```sql
-- Deve retornar: current_leads_count = 0
SELECT * FROM get_organization_limits('ORG-SEM-LEADS'::uuid);
```

### Cenário 3: Organização com limites e leads
```sql
-- Deve retornar: max_leads = valor configurado, current_leads_count = contagem real
SELECT * FROM get_organization_limits('ORG-COM-LIMITES'::uuid);
```

---

## 9. ✅ Verificar Fallback no Código

**O código já tem fallback:**
- Se a função RPC falhar, busca diretamente na tabela `leads`
- Isso garante que a aplicação continue funcionando

**Verificar se o fallback funciona:**
1. Temporariamente remova a função (para testar):
   ```sql
   DROP FUNCTION IF EXISTS get_organization_limits(UUID);
   ```
2. Teste a importação de leads
3. Deve funcionar usando o fallback
4. Re-crie a função depois

---

## 10. ✅ Monitorar Erros no Console

**Após aplicar:**
- ❌ **ANTES**: Erro 404 recorrente no console
- ✅ **DEPOIS**: Sem erro 404, função funciona normalmente

**Se ainda aparecer erro:**
- Verifique se aplicou no banco correto (produção vs desenvolvimento)
- Verifique se há cache do navegador
- Verifique se o código está usando a função corretamente

---

## 🎉 Tudo Pronto?

Se todos os itens acima passaram:
- ✅ Função criada e funcionando
- ✅ Permissões corretas
- ✅ Testes passando
- ✅ Sem erros no console

**NÃO precisa fazer mais nada!** A função está pronta para uso.

---

## 🐛 Problemas Comuns

### Erro: "function does not exist"
- **Causa**: SQL não foi aplicado ou foi aplicado no banco errado
- **Solução**: Re-execute o SQL no banco correto

### Erro: "permission denied"
- **Causa**: Permissões RLS bloqueando acesso
- **Solução**: Verifique se os GRANTs foram aplicados

### Erro: "column does not exist"
- **Causa**: Tabela `organization_limits` ou `leads` não existe
- **Solução**: Verifique se as tabelas existem e têm as colunas corretas

### Função retorna vazio
- **Causa**: Organização não existe ou não tem dados
- **Solução**: Teste com uma organização que você sabe que existe

---

## 📝 Notas Finais

- A função usa `SECURITY DEFINER`, então executa com privilégios do criador
- A função é `STABLE`, então pode ser otimizada pelo PostgreSQL
- O código frontend já tem fallback, então é seguro mesmo se a função falhar
- A função retorna sempre 1 linha (mesmo que não encontre limites)



