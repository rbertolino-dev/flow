# 🔐 Acesso Completo ao PostgreSQL - Credenciais e Instruções

**Data de criação:** 2025-01-31  
**Status:** ✅ Configurado e funcionando

---

## 📊 Banco de Dados 1: PostgreSQL do Servidor (Hetzner)

### 🔗 Informações de Conexão

```
Host: 95.217.2.116
Porta: 5432
Database: budget_services
Usuário: budget_user
Senha: XdgoSA4ABHSRWdTXA5cKDfJJs
```

### 📋 String de Conexão (Connection String)

```
postgresql://budget_user:XdgoSA4ABHSRWdTXA5cKDfJJs@95.217.2.116:5432/budget_services
```

### 🔒 Permissões

- ✅ **SELECT** - Visualizar dados
- ✅ **INSERT** - Inserir dados
- ✅ **UPDATE** - Atualizar dados
- ✅ **DELETE** - Deletar dados
- ✅ **CREATE** - Criar tabelas (no banco budget_services)

---

## 📊 Banco de Dados 2: Supabase PostgreSQL (Banco Principal do CRM)

### 🔗 Informações de Conexão

```
Host: db.ogeljmbhqxpfjbpnbwog.supabase.co
Porta: 5432
Database: postgres
Usuário: viewer_user
Senha: viewer_2025_secure_pass_kanban_buzz
```

### 📋 String de Conexão (Connection String)

```
postgresql://viewer_user:viewer_2025_secure_pass_kanban_buzz@db.ogeljmbhqxpfjbpnbwog.supabase.co:5432/postgres?sslmode=require
```

### 🔒 Permissões

- ✅ **SELECT** - Visualizar dados (Read-Only)
- ❌ **INSERT** - Não permitido
- ❌ **UPDATE** - Não permitido
- ❌ **DELETE** - Não permitido

---

## 🛠️ Como Conectar

### Opção 1: Via Cliente Gráfico (pgAdmin, DBeaver, TablePlus, etc.)

#### Para Banco do Servidor (budget_services):

**Configuração:**
- **Host/Server:** `95.217.2.116`
- **Port:** `5432`
- **Database:** `budget_services`
- **Username:** `budget_user`
- **Password:** `XdgoSA4ABHSRWdTXA5cKDfJJs`
- **SSL Mode:** `disable` ou `prefer`

#### Para Banco Supabase (CRM Principal):

**Configuração:**
- **Host/Server:** `db.ogeljmbhqxpfjbpnbwog.supabase.co`
- **Port:** `5432`
- **Database:** `postgres`
- **Username:** `viewer_user`
- **Password:** `viewer_2025_secure_pass_kanban_buzz`
- **SSL Mode:** `require` ou `prefer` (OBRIGATÓRIO)

---

### Opção 2: Via Terminal (psql)

#### Conectar ao Banco do Servidor:

```bash
psql "postgresql://budget_user:XdgoSA4ABHSRWdTXA5cKDfJJs@95.217.2.116:5432/budget_services"
```

Ou:

```bash
psql -h 95.217.2.116 -U budget_user -d budget_services
# Quando pedir senha: XdgoSA4ABHSRWdTXA5cKDfJJs
```

#### Conectar ao Banco Supabase:

```bash
psql "postgresql://viewer_user:viewer_2025_secure_pass_kanban_buzz@db.ogeljmbhqxpfjbpnbwog.supabase.co:5432/postgres?sslmode=require"
```

---

### Opção 3: Via Supabase Dashboard (Apenas Banco Supabase)

**Link direto:**
```
https://supabase.com/dashboard/project/ogeljmbhqxpfjbpnbwog/sql/new
```

**Como acessar:**
1. Acesse: https://supabase.com/dashboard/project/ogeljmbhqxpfjbpnbwog
2. Vá em **SQL Editor** no menu lateral
3. Execute queries diretamente no navegador

