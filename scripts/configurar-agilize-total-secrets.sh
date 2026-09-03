#!/usr/bin/env bash
# Configura secrets da Edge Function agilize-eprodutos-import
set -euo pipefail

PROJECT_REF="${SUPABASE_PROJECT_REF:-ogeljmbhqxpfjbpnbwog}"
AGILIZE_TOTAL_URL="${AGILIZE_TOTAL_URL:-https://svyglaxdnibamkpklwvs.supabase.co}"
AGILIZE_TOTAL_SERVICE_KEY="${AGILIZE_TOTAL_SERVICE_KEY:-sb_secret_7JNtTz46-ObEW56_pcJwGQ_LOPfoa9c}"

echo "Configurando secrets Agilize Total para project $PROJECT_REF ..."
supabase secrets set \
  AGILIZE_TOTAL_URL="$AGILIZE_TOTAL_URL" \
  AGILIZE_TOTAL_SERVICE_KEY="$AGILIZE_TOTAL_SERVICE_KEY" \
  --project-ref "$PROJECT_REF"

echo "OK. Secrets configurados."
