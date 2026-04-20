#!/usr/bin/env bash
# Deploy automatizado (4 passos): process-scheduled-messages, evolution-connection-state, (opcional) cron pg_net, app zero-downtime.
#
# Requisitos:
#   - supabase CLI + `supabase login` + projeto linkado (supabase link)
#   - Para cron via API: ~/.supabase/access-token e supabase/.temp/project-ref
#   - ALTER DATABASE ... app.settings.service_role_key já definido no Postgres (uma vez)
#
# Variáveis:
#   SKIP_PG_CRON=1     — não executa scripts/configurar-cron-jobs-completo.sql
#   SKIP_APP_DEPLOY=1 — não executa deploy-zero-downtime.sh
#
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT"

SKIP_PG_CRON="${SKIP_PG_CRON:-0}"
SKIP_APP_DEPLOY="${SKIP_APP_DEPLOY:-0}"

log() { echo "[deploy-agendamentos] $(date '+%H:%M:%S') $*"; }

log "Raiz: $ROOT"

if ! command -v supabase &>/dev/null; then
  echo "Instale o Supabase CLI: https://supabase.com/docs/guides/cli"
  exit 1
fi

log "1/4 — Edge Function: process-scheduled-messages"
supabase functions deploy process-scheduled-messages
log "Edge process-scheduled-messages OK."

log "2/4 — Edge Function: evolution-connection-state (proxy connectionState, sem CORS no browser)"
supabase functions deploy evolution-connection-state
log "Edge evolution-connection-state OK."

if [[ "$SKIP_PG_CRON" != "1" ]]; then
  TOKEN_FILE="${SUPABASE_ACCESS_TOKEN_FILE:-$HOME/.supabase/access-token}"
  REF_FILE="$ROOT/supabase/.temp/project-ref"
  SQL_CRON="$ROOT/scripts/configurar-cron-jobs-completo.sql"
  if [[ -f "$TOKEN_FILE" && -f "$REF_FILE" && -f "$SQL_CRON" ]]; then
    log "3/4 — Aplicar cron jobs (apikey + Bearer) via Management API…"
    if ! "$ROOT/scripts/supabase-exec-sql-management-api.sh" "$SQL_CRON" | tee /tmp/deploy-cron-sql.out; then
      log "AVISO: execução SQL do cron falhou (ver /tmp/deploy-cron-sql.out). Aplique manualmente no SQL Editor se necessário."
    else
      log "Cron SQL enviado (confirme resposta JSON sem erro acima)."
    fi
  else
    log "3/4 — Saltado (falta token ou project-ref ou SQL). Defina SKIP_PG_CRON=0 após supabase login + link."
  fi
else
  log "3/4 — Saltado (SKIP_PG_CRON=1)"
fi

if [[ "$SKIP_APP_DEPLOY" != "1" ]]; then
  log "4/4 — App (zero-downtime)…"
  "$ROOT/scripts/deploy-zero-downtime.sh" --confirm --skip-git-check
  log "App deploy concluído."
else
  log "4/4 — Saltado (SKIP_APP_DEPLOY=1)"
fi

log "Fluxo concluído."
