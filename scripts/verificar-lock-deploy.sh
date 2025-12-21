#!/bin/bash

# 🔍 Script: Verificar Status do Lock de Deploy
# Descrição: Mostra informações detalhadas sobre o lock de deploy
# Uso: ./scripts/verificar-lock-deploy.sh

LOCK_FILE="/tmp/deploy-zero-downtime.lock"

echo "🔍 Verificando status do lock de deploy..."
echo ""

# Verificar se lock existe
if [ ! -f "$LOCK_FILE" ]; then
    echo "✅ Lock não existe - pode fazer deploy"
    exit 0
fi

echo "📋 Lock encontrado: $LOCK_FILE"
echo ""

# Verificar quando foi modificado
echo "📅 Informações do arquivo:"
stat "$LOCK_FILE" 2>&1 | grep -E "Modify|Access|Size" | head -3
echo ""

# Verificar processos usando o lock
echo "🔍 Processos usando o lock:"
if command -v lsof &> /dev/null; then
    LOCK_USERS=$(lsof "$LOCK_FILE" 2>/dev/null || echo "")
    if [ -n "$LOCK_USERS" ]; then
        echo "$LOCK_USERS"
        echo ""
        
        # Extrair PIDs
        PIDS=$(echo "$LOCK_USERS" | awk 'NR>1 {print $2}' | sort -u)
        
        echo "📊 Detalhes dos processos:"
        for pid in $PIDS; do
            if ps -p "$pid" >/dev/null 2>&1; then
                echo "  PID $pid:"
                ps -p "$pid" -o pid,ppid,cmd,etime,stat 2>&1 | tail -1
                
                # Verificar se é processo de deploy
                if ps -p "$pid" -o cmd= | grep -q "deploy-zero-downtime"; then
                    echo "    ✅ Processo de deploy ativo"
                else
                    echo "    ⚠️  Processo não é de deploy (pode ser lock órfão)"
                fi
            else
                echo "  PID $pid: ❌ Processo não existe (lock órfão!)"
            fi
            echo ""
        done
    else
        echo "  ⚠️  Nenhum processo usando o lock (LOCK ÓRFÃO!)"
        echo ""
        echo "💡 Solução: Execute ./scripts/limpar-lock-deploy.sh"
    fi
else
    echo "  ⚠️  lsof não está disponível - não é possível verificar processos"
fi

# Verificar processos de deploy rodando
echo "🔍 Processos de deploy rodando:"
DEPLOY_PIDS=$(ps aux | grep -E "deploy-zero-downtime\.sh" | grep -v grep | awk '{print $2}' || echo "")
if [ -n "$DEPLOY_PIDS" ]; then
    echo "$DEPLOY_PIDS" | while read pid; do
        ps -p "$pid" -o pid,ppid,cmd,etime,stat 2>&1 | tail -1
    done
else
    echo "  ✅ Nenhum processo de deploy rodando"
fi
echo ""

# Testar se lock está realmente travado
echo "🧪 Teste de lock:"
if timeout 2 flock -n "$LOCK_FILE" echo "Lock livre" 2>&1; then
    echo "  ✅ Lock está livre - pode fazer deploy"
else
    echo "  ❌ Lock está ocupado"
    echo ""
    echo "💡 Se não há processo ativo, execute: ./scripts/limpar-lock-deploy.sh"
fi

exit 0





