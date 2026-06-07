#!/usr/bin/env bash
# Suite estendida: validação + long tasks + rede lenta (+ opcional outage).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

source "$SCRIPT_DIR/load-e2e-env.sh" 2>/dev/null || true

BASE_URL="${PLAYWRIGHT_BASE_URL:-http://localhost:3000}"

echo "=== Suite estendida de diagnóstico do funil ==="
echo "Base URL: $BASE_URL"
echo ""

echo ">>> 1/4 Validação G1–G4"
FUNNEL_VALIDATION_STRICT="${FUNNEL_VALIDATION_STRICT:-}" \
PLAYWRIGHT_BASE_URL="$BASE_URL" npm run test:e2e:funnel-validation

echo ""
echo ">>> 2/4 Long tasks (prova G2 CPU)"
PLAYWRIGHT_BASE_URL="$BASE_URL" npm run test:e2e:funnel-longtask

echo ""
echo ">>> 3/4 Rede lenta (delay ${FUNNEL_SLOW_DELAY_MS:-12000}ms, outage ${FUNNEL_SLOW_OUTAGE_MS:-20000}ms)"
FUNNEL_SLOW_DELAY_MS="${FUNNEL_SLOW_DELAY_MS:-12000}" \
FUNNEL_SLOW_OUTAGE_MS="${FUNNEL_SLOW_OUTAGE_MS:-20000}" \
PLAYWRIGHT_BASE_URL="$BASE_URL" \
npm run test:e2e:funnel-slow-network

if [[ "${SKIP_OUTAGE:-}" != "1" ]]; then
  echo ""
  echo ">>> 4/4 Outage Supabase (${FUNNEL_OUTAGE_MS:-30000}ms)"
  FUNNEL_OUTAGE_MS="${FUNNEL_OUTAGE_MS:-30000}" \
  PLAYWRIGHT_BASE_URL="$BASE_URL" \
  npm run test:e2e:funnel-outage
  PLAYWRIGHT_BASE_URL="$BASE_URL" npm run test:e2e:funnel-validation
fi

echo ""
echo "=== Relatórios ==="
for f in \
  test-results/funnel-perf/validation-report.md \
  test-results/funnel-perf/longtask-report.json \
  test-results/funnel-perf/slow-network.json \
  test-results/funnel-perf/outage-recovery.json; do
  [[ -f "$f" ]] && echo "  $f"
done

echo ""
echo "Mapa de edições: docs/MAPA-EDICOES-PERFORMANCE-FUNIL.md"
