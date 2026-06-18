#!/usr/bin/env bash
# Simulação segura Disparador 2 — sem enviar WhatsApp nem criar campanha real.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "=============================================="
echo " Disparador 2 — validação segura (sem envio)"
echo "=============================================="
echo ""

FAIL=0

run_step() {
  local name="$1"
  shift
  echo ">>> $name"
  if "$@"; then
    echo "✅ $name"
  else
    echo "❌ $name"
    FAIL=1
  fi
  echo ""
}

run_step "Unit: escalonamento rotate (Playwright)" \
  npx playwright test tests/e2e/broadcast-rotate-stagger.unit.spec.ts --project=chromium-unit

run_step "Unit: rodízio e lotes (Node)" \
  node scripts/teste-rotacao-validacao-broadcast.mjs

if [[ "${SKIP_EDGE_ICLASS:-}" != "1" ]]; then
  run_step "Integração leve: edge validate (sintético)" \
    python3 scripts/teste-validacao-edge-iclass.py --org 34086d07-9181-43fc-a3e8-6aa28974d68b || true
  # edge test may warn if env missing — don't fail whole suite on warn
fi

echo "=============================================="
if [[ "$FAIL" -eq 0 ]]; then
  echo "✅ Validação segura concluída"
  exit 0
else
  echo "❌ Algum passo falhou"
  exit 1
fi