---

## 📋 Tabelas Disponíveis

### Banco do Servidor (budget_services):

- `services` - Serviços de orçamento
- `employees` - Funcionários
- `positions` - Cargos
- `teams` - Equipes
- E outras tabelas relacionadas

### Banco Supabase (CRM Principal):

- `leads` - Leads do CRM
- `organizations` - Organizações
- `organization_members` - Membros das organizações
- `activities` - Atividades dos leads
- `tags` - Tags do sistema
- `pipeline_stages` - Estágios do funil
- `call_queue` - Fila de chamadas
- `whatsapp_messages` - Mensagens do WhatsApp
- `chatwoot_configs` - Configurações do Chatwoot
- `evolution_providers` - Providers Evolution
- E todas as outras tabelas do sistema CRM

---

## 🔍 Comandos Úteis

### Listar todas as tabelas:

```sql
-- No banco do servidor
\dt

-- No banco Supabase
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
```

### Ver estrutura de uma tabela:

```sql
\d nome_da_tabela
```

### Ver dados de uma tabela:

```sql
SELECT * FROM nome_da_tabela LIMIT 10;
```

### Ver estatísticas:

```sql
-- Exemplo: Total de leads
SELECT COUNT(*) as total_leads
FROM leads
WHERE deleted_at IS NULL;
```

---

## 🔐 Segurança

⚠️ **IMPORTANTE:**

1. **Nunca compartilhe estas credenciais publicamente**
2. **Use conexões SSL quando possível** (especialmente para Supabase)
3. **O usuário do Supabase é Read-Only** - não pode modificar dados
4. **O usuário do servidor tem permissões completas** - use com cuidado
5. **Mantenha backups regulares** dos dados importantes

---

## 🚨 Troubleshooting

### Erro: "Connection refused"

**Solução:**
1. Verificar se PostgreSQL está rodando:
   ```bash
   ssh kanban-buzz-server "systemctl status postgresql"
   ```

2. Verificar se porta está aberta:
   ```bash
   ssh kanban-buzz-server "netstat -tuln | grep 5432"
   ```

### Erro: "Password authentication failed"

**Solução:**
1. Verificar se a senha está correta
2. Verificar se o usuário existe:
   ```bash
   ssh kanban-buzz-server "sudo -u postgres psql -c '\du'"
   ```

### Erro: "SSL connection required" (Supabase)

**Solução:**
- Sempre usar `sslmode=require` ao conectar ao Supabase
- Verificar se o cliente PostgreSQL suporta SSL

---

## 📞 Suporte

Se precisar de:
- Acesso com mais permissões
- Criar novos usuários
- Resolver problemas de conexão
- Fazer backup/restore

Entre em contato com o administrador do sistema.

---

## 📝 Notas Adicionais

### Backup Automático

O banco `budget_services` tem backup automático configurado:
- **Script:** `/usr/local/bin/backup-budget-services.sh`
- **Diretório:** `/var/backups/postgresql`
- **Frequência:** Diário às 2h

### Variáveis de Ambiente

Para usar em aplicações, configure:

**Banco do Servidor:**
```bash
POSTGRES_HOST=95.217.2.116
POSTGRES_PORT=5432
POSTGRES_DB=budget_services
POSTGRES_USER=budget_user
POSTGRES_PASSWORD=XdgoSA4ABHSRWdTXA5cKDfJJs
```

**Banco Supabase:**
```bash
SUPABASE_DB_HOST=db.ogeljmbhqxpfjbpnbwog.supabase.co
SUPABASE_DB_PORT=5432
SUPABASE_DB_NAME=postgres
SUPABASE_DB_USER=viewer_user
SUPABASE_DB_PASSWORD=viewer_2025_secure_pass_kanban_buzz
SUPABASE_DB_SSL=require
```

---

**Última atualização:** 2025-01-31  
**Status:** ✅ Configurado e funcionando

