#!/usr/bin/env bash
# Baseline de performance com volume alto (≥150 cards).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

TARGET="${E2E_FUNNEL_LEAD_TARGET:-150}"

echo "=== Seed E2E (meta: ${TARGET} leads) ==="
node scripts/seed-e2e-funnel-leads.mjs

echo ""
echo "=== Diagnóstico completo ==="
npm run test:funnel-diagnosis:full

echo ""
if [[ -f test-results/funnel-perf/latest.json ]]; then
  cp test-results/funnel-perf/latest.json test-results/funnel-perf/baseline-high-volume.json
  echo "Baseline salvo: test-results/funnel-perf/baseline-high-volume.json"
  if command -v jq >/dev/null 2>&1; then
    cards=$(jq '[.samples[].visibleKanbanCards] | max // 0' test-results/funnel-perf/baseline-high-volume.json)
    echo "Cards visíveis (max cenário): $cards"
  fi
else
  echo "AVISO: latest.json não gerado — verifique credenciais E2E e app em :3000"
  exit 1
fi
