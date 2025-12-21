#!/bin/bash
# Script para fazer push para o GitHub usando token

cd /root/kanban-buzz-95241

echo "=== Push para GitHub ==="
echo ""

# Verificar se token foi fornecido
if [ -z "$1" ]; then
    echo "❌ ERRO: Token não fornecido"
    echo ""
    echo "Uso: ./scripts/push-to-github.sh SEU_TOKEN_AQUI"
    echo ""
    echo "Para criar um token:"
    echo "1. Acesse: https://github.com/settings/tokens"
    echo "2. Clique em 'Generate new token (classic)'"
    echo "3. Dê um nome (ex: 'kanban-buzz-push')"
    echo "4. Marque a opção 'repo' (acesso completo aos repositórios)"
    echo "5. Clique em 'Generate token'"
    echo "6. Copie o token e use neste script"
    echo ""
    echo "Exemplo:"
    echo "  ./scripts/push-to-github.sh ghp_xxxxxxxxxxxxxxxxxxxx"
    exit 1
fi

TOKEN="$1"

echo "📤 Fazendo push para GitHub..."
echo ""

# Fazer push usando token na URL
git push https://${TOKEN}@github.com/rbertolino-dev/flow.git main

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Push realizado com sucesso!"
    echo ""
    echo "Commits publicados:"
    git log --oneline -2
else
    echo ""
    echo "❌ Erro ao fazer push. Verifique:"
    echo "  - Token está correto e válido"
    echo "  - Token tem permissão 'repo'"
    echo "  - Você tem acesso ao repositório rbertolino-dev/flow"
fi


