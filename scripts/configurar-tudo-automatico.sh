#!/bin/bash
# 🚀 Script para Configurar Tudo Automaticamente

export SUPABASE_ACCESS_TOKEN="${SUPABASE_ACCESS_TOKEN:-sbp_65ea725d285d73d58dc277c200fbee1975f01b9f}"
PROJECT_REF="ogeljmbhqxpfjbpnbwog"
PROJECT_URL="https://ogeljmbhqxpfjbpnbwog.supabase.co"

LOG_FILE="/tmp/configurar-tudo.log"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

cd /root/kanban-buzz-95241 || exit 1

log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log "🚀 Configurando Tudo Automaticamente"
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log ""

# Facebook Secrets
log "🔵 Configurando Facebook Secrets..."
supabase secrets set FACEBOOK_APP_ID=1616642309241531 2>&1 | tee -a "$LOG_FILE"
supabase secrets set FACEBOOK_APP_SECRET=6513bcad61c0e9355d59cc31de243411 2>&1 | tee -a "$LOG_FILE"
supabase secrets set FACEBOOK_CLIENT_TOKEN=ef4a74f7a245713f66688e19d2741516 2>&1 | tee -a "$LOG_FILE"

# Gerar token único para Facebook Webhook
FACEBOOK_WEBHOOK_TOKEN=$(uuidgen 2>/dev/null || cat /proc/sys/kernel/random/uuid 2>/dev/null || openssl rand -hex 32)
log "🔑 Token Facebook Webhook gerado: $FACEBOOK_WEBHOOK_TOKEN"
supabase secrets set FACEBOOK_WEBHOOK_VERIFY_TOKEN="$FACEBOOK_WEBHOOK_TOKEN" 2>&1 | tee -a "$LOG_FILE"

log ""
log "✅ Secrets configurados!"
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"



