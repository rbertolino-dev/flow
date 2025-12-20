#!/bin/bash
DOMINIO="agilizeflow.com.br"
EMAIL="admin@agilizeflow.com.br"
SERVER_IP="95.217.2.116"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "🔍 Monitorando DNS para $DOMINIO..."
MAX_TENTATIVAS=30
TENTATIVA=0

while [ $TENTATIVA -lt $MAX_TENTATIVAS ]; do
    DNS_IP=$(dig +short $DOMINIO | tail -1)
    if [ -n "$DNS_IP" ] && [ "$DNS_IP" = "$SERVER_IP" ]; then
        echo "✅ DNS propagado! Configurando SSL..."
        bash "$SCRIPT_DIR/configurar-ssl.sh" "$DOMINIO" "$EMAIL"
        exit 0
    fi
    echo "⏳ Tentativa $((TENTATIVA+1))/$MAX_TENTATIVAS..."
    TENTATIVA=$((TENTATIVA+1))
    sleep 30
done
echo "⏰ Timeout. Execute manualmente quando DNS propagar."



