#!/usr/bin/env bash
# Mede baseline de performance do funil (troca de abas) e grava JSON + diagnosis em test-results/funnel-perf/
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

if [[ -z "${E2E_EMAIL:-}" || -z "${E2E_PASSWORD:-}" ]]; then
  echo "Defina E2E_EMAIL e E2E_PASSWORD para medir o funil em ambiente real."
  exit 1
fi

echo "Medindo performance do funil (Playwright)..."
npx playwright test tests/e2e/funnel-tab-switch.perf.spec.ts --project=chromium

LATEST="test-results/funnel-perf/latest.json"
if [[ ! -f "$LATEST" ]]; then
  echo "Arquivo $LATEST não gerado."
  exit 1
fi

echo ""
echo "=== Cenários ==="
if command -v jq >/dev/null 2>&1; then
  jq -r '.samples[] | "\(.scenario): \(.returnToKanbanMs)ms | 1º card \(.firstCardVisibleMs)ms | cq/card=\(.ratios.callQueuePerCard | . * 100 | floor / 100) | primary=\(.primaryBottleneck // "—")"' "$LATEST"
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
