#!/bin/bash

# 🧪 Script: Teste Automático Completo com Captura de Erros
# Descrição: Executa testes E2E, captura erros e gera sugestões de correção
# Uso: ./scripts/teste-automatico-completo.sh [--fix] [--report-only]

set -e

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_ROOT"

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Teste Automático Completo             ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""

# Verificar se Playwright está instalado
if ! command -v npx &> /dev/null || ! npx playwright --version &> /dev/null; then
    echo -e "${RED}❌ Playwright não está instalado${NC}"
    echo "Execute: npm install -D @playwright/test playwright && npx playwright install"
    exit 1
fi

# Modo de execução
MODE="${1:-auto}"
FIX_MODE="${2:-}"

# Executar testes
echo -e "${BLUE}🧪 Executando testes E2E...${NC}"
echo ""

if [ "$MODE" = "--report-only" ]; then
    echo -e "${YELLOW}📊 Modo: Apenas relatório (não executa testes)${NC}"
    echo ""
else
    # Executar testes com captura completa
    if npx playwright test --reporter=html,list,json 2>&1 | tee test-results/test-execution.log; then
        echo ""
        echo -e "${GREEN}✅ Todos os testes passaram!${NC}"
        exit 0
    else
        echo ""
        echo -e "${YELLOW}⚠️  Alguns testes falharam${NC}"
        echo -e "${BLUE}📊 Analisando erros...${NC}"
    fi
fi

# Analisar erros e gerar sugestões
echo ""
echo -e "${BLUE}🔍 Analisando erros capturados...${NC}"

# Criar diretório para análise
mkdir -p test-results/analysis

# Gerar relatório de análise
cat > test-results/analysis/error-analysis.json << 'EOF'
{
  "timestamp": "$(date -Iseconds)",
  "errors": [],
  "suggestions": [],
  "screenshots": [],
  "videos": []
}
EOF

# Analisar resultados JSON do Playwright
if [ -f "test-results/results.json" ]; then
    echo -e "${BLUE}📄 Analisando resultados JSON...${NC}"
    
    # Extrair informações de erros
    node << 'NODEJS'
const fs = require('fs');
const path = require('path');

try {
    const results = JSON.parse(fs.readFileSync('test-results/results.json', 'utf8'));
    const analysis = {
        timestamp: new Date().toISOString(),
        totalTests: 0,
        passed: 0,
        failed: 0,
        errors: [],
        suggestions: []
    };
    
    function analyzeTest(test) {
        analysis.totalTests++;
        
        if (test.status === 'passed') {
            analysis.passed++;
        } else if (test.status === 'failed') {
            analysis.failed++;
            
            const error = {
                test: test.title,
                file: test.location?.file || 'unknown',
                error: test.error?.message || 'Unknown error',
                stack: test.error?.stack || '',
                screenshot: test.attachments?.find(a => a.name === 'screenshot')?.path,
                video: test.attachments?.find(a => a.name === 'video')?.path
            };
            
            analysis.errors.push(error);
            
            // Gerar sugestões baseadas no tipo de erro
            if (error.error.includes('timeout')) {
                analysis.suggestions.push({
                    type: 'timeout',
                    error: error.error,
                    suggestion: 'Aumentar timeout ou otimizar performance do elemento',
                    fix: 'Ajustar timeout no playwright.config.ts ou adicionar waitForLoadState'
                });
            } else if (error.error.includes('not found') || error.error.includes('locator')) {
                analysis.suggestions.push({
                    type: 'selector',
                    error: error.error,
                    suggestion: 'Seletor pode estar quebrado ou elemento mudou',
                    fix: 'Atualizar seletor no teste ou verificar se elemento existe na página'
                });
            } else if (error.error.includes('validation')) {
                analysis.suggestions.push({
                    type: 'validation',
                    error: error.error,
                    suggestion: 'Validação falhou - verificar dados ou lógica',
                    fix: 'Ajustar validação no teste ou corrigir dados de teste'
                });
            }
        }
    }
    
    // Processar todos os testes
    if (results.suites) {
        results.suites.forEach(suite => {
            suite.specs?.forEach(spec => {
                spec.tests?.forEach(test => {
                    analyzeTest(test);
                });
            });
        });
    }
    
    // Salvar análise
    fs.writeFileSync(
        'test-results/analysis/error-analysis.json',
        JSON.stringify(analysis, null, 2)
    );
    
    console.log(`✅ Análise concluída:`);
    console.log(`   - Total: ${analysis.totalTests}`);
    console.log(`   - Passou: ${analysis.passed}`);
    console.log(`   - Falhou: ${analysis.failed}`);
    console.log(`   - Sugestões: ${analysis.suggestions.length}`);
    
} catch (error) {
    console.error('Erro ao analisar resultados:', error.message);
}
NODEJS

