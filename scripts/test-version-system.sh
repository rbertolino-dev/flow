#!/bin/bash
# Script de teste do sistema de versionamento

echo "🧪 Testando Sistema de Versionamento..."
echo ""

# Teste 1: Verificar scripts
echo "1️⃣ Verificando scripts..."
for script in version-manager.sh deploy-with-version.sh show-versions.sh quick-deploy.sh create-dashboard.sh; do
    if [ -f "scripts/$script" ] && [ -x "scripts/$script" ]; then
        echo "  ✅ $script"
    else
        echo "  ❌ $script"
    fi
done

# Teste 2: Verificar jq
echo ""
echo "2️⃣ Verificando dependências..."
if command -v jq &> /dev/null; then
    echo "  ✅ jq instalado"
else
    echo "  ❌ jq não instalado"
fi

# Teste 3: Verificar arquivo de versões
echo ""
echo "3️⃣ Verificando arquivo de versões..."
if [ -f ".versions.json" ]; then
    echo "  ✅ .versions.json existe"
    CURRENT=$(jq -r '.current_version' .versions.json 2>/dev/null || echo "erro")
    echo "  📦 Versão atual: $CURRENT"
else
    echo "  ⚠️  .versions.json não existe (será criado no primeiro deploy)"
fi

# Teste 4: Testar comando v
echo ""
echo "4️⃣ Testando comando ./scripts/v..."
if ./scripts/v &> /dev/null; then
    echo "  ✅ Comando v funciona"
else
    echo "  ⚠️  Comando v precisa de versões para mostrar"
fi

echo ""
echo "✅ Testes concluídos!"
