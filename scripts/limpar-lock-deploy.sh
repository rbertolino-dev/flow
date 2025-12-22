#!/bin/bash

# 🧹 Script: Limpar Lock de Deploy Travado
# Descrição: Remove lock de deploy se estiver travado (sem processo usando)
# Uso: ./scripts/limpar-lock-deploy.sh

set -e

LOCK_FILE="/tmp/deploy-zero-downtime.lock"

echo "🔍 Verificando lock de deploy..."

# Verificar se lock existe
if [ ! -f "$LOCK_FILE" ]; then
    echo "✅ Lock não existe - tudo OK"
    exit 0
fi

# Verificar se há processo usando o lock
if command -v lsof &> /dev/null; then
    PROCESSES=$(lsof "$LOCK_FILE" 2>/dev/null | wc -l)
    if [ "$PROCESSES" -gt 0 ]; then
        echo "⚠️  Lock está em uso por processo(s):"
        lsof "$LOCK_FILE" 2>/dev/null
        echo ""
        echo "Se o processo estiver travado, você pode finalizá-lo com:"
        echo "  kill <PID>"
        echo ""
        echo "Ou aguardar o deploy terminar."
        exit 1
    fi
fi

# Verificar se há processo de deploy rodando
DEPLOY_PIDS=$(ps aux | grep -E "deploy-zero-downtime\.sh" | grep -v grep | awk '{print $2}' || echo "")
if [ -n "$DEPLOY_PIDS" ]; then
    echo "⚠️  Há processo(s) de deploy rodando:"
    ps aux | grep -E "deploy-zero-downtime\.sh" | grep -v grep
    echo ""
    echo "Aguarde o deploy terminar ou finalize o processo se estiver travado."
    exit 1
fi

# Lock está órfão - pode remover com segurança
echo "✅ Lock está órfão (nenhum processo usando)"
echo "🧹 Removendo lock..."
rm -f "$LOCK_FILE"
echo "✅ Lock removido com sucesso!"
echo ""
echo "Agora você pode fazer deploy normalmente."

exit 0






