# 📋 Criar Usuário e Organização via SQL

## ⚠️ IMPORTANTE: Limitação do Supabase

**Não é possível criar usuários diretamente via SQL** na tabela `auth.users` por questões de segurança.

Você precisa criar o usuário primeiro via **Dashboard** ou **API**, e depois executar o SQL para criar a organização e associar.

---

## ✅ Opção 1: Via Dashboard (Recomendado - Mais Fácil)

### Passo 1: Criar Usuário no Dashboard

1. Acesse: https://supabase.com/dashboard/project/ogeljmbhqxpfjbpnbwog/auth/users
2. Clique em **"Add User"** (botão no canto superior direito)
3. Preencha:
   - **Email**: `pubdigital.net@gmail.com`
   - **Password**: `123456`
   - **Auto Confirm User**: ✅ **LIGADO** (importante!)
4. Clique em **"Create User"**

### Passo 2: Executar SQL

1. Acesse: https://supabase.com/dashboard/project/ogeljmbhqxpfjbpnbwog/sql/new
2. Cole o SQL do arquivo `CRIAR-USUARIO-ORGANIZACAO-SQL-SIMPLES.sql`
3. Clique em **"Run"**

---

## ✅ Opção 2: Via API (Automático)

Se você fornecer o **Service Role Key**, posso executar tudo automaticamente via script.

**Como obter Service Role Key:**
1. Acesse: https://supabase.com/dashboard/project/ogeljmbhqxpfjbpnbwog/settings/api
2. Copie a **"service_role"** key (secret, não a anon key)

---

## 📄 SQL Completo

O arquivo `CRIAR-USUARIO-ORGANIZACAO-SQL-SIMPLES.sql` contém o SQL completo que:
- ✅ Cria a organização `pubdgital`
- ✅ Cria/atualiza o perfil do usuário
- ✅ Associa o usuário à organização como `owner`
- ✅ Verifica o resultado

---

## 🧪 Verificar Resultado

Após executar o SQL, você deve ver:
- ✅ Email: `pubdigital.net@gmail.com`
- ✅ Organization: `pubdgital`
- ✅ Role: `owner`
- ✅ Full Name: `PubDigital`

---

## 🔗 Login

Depois de tudo configurado:
- **URL**: https://agilizeflow.com.br
- **Email**: pubdigital.net@gmail.com
- **Senha**: 123456