else
    echo -e "${YELLOW}⚠️  Arquivo de resultados não encontrado${NC}"
fi

# Gerar relatório HTML de sugestões
echo ""
echo -e "${BLUE}📝 Gerando relatório de sugestões...${NC}"

cat > test-results/analysis/fix-suggestions.html << 'EOF'
<!DOCTYPE html>
<html>
<head>
    <title>Sugestões de Correção - Testes E2E</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .error { background: #fee; padding: 10px; margin: 10px 0; border-left: 4px solid #f00; }
        .suggestion { background: #efe; padding: 10px; margin: 10px 0; border-left: 4px solid #0f0; }
        .info { background: #eef; padding: 10px; margin: 10px 0; border-left: 4px solid #00f; }
        h1 { color: #333; }
        h2 { color: #666; margin-top: 30px; }
        code { background: #f5f5f5; padding: 2px 5px; border-radius: 3px; }
    </style>
</head>
<body>
    <h1>🔧 Sugestões de Correção - Testes E2E</h1>
    <p><strong>Data:</strong> <span id="timestamp"></span></p>
    
    <h2>📊 Resumo</h2>
    <div class="info">
        <p><strong>Total de Testes:</strong> <span id="total"></span></p>
        <p><strong>Passou:</strong> <span id="passed"></span></p>
        <p><strong>Falhou:</strong> <span id="failed"></span></p>
        <p><strong>Sugestões:</strong> <span id="suggestions-count"></span></p>
    </div>
    
    <h2>❌ Erros Encontrados</h2>
    <div id="errors"></div>
    
    <h2>💡 Sugestões de Correção</h2>
    <div id="suggestions"></div>
    
    <script>
        fetch('error-analysis.json')
            .then(r => r.json())
            .then(data => {
                document.getElementById('timestamp').textContent = new Date(data.timestamp).toLocaleString();
                document.getElementById('total').textContent = data.totalTests;
                document.getElementById('passed').textContent = data.passed;
                document.getElementById('failed').textContent = data.failed;
                document.getElementById('suggestions-count').textContent = data.suggestions.length;
                
                const errorsDiv = document.getElementById('errors');
                data.errors.forEach(err => {
                    const div = document.createElement('div');
                    div.className = 'error';
                    div.innerHTML = `
                        <h3>${err.test}</h3>
                        <p><strong>Arquivo:</strong> ${err.file}</p>
                        <p><strong>Erro:</strong> <code>${err.error}</code></p>
                        ${err.screenshot ? `<p><strong>Screenshot:</strong> <a href="../${err.screenshot}">Ver</a></p>` : ''}
                        ${err.video ? `<p><strong>Vídeo:</strong> <a href="../${err.video}">Ver</a></p>` : ''}
                    `;
                    errorsDiv.appendChild(div);
                });
                
                const suggestionsDiv = document.getElementById('suggestions');
                data.suggestions.forEach(sug => {
                    const div = document.createElement('div');
                    div.className = 'suggestion';
                    div.innerHTML = `
                        <h3>${sug.type}</h3>
                        <p><strong>Erro:</strong> <code>${sug.error}</code></p>
                        <p><strong>Sugestão:</strong> ${sug.suggestion}</p>
                        <p><strong>Correção:</strong> ${sug.fix}</p>
                    `;
                    suggestionsDiv.appendChild(div);
                });
            });
    </script>
</body>
</html>
EOF

# Mostrar resumo
echo ""
echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  ✅ Análise Concluída                   ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
echo ""
echo "📊 Relatórios gerados:"
echo "   - test-results/analysis/error-analysis.json"
echo "   - test-results/analysis/fix-suggestions.html"
echo ""
echo "📋 Próximos passos:"
echo "   1. Abrir: test-results/analysis/fix-suggestions.html"
echo "   2. Revisar erros e sugestões"
echo "   3. Aplicar correções sugeridas"
echo "   4. Re-executar testes: npm run test:e2e"
echo ""

# Se modo --fix, tentar aplicar correções automáticas
if [ "$FIX_MODE" = "--fix" ]; then
    echo -e "${BLUE}🔧 Tentando aplicar correções automáticas...${NC}"
    # Aqui você pode adicionar lógica para aplicar correções automáticas
    echo -e "${YELLOW}⚠️  Correções automáticas ainda não implementadas${NC}"
    echo "   Revise as sugestões manualmente"
fi

