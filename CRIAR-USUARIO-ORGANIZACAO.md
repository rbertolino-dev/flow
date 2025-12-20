# 📋 Como Criar Usuário e Organização

## ✅ Passo a Passo Rápido

### 1. Criar Usuário no Supabase Dashboard

1. Acesse: https://supabase.com/dashboard/project/ogeljmbhqxpfjbpnbwog/auth/users
2. Clique em **"Add User"** (botão no canto superior direito)
3. Preencha:
   - **Email**: `pubdigital.net@gmail.com`
   - **Password**: `123456`
   - **Auto Confirm User**: ✅ **LIGADO** (importante!)
4. Clique em **"Create User"**

### 2. Executar SQL

1. Acesse: https://supabase.com/dashboard/project/ogeljmbhqxpfjbpnbwog/sql/new
2. Cole o SQL abaixo e clique em **"Run"**:

```sql
-- Criar organização
INSERT INTO public.organizations (name, slug, created_at, updated_at)
VALUES ('pubdgital', 'pubdgital', NOW(), NOW())
ON CONFLICT (slug) DO UPDATE SET name = 'pubdgital';

-- Associar usuário à organização como owner
INSERT INTO public.organization_members (organization_id, user_id, role, created_at)
SELECT o.id, u.id, 'owner', NOW()
FROM public.organizations o
CROSS JOIN auth.users u
WHERE o.slug = 'pubdgital' AND u.email = 'pubdigital.net@gmail.com'
ON CONFLICT (organization_id, user_id) DO UPDATE SET role = 'owner';

-- Criar perfil
INSERT INTO public.profiles (id, email, full_name, created_at, updated_at)
SELECT u.id, u.email, 'PubDigital', NOW(), NOW()
FROM auth.users u
WHERE u.email = 'pubdigital.net@gmail.com'
ON CONFLICT (id) DO UPDATE 
SET email = EXCLUDED.email, full_name = 'PubDigital', updated_at = NOW();

-- Verificar (deve retornar os dados)
SELECT 
  u.email,
  o.name as organization_name,
  om.role
FROM auth.users u
JOIN public.organization_members om ON om.user_id = u.id
JOIN public.organizations o ON o.id = om.organization_id
WHERE u.email = 'pubdigital.net@gmail.com';
```

### 3. Pronto! ✅

Agora você pode fazer login:
- **URL**: http://95.217.2.116:3000
- **Email**: pubdigital.net@gmail.com
- **Senha**: 123456

---

## 🔧 Se Preferir Automático

Se você fornecer o **Service Role Key**, posso executar automaticamente via script.

**Como obter Service Role Key:**
1. Acesse: https://supabase.com/dashboard/project/ogeljmbhqxpfjbpnbwog/settings/api
2. Copie a **"service_role"** key (secret, não a anon key)



