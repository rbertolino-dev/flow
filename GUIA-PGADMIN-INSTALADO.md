# 🎨 Guia Completo - pgAdmin Instalado no Servidor

**Data de instalação:** 2025-01-31  
**Status:** ✅ Instalado e funcionando

---

## 🌐 Acesso ao pgAdmin

### URL de Acesso:
```
http://95.217.2.116:5050
```

### Credenciais de Login:
- **Email:** `admin@kanbanbuzz.com`
- **Senha:** `Admin@KanbanBuzz2025!`

---

## 📊 Como Adicionar o Servidor PostgreSQL

### Passo a Passo:

1. **Acesse o pgAdmin**
   - Abra: http://95.217.2.116:5050
   - Faça login com as credenciais acima

2. **Adicionar Novo Servidor**
   - Clique com botão direito em **"Servers"** no painel esquerdo
   - Selecione **"Register"** > **"Server..."**

3. **Aba "General"**
   - **Name:** `Hetzner PostgreSQL` (ou qualquer nome que preferir)

4. **Aba "Connection"**
   - **Host name/address:** `95.217.2.116`
   - **Port:** `5432`
   - **Maintenance database:** `budget_services`
   - **Username:** `budget_user`
   - **Password:** `XdgoSA4ABHSRWdTXA5cKDfJJs`
   - ✅ Marque **"Save password"** para não precisar digitar sempre

5. **Aba "SSL" (Opcional)**
   - **SSL mode:** `Prefer` ou `Disable` (não é obrigatório para servidor local)

6. **Salvar**
   - Clique em **"Save"**

---

## 🗄️ Bancos de Dados Disponíveis

### Banco do Servidor (Hetzner):
- **Nome:** `budget_services`
- **Host:** `95.217.2.116`
- **Porta:** `5432`
- **Usuário:** `budget_user`
- **Senha:** `XdgoSA4ABHSRWdTXA5cKDfJJs`

### Banco Supabase (CRM Principal):
Você também pode adicionar o banco Supabase:

- **Nome:** `Supabase PostgreSQL`
- **Host:** `db.ogeljmbhqxpfjbpnbwog.supabase.co`
- **Porta:** `5432`
- **Database:** `postgres`
- **Usuário:** `viewer_user`
- **Senha:** `viewer_2025_secure_pass_kanban_buzz`
- **SSL mode:** `Require` (OBRIGATÓRIO)

---

## 🛠️ Funcionalidades do pgAdmin

### 1. Visualizar Tabelas
- Expanda o servidor > Databases > `budget_services` > Schemas > `public` > Tables
- Veja todas as tabelas do banco

### 2. Executar Queries SQL
- Clique com botão direito no banco de dados
- Selecione **"Query Tool"**
- Digite suas queries SQL
- Clique em **"Execute"** (F5)

### 3. Ver Estrutura de Tabelas
- Clique com botão direito em uma tabela
- Selecione **"Properties"**
- Veja colunas, tipos, constraints, etc.

### 4. Visualizar Dados
- Clique com botão direito em uma tabela
- Selecione **"View/Edit Data"** > **"All Rows"**
- Veja todos os dados da tabela

### 5. Inserir/Editar Dados
- Clique com botão direito em uma tabela
- Selecione **"View/Edit Data"** > **"All Rows"**
- Use os botões **"+"** e **"✏️"** para adicionar/editar

### 6. Backup e Restore
- Clique com botão direito no banco de dados
- Selecione **"Backup..."** ou **"Restore..."**

---

## 📋 Exemplos de Queries Úteis

### Listar todas as tabelas:
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
```

### Ver estrutura de uma tabela:
```sql
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'services'
ORDER BY ordinal_position;
```

### Contar registros:
```sql
SELECT COUNT(*) as total FROM services;
```

### Ver dados de uma tabela:
```sql
SELECT * FROM services LIMIT 10;
```

---

## 🔧 Comandos de Gerenciamento

### Verificar Status do Container:
```bash
ssh kanban-buzz-server "docker ps | grep pgadmin"
```

### Ver Logs:
```bash
ssh kanban-buzz-server "docker logs pgadmin-kanban-buzz"
```

### Reiniciar pgAdmin:
```bash
ssh kanban-buzz-server "docker restart pgadmin-kanban-buzz"
```

### Parar pgAdmin:
```bash
ssh kanban-buzz-server "docker stop pgadmin-kanban-buzz"
```

### Iniciar pgAdmin:
```bash
ssh kanban-buzz-server "docker start pgadmin-kanban-buzz"
```

---

## 🔒 Segurança

⚠️ **IMPORTANTE:**

1. **Acesso via HTTP** - O pgAdmin está acessível via HTTP (não HTTPS)
   - Para produção, considere configurar HTTPS via Nginx reverse proxy
   - Ou use VPN/SSH tunnel para acesso seguro

2. **Senha Forte** - A senha padrão é `Admin@KanbanBuzz2025!`
   - Considere alterar após primeiro acesso
   - Acesse: Server > pgAdmin Preferences > Change Password

3. **Firewall** - A porta 5050 está aberta
   - Considere restringir acesso por IP se necessário
   - Ou usar SSH tunnel para acesso local

---

## 🚨 Troubleshooting

### Erro: "Cannot connect to server"

**Solução:**
1. Verificar se PostgreSQL está rodando:
   ```bash
   ssh kanban-buzz-server "systemctl status postgresql"
   ```

2. Verificar se porta 5432 está acessível:
   ```bash
   ssh kanban-buzz-server "netstat -tuln | grep 5432"
   ```

3. Verificar credenciais no pgAdmin

### Erro: "Permission denied"

**Solução:**
```bash
ssh kanban-buzz-server "sudo chmod -R 777 /var/lib/pgadmin && docker restart pgadmin-kanban-buzz"
```

### pgAdmin não carrega

**Solução:**
1. Verificar logs:
   ```bash
   ssh kanban-buzz-server "docker logs pgadmin-kanban-buzz"
   ```

2. Reiniciar container:
   ```bash
   ssh kanban-buzz-server "docker restart pgadmin-kanban-buzz"
   ```

3. Verificar se porta está aberta:
   ```bash
   ssh kanban-buzz-server "ufw status | grep 5050"
   ```

---

## 📚 Recursos Adicionais

- **Documentação pgAdmin:** https://www.pgadmin.org/docs/
- **Documentação PostgreSQL:** https://www.postgresql.org/docs/
- **Credenciais completas:** Ver `ACESSO-POSTGRESQL-COMPLETO.md`

---

## ✅ Checklist de Configuração

- [x] pgAdmin instalado via Docker
- [x] Container rodando na porta 5050
- [x] Firewall configurado
- [x] Credenciais de acesso criadas
- [ ] Servidor PostgreSQL adicionado no pgAdmin (fazer manualmente após login)
- [ ] Teste de conexão bem-sucedido

---

**Última atualização:** 2025-01-31  
**Status:** ✅ Instalado e funcionando

