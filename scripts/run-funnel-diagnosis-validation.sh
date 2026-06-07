#!/usr/bin/env bash
# Validação completa do diagnóstico G1–G4 + outage (com vereditos CONFIRMADO/REFUTADO).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

# shellcheck source=scripts/load-e2e-env.sh
source "$SCRIPT_DIR/load-e2e-env.sh"

BASE_URL="${PLAYWRIGHT_BASE_URL:-http://localhost:3000}"
OUTAGE_MS="${FUNNEL_OUTAGE_MS:-8000}"

echo "=== 1/3 Testes unitários (motor de validação) ==="
npm run test:unit:funnel-validation

echo ""
echo "=== 2/3 Baseline funil + vereditos (E2E) ==="
PLAYWRIGHT_BASE_URL="$BASE_URL" npm run test:e2e:funnel-validation

echo ""
echo "=== 3/3 Simulação outage Supabase (${OUTAGE_MS}ms) ==="
FUNNEL_OUTAGE_MS="$OUTAGE_MS" PLAYWRIGHT_BASE_URL="$BASE_URL" npm run test:e2e:funnel-outage

echo ""
echo "=== Re-gerando vereditos com dados de outage ==="
PLAYWRIGHT_BASE_URL="$BASE_URL" npm run test:e2e:funnel-validation

echo ""
echo "=== Relatórios ==="
for f in \
  test-results/funnel-perf/validation-report.md \
  test-results/funnel-perf/latest.json \
  test-results/funnel-perf/outage-recovery.json; do
  if [[ -f "$f" ]]; then
    echo "  $f"
  fi
done

if command -v jq >/dev/null 2>&1 && [[ -f test-results/funnel-perf/validation-report.json ]]; then
  echo ""
  echo "=== Vereditos ==="
  jq -r '.verdicts[] | "\(.id): \(.status) (\(.confidence)) — \(.title)"' test-results/funnel-perf/validation-report.json
  echo ""
  trustworthy=$(jq -r '.diagnosisTrustworthy' test-results/funnel-perf/validation-report.json)
  echo "Diagnóstico confiável: $trustworthy"
fi

echo ""
echo "Gate estrito: FUNNEL_VALIDATION_STRICT=1 $0"
