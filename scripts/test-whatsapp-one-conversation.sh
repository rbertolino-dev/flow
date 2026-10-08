#!/usr/bin/env bash
# Testes automatizados: 1 conversa Chatwoot por número (21966224051)
# Cobre regras do Agilize Flow + app dashboard (ponte).
#
# Uso:
#   ./scripts/test-whatsapp-one-conversation.sh           # unit + integração (sem enviar WhatsApp)
#   ./scripts/test-whatsapp-one-conversation.sh --live    # também envia 1 mensagem de teste
#   ./scripts/test-whatsapp-one-conversation.sh --human   # inclui UI human-behavior
#   ./scripts/test-whatsapp-one-conversation.sh --all

set -euo pipefail
cd "$(dirname "$0")/.."

LIVE=0
HUMAN=0
for arg in "$@"; do
  case "$arg" in
    --live) LIVE=1 ;;
    --human) HUMAN=1 ;;
    --all) LIVE=1; HUMAN=1 ;;
  esac
done

echo "🧪 Unit: normalização 21966224051 → 5521966224051 + anti-@lid"
npx playwright test \
  tests/e2e/whatsapp-phone-conversation.unit.spec.ts \
  --project=chromium-unit \
  --reporter=list

echo ""
echo "🧪 Integração Chatwoot: ≤1 conversa aberta para 5521966224051"
if [[ "$LIVE" == "1" ]]; then
  export LIVE_WHATSAPP_TEST=1
  echo "⚠️  LIVE_WHATSAPP_TEST=1 — vai enviar 1 mensagem de teste no WhatsApp"
fi
npx playwright test \
  tests/e2e/chatwoot-one-conversation.integration.spec.ts \
  --project=chromium \
  --reporter=list

if [[ "$HUMAN" == "1" ]]; then
  echo ""
  echo "🧑 UI human-behavior: app dashboard (ponte)"
  npx playwright test \
    tests/e2e/chatwoot-bridge-dashboard.human.spec.ts \
    --project=chromium \
    --reporter=list || true

  echo ""
  echo "🧑 UI human-behavior: Agilize Flow (CRM)"
  npx playwright test \
    tests/e2e/agilize-flow-whatsapp-phone.human.spec.ts \
    --project=chromium \
    --reporter=list || true
fi

echo ""
echo "✅ Suite concluída (telefone 21966224051)"
