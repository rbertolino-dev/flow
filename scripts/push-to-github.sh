#!/bin/bash
# Script para fazer push para o GitHub usando token

cd /root/kanban-buzz-95241

echo "=== Push para GitHub ==="
echo ""

# Tentar carregar token do arquivo de credenciais
if [ -f "scripts/.github-credentials" ]; then
    source scripts/.github-credentials
    if [ -n "$GITHUB_TOKEN" ]; then
        TOKEN="$GITHUB_TOKEN"
        echo "✅ Token carregado do arquivo de credenciais"
        echo ""
    fi
fi

# Se token ainda não foi definido, verificar se foi passado como parâmetro
if [ -z "$TOKEN" ] && [ -n "$1" ]; then
    TOKEN="$1"
fi

# Se ainda não tem token, mostrar erro
if [ -z "$TOKEN" ]; then
    echo "❌ ERRO: Token não encontrado"
    echo ""
    echo "Opções:"
    echo "1. Usar arquivo scripts/.github-credentials (recomendado)"
    echo "2. Passar token como parâmetro: ./scripts/push-to-github.sh SEU_TOKEN_AQUI"
    echo ""
    echo "Para criar um token:"
    echo "1. Acesse: https://github.com/settings/tokens"
    echo "2. Clique em 'Generate new token (classic)'"
    echo "3. Dê um nome (ex: 'kanban-buzz-push')"
    echo "4. Marque a opção 'repo' (acesso completo aos repositórios)"
    echo "5. Clique em 'Generate token'"
    echo "6. Copie o token e adicione em scripts/.github-credentials"
    echo ""
    exit 1
fi

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



