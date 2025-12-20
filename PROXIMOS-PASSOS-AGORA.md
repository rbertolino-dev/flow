# 🚀 Próximos Passos - Após Deploy das Edge Functions

**Status Atual**: ✅ **Deploy Completo**  
**Data**: 15/12/2025 01:03

---

## ✅ O Que Já Foi Feito

1. ✅ **Migrations**: 209 de 220 registradas (95%)
2. ✅ **Edge Functions**: 85 funções deployadas (100% sucesso)
3. ✅ **Projeto Linkado**: `ogeljmbhqxpfjbpnbwog`

---

## 📋 Próximos Passos (Ordem de Execução)

### 1️⃣ Configurar Secrets (Variáveis de Ambiente)

**Opção A: Via Dashboard (Recomendado)**
1. Acesse: https://supabase.com/dashboard/project/ogeljmbhqxpfjbpnbwog
2. Vá em: **Settings** → **Edge Functions** → **Secrets**
3. Adicione cada variável de `VARIAVEIS-AMBIENTE-COMPLETAS.md`

**Opção B: Via CLI**
```bash
export SUPABASE_ACCESS_TOKEN="sbp_65ea725d285d73d58dc277c200fbee1975f01b9f"

# Facebook
supabase secrets set FACEBOOK_APP_ID=1616642309241531
supabase secrets set FACEBOOK_APP_SECRET=6513bcad61c0e9355d59cc31de243411
supabase secrets set FACEBOOK_CLIENT_TOKEN=ef4a74f7a245713f66688e19d2741516

# Chatwoot
supabase secrets set CHATWOOT_BASE_URL=https://seu-chatwoot.com
supabase secrets set CHATWOOT_ACCESS_TOKEN=seu-token

# HubSpot
supabase secrets set HUBSPOT_ACCESS_TOKEN=seu-token

# Mercado Pago
supabase secrets set MERCADO_PAGO_ACCESS_TOKEN=seu-token

# Evolution API (se usar)
supabase secrets set EVOLUTION_API_URL=sua-url
supabase secrets set EVOLUTION_API_KEY=sua-chave

# ... continuar com todas as variáveis
```

**⚠️ IMPORTANTE**: 
- Gerar novo `FACEBOOK_WEBHOOK_VERIFY_TOKEN` único
- Atualizar URLs de webhooks nos serviços externos

---

### 2️⃣ Configurar Cron Jobs

**Passo 1: Obter Service Role Key**
1. Dashboard → **Settings** → **API**
2. Copiar **Service Role Key** (secret)

**Passo 2: Preparar SQL**
1. Abrir `scripts/configurar-cron-jobs.sql`
2. Substituir `[PROJECT_URL]` por: `https://ogeljmbhqxpfjbpnbwog.supabase.co`
3. Substituir `[SERVICE_ROLE_KEY]` pela chave copiada

**Passo 3: Executar SQL**
1. Dashboard → **SQL Editor**
2. Colar o SQL modificado
3. Executar

**Cron Jobs a Configurar:**
- `sync-daily-metrics` - Meia-noite (diário)
- `process-whatsapp-workflows` - A cada 5 minutos
- `process-broadcast-queue` - A cada minuto
- `process-scheduled-messages` - A cada minuto
- `process-status-schedule` - A cada 5 minutos
- `sync-google-calendar-events` - A cada 15 minutos
- `process-google-business-posts` - A cada 30 minutos

---

### 3️⃣ Atualizar Frontend

**Se usar Lovable Cloud:**
1. Acesse: Dashboard do Lovable
2. Vá em: **Settings** → **Environment Variables**
3. Atualizar:
   - `VITE_SUPABASE_URL=https://ogeljmbhqxpfjbpnbwog.supabase.co`
   - `VITE_SUPABASE_PUBLISHABLE_KEY=[NOVA_ANON_KEY]`

**Se usar .env local:**
```bash
VITE_SUPABASE_URL=https://ogeljmbhqxpfjbpnbwog.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=[NOVA_ANON_KEY]
```

**Onde obter as chaves:**
- Dashboard → **Settings** → **API**
- Copiar **Project URL** e **anon/public key**

---

### 4️⃣ Atualizar Webhooks Externos

Atualizar URLs de webhooks em cada serviço:

#### Facebook/Instagram
- **Webhook URL**: `https://ogeljmbhqxpfjbpnbwog.supabase.co/functions/v1/facebook-webhook`
- **Redirect URI**: `https://ogeljmbhqxpfjbpnbwog.supabase.co/functions/v1/facebook-oauth-callback`

#### Evolution API
- **Webhook URL**: `https://ogeljmbhqxpfjbpnbwog.supabase.co/functions/v1/evolution-webhook`

#### Chatwoot
- **Webhook URL**: `https://ogeljmbhqxpfjbpnbwog.supabase.co/functions/v1/chatwoot-webhook`

#### HubSpot
- **Webhook URL**: `https://ogeljmbhqxpfjbpnbwog.supabase.co/functions/v1/hubspot-webhook`

#### Mercado Pago
- **Webhook URL**: `https://ogeljmbhqxpfjbpnbwog.supabase.co/functions/v1/mercado-pago-webhook`

---

## 📊 Checklist Final

- [x] Migrations aplicadas (209/220)
- [x] Edge Functions deployadas (85/85)
- [ ] Secrets configuradas
- [ ] Cron Jobs configurados
- [ ] Frontend atualizado
- [ ] Webhooks atualizados
- [ ] Testes realizados

---

## 🎯 Ordem Recomendada

1. **Primeiro**: Configurar Secrets (necessário para Edge Functions funcionarem)
2. **Segundo**: Configurar Cron Jobs (depende de Secrets)
3. **Terceiro**: Atualizar Frontend (para testar)
4. **Quarto**: Atualizar Webhooks (para integrações funcionarem)

---

## 🆘 Troubleshooting

### Erro: "Function not found"
- Verificar se Edge Function foi deployada: `supabase functions list`
- Verificar se nome está correto

### Erro: "Secret not found"
- Verificar se secret foi configurado: Dashboard → Settings → Edge Functions → Secrets
- Verificar se nome do secret está correto no código

### Cron Jobs não executam
- Verificar se `pg_cron` está habilitado
- Verificar se `net.http` está habilitado
- Verificar Service Role Key está correta
- Verificar logs: `SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 20;`

---

**Última atualização**: 15/12/2025 01:03
