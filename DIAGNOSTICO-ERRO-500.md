# 🔍 Diagnóstico do Erro 500 - Conexão PostgreSQL

**Data:** 17/12/2025  
**Status:** ⚠️ Em investigação

---

## ❌ Erro Atual

```
Erro ao buscar funcionários: Error: Erro ao conectar ao banco de dados
Erro ao buscar cargos: Error: Erro ao conectar ao banco de dados
```

---

## ✅ O Que Foi Verificado e Corrigido

### 1. PostgreSQL
- ✅ Escutando em todas as interfaces (`0.0.0.0:5432`)
- ✅ Firewall: Porta 5432 aberta
- ✅ `pg_hba.conf` configurado para aceitar conexões externas
- ✅ Teste de conexão externa: **SUCESSO** ✅

### 2. Variáveis de Ambiente
- ✅ `POSTGRES_HOST=95.217.2.116` (IP público)
- ✅ `POSTGRES_PORT=5432`
- ✅ `POSTGRES_DB=budget_services`
- ✅ `POSTGRES_USER=budget_user`
- ✅ `POSTGRES_PASSWORD=***` (configurada)

### 3. Edge Functions
- ✅ Todas deployadas com logs melhorados
- ✅ Configuração TLS adicionada
- ✅ Tratamento de erro melhorado

---

## 🔍 Possível Causa

**As Edge Functions do Supabase podem ter restrições de rede que impedem conexões externas diretas.**

Isso é comum em ambientes serverless onde:
- Conexões de saída podem ser bloqueadas
- Apenas conexões para serviços específicos são permitidas
- Pode haver whitelist de IPs/domínios

---

## 💡 Soluções Possíveis

### Opção 1: Verificar Logs Detalhados
1. Acesse: https://supabase.com/dashboard/project/ogeljmbhqxpfjbpnbwog/functions
2. Clique em `employees` ou `positions`
3. Vá em **Logs**
4. Procure por erros específicos de conexão

### Opção 2: Usar Supabase Database
Se as Edge Functions não conseguem conectar ao PostgreSQL externo, migrar os dados para o Supabase Database:

1. Executar migration no Supabase Database
2. Atualizar Edge Functions para usar Supabase Database
3. Migrar dados existentes (se houver)

### Opção 3: Criar Proxy/Túnel
Criar uma Edge Function intermediária que:
- Recebe requisições das Edge Functions de colaboradores
- Conecta ao PostgreSQL externo
- Retorna os dados

### Opção 4: Verificar se get-services Funciona
Se `get-services` funciona com PostgreSQL externo, comparar implementação.

---

## 📋 Próximos Passos

1. **Verificar logs no Dashboard** para ver erro específico
2. **Testar get-services** para ver se funciona
3. **Considerar migração** para Supabase Database se necessário

---

## 🔧 Comandos Úteis

### Verificar Logs
```bash
# No Supabase Dashboard → Functions → Logs
```

### Testar Conexão Manual
```bash
PGPASSWORD='XdgoSA4ABHSRWdTXA5cKDfJJs' psql -h 95.217.2.116 -U budget_user -d budget_services -c "SELECT 1;"
```

### Verificar Variáveis
```bash
supabase secrets list --project-ref ogeljmbhqxpfjbpnbwog | grep POSTGRES
```

---

**Última atualização:** 17/12/2025

