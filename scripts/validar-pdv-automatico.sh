#!/usr/bin/env bash
# Validação automática do PDV (API + Postgres Hetzner)
# Uso: ./scripts/validar-pdv-automatico.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

ERRORS=0
pass() { echo -e "${GREEN}✅ $1${NC}"; }
fail() { echo -e "${RED}❌ $1${NC}"; ERRORS=$((ERRORS + 1)); }
info() { echo -e "${BLUE}→ $1${NC}"; }

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Validação automática PDV              ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""

# Credenciais E2E (sem logar valores)
load_env_file() {
  local file="$1"
  [ -f "$file" ] || return 0
  while IFS= read -r line || [ -n "$line" ]; do
    local trimmed="${line#"${line%%[![:space:]]*}"}"
    trimmed="${trimmed%"${trimmed##*[![:space:]]}"}"
    [ -z "$trimmed" ] && continue
    [[ "$trimmed" == \#* ]] && continue
    [[ "$trimmed" != *=* ]] && continue
    local key="${trimmed%%=*}"
    local value="${trimmed#*=}"
    # strip quotes
    if [[ "$value" == \"*\" && "$value" == *\" ]]; then
      value="${value:1:-1}"
    elif [[ "$value" == \'*\' && "$value" == *\' ]]; then
      value="${value:1:-1}"
    fi
    # não sobrescrever se já definido
    if [ -z "${!key:-}" ]; then
      export "$key=$value"
    fi
  done < "$file"
}

load_env_file "$PROJECT_ROOT/.env"
load_env_file "$PROJECT_ROOT/.env.e2e.local"

if [ -z "${E2E_EMAIL:-}" ] || [ -z "${E2E_PASSWORD:-}" ]; then
  fail "E2E_EMAIL/E2E_PASSWORD ausentes (.env.e2e.local)"
  exit 1
fi

SUPABASE_URL="${VITE_SUPABASE_URL:-${SUPABASE_URL:-}}"
SUPABASE_ANON="${VITE_SUPABASE_PUBLISHABLE_KEY:-${SUPABASE_ANON_KEY:-}}"
ORG_ID="${E2E_ORG_ID:-}"

if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_ANON" ]; then
  fail "VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY ausentes"
  exit 1
fi

info "1/6 Autenticando no Supabase..."
AUTH_JSON=$(curl -sS "${SUPABASE_URL}/auth/v1/token?grant_type=password" \
  -H "apikey: ${SUPABASE_ANON}" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${E2E_EMAIL}\",\"password\":\"${E2E_PASSWORD}\"}")

ACCESS_TOKEN=$(echo "$AUTH_JSON" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('access_token') or '')" 2>/dev/null || true)
if [ -z "$ACCESS_TOKEN" ]; then
  fail "Falha no login E2E (sem access_token)"
  echo "$AUTH_JSON" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('error_description') or d.get('msg') or d.get('error') or 'erro desconhecido')" 2>/dev/null || true
  exit 1
fi
pass "Login OK"

if [ -z "$ORG_ID" ]; then
  info "Resolvendo organization_id do usuário..."
  USER_ID=$(echo "$AUTH_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin).get('user',{}).get('id') or '')")
  ORG_JSON=$(curl -sS "${SUPABASE_URL}/rest/v1/organization_members?user_id=eq.${USER_ID}&select=organization_id&limit=1" \
    -H "apikey: ${SUPABASE_ANON}" \
    -H "Authorization: Bearer ${ACCESS_TOKEN}")
  ORG_ID=$(echo "$ORG_JSON" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d[0]['organization_id'] if isinstance(d,list) and d else '')" 2>/dev/null || true)
fi

if [ -z "$ORG_ID" ]; then
  fail "Não foi possível obter E2E_ORG_ID"
  exit 1
fi
pass "Org: ${ORG_ID:0:8}…"

info "2/6 Listando produtos (edge products)..."
PRODUCTS_JSON=$(curl -sS "${SUPABASE_URL}/functions/v1/products" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "apikey: ${SUPABASE_ANON}" \
  -H "X-Organization-Id: ${ORG_ID}")

PRODUCT_COUNT=$(echo "$PRODUCTS_JSON" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('data') or []))" 2>/dev/null || echo 0)
if [ "$PRODUCT_COUNT" = "0" ]; then
  fail "Nenhum produto retornado pela edge products"
  echo "$PRODUCTS_JSON" | head -c 400; echo
else
  pass "Produtos: $PRODUCT_COUNT"
fi

PRODUCT_ID=$(echo "$PRODUCTS_JSON" | python3 -c "
import sys, json
rows = json.load(sys.stdin).get('data') or []
active = [p for p in rows if p.get('is_active', True)]
pick = active[0] if active else (rows[0] if rows else None)
if not pick:
  print('')
else:
  print(pick['id'])
  open('/tmp/pdv-val-product.json','w').write(json.dumps(pick))
" 2>/dev/null || true)

if [ -z "$PRODUCT_ID" ]; then
  fail "Sem produto para venda de teste"
  exit 1
fi

STOCK_BEFORE=$(python3 -c "import json; p=json.load(open('/tmp/pdv-val-product.json')); print(p.get('stock_quantity') if p.get('stock_quantity') is not None else 0)")
PRODUCT_NAME=$(python3 -c "import json; p=json.load(open('/tmp/pdv-val-product.json')); print(p.get('name') or 'Produto teste')")
PRODUCT_PRICE=$(python3 -c "import json; p=json.load(open('/tmp/pdv-val-product.json')); print(float(p.get('price') or 0))")
PRODUCT_SKU=$(python3 -c "import json; p=json.load(open('/tmp/pdv-val-product.json')); print(p.get('sku') or '')")
PRODUCT_UNIT=$(python3 -c "import json; p=json.load(open('/tmp/pdv-val-product.json')); print(p.get('unit') or 'un')")

info "3/6 Listando vendas (edge pos-sales)..."
LIST_HTTP=$(curl -sS -o /tmp/pdv-list.json -w "%{http_code}" \
  "${SUPABASE_URL}/functions/v1/pos-sales?action=list_sales&limit=5" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "apikey: ${SUPABASE_ANON}" \
  -H "X-Organization-Id: ${ORG_ID}")
if [ "$LIST_HTTP" != "200" ]; then
  fail "list_sales HTTP $LIST_HTTP"
  cat /tmp/pdv-list.json | head -c 500; echo
else
  pass "list_sales HTTP 200"
fi

info "4/6 Finalizando venda de teste (qty=1)..."
# Preço mínimo 0.01 para validar pagamento
if python3 -c "import sys; sys.exit(0 if float('${PRODUCT_PRICE}') > 0 else 1)"; then
  SALE_PRICE="$PRODUCT_PRICE"
else
  SALE_PRICE="1.00"
fi

FINALIZE_BODY=$(python3 - <<PY
import json
print(json.dumps({
  "action": "finalize_sale",
  "items": [{
    "item_type": "product",
    "item_id": "${PRODUCT_ID}",
    "name": """${PRODUCT_NAME}""".replace('"','\\"'),
    "sku": "${PRODUCT_SKU}" or None,
    "unit": "${PRODUCT_UNIT}",
    "quantity": 1,
    "unit_price": float("${SALE_PRICE}"),
    "discount_amount": 0
  }],
  "payments": [{"method": "pix", "amount": float("${SALE_PRICE}")}],
  "discount_amount": 0,
  "notes": "VALIDACAO_AUTO_PDV",
  "add_commission": False,
  "customer_name": "Cliente Validacao PDV"
}))
PY
)

FINALIZE_HTTP=$(curl -sS -o /tmp/pdv-finalize.json -w "%{http_code}" \
  "${SUPABASE_URL}/functions/v1/pos-sales" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "apikey: ${SUPABASE_ANON}" \
  -H "X-Organization-Id: ${ORG_ID}" \
  -H "Content-Type: application/json" \
  -d "$FINALIZE_BODY")

if [ "$FINALIZE_HTTP" != "201" ] && [ "$FINALIZE_HTTP" != "200" ]; then
  fail "finalize_sale HTTP $FINALIZE_HTTP"
  cat /tmp/pdv-finalize.json | head -c 800; echo
else
  SALE_NUMBER=$(python3 -c "import json; print(json.load(open('/tmp/pdv-finalize.json')).get('data',{}).get('sale_number',''))")
  SALE_ID=$(python3 -c "import json; print(json.load(open('/tmp/pdv-finalize.json')).get('data',{}).get('id',''))")
  pass "Venda #${SALE_NUMBER} criada (id ${SALE_ID:0:8}…)"
fi

info "5/6 Conferindo estoque após venda..."
PRODUCTS_AFTER=$(curl -sS "${SUPABASE_URL}/functions/v1/products/${PRODUCT_ID}" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "apikey: ${SUPABASE_ANON}" \
  -H "X-Organization-Id: ${ORG_ID}")
STOCK_AFTER=$(echo "$PRODUCTS_AFTER" | python3 -c "import sys,json; d=json.load(sys.stdin).get('data') or {}; print(d.get('stock_quantity') if d.get('stock_quantity') is not None else 'NA')" 2>/dev/null || echo NA)

if [ "$STOCK_AFTER" = "NA" ]; then
  fail "Não foi possível ler estoque após venda"
else
  EXPECTED=$(python3 -c "print(float('${STOCK_BEFORE}') - 1)")
  GOT=$(python3 -c "print(float('${STOCK_AFTER}'))")
  if python3 -c "import sys; sys.exit(0 if abs(float('${EXPECTED}')-float('${GOT}')) < 0.001 else 1)"; then
    pass "Estoque ${STOCK_BEFORE} → ${STOCK_AFTER}"
  else
    fail "Estoque esperado ${EXPECTED}, obtido ${STOCK_AFTER}"
  fi
fi

info "6/6 Conferindo tabelas no Postgres Hetzner..."
# shellcheck source=/dev/null
source "$SCRIPT_DIR/.ssh-credentials"
CREDS=$(sshpass -p "$SSH_PASSWORD" ssh -o StrictHostKeyChecking=no "$SSH_USER@$SSH_HOST" \
  "cat /root/postgresql-budget-credentials.txt 2>/dev/null || true")
PGPASSWORD=$(echo "$CREDS" | grep "POSTGRES_PASSWORD=" | cut -d'=' -f2 | tr -d ' ')
PGUSER=$(echo "$CREDS" | grep "POSTGRES_USER=" | cut -d'=' -f2 | tr -d ' ')
PGDB=$(echo "$CREDS" | grep "POSTGRES_DB=" | cut -d'=' -f2 | tr -d ' ')
PGUSER=${PGUSER:-budget_user}
PGDB=${PGDB:-budget_services}

if [ -n "${SALE_ID:-}" ] && [ -n "$PGPASSWORD" ]; then
  ROW_COUNT=$(sshpass -p "$SSH_PASSWORD" ssh -o StrictHostKeyChecking=no "$SSH_USER@$SSH_HOST" \
    "export PGPASSWORD='$PGPASSWORD' && psql -h localhost -U $PGUSER -d $PGDB -tAc \"SELECT COUNT(*) FROM pos_sales WHERE id='${SALE_ID}' AND organization_id='${ORG_ID}';\"")
  ITEM_COUNT=$(sshpass -p "$SSH_PASSWORD" ssh -o StrictHostKeyChecking=no "$SSH_USER@$SSH_HOST" \
    "export PGPASSWORD='$PGPASSWORD' && psql -h localhost -U $PGUSER -d $PGDB -tAc \"SELECT COUNT(*) FROM pos_sale_items WHERE sale_id='${SALE_ID}';\"")
  PAY_COUNT=$(sshpass -p "$SSH_PASSWORD" ssh -o StrictHostKeyChecking=no "$SSH_USER@$SSH_HOST" \
    "export PGPASSWORD='$PGPASSWORD' && psql -h localhost -U $PGUSER -d $PGDB -tAc \"SELECT COUNT(*) FROM pos_sale_payments WHERE sale_id='${SALE_ID}';\"")
  MOV_COUNT=$(sshpass -p "$SSH_PASSWORD" ssh -o StrictHostKeyChecking=no "$SSH_USER@$SSH_HOST" \
    "export PGPASSWORD='$PGPASSWORD' && psql -h localhost -U $PGUSER -d $PGDB -tAc \"SELECT COUNT(*) FROM pos_stock_movements WHERE sale_id='${SALE_ID}';\"")

  [ "${ROW_COUNT// /}" = "1" ] && pass "pos_sales: 1 linha" || fail "pos_sales count=${ROW_COUNT}"
  [ "${ITEM_COUNT// /}" = "1" ] && pass "pos_sale_items: 1 linha" || fail "pos_sale_items count=${ITEM_COUNT}"
  [ "${PAY_COUNT// /}" = "1" ] && pass "pos_sale_payments: 1 linha" || fail "pos_sale_payments count=${PAY_COUNT}"
  [ "${MOV_COUNT// /}" = "1" ] && pass "pos_stock_movements: 1 linha" || fail "pos_stock_movements count=${MOV_COUNT}"
else
  fail "Não foi possível validar Postgres (sem SALE_ID ou senha)"
fi

echo ""
if [ "$ERRORS" -eq 0 ]; then
  echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
  echo -e "${GREEN}║  PDV VALIDADO COM SUCESSO              ║${NC}"
  echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
  exit 0
else
  echo -e "${RED}╔════════════════════════════════════════╗${NC}"
  echo -e "${RED}║  PDV FALHOU (${ERRORS} erro(s))                 ║${NC}"
  echo -e "${RED}╚════════════════════════════════════════╝${NC}"
  exit 1
fi
