#!/usr/bin/env bash
# Valida filtros avançados do histórico PDV (API pos-sales)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

ERRORS=0
pass() { echo -e "${GREEN}✅ $1${NC}"; }
fail() { echo -e "${RED}❌ $1${NC}"; ERRORS=$((ERRORS + 1)); }
info() { echo -e "${BLUE}→ $1${NC}"; }
warn() { echo -e "${YELLOW}⚠️  $1${NC}"; }

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
    if [[ "$value" == \"*\" && "$value" == *\" ]]; then value="${value:1:-1}"; fi
    if [[ "$value" == \'*\' && "$value" == *\' ]]; then value="${value:1:-1}"; fi
    if [ -z "${!key:-}" ]; then export "$key=$value"; fi
  done < "$file"
}

load_env_file "$PROJECT_ROOT/.env"
load_env_file "$PROJECT_ROOT/.env.e2e.local"

SUPABASE_URL="${VITE_SUPABASE_URL:-}"
SUPABASE_ANON="${VITE_SUPABASE_PUBLISHABLE_KEY:-${SUPABASE_ANON_KEY:-}}"
ORG_ID="${E2E_ORG_ID:-}"

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Teste filtros histórico PDV           ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""

info "Autenticando..."
AUTH_JSON=$(curl -sS "${SUPABASE_URL}/auth/v1/token?grant_type=password" \
  -H "apikey: ${SUPABASE_ANON}" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${E2E_EMAIL}\",\"password\":\"${E2E_PASSWORD}\"}")
ACCESS_TOKEN=$(echo "$AUTH_JSON" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('access_token') or '')")
[ -n "$ACCESS_TOKEN" ] || { fail "Login falhou"; exit 1; }
pass "Login OK"

if [ -z "$ORG_ID" ]; then
  ORG_ID=$(curl -sS "${SUPABASE_URL}/rest/v1/organization_members?select=organization_id&limit=1" \
    -H "apikey: ${SUPABASE_ANON}" \
    -H "Authorization: Bearer ${ACCESS_TOKEN}" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d[0]['organization_id'] if d else '')")
fi
[ -n "$ORG_ID" ] || { fail "ORG_ID ausente"; exit 1; }
pass "Org: ${ORG_ID:0:8}…"

list_sales() {
  local qs="$1"
  local tmp
  tmp=$(mktemp)
  local code
  code=$(curl -sS -o "$tmp" -w "%{http_code}" \
    "${SUPABASE_URL}/functions/v1/pos-sales?action=list_sales&${qs}" \
    -H "Authorization: Bearer ${ACCESS_TOKEN}" \
    -H "apikey: ${SUPABASE_ANON}" \
    -H "X-Organization-Id: ${ORG_ID}")
  echo "$code"
  cat "$tmp"
  rm -f "$tmp"
}

parse_count() {
  python3 -c "
import sys, json
raw = sys.stdin.read()
# primeira linha = http code
nl = raw.find('\n')
code = raw[:nl] if nl >= 0 else raw
body = raw[nl+1:] if nl >= 0 else '{}'
try:
    d = json.loads(body) if body.strip() else {}
except Exception as e:
    print(code, -1, -1)
    sys.exit(0)
print(code, d.get('summary', {}).get('sales_count', -1), len(d.get('data') or []))
"
}

# Baseline
info "1) Listagem baseline (sem filtros avançados)"
BASE_RAW=$(list_sales "limit=50&include_items=1")
read -r BASE_HTTP BASE_COUNT BASE_LEN <<< "$(echo "$BASE_RAW" | parse_count)"
if [ "$BASE_HTTP" = "200" ]; then
  pass "Baseline HTTP 200 — count=${BASE_COUNT} rows=${BASE_LEN}"
else
  fail "Baseline HTTP ${BASE_HTTP}"
  echo "$BASE_RAW" | head -c 400
  echo
fi

# Seed: criar venda com pagamento pix e cliente conhecido se baseline vazio ou para ter dados
info "2) Criando venda de teste para filtros..."
PRODUCTS=$(curl -sS "${SUPABASE_URL}/functions/v1/products?action=list" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "apikey: ${SUPABASE_ANON}" \
  -H "X-Organization-Id: ${ORG_ID}" 2>/dev/null || true)

# Try products edge or supabase table
PROD_JSON=$(curl -sS "${SUPABASE_URL}/rest/v1/products?select=id,name,price,stock_quantity&is_active=eq.true&organization_id=eq.${ORG_ID}&limit=1" \
  -H "apikey: ${SUPABASE_ANON}" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}")
PROD_ID=$(echo "$PROD_JSON" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d[0]['id'] if isinstance(d,list) and d else '')" 2>/dev/null || true)
PROD_NAME=$(echo "$PROD_JSON" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d[0]['name'] if isinstance(d,list) and d else 'Produto Teste')" 2>/dev/null || true)
PROD_PRICE=$(echo "$PROD_JSON" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d[0]['price'] if isinstance(d,list) and d else 10)" 2>/dev/null || true)
PROD_SKU=""

CUSTOMER_NAME=""
CUSTOMER_PHONE=""
SALE_TOTAL=""
PAYMENT_METHOD="pix"

if [ -z "$PROD_ID" ]; then
  warn "Sem produto ativo — usando vendas existentes para asserts"
  # Extrair cliente real do baseline para testar filtros de cliente
  SAMPLE=$(list_sales "limit=5&include_items=0")
  CUSTOMER_NAME=$(echo "$SAMPLE" | python3 -c "
import sys,json
raw=sys.stdin.read(); nl=raw.find('\n'); body=raw[nl+1:]
d=json.loads(body)
for s in d.get('data') or []:
  if s.get('customer_name'):
    print(s['customer_name']); break
" 2>/dev/null || true)
  CUSTOMER_PHONE=$(echo "$SAMPLE" | python3 -c "
import sys,json
raw=sys.stdin.read(); nl=raw.find('\n'); body=raw[nl+1:]
d=json.loads(body)
for s in d.get('data') or []:
  if s.get('customer_phone'):
    print(s['customer_phone']); break
" 2>/dev/null || true)
  SALE_TOTAL=$(echo "$SAMPLE" | python3 -c "
import sys,json
raw=sys.stdin.read(); nl=raw.find('\n'); body=raw[nl+1:]
d=json.loads(body)
totals=[float(s.get('total') or 0) for s in (d.get('data') or [])]
print(min(totals) if totals else '')
" 2>/dev/null || true)
  MAX_TOTAL=$(echo "$SAMPLE" | python3 -c "
import sys,json
raw=sys.stdin.read(); nl=raw.find('\n'); body=raw[nl+1:]
d=json.loads(body)
totals=[float(s.get('total') or 0) for s in (d.get('data') or [])]
print(max(totals) if totals else 0)
" 2>/dev/null || true)
  if [ -n "$CUSTOMER_NAME" ]; then pass "Cliente existente: ${CUSTOMER_NAME}"; fi
else
  CUSTOMER_NAME="Cliente Filtro E2E $(date +%s)"
  CUSTOMER_PHONE="11977665544"
  SALE_TOTAL=$(python3 -c "print(round(float('${PROD_PRICE:-10}'),2))")
  MAX_TOTAL="$SALE_TOTAL"
  CREATE=$(curl -sS -o /tmp/pos-filter-create.json -w "%{http_code}" -X POST "${SUPABASE_URL}/functions/v1/pos-sales" \
    -H "Authorization: Bearer ${ACCESS_TOKEN}" \
    -H "apikey: ${SUPABASE_ANON}" \
    -H "Content-Type: application/json" \
    -H "X-Organization-Id: ${ORG_ID}" \
    -d "{
      \"action\": \"finalize_sale\",
      \"customer_name\": \"${CUSTOMER_NAME}\",
      \"customer_phone\": \"${CUSTOMER_PHONE}\",
      \"discount_amount\": 0,
      \"apply_stock\": false,
      \"generate_financial\": false,
      \"items\": [{
        \"item_type\": \"product\",
        \"item_id\": \"${PROD_ID}\",
        \"name\": \"${PROD_NAME}\",
        \"sku\": \"${PROD_SKU}\",
        \"quantity\": 1,
        \"unit_price\": ${SALE_TOTAL},
        \"discount_amount\": 0
      }],
      \"payments\": [{ \"method\": \"${PAYMENT_METHOD}\", \"amount\": ${SALE_TOTAL} }]
    }")
  CREATE_CODE="$CREATE"
  CREATE_BODY=$(cat /tmp/pos-filter-create.json)
  if [ "$CREATE_CODE" = "201" ] || [ "$CREATE_CODE" = "200" ]; then
    SALE_NUM=$(echo "$CREATE_BODY" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('sale_number',''))" 2>/dev/null || true)
    pass "Venda #${SALE_NUM} criada (cliente=${CUSTOMER_NAME}, pag=${PAYMENT_METHOD}, total=${SALE_TOTAL})"
  else
    fail "Falha ao criar venda HTTP ${CREATE_CODE}"
    echo "$CREATE_BODY" | head -c 500; echo
    CUSTOMER_NAME=""
    CUSTOMER_PHONE=""
  fi
fi

assert_filter() {
  local label="$1"
  local qs="$2"
  local expect_min="${3:-0}"   # minimum expected count
  local expect_mode="${4:-ge}" # ge | eq | gt0 | zero
  local raw http count len
  raw=$(list_sales "$qs")
  read -r http count len <<< "$(echo "$raw" | parse_count)"
  if [ "$http" != "200" ]; then
    fail "${label}: HTTP ${http}"
    echo "$raw" | head -c 300; echo
    return
  fi
  case "$expect_mode" in
    ge)
      if [ "$count" -ge "$expect_min" ]; then
        pass "${label}: count=${count} (>= ${expect_min})"
      else
        fail "${label}: count=${count} esperado >= ${expect_min}"
      fi
      ;;
    eq)
      if [ "$count" -eq "$expect_min" ]; then
        pass "${label}: count=${count}"
      else
        fail "${label}: count=${count} esperado = ${expect_min}"
      fi
      ;;
    gt0)
      if [ "$count" -gt 0 ]; then
        pass "${label}: count=${count} (>0)"
      else
        fail "${label}: count=0 (esperado >0)"
      fi
      ;;
    zero)
      if [ "$count" -eq 0 ]; then
        pass "${label}: count=0 (como esperado)"
      else
        fail "${label}: count=${count} esperado 0"
      fi
      ;;
  esac
}

info "3) Filtro cliente (contato/nome)"
if [ -n "${CUSTOMER_NAME}" ]; then
  Q=$(python3 -c "import urllib.parse; print(urllib.parse.quote('${CUSTOMER_NAME}'))")
  assert_filter "customer_query=contato" "customer_field=contato&customer_query=${Q}&limit=50" 1 gt0
else
  assert_filter "customer_query=contato (amostra)" "customer_field=contato&customer_query=a&limit=50" 0 ge
fi

info "4) Filtro cliente (telefone)"
if [ -n "${CUSTOMER_PHONE:-}" ]; then
  assert_filter "customer_query=telefone" "customer_field=telefone&customer_query=${CUSTOMER_PHONE}&limit=50" 1 gt0
else
  warn "Sem telefone de seed — skip"
fi

info "5) Filtro forma de pagamento (pix)"
assert_filter "payment_method=pix" "payment_method=pix&limit=50" 0 ge
# Se criamos venda pix, deve achar
if [ -n "${CUSTOMER_NAME}" ]; then
  assert_filter "payment_method=pix (após seed)" "payment_method=pix&limit=50" 1 gt0
fi

info "6) Filtro forma de pagamento inexistente"
assert_filter "payment_method=metodo_fantasma" "payment_method=metodo_fantasma_xyz&limit=50" 0 zero

info "7) Filtro origem=pdv"
assert_filter "origin=pdv" "origin=pdv&limit=50" 0 ge

info "8) Filtro origem=importacao (deve ser 0 se só PDV)"
assert_filter "origin=importacao" "origin=importacao&limit=50" 0 zero

info "9) Filtro preço (faixa)"
if [ -n "${SALE_TOTAL:-}" ]; then
  MIN=$(python3 -c "print(max(0, float('${SALE_TOTAL}')-0.01))")
  MAX=$(python3 -c "print(float('${SALE_TOTAL}')+100)")
  assert_filter "price_min/max inclui min existente" "price_min=${MIN}&price_max=${MAX}&limit=50" 1 gt0
  HIGH=$(python3 -c "print(float('${MAX_TOTAL:-0}') + 1000000)")
  assert_filter "price_min acima do máximo" "price_min=${HIGH}&limit=50" 0 zero
else
  assert_filter "price_min=0 price_max=500000" "price_min=0&price_max=500000&limit=50" 0 ge
fi

info "10) Filtro with_invoice=1 (sem NF → 0)"
assert_filter "with_invoice=1" "with_invoice=1&limit=50" 0 zero

info "11) Filtro sold_by (usuário atual)"
USER_ID=$(echo "$AUTH_JSON" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('user',{}).get('id') or '')")
if [ -n "$USER_ID" ] && [ -n "${CUSTOMER_NAME}" ]; then
  assert_filter "sold_by=eu" "sold_by=${USER_ID}&limit=50" 1 gt0
else
  warn "Sem user id / seed — skip sold_by assert forte"
  if [ -n "$USER_ID" ]; then
    assert_filter "sold_by=eu (soft)" "sold_by=${USER_ID}&limit=50" 0 ge
  fi
fi

info "12) Combinação: pagamento + origem + preço"
assert_filter "combo pix+pdv" "payment_method=pix&origin=pdv&price_min=0&price_max=500000&limit=50" 0 ge

echo ""
if [ "$ERRORS" -eq 0 ]; then
  echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
  echo -e "${GREEN}║  FILTROS PDV OK                        ║${NC}"
  echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
  exit 0
else
  echo -e "${RED}╔════════════════════════════════════════╗${NC}"
  echo -e "${RED}║  ${ERRORS} falha(s) nos filtros             ║${NC}"
  echo -e "${RED}╚════════════════════════════════════════╝${NC}"
  exit 1
fi
