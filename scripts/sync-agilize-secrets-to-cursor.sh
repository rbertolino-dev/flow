#!/usr/bin/env bash
# Sincroniza credenciais Agilize/Bubble para Runtime Secrets do Environment Cursor.
# NÃO grava secrets no Git. NÃO imprime valores.
#
# Requisitos:
#   CURSOR_API_KEY  — API key do Cursor (Dashboard → Cloud Agents / API Keys)
#   Valores em env ou store (source scripts/load-agilize-credentials.sh)
#
# Uso:
#   export CURSOR_API_KEY=...
#   ./scripts/sync-agilize-secrets-to-cursor.sh

set -euo pipefail
set +x

ENV_ID="${CURSOR_ENVIRONMENT_ID:-e08c2acc-c8ee-11f1-bec7-b2318963e0b6}"
API_BASE="${CURSOR_API_BASE:-https://api.cursor.com}"

if [[ -z "${CURSOR_API_KEY:-}" ]]; then
  echo "Erro: defina CURSOR_API_KEY (Cursor Dashboard → API Keys)." >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
AGILIZE_CREDS_QUIET=1 source "$SCRIPT_DIR/load-agilize-credentials.sh" || {
  echo "Erro: credenciais Agilize/Bubble não encontradas no ambiente/store." >&2
  exit 1
}

put_secret() {
  local name="$1"
  local value="$2"
  local type="${3:-runtime_secret}"

  if [[ -z "$value" ]]; then
    echo "  skip $name (vazio)"
    return 0
  fi

  local code
  code=$(
    NAME="$name" V="$value" T="$type" \
    API_BASE="$API_BASE" ENV_ID="$ENV_ID" CURSOR_API_KEY="$CURSOR_API_KEY" \
    python3 - <<'PY'
import base64, json, os, urllib.error, urllib.request

api = os.environ["API_BASE"]
env = os.environ["ENV_ID"]
name = os.environ["NAME"]
key = os.environ["CURSOR_API_KEY"]
body = json.dumps({
    "value": os.environ["V"],
    "type": os.environ["T"],
    "repos": [],
}).encode()
req = urllib.request.Request(
    f"{api}/v1/environments/{env}/secrets/{name}",
    data=body,
    method="PUT",
    headers={
        "Content-Type": "application/json",
        "Authorization": "Basic " + base64.b64encode(f"{key}:".encode()).decode(),
    },
)
try:
    with urllib.request.urlopen(req, timeout=30) as r:
        print(r.status)
except urllib.error.HTTPError as e:
    err = e.read().decode(errors="replace")[:300]
    open("/tmp/cursor-secret-last-error.txt", "w").write(err)
    print(e.code)
PY
  )
  echo "  $name -> HTTP $code"
  if [[ "$code" != "200" && "$code" != "201" ]]; then
    echo "    erro: $(head -c 200 /tmp/cursor-secret-last-error.txt 2>/dev/null || true)" >&2
  fi
}

echo "Sincronizando secrets para environment $ENV_ID ..."

put_secret AGILIZE_SUPABASE_URL "${AGILIZE_SUPABASE_URL:-}" environment_variable
put_secret AGILIZE_SUPABASE_REST_URL "${AGILIZE_SUPABASE_REST_URL:-}" environment_variable
put_secret AGILIZE_SUPABASE_PUBLISHABLE_KEY "${AGILIZE_SUPABASE_PUBLISHABLE_KEY:-}" runtime_secret
put_secret AGILIZE_SUPABASE_SECRET_KEY "${AGILIZE_SUPABASE_SECRET_KEY:-}" runtime_secret
put_secret BUBBLE_APP_URL "${BUBBLE_APP_URL:-}" environment_variable
put_secret BUBBLE_DATA_API_URL "${BUBBLE_DATA_API_URL:-}" environment_variable
put_secret BUBBLE_WORKFLOW_API_URL "${BUBBLE_WORKFLOW_API_URL:-}" environment_variable
put_secret BUBBLE_API_TOKEN_LABEL "${BUBBLE_API_TOKEN_LABEL:-}" environment_variable
put_secret BUBBLE_API_TOKEN "${BUBBLE_API_TOKEN:-}" runtime_secret
put_secret BUBBLE_AGILIZE_KEY "${BUBBLE_AGILIZE_KEY:-${BUBBLE_API_TOKEN:-}}" runtime_secret

echo "Concluído. Novos agentes herdam esses secrets no boot."
echo "Obs: agentes já em execução não recebem secrets novos — inicie um agente novo."
