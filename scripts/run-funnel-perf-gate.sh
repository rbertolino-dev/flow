#!/usr/bin/env bash
# Gate de performance do funil — falha se regressão vs baseline ou cq/card > 0.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

BASELINE_FILE="${FUNNEL_BASELINE_FILE:-test-results/funnel-perf/baseline.json}"
SUMMARY_FILE="${FUNNEL_SUMMARY_FILE:-test-results/funnel-perf/multi-run/summary.json}"
REGRESSION_PCT="${FUNNEL_GATE_REGRESSION_PCT:-15}"
TARGET_LIST_KANBAN_MS="${FUNNEL_TARGET_LIST_KANBAN_MS:-5000}"

if ! command -v jq >/dev/null 2>&1; then
  echo "❌ jq é obrigatório para run-funnel-perf-gate.sh"
  exit 1
fi

if [[ ! -f "$SUMMARY_FILE" ]]; then
  echo "❌ Summary não encontrado: $SUMMARY_FILE"
  echo "   Execute antes: RUNS=5 npm run test:e2e:funnel-perf:multirun"
  exit 1
fi

if [[ ! -f "$BASELINE_FILE" ]]; then
  echo "❌ Baseline não encontrado: $BASELINE_FILE"
  exit 1
fi

fail=0

check_scenario() {
  local scenario="$1"
  local median
  local baseline_ms
  local cq
  local max_allowed

  median=$(jq -r --arg s "$scenario" '.scenarios[] | select(.scenario == $s) | .median_ms // empty' "$SUMMARY_FILE")
  baseline_ms=$(jq -r --arg s "$scenario" '.samples[] | select(.scenario == $s) | .returnToKanbanMs // empty' "$BASELINE_FILE")
  cq=$(jq -r --arg s "$scenario" '.scenarios[] | select(.scenario == $s) | .avg_callQueuePerCard // 0' "$SUMMARY_FILE")

  if [[ -z "$median" ]]; then
    echo "❌ Cenário ausente no summary: $scenario"
    fail=1
    return
  fi

  if awk -v cq="$cq" 'BEGIN { exit (cq > 0) ? 0 : 1 }'; then
    echo "❌ $scenario: callQueuePerCard=$cq (esperado 0)"
    fail=1
  else
    echo "✅ $scenario: callQueuePerCard=0"
  fi

  if [[ -n "$baseline_ms" && "$baseline_ms" != "null" ]]; then
    max_allowed=$(awk -v b="$baseline_ms" -v p="$REGRESSION_PCT" 'BEGIN { printf "%.0f", b * (1 + p / 100) }')
    if [[ "$median" -gt "$max_allowed" ]]; then
      echo "❌ $scenario: mediana=${median}ms > baseline+${REGRESSION_PCT}% (${max_allowed}ms, baseline=${baseline_ms}ms)"
      fail=1
    else
      echo "✅ $scenario: mediana=${median}ms (baseline=${baseline_ms}ms, limiar=${max_allowed}ms)"
    fi
  else
    echo "⚠️  $scenario: mediana=${median}ms (sem baseline para comparar)"
  fi
}

echo "=== Gate de performance do funil ==="
echo "Baseline: $BASELINE_FILE"
echo "Summary:  $SUMMARY_FILE"
echo "Regressão máxima: +${REGRESSION_PCT}%"
echo ""

check_scenario "view_list_to_kanban"
check_scenario "sidebar_calls_to_kanban"
check_scenario "first_load_kanban"

list_median=$(jq -r '.scenarios[] | select(.scenario == "view_list_to_kanban") | .median_ms // empty' "$SUMMARY_FILE")
if [[ -n "$list_median" ]]; then
  echo ""
  if [[ "$list_median" -le "$TARGET_LIST_KANBAN_MS" ]]; then
    echo "✅ Meta Lista→Kanban: ${list_median}ms <= ${TARGET_LIST_KANBAN_MS}ms"
  else
    echo "⚠️  Meta Lista→Kanban: ${list_median}ms > ${TARGET_LIST_KANBAN_MS}ms (ainda acima da meta)"
  fi
fi

echo ""
if [[ "$fail" -ne 0 ]]; then
  echo "❌ Gate FALHOU"
  exit 1
fi

echo "✅ Gate APROVADO"
exit 0
