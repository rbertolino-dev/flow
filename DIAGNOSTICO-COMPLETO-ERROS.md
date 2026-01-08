# 🔍 Diagnóstico Completo dos Erros 406 e 500

## ✅ Resultado dos Testes via API

Os testes via API mostraram que:
- ✅ `facebook_configs`: OK (200)
- ✅ `evolution_logs`: OK (200)

**Isso significa que as migrations de RLS foram aplicadas corretamente!**

## ⚠️ Por que ainda aparece erro 406 no navegador?

O erro 406 no navegador pode ser causado por:

1. **Cache do navegador**: O navegador pode estar usando cache antigo
2. **Token JWT expirado**: O token de autenticação pode estar expirado
3. **Sessão não atualizada**: A sessão do usuário pode precisar ser renovada

## 🔧 Soluções

### 1. Limpar Cache do Navegador

1. Abra o DevTools (F12)
2. Clique com botão direito no botão de recarregar
3. Selecione "Esvaziar cache e atualizar forçadamente" (ou Ctrl+Shift+R)
4. Ou use: Ctrl+Shift+Delete → Limpar dados de navegação → Cache

### 2. Fazer Logout e Login Novamente

1. Faça logout da aplicação
2. Feche o navegador completamente
3. Abra novamente e faça login
4. Teste novamente

### 3. Verificar Token JWT

No console do navegador (F12), execute:
```javascript
// Verificar token atual
const token = localStorage.getItem('sb-ogeljmbhqxpfjbpnbwog-auth-token');
console.log('Token:', token ? 'Existe' : 'Não existe');

// Se token existe, verificar se está expirado
if (token) {
  const payload = JSON.parse(atob(token.split('.')[1]));
  const exp = new Date(payload.exp * 1000);
  console.log('Token expira em:', exp);
  console.log('Token expirado?', exp < new Date());
}
```

## 🔍 Verificar Erro 500 do Webhook

O erro 500 no webhook pode ser causado por:

1. **Colunas faltantes**: `has_unread_messages`, `last_message_at`, `unread_message_count`
2. **Função faltante**: `increment_unread_count`
3. **Erro no código do webhook**

### Verificar no Supabase Dashboard

Execute este SQL no Supabase SQL Editor:

```sql
-- Verificar se colunas de leads existem
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'leads'
  AND column_name IN ('has_unread_messages', 'last_message_at', 'unread_message_count')
ORDER BY column_name;

-- Verificar se função increment_unread_count existe
SELECT 
  routine_name,
  routine_type,
  data_type
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name = 'increment_unread_count';
```

**Resultado esperado:**
- Deve retornar 3 colunas: `has_unread_messages`, `last_message_at`, `unread_message_count`
- Deve retornar 1 função: `increment_unread_count`

### Se colunas não existirem:

Aplique a migration:
- `supabase/migrations/20260106000003_fix_leads_unread_columns.sql`

## 📋 Checklist de Verificação

- [ ] Limpar cache do navegador (Ctrl+Shift+R)
- [ ] Fazer logout e login novamente
- [ ] Verificar se colunas de leads existem (SQL acima)
- [ ] Verificar se função `increment_unread_count` existe (SQL acima)
- [ ] Aplicar migration de leads se necessário
- [ ] Testar webhook novamente no frontend

## 🎯 Próximos Passos

1. **Limpar cache do navegador** primeiro
2. **Verificar colunas de leads** no banco
3. **Aplicar migration de leads** se necessário
4. **Testar novamente** após limpar cache


