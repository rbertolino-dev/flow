#!/usr/bin/env bash
# Suíte cautelosa — agenda de mensagens (timezone + smoke edge).
# Não executa E2E de UI nem disparador.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "=== 1/2 — Unitários timezone (scheduled_messages) ==="
node scripts/teste-agenda-timezone.mjs

echo ""
echo "=== 2/2 — Smoke edge process-scheduled-messages ==="
EDGE_EXIT=0
python3 scripts/teste-agenda-edge-smoke.py || EDGE_EXIT=$?

if [[ "$EDGE_EXIT" -eq 2 ]]; then
  echo "⚠️  Smoke edge ignorado (ambiente sem chaves Supabase)"
elif [[ "$EDGE_EXIT" -ne 0 ]]; then
  echo "❌ Smoke edge falhou"
  exit 1
fi

echo ""
echo "✅ Suíte agenda (cautelosa) concluída."
