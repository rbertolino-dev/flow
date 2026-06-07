#!/usr/bin/env bash
# Cria .env.e2e.local (gitignored) sem ecoar senha no terminal.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
OUT="$PROJECT_ROOT/.env.e2e.local"

if [[ -f "$OUT" && "${FORCE_E2E_SETUP:-}" != "1" ]]; then
  echo ".env.e2e.local já existe. Use FORCE_E2E_SETUP=1 para sobrescrever."
  exit 0
fi

EMAIL="${E2E_EMAIL:-${TEST_LOGIN_EMAIL:-pubdigital.net@gmail.com}}"
PASS="${E2E_PASSWORD:-${TEST_LOGIN_PASSWORD:-123456}}"

if [[ -z "$PASS" ]]; then
  if [[ -t 0 ]]; then
    read -r -p "E2E_EMAIL [$EMAIL]: " input_email
    EMAIL="${input_email:-$EMAIL}"
    read -r -s -p "E2E_PASSWORD: " PASS
    echo ""
  else
    echo "Defina E2E_PASSWORD ou TEST_LOGIN_PASSWORD (ou rode em terminal interativo)."
    exit 1
  fi
fi

umask 077
cat > "$OUT" <<EOF
# Gerado por scripts/setup-e2e-local.sh — NÃO commitar
E2E_EMAIL=$EMAIL
E2E_PASSWORD=$PASS
EOF
chmod 600 "$OUT"
echo "Criado $OUT (chmod 600). E-mail: $(echo "$EMAIL" | sed 's/^\(..\).*/\1***/')"
