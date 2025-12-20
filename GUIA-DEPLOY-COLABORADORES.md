# 🚀 Guia de Deploy - Sistema de Colaboradores

**Status:** ✅ Código 100% implementado  
**O que você precisa fazer:** Apenas 3 passos para colocar em produção

---

## ✅ O Que Já Está Pronto

- ✅ Migration SQL criada
- ✅ 4 Edge Functions criadas
- ✅ 3 Hooks React criados
- ✅ 8 Componentes React criados
- ✅ Testes E2E criados
- ✅ Integração no menu e rotas
- ✅ Validações e formatações
- ✅ Sem erros de lint

---

## 📋 O Que Você Precisa Fazer

### Passo 1: Executar Migration no PostgreSQL ⚠️ OBRIGATÓRIO

**No servidor Hetzner (95.217.2.116):**

```bash
# Conectar ao servidor
ssh root@95.217.2.116

# Executar migration
psql -h localhost -U budget_user -d budget_services \
  -f /root/kanban-buzz-95241/supabase/migrations/20251217013247_create_employees_system_postgres.sql
```

**OU se o arquivo estiver local, copiar primeiro:**

```bash
# Copiar arquivo para o servidor
scp supabase/migrations/20251217013247_create_employees_system_postgres.sql \
  root@95.217.2.116:/tmp/

# Depois executar no servidor
ssh root@95.217.2.116
psql -h localhost -U budget_user -d budget_services -f /tmp/20251217013247_create_employees_system_postgres.sql
```

**Verificar se funcionou:**
```bash
psql -h localhost -U budget_user -d budget_services -c "\dt" | grep -E "(employees|positions|teams)"
```

Deve mostrar as tabelas: `employees`, `positions`, `teams`, `employee_salary_history`, `employee_position_history`, `employee_teams`

---

### Passo 2: Configurar Variáveis de Ambiente nas Edge Functions ⚠️ OBRIGATÓRIO

**No Supabase Dashboard:**

1. Acesse: https://supabase.com/dashboard/project/ogeljmbhqxpfjbpnbwog/functions
2. Para cada Edge Function (`employees`, `positions`, `teams`, `employee-history`):
   - Clique na função
   - Vá em **Settings** → **Secrets**
   - Adicione as seguintes variáveis:

```
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=budget_services
POSTGRES_USER=budget_user
POSTGRES_PASSWORD=<senha_do_servidor>
```

**⚠️ IMPORTANTE:** A senha está em `/root/postgresql-budget-credentials.txt` no servidor Hetzner.

**OU usar o script automatizado:**

```bash
# Se você tiver o script de configuração
./scripts/configurar-postgres-secrets.sh
```

---

### Passo 3: Fazer Deploy das Edge Functions ⚠️ OBRIGATÓRIO

**Opção A: Via Supabase CLI (Recomendado)**

```bash
# Configurar credenciais (se ainda não configurou)
export SUPABASE_ACCESS_TOKEN="sbp_3c4c0840440fb94a32052c9523dd46949af8af19"
export SUPABASE_PROJECT_ID="ogeljmbhqxpfjbpnbwog"

# Deploy das Edge Functions
supabase functions deploy employees
supabase functions deploy positions
supabase functions deploy teams
supabase functions deploy employee-history
```

**Opção B: Via Dashboard (Manual)**

1. Acesse: https://supabase.com/dashboard/project/ogeljmbhqxpfjbpnbwog/functions
2. Para cada função, faça upload do código ou use o editor online

---

## ✅ Verificação Final

### 1. Testar no Frontend

1. Acesse a aplicação
2. Vá em **Colaboradores** no menu
3. Tente criar um funcionário
4. Verifique se aparece na lista

### 2. Verificar Logs das Edge Functions

No Supabase Dashboard → Edge Functions → Logs:
- Verifique se não há erros
- Teste cada função individualmente

### 3. Executar Testes (Opcional mas Recomendado)

```bash
npm run test:e2e
```

---

## 🐛 Troubleshooting

### Erro: "POSTGRES_PASSWORD não configurada"
**Solução:** Configure as variáveis de ambiente no Passo 2

### Erro: "relation does not exist"
**Solução:** Execute a migration no Passo 1

### Erro: "Não autenticado"
**Solução:** Verifique se está logado na aplicação

### Erro: "Organização não encontrada"
**Solução:** Verifique se você tem uma organização ativa

### Funcionários não aparecem
**Solução:** 
1. Verifique se a migration foi executada
2. Verifique os logs da Edge Function `employees`
3. Verifique se `organization_id` está sendo passado corretamente

---

## 📊 Resumo Rápido

```bash
# 1. Migration (no servidor Hetzner)
ssh root@95.217.2.116
psql -h localhost -U budget_user -d budget_services \
  -f /root/kanban-buzz-95241/supabase/migrations/20251217013247_create_employees_system_postgres.sql

# 2. Configurar secrets (no Supabase Dashboard)
# Adicionar POSTGRES_* nas Edge Functions

# 3. Deploy (local)
supabase functions deploy employees
supabase functions deploy positions
supabase functions deploy teams
supabase functions deploy employee-history
```

---

## ✅ Checklist

- [ ] Migration executada no PostgreSQL
- [ ] Variáveis de ambiente configuradas nas 4 Edge Functions
- [ ] Edge Functions deployadas
- [ ] Testado criar funcionário no frontend
- [ ] Verificado logs sem erros

---

**Pronto!** Após esses 3 passos, a funcionalidade estará 100% operacional! 🎉

