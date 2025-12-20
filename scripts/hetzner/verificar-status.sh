#!/bin/bash

echo "╔════════════════════════════════════════╗"
echo "║  Status do Ambiente Hetzner           ║"
echo "╚════════════════════════════════════════╝"
echo ""
echo "📊 Aplicação:"
docker ps --filter "name=kanban-buzz-app" --format "  {{.Names}}: {{.Status}}"
echo ""
echo "🌐 Nginx:"
systemctl is-active nginx > /dev/null && echo "  ✅ Ativo" || echo "  ❌ Inativo"
echo ""
echo "🔒 Firewall:"
sudo ufw status | head -3
echo ""
echo "💾 Espaço em disco:"
df -h / | tail -1 | awk '{print "  " $4 " disponível de " $2}'
echo ""
echo "🌍 DNS agilizeflow.com.br:"
DNS_IP=$(dig +short agilizeflow.com.br | tail -1)
if [ -n "$DNS_IP" ]; then
  echo "  ✅ Propagado: $DNS_IP"
  if [ "$DNS_IP" = "95.217.2.116" ]; then
    echo "  ✅ Apontando corretamente para o servidor"
  else
    echo "  ⚠️  Apontando para IP diferente: $DNS_IP"
  fi
else
  echo "  ⏳ Ainda não propagado"
fi
echo ""
