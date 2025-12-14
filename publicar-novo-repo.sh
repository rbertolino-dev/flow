#!/bin/bash

# Script para publicar projeto em um novo repositório GitHub
# Sem afetar o repositório original

echo "🚀 Publicar em Novo Repositório GitHub"
echo "========================================"
echo ""

# Verificar se já existe um remote
if git remote | grep -q "^origin$"; then
    echo "⚠️  Repositório atual conectado a:"
    git remote get-url origin
    echo ""
    read -p "Deseja remover a conexão atual e conectar a um novo repositório? (s/n): " confirmar
    
    if [ "$confirmar" != "s" ] && [ "$confirmar" != "S" ]; then
        echo "❌ Operação cancelada."
        exit 0
    fi
    
    echo ""
    echo "📝 Removendo conexão com repositório original..."
    git remote remove origin
    echo "✅ Removido!"
fi

echo ""
echo "📋 Por favor, forneça a URL do NOVO repositório GitHub:"
echo "   Exemplo: https://github.com/seu-usuario/nome-do-repo.git"
read -p "URL: " nova_url

if [ -z "$nova_url" ]; then
    echo "❌ URL não fornecida. Operação cancelada."
    exit 1
fi

echo ""
echo "🔗 Conectando ao novo repositório..."
git remote add origin "$nova_url"

echo ""
echo "✅ Verificando conexão..."
git remote -v

echo ""
read -p "Deseja fazer push agora? (s/n): " fazer_push

if [ "$fazer_push" = "s" ] || [ "$fazer_push" = "S" ]; then
    echo ""
    echo "📤 Fazendo push para o novo repositório..."
    git push -u origin main
    
    if [ $? -eq 0 ]; then
        echo ""
        echo "✅ Sucesso! Projeto publicado no novo repositório!"
        echo "🌐 Acesse: $nova_url"
    else
        echo ""
        echo "❌ Erro ao fazer push. Verifique:"
        echo "   1. Se o repositório foi criado no GitHub"
        echo "   2. Se você tem permissão para fazer push"
        echo "   3. Se a URL está correta"
    fi
else
    echo ""
    echo "ℹ️  Conexão configurada. Execute 'git push -u origin main' quando quiser publicar."
fi

