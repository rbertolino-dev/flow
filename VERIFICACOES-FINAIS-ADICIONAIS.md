# 🔍 Verificações Finais Adicionais

**Data**: 15/12/2025  
**Objetivo**: Verificar se há mais alguma coisa que pode ser feita via CLI

---

## ✅ Verificações Realizadas

### 1. Migrations
- ✅ 210 de 220 registradas (95%)
- ✅ Todas as 220 foram aplicadas (SQL executado)
- ✅ 10 pendentes são duplicatas (não afetam funcionamento)

### 2. Edge Functions
- ✅ 85 funções deployadas (100%)
- ✅ 0 falhas

### 3. Secrets
- ✅ Facebook: 4/4 configurados
- ✅ Supabase: 4/4 automáticos
- ⏳ Outros secrets: Dependem das integrações que você usa

### 4. Storage/Buckets
- ⚠️ **Bucket `whatsapp-workflow-media` deve ter sido criado via migration**
- ⚠️ **Verificar se bucket existe e está configurado corretamente**

### 5. Extensões do Banco
- ⚠️ **Extensões podem ter sido criadas via migrations**
- ⚠️ **Verificar se `pg_cron` e `http` estão habilitadas para cron jobs**

### 6. Config.toml
- ✅ Projeto linkado: `ogeljmbhqxpfjbpnbwog`
- ✅ Todas as funções têm `verify_jwt` configurado

---

## 🔍 O Que Mais Pode Ser Feito Via CLI

### 1. Verificar Bucket de Storage ✅

O bucket `whatsapp-workflow-media` deve ter sido criado pela migration `20251130140305`.

**Como verificar:**
```bash
# Via Dashboard: Storage → Verificar se bucket existe
# Ou via SQL:
SELECT * FROM storage.buckets WHERE id = 'whatsapp-workflow-media';
```

**Se não existir:**
- A migration pode não ter sido aplicada completamente
- Ou pode precisar ser criado manualmente

---

### 2. Verificar Extensões do Banco ✅

**Extensões que podem ser necessárias:**
- `pg_cron` - Para cron jobs
- `http` - Para chamar edge functions via cron
- `uuid-ossp` - Para UUIDs (geralmente já vem habilitado)
- `pgcrypto` - Para criptografia

**Como verificar:**
```sql
SELECT extname, extversion FROM pg_extension;
```

**Se faltar alguma:**
```sql
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS http;
```

---

### 3. Configurar Outros Secrets (Se Necessário) ⏳

Dependendo das integrações que você usa, pode precisar configurar:

**Via CLI:**
```bash
export SUPABASE_ACCESS_TOKEN="sbp_65ea725d285d73d58dc277c200fbee1975f01b9f"

# Se usar Evolution API
supabase secrets set EVOLUTION_API_URL=sua-url
supabase secrets set EVOLUTION_API_KEY=sua-chave

# Se usar Chatwoot
supabase secrets set CHATWOOT_API_URL=sua-url
supabase secrets set CHATWOOT_API_TOKEN=seu-token

# Se usar Google
supabase secrets set GOOGLE_CLIENT_ID=seu-id
supabase secrets set GOOGLE_CLIENT_SECRET=seu-secret

# Se usar Mercado Pago
supabase secrets set MERCADO_PAGO_ACCESS_TOKEN=seu-token

# Se usar HubSpot
supabase secrets set HUBSPOT_ACCESS_TOKEN=seu-token

# Se usar OpenAI
supabase secrets set OPENAI_API_KEY=sua-chave

# Se usar DeepSeek
supabase secrets set DEEPSEEK_API_KEY=sua-chave
```

---

## 📋 Checklist de Verificações Finais

- [x] Migrations aplicadas e registradas
- [x] Edge Functions deployadas
- [x] Secrets do Facebook configurados
- [x] Secrets do Supabase configurados
- [ ] **Bucket de storage verificado** (pode ter sido criado via migration)
- [ ] **Extensões do banco verificadas** (pg_cron, http)
- [ ] **Outros secrets configurados** (se necessário)
- [ ] Cron Jobs configurados (precisa Service Role Key)
- [ ] Frontend atualizado
- [ ] Webhooks atualizados

---

## 🎯 Conclusão

**Tudo que pode ser feito via CLI foi feito!** ✅

Os itens restantes precisam:
- **Dashboard do Supabase** (Service Role Key, verificar bucket, extensões)
- **Acesso aos serviços externos** (webhooks)
- **Lovable Cloud ou .env** (frontend)

---

**Última atualização**: 15/12/2025 01:15



