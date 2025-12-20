# 🔍 Diagnóstico: Página de Cadastro Não Funciona

**URL**: http://agilizeflow.com.br/CADASTRO  
**Problema**: Página de cadastro/onboarding não está funcionando

---

## 🔍 Possíveis Causas

### 1. Edge Function `log-auth-attempt` Não Deployada

A página tenta chamar a Edge Function `log-auth-attempt` que pode não estar deployada.

**Verificar:**
```bash
supabase functions list
```

**Se não estiver deployada:**
```bash
supabase functions deploy log-auth-attempt
```

**OU** Comentar as chamadas temporariamente (não é crítico para funcionar).

---

### 2. Email Confirmation Habilitado no Supabase

Se o Supabase estiver configurado para exigir confirmação de email, o auto-login após signup falhará.

**Verificar no Dashboard:**
1. Acesse: https://supabase.com/dashboard/project/ogeljmbhqxpfjbpnbwog/auth/providers
2. Verifique se **"Confirm email"** está habilitado

**Solução:**
- **Opção 1**: Desabilitar confirmação de email (para desenvolvimento)
- **Opção 2**: Modificar código para não fazer auto-login (aguardar confirmação)

---

### 3. Signup Desabilitado no Supabase

O signup pode estar desabilitado nas configurações.

**Verificar:**
1. Dashboard → **Authentication** → **Settings**
2. Verificar se **"Enable email signup"** está habilitado

---

### 4. Problemas com Variáveis de Ambiente

O `.env` pode não estar configurado corretamente.

**Verificar:**
```bash
# Verificar se .env existe e tem as variáveis corretas
cat .env | grep VITE_SUPABASE
```

**Variáveis necessárias:**
```
VITE_SUPABASE_URL=https://ogeljmbhqxpfjbpnbwog.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=[ANON_KEY]
```

---

### 5. RLS (Row Level Security) Bloqueando

As políticas RLS podem estar bloqueando a criação de perfis.

**Verificar:**
- Se a tabela `profiles` tem políticas RLS adequadas
- Se o trigger `handle_new_user` está funcionando

---

## 🛠️ Soluções Rápidas

### Solução 1: Verificar Console do Navegador

1. Abra http://agilizeflow.com.br/CADASTRO
2. Abra DevTools (F12)
3. Vá em **Console**
4. Tente criar uma conta
5. Veja os erros no console

**Erros comuns:**
- `Failed to fetch` → Problema de conexão com Supabase
- `Email already registered` → Email já existe
- `Invalid API key` → `.env` incorreto
- `Function not found` → Edge Function não deployada

---

### Solução 2: Testar Signup Direto no Supabase

**Via Dashboard:**
1. Acesse: https://supabase.com/dashboard/project/ogeljmbhqxpfjbpnbwog/auth/users
2. Clique em **"Add User"**
3. Tente criar um usuário manualmente
4. Se funcionar, o problema é no código frontend
5. Se não funcionar, o problema é na configuração do Supabase

---

### Solução 3: Verificar Logs do Supabase

**Ver logs de autenticação:**
1. Dashboard → **Logs** → **Auth Logs**
2. Tente criar conta
3. Veja os logs para identificar o erro

---

### Solução 4: Modificar Código Temporariamente

Comentar as chamadas à Edge Function `log-auth-attempt` (não é crítica):

```typescript
// Comentar estas linhas temporariamente:
// await supabase.functions.invoke('log-auth-attempt', { ... })
```

---

## 🔧 Correções no Código

### Opção 1: Desabilitar Auto-Login (Se Email Confirmation Estiver Habilitado)

Modificar `src/pages/Cadastro.tsx`:

```typescript
// Remover ou comentar o auto-login:
// const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({...});

// Em vez disso, mostrar mensagem:
toast({
  title: "Conta criada!",
  description: "Verifique seu email para confirmar a conta.",
});
```

### Opção 2: Tornar log-auth-attempt Opcional

Já está usando `.catch()`, mas podemos melhorar:

```typescript
// Tornar completamente opcional
try {
  await supabase.functions.invoke('log-auth-attempt', {...});
} catch (err) {
  // Ignorar silenciosamente
  console.debug('Log auth attempt failed (non-critical):', err);
}
```

---

## 📋 Checklist de Verificação

- [ ] Edge Function `log-auth-attempt` está deployada?
- [ ] Email confirmation está desabilitado no Supabase?
- [ ] Signup está habilitado no Supabase?
- [ ] Variáveis `.env` estão corretas?
- [ ] Console do navegador mostra algum erro?
- [ ] Logs do Supabase mostram tentativas de signup?
- [ ] RLS policies estão corretas?

---

## 🚀 Próximos Passos

1. **Verificar console do navegador** para ver erros específicos
2. **Verificar logs do Supabase** para ver tentativas de signup
3. **Testar signup manual** no Dashboard
4. **Verificar configurações** de autenticação no Supabase

---

**Me informe:**
- O que aparece no console do navegador quando tenta cadastrar?
- Qual erro específico aparece?
- O signup funciona no Dashboard do Supabase?



