#!/usr/bin/env bash
#
# Automatiza: (1) app.settings.service_role_key no Postgres + (2) cron jobs (incl. process-scheduled-messages)
# + (3) uma invocação imediata da edge para drenar a fila.
#
# Requisitos:
#   - supabase login (token em ~/.supabase/access-token)
#   - supabase link (ficheiro supabase/.temp/project-ref)
#   - .env na raiz com SUPABASE_SERVICE_ROLE_KEY=eyJ... (JWT service_role do Dashboard → API)
#
# Uso:
#   ./scripts/aplicar-service-role-e-cron-scheduled-messages.sh
#   DRY_RUN=1 ./scripts/aplicar-service-role-e-cron-scheduled-messages.sh   # só valida variáveis
#
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT"

DRY_RUN="${DRY_RUN:-0}"

echo "[service-role-cron] Raiz: $ROOT"

load_service_role_from_env() {
  if [[ -f "$ROOT/.env" ]]; then
    # shellcheck disable=SC1091
    set -a
    # shellcheck disable=SC1090
    source "$ROOT/.env" 2>/dev/null || true
    set +a
  fi
  if [[ -z "${SUPABASE_SERVICE_ROLE_KEY:-}" && -n "${SERVICE_ROLE_KEY:-}" ]]; then
    SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY"
  fi
}

load_service_role_from_env

if [[ "$DRY_RUN" == "1" ]]; then
  echo "[service-role-cron] DRY_RUN=1 — validação apenas."
  [[ -f "$ROOT/supabase/.temp/project-ref" ]] && echo "[service-role-cron] project-ref: OK" || echo "[service-role-cron] project-ref: falta supabase link"
  if [[ -n "${SUPABASE_SERVICE_ROLE_KEY:-}" ]]; then
    echo "[service-role-cron] SUPABASE_SERVICE_ROLE_KEY: definido (${#SUPABASE_SERVICE_ROLE_KEY} chars)"
  else
    echo "[service-role-cron] SUPABASE_SERVICE_ROLE_KEY: ausente (obrigatório para execução real)"
  fi
  exit 0
fi

if [[ -z "${SUPABASE_SERVICE_ROLE_KEY:-}" ]]; then
  echo "[service-role-cron] ERRO: defina SUPABASE_SERVICE_ROLE_KEY no .env (JWT service_role do Supabase Dashboard → Settings → API)." >&2
  exit 1
fi

# Escapar aspas simples para literal SQL ('' em Postgres)
escape_sql_literal() {
  printf '%s' "$1" | sed "s/'/''/g"
}
ESC_KEY="$(escape_sql_literal "$SUPABASE_SERVICE_ROLE_KEY")"

REF_FILE="$ROOT/supabase/.temp/project-ref"
[[ -f "$REF_FILE" ]] || { echo "[service-role-cron] ERRO: projeto não linkado (falta $REF_FILE). Execute: supabase link --project-ref …" >&2; exit 1; }
REF="$(tr -d '[:space:]' < "$REF_FILE")"

TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT

cat >"$TMP" <<EOSQL
ALTER DATABASE postgres SET app.settings.service_role_key = '$ESC_KEY';
EOSQL

echo "[service-role-cron] 1/3 — ALTER DATABASE app.settings.service_role_key (comprimento JWT: ${#SUPABASE_SERVICE_ROLE_KEY})"

"$ROOT/scripts/supabase-exec-sql-management-api.sh" "$TMP"
echo ""

SQL_CRON="$ROOT/scripts/configurar-cron-jobs-completo.sql"
if [[ ! -f "$SQL_CRON" ]]; then
  echo "[service-role-cron] ERRO: não encontrado $SQL_CRON" >&2
  exit 1
fi

echo "[service-role-cron] 2/3 — Aplicar cron jobs ($SQL_CRON)…"
"$ROOT/scripts/supabase-exec-sql-management-api.sh" "$SQL_CRON"
echo ""

FUNC_URL="https://${REF}.supabase.co/functions/v1/process-scheduled-messages"
echo "[service-role-cron] 3/3 — Invocar uma vez process-scheduled-messages…"
curl -sS -o /tmp/process-scheduled-messages-invoke.json -w "\nHTTP %{http_code}\n" \
  -X POST "$FUNC_URL" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{}' || true
cat /tmp/process-scheduled-messages-invoke.json 2>/dev/null || true
echo ""
echo "[service-role-cron] Concluído. Verifique no SQL se pending com hora passada diminuiu; logs da edge no Dashboard."
