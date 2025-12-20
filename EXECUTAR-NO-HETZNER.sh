#!/bin/bash
# Corrigir Nginx para React SPA - Execute no servidor Hetzner

set -e

CONFIG_FILE=$(ls /etc/nginx/sites-available/agilizeflow* /etc/nginx/sites-available/default 2>/dev/null | head -1)

if [ -z "$CONFIG_FILE" ]; then
    echo "❌ Arquivo não encontrado"
    exit 1
fi

echo "✅ Arquivo: $CONFIG_FILE"

# Backup
cp "$CONFIG_FILE" "${CONFIG_FILE}.backup-$(date +%Y%m%d-%H%M%S)"

# Adicionar try_files se não existir
if ! grep -q "try_files.*index.html" "$CONFIG_FILE"; then
    if grep -q "location / {" "$CONFIG_FILE"; then
        sed -i '/location \/ {/a\        try_files $uri $uri/ /index.html;' "$CONFIG_FILE"
        echo "✅ try_files adicionado"
    fi
fi

# Testar e recarregar
if nginx -t; then
    systemctl reload nginx
    echo "✅ Nginx recarregado!"
else
    echo "❌ Erro na configuração"
    exit 1
fi



