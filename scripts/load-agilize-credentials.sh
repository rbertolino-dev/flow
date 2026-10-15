#!/usr/bin/env bash
# Carrega credenciais Agilize Total (Supabase + Bubble) SEM versioná-las.
# Ordem:
#   1) Variáveis já injetadas (Cursor Runtime Secrets)
#   2) /cursor/stores/user/agilize-api-credentials.env
#   3) /cursor/stores/self/agilize-api-credentials.env
#
# Uso: source scripts/load-agilize-credentials.sh
# Nunca imprime valores dos secrets.

set +x
_agilize_creds_loaded=0

_agilize_has_core() {
  [[ -n "${AGILIZE_SUPABASE_SECRET_KEY:-}" && -n "${BUBBLE_API_TOKEN:-}" ]]
}

if _agilize_has_core; then
  _agilize_creds_loaded=1
else
  for _f in \
    /cursor/stores/user/agilize-api-credentials.env \
    /cursor/stores/self/agilize-api-credentials.env
  do
    if [[ -f "$_f" ]]; then
      # shellcheck disable=SC1090
      set -a
      # shellcheck disable=SC1090
      source "$_f"
      set +a
      if _agilize_has_core; then
        _agilize_creds_loaded=1
        break
      fi
    fi
  done
fi

# Aliases úteis para edge functions / scripts existentes
if [[ -n "${BUBBLE_API_TOKEN:-}" && -z "${BUBBLE_AGILIZE_KEY:-}" ]]; then
  export BUBBLE_AGILIZE_KEY="$BUBBLE_API_TOKEN"
fi
if [[ -n "${AGILIZE_SUPABASE_URL:-}" && -z "${AGILIZE_SUPABASE_REST_URL:-}" ]]; then
  export AGILIZE_SUPABASE_REST_URL="${AGILIZE_SUPABASE_URL%/}/rest/v1"
fi

if [[ "${AGILIZE_CREDS_QUIET:-}" != "1" ]]; then
  if [[ "$_agilize_creds_loaded" -eq 1 ]]; then
    echo "[agilize-creds] OK (supabase=${AGILIZE_SUPABASE_URL:+yes} bubble=${BUBBLE_DATA_API_URL:+yes})"
  else
    echo "[agilize-creds] AUSENTE — cadastre Runtime Secrets no Environment do Cursor Cloud" >&2
    return 1 2>/dev/null || exit 1
  fi
fi

unset _f _agilize_creds_loaded
unset -f _agilize_has_core 2>/dev/null || true
