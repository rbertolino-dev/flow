# 🔧 Como Corrigir a Página de Cadastro

**Problema**: http://agilizeflow.com.br/CADASTRO não está funcionando

---

## 🎯 Passos para Diagnosticar e Corrigir

### Passo 1: Verificar Console do Navegador

1. Abra: http://agilizeflow.com.br/CADASTRO
2. Pressione **F12** (DevTools)
3. Vá na aba **Console**
4. Tente criar uma conta
5. **Anote os erros** que aparecem

**Erros comuns:**
- `Failed to fetch` → Problema de conexão
- `Invalid API key` → `.env` incorreto
- `Function not found` → Edge Function não deployada
- `Email already registered` → Email já existe

---

### Passo 2: Verificar Configurações do Supabase

#### 2.1 Verificar se Signup Está Habilitado

1. Acesse: https://supabase.com/dashboard/project/ogeljmbhqxpfjbpnbwog/auth/providers
2. Verifique se **"Enable email signup"** está **ON**

#### 2.2 Verificar Email Confirmation

1. Dashboard → **Authentication** → **Settings**
2. Verifique **"Confirm email"**
   - **Se estiver ON**: Usuário precisa confirmar email antes de fazer login
   - **Se estiver OFF**: Login funciona imediatamente

**Recomendação**: Desabilitar temporariamente para testar

---

### Passo 3: Verificar Edge Function

A página chama `log-auth-attempt` que pode não estar deployada.

**Verificar:**
```bash
supabase functions list | grep log-auth-attempt
```

**Se não estiver deployada:**
```bash
supabase functions deploy log-auth-attempt
```

**OU** Comentar as chamadas no código (não é crítico).

---

### Passo 4: Verificar Variáveis de Ambiente

**No servidor Hetzner, verificar:**
```bash
# Verificar se .env existe
cat .env | grep VITE_SUPABASE

# Deve mostrar:
# VITE_SUPABASE_URL=https://ogeljmbhqxpfjbpnbwog.supabase.co
# VITE_SUPABASE_PUBLISHABLE_KEY=eyJ...
```

**Se não estiver configurado:**
1. Obter Anon Key do Dashboard
2. Atualizar `.env`
3. Reiniciar aplicação

---

### Passo 5: Testar Signup Manual

**Via Dashboard do Supabase:**
1. Acesse: https://supabase.com/dashboard/project/ogeljmbhqxpfjbpnbwog/auth/users
2. Clique em **"Add User"**
3. Preencha:
   - Email: `teste@exemplo.com`
   - Password: `123456`
   - **Auto Confirm User**: ✅ **LIGADO**
4. Clique em **"Create User"**

**Se funcionar**: Problema é no código frontend  
**Se não funcionar**: Problema é na configuração do Supabase

---

## 🔧 Correções Rápidas

### Correção 1: Tornar log-auth-attempt Opcional

Editar `src/pages/Cadastro.tsx`:

```typescript
// Linha 69-79: Tornar completamente opcional
try {
  await supabase.functions.invoke('log-auth-attempt', {
    body: {
      email,
      success: !error,
      error: error?.message || null,
      ip: null,
      userAgent: navigator.userAgent,
      method: 'signup',
      userId: data?.user?.id || null,
    },
  });
} catch (err) {
  // Ignorar silenciosamente - não é crítico
  console.debug('Log auth attempt failed (non-critical)');
}

// Fazer o mesmo para a segunda chamada (linha 90-100)
```

---

### Correção 2: Desabilitar Auto-Login (Se Email Confirmation Estiver ON)

Se email confirmation estiver habilitado, o auto-login falhará.

**Opção A**: Desabilitar email confirmation no Dashboard

**Opção B**: Modificar código para não fazer auto-login:

```typescript
// Comentar linhas 84-106 (auto-login)
// Em vez disso:
toast({
  title: "Conta criada!",
  description: "Verifique seu email para confirmar a conta.",
});
// Não navegar para /onboarding
```

---

### Correção 3: Verificar RLS Policies

Verificar se a tabela `profiles` tem políticas adequadas:

```sql
-- Verificar políticas
SELECT * FROM pg_policies WHERE tablename = 'profiles';

-- Se necessário, criar política:
CREATE POLICY "Users can insert own profile"
ON public.profiles FOR INSERT
WITH CHECK (auth.uid() = id);
```

---

## 📊 Checklist Completo

- [ ] Console do navegador verificado (erros anotados)
- [ ] Signup habilitado no Supabase Dashboard
- [ ] Email confirmation verificado (ON/OFF)
- [ ] Edge Function `log-auth-attempt` deployada
- [ ] Variáveis `.env` corretas
- [ ] Signup manual funciona no Dashboard
- [ ] RLS policies verificadas
- [ ] Logs do Supabase verificados

---

## 🆘 Se Nada Funcionar

1. **Ver logs do Supabase:**
   - Dashboard → **Logs** → **Auth Logs**
   - Ver tentativas de signup e erros

2. **Testar com curl:**
   ```bash
   curl -X POST 'https://ogeljmbhqxpfjbpnbwog.supabase.co/auth/v1/signup' \
     -H "apikey: [ANON_KEY]" \
     -H "Content-Type: application/json" \
     -d '{"email":"teste@exemplo.com","password":"123456"}'
   ```

3. **Verificar se Supabase está acessível:**
   ```bash
   curl https://ogeljmbhqxpfjbpnbwog.supabase.co/rest/v1/
   ```

---

**Me informe:**
- O que aparece no console do navegador?
- Qual erro específico aparece?
- O signup funciona no Dashboard?



