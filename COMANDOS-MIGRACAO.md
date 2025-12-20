# 🚀 Comandos para Completar a Migração

**Projeto Novo**: `ogeljmbhqxpfjbpnbwog`  
**Status**: ⏳ Aguardando autenticação

---

## ⚡ Comandos Rápidos (Execute na Ordem)

### 1️⃣ Autenticar no Supabase CLI
```bash
supabase login
```
Isso abrirá o navegador para autenticação. Após autenticar, volte aqui.

---

### 2️⃣ Aplicar Todas as Migrations (215 arquivos)
```bash
cd /root/kanban-buzz-95241
supabase db push
```

**O que faz:**
- Aplica todas as 215 migrations SQL em ordem
- Cria todas as tabelas, funções, triggers, RLS policies
- Pode levar alguns minutos

**Verificar sucesso:**
```bash
supabase db diff
```
Se não houver diferenças, todas as migrations foram aplicadas! ✅

---

### 3️⃣ Deploy de Todas as Edge Functions (86 funções)
```bash
cd /root/kanban-buzz-95241
./scripts/deploy-todas-funcoes.sh
```

**Ou deploy manual uma por uma:**
```bash
for func in supabase/functions/*/; do
    func_name=$(basename "$func")
    echo "Deploying $func_name..."
    supabase functions deploy "$func_name"
done
```

**Tempo estimado**: 10-15 minutos (dependendo da conexão)

---

### 4️⃣ Configurar Secrets no Dashboard

1. Acesse: https://supabase.com/dashboard/project/ogeljmbhqxpfjbpnbwog
2. Vá em: **Settings** → **Edge Functions** → **Secrets**
3. Adicione todas as variáveis de `VARIAVEIS-AMBIENTE-COMPLETAS.md`

**Variáveis Críticas:**
```bash
SUPABASE_URL=https://ogeljmbhqxpfjbpnbwog.supabase.co
SUPABASE_SERVICE_ROLE_KEY=[OBTER_NO_DASHBOARD]
SUPABASE_ANON_KEY=[OBTER_NO_DASHBOARD]

# Facebook
FACEBOOK_APP_ID=1616642309241531
FACEBOOK_APP_SECRET=6513bcad61c0e9355d59cc31de243411
FACEBOOK_CLIENT_TOKEN=ef4a74f7a245713f66688e19d2741516
FACEBOOK_WEBHOOK_VERIFY_TOKEN=[GERAR_NOVO_UUID]

# Outras variáveis conforme VARIAVEIS-AMBIENTE-COMPLETAS.md
```

---

### 5️⃣ Atualizar Frontend

#### No Lovable Cloud:
1. Acesse Settings → Environment Variables
2. Atualize:
   - `VITE_SUPABASE_URL=https://ogeljmbhqxpfjbpnbwog.supabase.co`
   - `VITE_SUPABASE_PUBLISHABLE_KEY=[NOVA_ANON_KEY]`

#### Ou no .env local:
```bash
VITE_SUPABASE_URL=https://ogeljmbhqxpfjbpnbwog.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=[NOVA_ANON_KEY]
```

#### Regenerar Types TypeScript:
```bash
supabase gen types typescript --project-id ogeljmbhqxpfjbpnbwog > src/integrations/supabase/types.ts
```

---

### 6️⃣ Atualizar URLs de Webhooks

#### Facebook Developer
- Redirect URI: `https://ogeljmbhqxpfjbpnbwog.supabase.co/functions/v1/facebook-oauth-callback`
- Webhook URL: `https://ogeljmbhqxpfjbpnbwog.supabase.co/functions/v1/facebook-webhook`

#### Evolution API
- Webhook URL: `https://ogeljmbhqxpfjbpnbwog.supabase.co/functions/v1/evolution-webhook`

#### Chatwoot
- Webhook URL: `https://ogeljmbhqxpfjbpnbwog.supabase.co/functions/v1/chatwoot-webhook`

#### Mercado Pago
- Webhook URL: `https://ogeljmbhqxpfjbpnbwog.supabase.co/functions/v1/mercado-pago-webhook`

#### Asaas
- Webhook URL: `https://ogeljmbhqxpfjbpnbwog.supabase.co/functions/v1/asaas-sync-boleto-status`

#### Google Cloud Console
- Calendar Redirect: `https://ogeljmbhqxpfjbpnbwog.supabase.co/functions/v1/google-calendar-oauth-callback`
- Gmail Redirect: `https://ogeljmbhqxpfjbpnbwog.supabase.co/functions/v1/gmail-oauth-callback`
- Business Redirect: `https://ogeljmbhqxpfjbpnbwog.supabase.co/functions/v1/google-business-oauth-callback`

---

## ✅ Verificação Pós-Migração

### Testar Autenticação
```bash
# No frontend, testar login/logout
```

### Testar Edge Functions
```bash
# Testar algumas funções críticas
curl -X POST https://ogeljmbhqxpfjbpnbwog.supabase.co/functions/v1/evolution-webhook \
  -H "Authorization: Bearer [ANON_KEY]" \
  -H "Content-Type: application/json" \
  -d '{"test": true}'
```

### Verificar Banco de Dados
```bash
supabase db diff
# Se não houver diferenças, está tudo sincronizado!
```

---

## 📊 Estatísticas da Migração

- **Migrations**: 215 arquivos SQL
- **Edge Functions**: 86 funções
- **Tempo estimado total**: 30-45 minutos
- **Projeto Original**: `orcbxgajfhgmjobsjlix` (mantido como backup)
- **Projeto Novo**: `ogeljmbhqxpfjbpnbwog`

---

## 🆘 Troubleshooting

### Erro: "Access token not provided"
```bash
supabase login
```

### Erro: "Project not linked"
```bash
supabase link --project-ref ogeljmbhqxpfjbpnbwog
```

### Erro ao fazer deploy de função
```bash
# Deploy manual da função específica
supabase functions deploy [nome-da-funcao]
```

### Ver logs de uma função
```bash
supabase functions logs [nome-da-funcao]
```

---

**Boa sorte com a migração!** 🚀
