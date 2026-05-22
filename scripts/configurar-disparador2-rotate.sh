#!/usr/bin/env bash
# Configura webhooks + sync para Disparador 2 (modo rotacionar) — org IClass por padrão
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
ORG="${1:-34086d07-9181-43fc-a3e8-6aa28974d68b}"
exec python3 "$ROOT/scripts/configurar-disparador2-rotate.py" --org "$ORG"
