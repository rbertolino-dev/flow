#!/bin/bash

# Script para testar webhook da segunda instância
# Uso: ./test-webhook-segunda-instancia.sh

echo "🧪 Teste de Webhook - Segunda Instância"
echo "========================================"
echo ""

# Cores
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Verificar se variáveis estão configuradas
if [ -z "$SUPABASE_URL" ]; then
    echo -e "${YELLOW}⚠️  SUPABASE_URL não configurado${NC}"
    echo "Por favor, configure: export SUPABASE_URL=https://seu-projeto.supabase.co"
    exit 1
fi

# Solicitar informações
echo "📋 Informações necessárias:"
read -p "Nome da primeira instância: " INSTANCE1
read -p "Webhook secret da primeira instância: " SECRET1
read -p "Nome da segunda instância: " INSTANCE2
read -p "Webhook secret da segunda instância: " SECRET2
read -p "Número de telefone para teste (ex: 5511999999999): " PHONE

echo ""
echo "🔍 Testando primeira instância..."
echo ""

# Teste 1: Primeira instância com secret
PAYLOAD1=$(cat <<EOF
{
  "event": "messages.upsert",
  "instance": "$INSTANCE1",
  "data": {
    "key": {
      "remoteJid": "${PHONE}@s.whatsapp.net",
      "fromMe": false
    },
    "message": {
      "conversation": "Teste primeira instância - $(date +%s)"
    },
    "pushName": "Teste Instância 1"
  }
}
EOF
)

echo "📤 Enviando webhook para primeira instância..."
RESPONSE1=$(curl -s -w "\n%{http_code}" -X POST \
  "${SUPABASE_URL}/functions/v1/evolution-webhook?secret=${SECRET1}" \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: ${SECRET1}" \
  -d "$PAYLOAD1")

HTTP_CODE1=$(echo "$RESPONSE1" | tail -n1)
BODY1=$(echo "$RESPONSE1" | sed '$d')

if [ "$HTTP_CODE1" = "200" ]; then
    echo -e "${GREEN}✅ Primeira instância: OK (HTTP $HTTP_CODE1)${NC}"
    echo "Resposta: $BODY1"
else
    echo -e "${RED}❌ Primeira instância: ERRO (HTTP $HTTP_CODE1)${NC}"
    echo "Resposta: $BODY1"
fi

echo ""
echo "🔍 Testando segunda instância..."
echo ""

# Teste 2: Segunda instância com secret
PAYLOAD2=$(cat <<EOF
{
  "event": "messages.upsert",
  "instance": "$INSTANCE2",
  "data": {
    "key": {
      "remoteJid": "${PHONE}@s.whatsapp.net",
      "fromMe": false
    },
    "message": {
      "conversation": "Teste segunda instância - $(date +%s)"
    },
    "pushName": "Teste Instância 2"
  }
}
EOF
)

echo "📤 Enviando webhook para segunda instância..."
RESPONSE2=$(curl -s -w "\n%{http_code}" -X POST \
  "${SUPABASE_URL}/functions/v1/evolution-webhook?secret=${SECRET2}" \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: ${SECRET2}" \
  -d "$PAYLOAD2")

HTTP_CODE2=$(echo "$RESPONSE2" | tail -n1)
BODY2=$(echo "$RESPONSE2" | sed '$d')

if [ "$HTTP_CODE2" = "200" ]; then
    echo -e "${GREEN}✅ Segunda instância: OK (HTTP $HTTP_CODE2)${NC}"
    echo "Resposta: $BODY2"
else
    echo -e "${RED}❌ Segunda instância: ERRO (HTTP $HTTP_CODE2)${NC}"
    echo "Resposta: $BODY2"
fi

echo ""
echo "🔍 Testando segunda instância SEM secret (fallback por instance_name)..."
echo ""

# Teste 3: Segunda instância SEM secret (testa fallback)
RESPONSE3=$(curl -s -w "\n%{http_code}" -X POST \
  "${SUPABASE_URL}/functions/v1/evolution-webhook" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD2")

HTTP_CODE3=$(echo "$RESPONSE3" | tail -n1)
BODY3=$(echo "$RESPONSE3" | sed '$d')

if [ "$HTTP_CODE3" = "200" ]; then
    echo -e "${GREEN}✅ Segunda instância (sem secret): OK (HTTP $HTTP_CODE3)${NC}"
    echo "Resposta: $BODY3"
    echo -e "${YELLOW}⚠️  Fallback por instance_name funcionou!${NC}"
else
    echo -e "${RED}❌ Segunda instância (sem secret): ERRO (HTTP $HTTP_CODE3)${NC}"
    echo "Resposta: $BODY3"
fi

echo ""
echo "========================================"
echo "📊 Resumo dos Testes:"
echo "========================================"
echo ""

if [ "$HTTP_CODE1" = "200" ]; then
    echo -e "${GREEN}✅ Primeira instância: Funcionando${NC}"
else
    echo -e "${RED}❌ Primeira instância: Com problemas${NC}"
fi

if [ "$HTTP_CODE2" = "200" ]; then
    echo -e "${GREEN}✅ Segunda instância (com secret): Funcionando${NC}"
else
    echo -e "${RED}❌ Segunda instância (com secret): Com problemas${NC}"
fi

if [ "$HTTP_CODE3" = "200" ]; then
    echo -e "${GREEN}✅ Segunda instância (sem secret): Funcionando (fallback)${NC}"
else
    echo -e "${YELLOW}⚠️  Segunda instância (sem secret): Não funcionou (normal se secret for obrigatório)${NC}"
fi

echo ""
echo "💡 Dica: Verifique os logs do Supabase para mais detalhes:"
echo "   supabase functions logs evolution-webhook --limit 50"
