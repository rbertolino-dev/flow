#!/bin/bash

# 📊 Script: Criar Dashboard HTML de Versões
# Descrição: Gera uma página HTML visual para ver versões
# Uso: ./scripts/create-dashboard.sh

set -e

# Cores
GREEN='\033[0;32m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Diretório do script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
VERSIONS_FILE="$PROJECT_DIR/.versions.json"
DASHBOARD_FILE="$PROJECT_DIR/dashboard-versions.html"

# Verificar se jq está instalado
if ! command -v jq &> /dev/null; then
    echo -e "${RED}❌ jq não está instalado${NC}"
    exit 1
fi

cd "$PROJECT_DIR"

# Verificar se arquivo existe
if [ ! -f "$VERSIONS_FILE" ]; then
    echo -e "${YELLOW}⚠️  Nenhuma versão registrada ainda${NC}"
    exit 0
fi

# Gerar HTML
cat > "$DASHBOARD_FILE" <<'HTML_HEAD'
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>📦 Dashboard de Versões - Kanban Buzz</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 20px;
            min-height: 100vh;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 15px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.2);
            padding: 30px;
        }
        h1 {
            color: #333;
            margin-bottom: 10px;
            font-size: 2.5em;
        }
        .subtitle {
            color: #666;
            margin-bottom: 30px;
            font-size: 1.1em;
        }
        .stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        .stat-card {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 20px;
            border-radius: 10px;
            text-align: center;
        }
        .stat-card h3 {
            font-size: 2em;
            margin-bottom: 5px;
        }
        .stat-card p {
            opacity: 0.9;
            font-size: 0.9em;
        }
        .versions-list {
            margin-top: 30px;
        }
        .version-item {
            background: #f8f9fa;
            border-left: 4px solid #667eea;
            padding: 20px;
            margin-bottom: 15px;
            border-radius: 5px;
            transition: transform 0.2s, box-shadow 0.2s;
        }
        .version-item:hover {
            transform: translateX(5px);
            box-shadow: 0 5px 15px rgba(0,0,0,0.1);
        }
        .version-item.current {
            background: #e8f5e9;
            border-left-color: #4caf50;
        }
        .version-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 10px;
        }
        .version-number {
            font-size: 1.5em;
            font-weight: bold;
            color: #333;
        }
        .version-number.current {
            color: #4caf50;
        }
        .version-badge {
            background: #4caf50;
            color: white;
            padding: 5px 15px;
            border-radius: 20px;
            font-size: 0.8em;
            font-weight: bold;
        }
        .version-details {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin-top: 15px;
            color: #666;
            font-size: 0.9em;
        }
        .version-detail {
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .version-detail strong {
            color: #333;
        }
        .version-changes {
            margin-top: 15px;
            padding: 15px;
            background: white;
            border-radius: 5px;
            border: 1px solid #e0e0e0;
        }
        .version-changes h4 {
            color: #333;
            margin-bottom: 10px;
        }
        .version-changes p {
            color: #666;
            line-height: 1.6;
            white-space: pre-wrap;
        }
        .footer {
            margin-top: 40px;
            text-align: center;
            color: #666;
            padding-top: 20px;
            border-top: 1px solid #e0e0e0;
        }
        .refresh-btn {
            background: #667eea;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 5px;
            cursor: pointer;
            font-size: 1em;
            margin-top: 20px;
        }
        .refresh-btn:hover {
            background: #5568d3;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>📦 Dashboard de Versões</h1>
        <p class="subtitle">Sistema de Versionamento Automático - Kanban Buzz</p>
HTML_HEAD

# Adicionar estatísticas
CURRENT_VERSION=$(jq -r '.current_version' "$VERSIONS_FILE" 2>/dev/null || echo "0.0.0")
TOTAL_VERSIONS=$(jq '.versions | length' "$VERSIONS_FILE" 2>/dev/null || echo "0")
LAST_UPDATED=$(jq -r '.last_updated' "$VERSIONS_FILE" 2>/dev/null || echo "N/A")

cat >> "$DASHBOARD_FILE" <<HTML_STATS
        <div class="stats">
            <div class="stat-card">
                <h3>$CURRENT_VERSION</h3>
                <p>Versão Atual</p>
            </div>
            <div class="stat-card">
                <h3>$TOTAL_VERSIONS</h3>
                <p>Total de Versões</p>
            </div>
            <div class="stat-card">
                <h3>$(date -d "$LAST_UPDATED" +"%d/%m/%Y" 2>/dev/null || echo "$LAST_UPDATED")</h3>
                <p>Última Atualização</p>
            </div>
        </div>
HTML_STATS

# Adicionar lista de versões
cat >> "$DASHBOARD_FILE" <<HTML_VERSIONS
        <div class="versions-list">
            <h2 style="margin-bottom: 20px; color: #333;">Histórico de Versões</h2>
HTML_VERSIONS

# Processar versões
jq -r '.versions[] | 
    "\(.version)|\(.timestamp)|\(.git_hash)|\(.git_branch)|\(.changes)"' \
    "$VERSIONS_FILE" | while IFS='|' read -r version timestamp hash branch changes; do
    
    version=$(echo "$version" | xargs)
    timestamp=$(echo "$timestamp" | xargs)
    hash=$(echo "$hash" | xargs)
    branch=$(echo "$branch" | xargs)
    changes=$(echo "$changes" | xargs | sed 's/"/\\"/g')
    
    formatted_date=$(date -d "$timestamp" +"%d/%m/%Y %H:%M:%S" 2>/dev/null || echo "$timestamp")
    
    is_current=""
    badge=""
    if [ "$version" = "$CURRENT_VERSION" ]; then
        is_current="current"
        badge='<span class="version-badge">ATUAL</span>'
    fi
    
    cat >> "$DASHBOARD_FILE" <<HTML_VERSION_ITEM
            <div class="version-item $is_current">
                <div class="version-header">
                    <span class="version-number $is_current">$version</span>
                    $badge
                </div>
                <div class="version-details">
                    <div class="version-detail">
                        <strong>📅 Data:</strong> $formatted_date
                    </div>
                    <div class="version-detail">
                        <strong>🔀 Branch:</strong> $branch
                    </div>
                    <div class="version-detail">
                        <strong>🔑 Hash:</strong> $hash
                    </div>
                </div>
                <div class="version-changes">
                    <h4>Mudanças:</h4>
                    <p>$changes</p>
                </div>
            </div>
HTML_VERSION_ITEM
done

# Footer
cat >> "$DASHBOARD_FILE" <<HTML_FOOT
        </div>
        <div class="footer">
            <p>Dashboard gerado automaticamente em $(date +"%d/%m/%Y %H:%M:%S")</p>
            <button class="refresh-btn" onclick="location.reload()">🔄 Atualizar</button>
        </div>
    </div>
</body>
</html>
HTML_FOOT

echo -e "${GREEN}✅ Dashboard HTML criado com sucesso!${NC}"
echo -e "${CYAN}Arquivo:${NC} $DASHBOARD_FILE"
echo -e "${BLUE}Abra no navegador:${NC} file://$DASHBOARD_FILE"
echo ""
echo -e "${YELLOW}Ou visualize via servidor web:${NC}"
echo -e "  ${CYAN}python3 -m http.server 8080${NC}"
echo -e "  ${CYAN}Depois acesse: http://localhost:8080/dashboard-versions.html${NC}"





