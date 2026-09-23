#!/usr/bin/env bash
# Valida o caixa consolidado do PDV (API pos-sales?action=cash_consolidated)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

ERRORS=0
pass() { echo -e "${GREEN}✅ $1${NC}"; }
fail() { echo -e "${RED}❌ $1${NC}"; ERRORS=$((ERRORS + 1)); }
info() { echo -e "${BLUE}→ $1${NC}"; }

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
echo -e "${BLUE}║  Teste caixa consolidado PDV          ║${NC}"
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

DATE_FROM=$(python3 -c "import datetime; n=datetime.datetime.now(); print(datetime.datetime(n.year,n.month,1,0,0,0).astimezone().isoformat())")
DATE_TO=$(python3 -c "import datetime; n=datetime.datetime.now(); print(datetime.datetime(n.year,n.month,n.day,23,59,59).astimezone().isoformat())")
export DATE_FROM DATE_TO

call_cash() {
  local qs="$1"
  local tmp
  tmp=$(mktemp)
  local code
  code=$(curl -sS -o "$tmp" -w "%{http_code}" \
    "${SUPABASE_URL}/functions/v1/pos-sales?${qs}" \
    -H "Authorization: Bearer ${ACCESS_TOKEN}" \
    -H "apikey: ${SUPABASE_ANON}" \
    -H "X-Organization-Id: ${ORG_ID}")
  echo "$code"
  cat "$tmp"
  rm -f "$tmp"
}

validate_report() {
  local label="$1"
  python3 -c "
import sys, json
label = sys.argv[1]
raw = sys.stdin.read()
nl = raw.find('\n')
code = raw[:nl] if nl >= 0 else raw
body = raw[nl+1:] if nl >= 0 else '{}'
try:
    d = json.loads(body) if body.strip() else {}
except Exception as e:
    print('FAIL', label, 'json', e)
    sys.exit(0)
if code != '200':
    print('FAIL', label, 'http', code, body[:240])
    sys.exit(0)
data = d.get('data') or {}
keys = ('payments', 'products_by_category', 'services_by_category', 'other_entries')
for key in keys:
    if not isinstance(data.get(key), list):
        print('FAIL', label, 'lista', key)
        sys.exit(0)
for row in data['payments']:
    if not isinstance(row.get('method'), str) or not row['method']:
        print('FAIL', label, 'method')
        sys.exit(0)
    if not isinstance(row.get('amount'), (int, float)):
        print('FAIL', label, 'amount', row)
        sys.exit(0)
for key in ('products_by_category', 'services_by_category'):
    for row in data[key]:
        if not isinstance(row.get('category'), str) or not row['category']:
            print('FAIL', label, 'category', key)
            sys.exit(0)
        if not isinstance(row.get('quantity'), (int, float)) or not isinstance(row.get('amount'), (int, float)):
            print('FAIL', label, 'totais', key, row)
            sys.exit(0)
pay = len(data['payments'])
prod = len(data['products_by_category'])
serv = len(data['services_by_category'])
print('OK', label, f'pagamentos={pay}', f'produtos={prod}', f'servicos={serv}')
" "$label"
}

info "1) Caixa consolidado do mês (dia inteiro)"
RAW=$(call_cash "action=cash_consolidated&date_from=$(python3 -c "import urllib.parse,os; print(urllib.parse.quote(os.environ['DATE_FROM']))")&date_to=$(python3 -c "import urllib.parse,os; print(urllib.parse.quote(os.environ['DATE_TO']))")")
export DATE_FROM DATE_TO
RESULT=$(echo "$RAW" | validate_report "mes")
if [[ "$RESULT" == OK* ]]; then
  pass "Mês: $RESULT"
else
  fail "Mês: $RESULT"
  echo "$RAW" | head -c 500
  echo
fi

info "2) Período da manhã"
RAW_M=$(call_cash "action=cash_consolidated&day_period=morning&date_from=$(python3 -c "import urllib.parse,os; print(urllib.parse.quote(os.environ['DATE_FROM']))")&date_to=$(python3 -c "import urllib.parse,os; print(urllib.parse.quote(os.environ['DATE_TO']))")")
RESULT_M=$(echo "$RAW_M" | validate_report "manha")
if [[ "$RESULT_M" == OK* ]]; then
  pass "Manhã: $RESULT_M"
else
  fail "Manhã: $RESULT_M"
fi

info "3) Sem datas deve falhar"
CODE_BAD=$(curl -sS -o /tmp/pdv-caixa-bad.json -w "%{http_code}" \
  "${SUPABASE_URL}/functions/v1/pos-sales?action=cash_consolidated" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "apikey: ${SUPABASE_ANON}" \
  -H "X-Organization-Id: ${ORG_ID}")
if [ "$CODE_BAD" = "400" ]; then
  pass "Sem datas retorna HTTP 400"
else
  fail "Sem datas retornou HTTP ${CODE_BAD}"
fi

echo ""
if [ "$ERRORS" -eq 0 ]; then
  echo -e "${GREEN}Caixa consolidado: todos os testes passaram.${NC}"
  exit 0
fi
echo -e "${RED}Caixa consolidado: ${ERRORS} falha(s).${NC}"
exit 1
