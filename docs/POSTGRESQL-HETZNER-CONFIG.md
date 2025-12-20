# 📊 Configuração PostgreSQL - Servidor Hetzner

**Data de criação:** 2025-12-20  
**Servidor:** Hetzner Cloud  
**Banco de dados:** budget_services

---

## 🔐 Credenciais de Acesso

⚠️ **IMPORTANTE:** As credenciais completas são geradas automaticamente pelo script de instalação e salvas em:
```
/root/postgresql-budget-credentials.txt
```

### Variáveis de Ambiente Necessárias

Após a instalação, configure as seguintes variáveis de ambiente na Edge Function `get-services`:

```bash
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=budget_services
POSTGRES_USER=budget_user
POSTGRES_PASSWORD=<senha_gerada_pelo_script>
```

---

## 🚀 Instalação

### Passo 1: Executar Script de Instalação

```bash
# Conectar ao servidor Hetzner
ssh root@<IP_DO_SERVIDOR>

# Copiar script para o servidor (se necessário)
# Ou executar diretamente:
bash scripts/hetzner/install-postgresql.sh
```

### Passo 2: Verificar Instalação

```bash
# Verificar status do PostgreSQL
systemctl status postgresql

# Testar conexão
psql -h localhost -U budget_user -d budget_services
```

### Passo 3: Executar Migration

```bash
# Conectar ao banco
psql -h localhost -U budget_user -d budget_services

# Executar migration
\i supabase/migrations/20251220000000_create_services_table_postgres.sql
```

---

## 📋 String de Conexão

```
postgresql://budget_user:<SENHA>@localhost:5432/budget_services
```

---

## 🛠️ Comandos Úteis

### Conectar ao Banco

```bash
psql -h localhost -U budget_user -d budget_services
```

### Listar Tabelas

```sql
\dt
```

### Ver Estrutura de uma Tabela

```sql
\d services
```

### Listar Serviços

```sql
SELECT * FROM services ORDER BY created_at DESC;
```

### Criar Serviço de Exemplo

```sql
INSERT INTO services (organization_id, name, description, price, category, is_active)
VALUES (
  '00000000-0000-0000-0000-000000000000', -- Substituir pelo organization_id real
  'Serviço Exemplo',
  'Descrição do serviço exemplo',
  100.00,
  'Categoria 1',
  true
);
```

---

## 💾 Backup e Restore

### Backup Manual

```bash
# Fazer backup
PGPASSWORD=<SENHA> pg_dump -h localhost -U budget_user -d budget_services > backup_$(date +%Y%m%d).sql

# Comprimir
gzip backup_$(date +%Y%m%d).sql
```

### Restore

```bash
# Descomprimir
gunzip backup_YYYYMMDD.sql.gz

# Restaurar
PGPASSWORD=<SENHA> psql -h localhost -U budget_user -d budget_services < backup_YYYYMMDD.sql
```

### Backup Automático

O script de instalação configura um backup automático diário às 2h da manhã.

**Localização dos backups:**
```
/var/backups/postgresql/budget_services_YYYYMMDD_HHMMSS.sql.gz
```

**Manter apenas últimos 7 dias:** Configurado automaticamente.

---

## 🔒 Segurança

### Firewall

- PostgreSQL escuta apenas em `localhost` (127.0.0.1)
- Porta 5432 não está exposta externamente
- Conexões externas bloqueadas

### Autenticação

- Método: `md5` (senha criptografada)
- Apenas usuário `budget_user` tem acesso ao banco `budget_services`

### Permissões

- Usuário `budget_user` tem permissões completas no banco `budget_services`
- Não tem acesso a outros bancos ou ao PostgreSQL como superusuário

---

## 🐛 Troubleshooting

### Erro: "connection refused"

**Causa:** PostgreSQL não está rodando

**Solução:**
```bash
systemctl start postgresql
systemctl enable postgresql
```

### Erro: "password authentication failed"

**Causa:** Senha incorreta

**Solução:** Verificar senha em `/root/postgresql-budget-credentials.txt`

### Erro: "database does not exist"

**Causa:** Banco não foi criado

**Solução:**
```bash
sudo -u postgres psql -c "CREATE DATABASE budget_services OWNER budget_user;"
```

### Erro: "permission denied"

**Causa:** Usuário não tem permissões

**Solução:**
```bash
sudo -u postgres psql -d budget_services -c "GRANT ALL ON SCHEMA public TO budget_user;"
```

### Verificar Logs

```bash
# Logs do PostgreSQL
tail -f /var/log/postgresql/postgresql-15-main.log

# Logs de backup
tail -f /var/log/postgresql-backup.log
```

---

## 📊 Monitoramento

### Verificar Uso de Espaço

```sql
SELECT 
  pg_size_pretty(pg_database_size('budget_services')) AS database_size;
```

### Verificar Número de Serviços

```sql
SELECT COUNT(*) FROM services;
```

### Verificar Serviços por Organização

```sql
SELECT organization_id, COUNT(*) as total
FROM services
GROUP BY organization_id;
```

---

## 🔄 Atualizações

### Atualizar PostgreSQL

```bash
apt update
apt upgrade postgresql postgresql-contrib
systemctl restart postgresql
```

### Verificar Versão

```bash
psql --version
```

---

## 📞 Suporte

Em caso de problemas:

1. Verificar logs: `/var/log/postgresql/postgresql-15-main.log`
2. Verificar status: `systemctl status postgresql`
3. Verificar credenciais: `/root/postgresql-budget-credentials.txt`
4. Verificar conexão: `psql -h localhost -U budget_user -d budget_services`

---

**Última atualização:** 2025-12-20


