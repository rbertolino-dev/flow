#!/usr/bin/env bash
# =============================================================================
# Backfill: espelha orçamentos já aprovados em pos_sales (sale_origin=orcamento)
# =============================================================================
#
# Uso (na raiz do repo, com .env / .env.e2e.local):
#   ORG_ID=<uuid> E2E_EMAIL=... E2E_PASSWORD=... ./scripts/backfill-budget-pos-sales.sh
#   ORG_ID=<uuid> E2E_EMAIL=... E2E_PASSWORD=... ./scripts/backfill-budget-pos-sales.sh --dry-run
#
# O que faz:
#   1. Lista budgets com approved=true da organização
#   2. Para cada um, cria venda via pos-sales finalize_sale com:
#        - sale_origin=orcamento
#        - client_request_id=orcamento:{budget_id}  (idempotente)
#        - apply_stock=false
#        - generate_financial=false
#   3. Não altera estoque nem financeiro (já tratados na aprovação original)
#
# NÃO rode no deploy zero-downtime. Use sob demanda após o deploy da feature.
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

DRY_RUN=0
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
  esac
done

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
ORG_ID="${ORG_ID:-${E2E_ORG_ID:-}}"

if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_ANON" ]; then
  echo "Defina VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY"
  exit 1
fi
if [ -z "${E2E_EMAIL:-}" ] || [ -z "${E2E_PASSWORD:-}" ]; then
  echo "Defina E2E_EMAIL e E2E_PASSWORD para autenticar"
  exit 1
fi

echo "Autenticando..."
AUTH_JSON=$(curl -sS "${SUPABASE_URL}/auth/v1/token?grant_type=password" \
  -H "apikey: ${SUPABASE_ANON}" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${E2E_EMAIL}\",\"password\":\"${E2E_PASSWORD}\"}")
ACCESS_TOKEN=$(echo "$AUTH_JSON" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('access_token') or '')")
[ -n "$ACCESS_TOKEN" ] || { echo "Login falhou: $AUTH_JSON"; exit 1; }

if [ -z "$ORG_ID" ]; then
  ORG_ID=$(curl -sS "${SUPABASE_URL}/rest/v1/organization_members?select=organization_id&limit=1" \
    -H "apikey: ${SUPABASE_ANON}" \
    -H "Authorization: Bearer ${ACCESS_TOKEN}" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d[0]['organization_id'] if d else '')")
fi
[ -n "$ORG_ID" ] || { echo "ORG_ID ausente"; exit 1; }

echo "Org: ${ORG_ID:0:8}…  dry-run=$DRY_RUN"
echo "Buscando orçamentos aprovados..."

BUDGETS_JSON=$(curl -sS \
  "${SUPABASE_URL}/rest/v1/budgets?select=id,budget_number,products,services,additions,total,lead_id,client_data,approved,created_at&approved=eq.true&organization_id=eq.${ORG_ID}&order=created_at.asc" \
  -H "apikey: ${SUPABASE_ANON}" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "X-Organization-Id: ${ORG_ID}")

export SUPABASE_URL SUPABASE_ANON ACCESS_TOKEN ORG_ID DRY_RUN BUDGETS_JSON

python3 <<'PY'
import json, os, re, urllib.request

UUID_RE = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$",
    re.I,
)

def round_money(v):
    return round(float(v or 0) * 100) / 100

def map_line(item, item_type):
    qty = float(item.get("quantity") or 0)
    if qty <= 0:
        return None
    price = float(item.get("price") or 0)
    expected = round_money(price * qty)
    subtotal = round_money(item.get("subtotal", expected))
    discount = max(0, round_money(expected - subtotal))
    item_id = item.get("id")
    manual = bool(item.get("isManual")) or not (item_id and UUID_RE.match(str(item_id)))
    return {
        "item_type": item_type,
        "item_id": None if manual else item_id,
        "name": item.get("name") or ("Serviço" if item_type == "service" else "Produto"),
        "quantity": qty,
        "unit_price": price,
        "discount_amount": discount,
        "unit": "un",
    }

def build_payload(budget):
    items = []
    for p in budget.get("products") or []:
        line = map_line(p, "product")
        if line:
            items.append(line)
    for s in budget.get("services") or []:
        line = map_line(s, "service")
        if line:
            items.append(line)
    if not items:
        return None

    items_subtotal = round_money(sum(
        i["quantity"] * i["unit_price"] - (i.get("discount_amount") or 0) for i in items
    ))
    budget_total = round_money(budget.get("total") or 0)
    additions = round_money(budget.get("additions") or 0)
    surcharge = max(0, additions)
    discount = 0
    expected = round_money(items_subtotal + surcharge)
    if budget_total > 0:
        if budget_total > expected + 0.009:
            surcharge = round_money(surcharge + (budget_total - expected))
        elif budget_total < expected - 0.009:
            discount = round_money(expected - budget_total)
    sale_total = round_money(items_subtotal - discount + surcharge)
    client = budget.get("client_data") or {}
    sold_at = (budget.get("created_at") or "") or None
    return {
        "action": "finalize_sale",
        "items": items,
        "payments": [{"method": "pix", "amount": sale_total}],
        "discount_amount": discount,
        "surcharge_amount": surcharge,
        "lead_id": budget.get("lead_id"),
        "customer_name": client.get("name") or client.get("company"),
        "customer_phone": client.get("phone"),
        "sale_description": f"Orçamento {budget.get('budget_number') or ''}".strip(),
        "sold_at": sold_at,
        "apply_stock": False,
        "generate_financial": False,
        "add_commission": False,
        "sale_origin": "orcamento",
        "client_request_id": f"orcamento:{budget['id']}",
    }

budgets = json.loads(os.environ["BUDGETS_JSON"] or "[]")
if not isinstance(budgets, list):
    raise SystemExit(f"Resposta inesperada de budgets: {budgets}")

url = os.environ["SUPABASE_URL"].rstrip("/") + "/functions/v1/pos-sales"
dry = os.environ.get("DRY_RUN") == "1"
created = skipped = errors = 0

print(f"Orçamentos aprovados: {len(budgets)}")
for budget in budgets:
    bid = budget.get("id")
    payload = build_payload(budget)
    if not payload:
        print(f"  skip {bid}: sem itens")
        skipped += 1
        continue
    if dry:
        print(f"  dry-run {bid} → {payload['client_request_id']} total={payload['payments'][0]['amount']}")
        skipped += 1
        continue
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode(),
        headers={
            "Authorization": f"Bearer {os.environ['ACCESS_TOKEN']}",
            "apikey": os.environ["SUPABASE_ANON"],
            "Content-Type": "application/json",
            "X-Organization-Id": os.environ["ORG_ID"],
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            body = json.loads(resp.read().decode() or "{}")
            sale = body.get("data") or {}
            print(f"  ok {bid} → venda #{sale.get('sale_number')} id={sale.get('id')}")
            created += 1
    except Exception as exc:
        # Idempotência: se já existir, a API devolve a venda existente (201/200).
        # Erros reais são contados.
        err_body = ""
        if hasattr(exc, "read"):
            try:
                err_body = exc.read().decode()
            except Exception:
                pass
        print(f"  erro {bid}: {exc} {err_body[:200]}")
        errors += 1

print(f"\nResumo: criadas/confirmadas={created} skipped={skipped} erros={errors}")
if errors:
    raise SystemExit(1)
PY

echo "Backfill concluído."
