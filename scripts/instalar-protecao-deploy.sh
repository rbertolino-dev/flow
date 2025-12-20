#!/bin/bash

# 🛡️ Script: Instalar Proteção de Deploy
# Descrição: Instala hooks e proteções para detectar deploys incorretos
# Uso: ./scripts/instalar-protecao-deploy.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "🛡️ Instalando proteção de deploy..."

# 1. Adicionar hook ao .bashrc
if ! grep -q "hook-docker-compose.sh" ~/.bashrc 2>/dev/null; then
    echo "" >> ~/.bashrc
    echo "# Proteção de deploy - Kanban Buzz" >> ~/.bashrc
    echo "source $SCRIPT_DIR/hook-docker-compose.sh 2>/dev/null || true" >> ~/.bashrc
    echo "✅ Hook adicionado ao .bashrc"
else
    echo "ℹ️  Hook já está no .bashrc"
fi

# 2. Criar serviço systemd para detector
sudo tee /etc/systemd/system/kanban-buzz-deploy-detector.service > /dev/null <<EOF
[Unit]
Description=Kanban Buzz Deploy Incorreto Detector
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=$PROJECT_DIR
ExecStart=/bin/bash $SCRIPT_DIR/detectar-deploy-incorreto.sh
Restart=always
RestartSec=10
StandardOutput=append:/var/log/kanban-buzz-deploy-detector.log
StandardError=append:/var/log/kanban-buzz-deploy-detector.log

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable kanban-buzz-deploy-detector
sudo systemctl start kanban-buzz-deploy-detector

echo "✅ Serviço detector iniciado"

# 3. Criar script de visualização global
sudo tee /usr/local/bin/ver-deploys-incorretos > /dev/null <<EOF
#!/bin/bash
$SCRIPT_DIR/ver-deploys-incorretos.sh
EOF

sudo chmod +x /usr/local/bin/ver-deploys-incorretos

echo "✅ Script de visualização instalado em /usr/local/bin/ver-deploys-incorretos"

# 4. Criar aliases úteis
if ! grep -q "kanban-buzz-aliases" ~/.bashrc 2>/dev/null; then
    echo "" >> ~/.bashrc
    echo "# Aliases Kanban Buzz" >> ~/.bashrc
    echo "alias ver-deploys-incorretos='$SCRIPT_DIR/ver-deploys-incorretos.sh'" >> ~/.bashrc
    echo "alias proteger-deploy='source $SCRIPT_DIR/proteger-deploy.sh'" >> ~/.bashrc
    echo "✅ Aliases adicionados"
fi

echo ""
echo "✅ Proteção de deploy instalada!"
echo ""
echo "📋 Como usar:"
echo "   - Ver deploys incorretos: ver-deploys-incorretos"
echo "   - Logs: tail -f /var/log/kanban-buzz-deploy-alerts.log"
echo "   - Status detector: sudo systemctl status kanban-buzz-deploy-detector"
echo ""
echo "🔄 Recarregue o shell ou execute: source ~/.bashrc"


