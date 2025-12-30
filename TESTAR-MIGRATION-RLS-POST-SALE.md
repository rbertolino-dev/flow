# 🧪 Como Testar a Migration RLS Post-Sale

## ✅ Verificação Rápida

### 1. Teste no Frontend (Método Principal)

1. **Acesse o módulo Pós-Venda:**
   - Vá para: `https://agilizeflow.com.br/post-sale`
   - Ou: `http://localhost:3000/post-sale` (se estiver rodando localmente)

2. **Abra um cliente de pós-venda:**
   - Clique em qualquer cliente no Kanban
   - O modal de detalhes do cliente deve abrir

3. **Tente aplicar um template de follow-up:**
   - No modal, vá até a seção "Follow-up"
   - Selecione um template no dropdown "Aplicar Template de Follow-up"
   - Clique para aplicar

4. **Resultado esperado:**
   - ✅ **SUCESSO**: Template aplicado sem erros, toast de sucesso aparece
   - ❌ **ERRO**: Se ainda aparecer erro `new row violates row-level security policy`, a migration não foi aplicada corretamente

### 2. Verificação via Console do Navegador

1. Abra o DevTools (F12)
2. Vá para a aba "Console"
3. Tente aplicar um template
4. **Resultado esperado:**
   - ✅ **SUCESSO**: Nenhum erro de RLS no console
   - ❌ **ERRO**: Se aparecer `code: '42501'` ou `row-level security policy`, a migration não foi aplicada

### 3. Verificação Direta no Banco (Opcional)

Execute este SQL no Supabase Dashboard para verificar se as políticas foram atualizadas:

```sql
-- Verificar políticas de lead_follow_ups
SELECT 
    policyname,
    cmd,
    CASE 
        WHEN qual::text LIKE '%post_sale_leads%' OR with_check::text LIKE '%post_sale_leads%' 
        THEN '✅ Inclui post_sale_leads'
        ELSE '❌ NÃO inclui post_sale_leads'
    END as status
FROM pg_policies
WHERE tablename = 'lead_follow_ups'
ORDER BY policyname;
```

**Resultado esperado:**
- Todas as 4 políticas devem mostrar `✅ Inclui post_sale_leads`

## 🔍 Troubleshooting

### Se ainda aparecer erro de RLS:

1. **Verifique se a migration foi aplicada:**
   ```sql
   -- No Supabase Dashboard SQL Editor
   SELECT * FROM supabase_migrations.schema_migrations 
   WHERE version = '20251230100000';
   ```

2. **Se não foi aplicada, aplique manualmente:**
   - Acesse: https://supabase.com/dashboard/project/ogeljmbhqxpfjbpnbwog/sql/new
   - Cole o SQL de: `supabase/migrations/20251230100000_fix_lead_follow_ups_rls_for_post_sale.sql`
   - Execute (Run)

3. **Verifique se as políticas antigas foram removidas:**
   ```sql
   SELECT policyname FROM pg_policies 
   WHERE tablename = 'lead_follow_ups';
   ```
   
   Deve mostrar apenas 4 políticas (view, create, update, delete)

### Se o erro persistir:

1. Limpe o cache do navegador (Ctrl+Shift+Delete)
2. Faça logout e login novamente
3. Verifique se está usando a organização correta
4. Verifique os logs do Supabase para mais detalhes

## 📝 Checklist de Teste

- [ ] Migration aplicada no banco
- [ ] Políticas RLS incluem `post_sale_leads`
- [ ] Template de follow-up aplica sem erro no frontend
- [ ] Console do navegador não mostra erros de RLS
- [ ] Toast de sucesso aparece ao aplicar template
- [ ] Follow-up aparece na lista de follow-ups do cliente

## ✅ Teste Completo

1. Crie um novo cliente de pós-venda
2. Aplique um template de follow-up
3. Verifique se o follow-up foi criado
4. Complete uma etapa do follow-up
5. Verifique se não há erros em nenhuma etapa

Se todos os passos funcionarem sem erros de RLS, a migration foi aplicada com sucesso! 🎉

