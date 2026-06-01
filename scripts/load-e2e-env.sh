#!/usr/bin/env bash
# Carrega E2E_EMAIL / E2E_PASSWORD de .env.e2e.local sem imprimir segredos.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
E2E_ENV_FILE="${E2E_ENV_FILE:-$PROJECT_ROOT/.env.e2e.local}"

if [[ -n "${E2E_EMAIL:-}" && -n "${E2E_PASSWORD:-}" ]]; then
  exit 0
fi

if [[ ! -f "$E2E_ENV_FILE" ]]; then
  echo "Arquivo de credenciais não encontrado: .env.e2e.local"
  echo "  cp .env.e2e.example .env.e2e.local"
  echo "  chmod 600 .env.e2e.local"
  echo "  # edite E2E_EMAIL e E2E_PASSWORD (conta de teste dedicada)"
  exit 1
fi

# Restringe leitura ao dono do arquivo
perm="$(stat -c '%a' "$E2E_ENV_FILE" 2>/dev/null || stat -f '%OLp' "$E2E_ENV_FILE")"
if [[ "$perm" != "600" && "$perm" != "400" ]]; then
  chmod 600 "$E2E_ENV_FILE" 2>/dev/null || true
  echo "Permissões de .env.e2e.local ajustadas para 600"
fi

set -a
# shellcheck disable=SC1090
source "$E2E_ENV_FILE"
set +a

if [[ -z "${E2E_EMAIL:-}" || -z "${E2E_PASSWORD:-}" ]]; then
  echo "E2E_EMAIL e E2E_PASSWORD devem estar definidos em .env.e2e.local"
  exit 1
fi
