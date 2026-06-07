#!/usr/bin/env bash
# Mede baseline de performance do funil — credenciais via .env.e2e.local (nunca commitadas).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

# shellcheck source=scripts/load-e2e-env.sh
source "$SCRIPT_DIR/load-e2e-env.sh"

if [[ ! -f "$PROJECT_ROOT/.env.e2e.local" ]]; then
  echo "Criando .env.e2e.local (setup seguro)..."
  FORCE_E2E_SETUP="${FORCE_E2E_SETUP:-}" "$SCRIPT_DIR/setup-e2e-local.sh" || true
fi

echo "Medindo performance do funil (Playwright, build Docker)..."
npm run test:e2e:funnel-perf:secure

LATEST="test-results/funnel-perf/latest.json"
if [[ ! -f "$LATEST" ]]; then
  echo "Arquivo $LATEST não gerado."
  exit 1
fi

echo ""
echo "=== Cenários (sem credenciais nos logs) ==="
if command -v jq >/dev/null 2>&1; then
  jq -r '.samples[] | "\(.scenario): \(.returnToKanbanMs)ms | cq/card=\(.ratios.callQueuePerCard | . * 100 | floor / 100) | primary=\(.primaryBottleneck // "—")"' "$LATEST"
  echo ""
  echo "=== Diagnóstico global ==="
  jq -r '.reportDiagnosis[]? | "[\(.severity)] \(.id): \(.message)"' "$LATEST"
else
  cat "$LATEST"
fi

if [[ -f test-results/funnel-perf/diagnosis-summary.md ]]; then
  echo ""
  echo "Relatório: test-results/funnel-perf/diagnosis-summary.md"
fi

echo ""
echo "Para fixar baseline: cp $LATEST test-results/funnel-perf/baseline.json"
