#!/usr/bin/env bash
# Deploy automatizado (4 passos): process-scheduled-messages, evolution-connection-state, (opcional) cron pg_net, app zero-downtime.
#
# Requisitos:
#   - supabase CLI + `supabase login` + projeto linkado (supabase link)
#   - Para cron via API: ~/.supabase/access-token e supabase/.temp/project-ref
#   - SUPABASE_SERVICE_ROLE_KEY no .env (recomendado): o passo 3 usa
#     scripts/aplicar-service-role-e-cron-scheduled-messages.sh (ALTER DATABASE + cron + invoke).
#     Sem a chave, tenta só o SQL do cron (pode falhar se app.settings não estiver definido).
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
  AUTO_CRON="$ROOT/scripts/aplicar-service-role-e-cron-scheduled-messages.sh"
  if [[ -f "$TOKEN_FILE" && -f "$REF_FILE" && -f "$AUTO_CRON" ]]; then
    # Carrega .env só para detetar service role (não exportar tudo ao ambiente do deploy)
    if [[ -f "$ROOT/.env" ]] && grep -qE '^[[:space:]]*SUPABASE_SERVICE_ROLE_KEY=|^SERVICE_ROLE_KEY=' "$ROOT/.env" 2>/dev/null; then
      log "3/4 — Service role + cron + invoke (automatizado)…"
      if ! bash "$AUTO_CRON" | tee /tmp/deploy-cron-auto.out; then
        log "AVISO: aplicar-service-role-e-cron falhou (ver /tmp/deploy-cron-auto.out)."
      fi
    elif [[ -f "$SQL_CRON" ]]; then
      log "3/4 — Aplicar só SQL do cron (sem SUPABASE_SERVICE_ROLE_KEY no .env — pode faltar ALTER DATABASE)…"
      if ! "$ROOT/scripts/supabase-exec-sql-management-api.sh" "$SQL_CRON" | tee /tmp/deploy-cron-sql.out; then
        log "AVISO: execução SQL do cron falhou (ver /tmp/deploy-cron-sql.out). Corra: ./scripts/aplicar-service-role-e-cron-scheduled-messages.sh"
      else
        log "Cron SQL enviado (confirme resposta JSON sem erro acima)."
      fi
    else
      log "3/4 — Saltado (falta $SQL_CRON)."
    fi
  else
    log "3/4 — Saltado (falta token, project-ref ou $AUTO_CRON). supabase login + link."
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
