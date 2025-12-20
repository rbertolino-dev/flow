# ⚙️ Configuração Final - Gerador de Orçamentos

**Data:** 2025-12-20  
**Status:** Pronto para configuração final

---

## ✅ O que já foi feito

1. ✅ PostgreSQL instalado no servidor Hetzner
2. ✅ Banco de dados `budget_services` criado
3. ✅ Usuário `budget_user` criado
4. ✅ Edge Functions deployadas:
   - `get-services`
   - `send-budget-whatsapp`
5. ✅ Código frontend implementado
6. ✅ Migrations criadas

---

## 🔧 Passos Finais de Configuração

### 1. Executar Migration no PostgreSQL

**No servidor Hetzner:**

```bash
# Opção 1: Usar o script
bash scripts/hetzner/run-postgres-migration.sh

# Opção 2: Manual
psql -h localhost -U budget_user -d budget_services -f supabase/migrations/20251220000000_create_services_table_postgres.sql
```

**Verificar se funcionou:**
```bash
psql -h localhost -U budget_user -d budget_services -c "\d services"
```

---

### 2. Executar Migrations no Supabase

**No Supabase Dashboard → SQL Editor:**

Execute as seguintes migrations na ordem:

1. `supabase/migrations/20251220000001_create_budgets_table.sql`
2. `supabase/migrations/20251220000002_create_budget_backgrounds.sql`

**Ou via CLI:**
```bash
supabase db push
```

---

### 3. Configurar Variáveis de Ambiente na Edge Function

**No Supabase Dashboard → Edge Functions → get-services → Settings:**

Adicione as seguintes variáveis de ambiente:

```
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=budget_services
POSTGRES_USER=budget_user
POSTGRES_PASSWORD=XdgoSA4ABHSRWdTXA5cKDfJJs
```

⚠️ **IMPORTANTE:** A senha acima é a senha gerada pelo script. Use a senha do arquivo `/root/postgresql-budget-credentials.txt` no servidor.

**Como configurar:**
1. Acesse: https://supabase.com/dashboard/project/ogeljmbhqxpfjbpnbwog/functions
2. Clique em `get-services`
3. Vá em **Settings** → **Secrets**
4. Adicione cada variável como um secret

---

### 4. Testar Conexão

**Teste a Edge Function:**

```bash
# Obter token de autenticação
curl -X POST 'https://ogeljmbhqxpfjbpnbwog.supabase.co/functions/v1/get-services' \
  -H 'Authorization: Bearer <SEU_TOKEN>' \
  -H 'Content-Type: application/json'
```

**Resposta esperada:**
```json
{
  "data": []
}
```

Se retornar erro, verifique:
- Variáveis de ambiente configuradas
- PostgreSQL rodando no servidor
- Firewall permitindo conexão local

---

## 🧪 Testar Funcionalidade Completa

### 1. Criar Serviço de Teste

**Via SQL direto no PostgreSQL:**
```sql
-- Conectar
psql -h localhost -U budget_user -d budget_services

-- Inserir serviço de teste (substitua o organization_id pelo seu)
INSERT INTO services (organization_id, name, description, price, category, is_active)
VALUES (
  '<SEU_ORGANIZATION_ID>', -- Obter do Supabase
  'Serviço de Teste',
  'Descrição do serviço de teste',
  150.00,
  'Teste',
  true
);
```

### 2. Criar Orçamento no Frontend

1. Acesse a aplicação
2. Vá em **Orçamentos** no menu
3. Clique em **Novo Orçamento**
4. Selecione um cliente
5. Adicione produtos e serviços
6. Crie o orçamento
7. Verifique se o PDF foi gerado

### 3. Enviar via WhatsApp

1. Na lista de orçamentos, clique em **Enviar via WhatsApp**
2. Selecione uma instância conectada
3. Envie o orçamento
4. Verifique se chegou no WhatsApp do cliente

---

## 📋 Checklist Final

- [ ] Migration PostgreSQL executada
- [ ] Migrations Supabase executadas
- [ ] Variáveis de ambiente configuradas na Edge Function
- [ ] Teste de conexão com PostgreSQL funcionando
- [ ] Serviço de teste criado
- [ ] Orçamento criado com sucesso
- [ ] PDF gerado corretamente
- [ ] Envio via WhatsApp funcionando

---

## 🐛 Troubleshooting

### Erro: "POSTGRES_PASSWORD não configurada"

**Solução:** Configure as variáveis de ambiente na Edge Function `get-services`

### Erro: "connection refused"

**Solução:** 
```bash
# No servidor Hetzner
systemctl status postgresql
systemctl start postgresql
```

### Erro: "relation services does not exist"

**Solução:** Execute a migration no PostgreSQL:
```bash
bash scripts/hetzner/run-postgres-migration.sh
```

### Erro: "table budgets does not exist"

**Solução:** Execute as migrations no Supabase

### Serviços não aparecem no frontend

**Verificar:**
1. Variáveis de ambiente configuradas
2. PostgreSQL acessível
3. Serviços cadastrados com `organization_id` correto
4. Serviços com `is_active = true`

---

## 📞 Suporte

Se encontrar problemas:

1. Verifique os logs da Edge Function no Supabase Dashboard
2. Verifique os logs do PostgreSQL: `/var/log/postgresql/postgresql-16-main.log`
3. Verifique o console do navegador para erros do frontend

---

**Última atualização:** 2025-12-20


