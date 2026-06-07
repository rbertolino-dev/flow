#!/usr/bin/env bash
# Executa benchmark do funil em múltiplas rodadas e compara mediana com baseline.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

RUNS="${RUNS:-5}"
BASE_URL="${PLAYWRIGHT_BASE_URL:-http://localhost}"
OUT_DIR="test-results/funnel-perf/multi-run"
BASELINE_FILE="test-results/funnel-perf/baseline.json"

if ! [[ "$RUNS" =~ ^[0-9]+$ ]] || [[ "$RUNS" -lt 1 ]]; then
  echo "RUNS inválido: $RUNS (use inteiro >= 1)"
  exit 1
fi

mkdir -p "$OUT_DIR"
rm -f "$OUT_DIR"/run-*.json "$OUT_DIR"/summary.json "$OUT_DIR"/comparison.md

echo "Benchmark funil em $RUNS rodada(s) - baseURL=$BASE_URL"
for i in $(seq 1 "$RUNS"); do
  echo ""
  echo "===== RODADA $i/$RUNS ====="
  PLAYWRIGHT_BASE_URL="$BASE_URL" "$SCRIPT_DIR/run-funnel-perf-baseline.sh"
  cp "test-results/funnel-perf/latest.json" "$OUT_DIR/run-$i.json"
done

if ! command -v jq >/dev/null 2>&1; then
  echo "jq não encontrado; comparação agregada não será gerada."
  exit 0
fi

ALL_RUNS_JSON="$OUT_DIR/all-runs.json"
jq -s '.' "$OUT_DIR"/run-*.json > "$ALL_RUNS_JSON"

SUMMARY_JSON="$OUT_DIR/summary.json"
jq -n \
  --argjson runs "$RUNS" \
  --slurpfile baseline "$BASELINE_FILE" \
  --slurpfile runsData "$ALL_RUNS_JSON" '
  def median(arr):
    (arr|sort) as $s
    | ($s|length) as $n
    | if $n == 0 then null
      elif ($n % 2) == 1 then $s[($n / 2 | floor)]
      else (($s[$n / 2 - 1] + $s[$n / 2]) / 2)
      end;
  def pct(diff; base):
    if (base // 0) == 0 then null else ((diff / base) * 100) end;
  ($runsData[0] | map(.samples[]) | group_by(.scenario) | map({
      scenario: .[0].scenario,
      runs_ms: map(.returnToKanbanMs),
      avg_ms: (map(.returnToKanbanMs) | add / length),
      median_ms: median(map(.returnToKanbanMs)),
      min_ms: (map(.returnToKanbanMs) | min),
      max_ms: (map(.returnToKanbanMs) | max),
      avg_callQueuePerCard: (map(.ratios.callQueuePerCard) | add / length)
    })) as $agg
  | {
      runs: $runs,
      generated_at: (now | todate),
      base_url: ($runsData[0][0].baseUrl // null),
      scenarios: [
        $agg[] as $a
        | ($baseline[0].samples[]? | select(.scenario == $a.scenario)) as $b
        | {
            scenario: $a.scenario,
            baseline_ms: ($b.returnToKanbanMs // null),
            runs_ms: $a.runs_ms,
            avg_ms: ($a.avg_ms | round),
            median_ms: ($a.median_ms | round),
            min_ms: $a.min_ms,
            max_ms: $a.max_ms,
            avg_callQueuePerCard: (($a.avg_callQueuePerCard * 1000 | round) / 1000),
            ganho_avg_ms: (if $b.returnToKanbanMs then (($b.returnToKanbanMs - $a.avg_ms) | round) else null end),
            ganho_median_ms: (if $b.returnToKanbanMs then (($b.returnToKanbanMs - $a.median_ms) | round) else null end),
            ganho_avg_percent: (if $b.returnToKanbanMs then (pct(($b.returnToKanbanMs - $a.avg_ms); $b.returnToKanbanMs) | round) else null end),
            ganho_median_percent: (if $b.returnToKanbanMs then (pct(($b.returnToKanbanMs - $a.median_ms); $b.returnToKanbanMs) | round) else null end)
          }
      ]
    }' > "$SUMMARY_JSON"

SUMMARY_MD="$OUT_DIR/comparison.md"
{
  echo "# Benchmark funil (${RUNS} rodadas)"
  echo ""
  jq -r '
    .scenarios[] |
    "- \(.scenario): baseline=\(.baseline_ms // "—")ms | media=\(.avg_ms)ms | mediana=\(.median_ms)ms | ganho_mediana=\(.ganho_median_ms // "—")ms (\(.ganho_median_percent // "—")%) | cq/card=\(.avg_callQueuePerCard)"
  ' "$SUMMARY_JSON"
} > "$SUMMARY_MD"

echo ""
echo "Resumo salvo em:"
echo "  - $SUMMARY_JSON"
echo "  - $SUMMARY_MD"
