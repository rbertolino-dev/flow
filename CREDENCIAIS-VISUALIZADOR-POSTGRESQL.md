# 🔐 Credenciais de Acesso - Usuário Visualizador PostgreSQL

**Data de criação:** 2025-12-22  
**Tipo de acesso:** Read-Only (Apenas visualização)  
**Projeto:** Kanban Buzz CRM

---

## 📊 Credenciais de Conexão

### Informações de Conexão

```
Host: db.ogeljmbhqxpfjbpnbwog.supabase.co
Porta: 5432
Database: postgres
Usuário: viewer_user
Senha: viewer_2025_secure_pass_kanban_buzz
```

### String de Conexão (Connection String)

```
postgresql://viewer_user:viewer_2025_secure_pass_kanban_buzz@db.ogeljmbhqxpfjbpnbwog.supabase.co:5432/postgres
```

### String de Conexão (URL Encoded)

```
postgresql://viewer_user:viewer_2025_secure_pass_kanban_buzz%40db.ogeljmbhqxpfjbpnbwog.supabase.co:5432/postgres
```

---

## 🔗 Links de Acesso

### 1. Supabase Dashboard (SQL Editor)

**Link direto:**
```
https://supabase.com/dashboard/project/ogeljmbhqxpfjbpnbwog/sql/new
```

**Como acessar:**
1. Acesse: https://supabase.com/dashboard/project/ogeljmbhqxpfjbpnbwog
2. Vá em **SQL Editor** no menu lateral
3. Use as credenciais acima para conectar via cliente PostgreSQL externo

### 2. Cliente PostgreSQL (pgAdmin, DBeaver, etc.)

**Configuração:**
- **Host/Server:** `db.ogeljmbhqxpfjbpnbwog.supabase.co`
- **Port:** `5432`
- **Database:** `postgres`
- **Username:** `viewer_user`
- **Password:** `viewer_2025_secure_pass_kanban_buzz`
- **SSL Mode:** `require` ou `prefer`

### 3. Via Terminal (psql)

```bash
psql "postgresql://viewer_user:viewer_2025_secure_pass_kanban_buzz@db.ogeljmbhqxpfjbpnbwog.supabase.co:5432/postgres?sslmode=require"
```

---

## 🔒 Permissões do Usuário

O usuário `viewer_user` tem as seguintes permissões:

✅ **Permitido:**
- ✅ SELECT em todas as tabelas do schema `public`
- ✅ SELECT em todas as views do schema `public`
- ✅ SELECT em sequências (para ver valores atuais)
- ✅ Conexão ao banco de dados
- ✅ Uso do schema `public`

❌ **NÃO Permitido:**
- ❌ INSERT (inserir dados)
- ❌ UPDATE (atualizar dados)
- ❌ DELETE (deletar dados)
- ❌ CREATE (criar tabelas/views)
- ❌ ALTER (modificar estrutura)
- ❌ DROP (deletar tabelas/views)
- ❌ TRUNCATE (limpar tabelas)
- ❌ Qualquer modificação no banco de dados

---

## 📋 Tabelas Acessíveis

O usuário visualizador pode visualizar todas as tabelas do schema `public`, incluindo:

- `leads` - Leads do CRM
- `organizations` - Organizações
- `organization_members` - Membros das organizações
- `activities` - Atividades dos leads
- `tags` - Tags do sistema
- `pipeline_stages` - Estágios do funil
- `call_queue` - Fila de chamadas
- `whatsapp_messages` - Mensagens do WhatsApp
- `chatwoot_configs` - Configurações do Chatwoot
- E todas as outras tabelas do sistema

---

## 🛠️ Exemplos de Uso

### 1. Conectar via psql

```bash
psql "postgresql://viewer_user:viewer_2025_secure_pass_kanban_buzz@db.ogeljmbhqxpfjbpnbwog.supabase.co:5432/postgres?sslmode=require"
```

### 2. Listar todas as tabelas

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
```

### 3. Ver estrutura de uma tabela

```sql
\d leads
```

### 4. Consultar dados (exemplo)

```sql
SELECT id, name, email, created_at 
FROM leads 
ORDER BY created_at DESC 
LIMIT 10;
```

### 5. Ver estatísticas

```sql
SELECT 
  COUNT(*) as total_leads,
  COUNT(DISTINCT organization_id) as total_organizations
FROM leads
WHERE deleted_at IS NULL;
```

---

## 🔐 Segurança

⚠️ **IMPORTANTE:**
- Esta senha é específica para acesso read-only
- Não compartilhe esta senha publicamente
- O usuário não pode modificar dados
- Todas as conexões devem usar SSL (recomendado)

---

## 🔄 Atualização de Permissões

Se novas tabelas forem criadas, as permissões serão aplicadas automaticamente via event trigger.

Para aplicar manualmente permissões em novas tabelas:

```sql
-- Conectar como superuser/admin
-- As permissões são aplicadas automaticamente via trigger
```

---

## 📞 Suporte

Se precisar de acesso com mais permissões ou tiver problemas de conexão, entre em contato com o administrador do sistema.

---

**Última atualização:** 2025-12-22  
**Status:** ✅ Ativo e funcionando

