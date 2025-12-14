#!/bin/bash

# Script para fazer push do código para o repositório flow
# GARANTE: Não mexe no repositório original

echo "🚀 Publicando código no repositório flow"
echo "=========================================="
echo ""
echo "✅ Verificando configuração..."
echo "   Repositório remoto: $(git remote get-url origin)"
echo ""

# Verificar se está no repositório correto
if [[ ! "$(git remote get-url origin)" == *"flow.git"* ]]; then
    echo "❌ ERRO: O remote não aponta para o repositório flow!"
    echo "   Remote atual: $(git remote get-url origin)"
    exit 1
fi

echo "✅ Remote correto confirmado (flow.git)"
echo "✅ Repositório original NÃO será afetado"
echo ""

# Verificar se há mudanças não commitadas
if ! git diff-index --quiet HEAD --; then
    echo "⚠️  Há mudanças não commitadas. Deseja commitá-las? (s/n)"
    read -p "> " resposta
    if [ "$resposta" = "s" ] || [ "$resposta" = "S" ]; then
        git add .
        git commit -m "Atualizações locais"
    fi
fi

echo ""
echo "📤 Fazendo push para o repositório flow..."
echo "   (Você precisará autenticar com token do GitHub)"
echo ""

# Tentar push
git push -u origin main --force

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ SUCESSO! Código publicado no repositório flow!"
    echo "🌐 Acesse: https://github.com/rbertolino-dev/flow"
    echo ""
    echo "✅ Repositório original permanece intacto!"
else
    echo ""
    echo "❌ Erro ao fazer push. Possíveis causas:"
    echo "   1. Falta de autenticação (precisa de token GitHub)"
    echo "   2. Sem permissão no repositório"
    echo ""
    echo "📝 Para autenticar:"
    echo "   1. Crie um token: https://github.com/settings/tokens"
    echo "   2. Execute: git push -u origin main --force"
    echo "   3. Quando pedir senha, cole o token"
fi

