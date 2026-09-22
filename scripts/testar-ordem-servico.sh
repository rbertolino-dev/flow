#!/usr/bin/env bash
# Teste automatizado do módulo Ordem de Serviço (API + validações)
# Uso: ./scripts/testar-ordem-servico.sh [organization_id]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

source "$PROJECT_ROOT/.supabase-cli-config" 2>/dev/null || true

ORG_ID="${1:-}"
API="https://api.supabase.com/v1/projects/${SUPABASE_PROJECT_ID}/database/query"

if [ -z "${SUPABASE_ACCESS_TOKEN:-}" ] || [ -z "${SUPABASE_PROJECT_ID:-}" ]; then
  echo "❌ SUPABASE_ACCESS_TOKEN / SUPABASE_PROJECT_ID não configurados"
  exit 1
fi

sql() {
  local query="$1"
  curl -s -X POST "$API" \
    -H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}" \
    -H "Content-Type: application/json" \
    -d "$(python3 -c "import json,sys; print(json.dumps({'query': sys.argv[1]}))" "$query")"
}

echo "╔════════════════════════════════════════╗"
echo "║  Teste Ordem de Serviço (automatizado) ║"
echo "╚════════════════════════════════════════╝"
echo ""

# 1) Organização alvo
if [ -z "$ORG_ID" ]; then
  ORG_ID=$(sql "SELECT id FROM organizations ORDER BY created_at DESC LIMIT 1;" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d[0]['id'] if d else '')")
fi

if [ -z "$ORG_ID" ]; then
  echo "❌ Nenhuma organização encontrada"
  exit 1
fi

echo "✅ Org: $ORG_ID"

# 2) Garantir etapas padrão se vazio
COUNT_STATUS=$(sql "SELECT COUNT(*)::int AS c FROM service_order_statuses WHERE organization_id = '$ORG_ID';" | python3 -c "import sys,json; print(json.load(sys.stdin)[0]['c'])")
echo "   Etapas atuais: $COUNT_STATUS"

if [ "$COUNT_STATUS" = "0" ]; then
  echo "→ Criando etapas padrão..."
  sql "
    INSERT INTO service_order_statuses (organization_id, name, color, sort_order, is_final, is_default) VALUES
    ('$ORG_ID', 'compra de material', '#ef4444', 10, false, true),
    ('$ORG_ID', 'Fabricação', '#8b5cf6', 20, false, false),
    ('$ORG_ID', 'armazenagem', '#7f1d1d', 30, false, false),
    ('$ORG_ID', 'finalização do kit', '#1f2937', 40, false, false),
    ('$ORG_ID', 'Finalizado', '#22c55e', 50, true, false);
  " > /dev/null
fi

# 3) Criar etapa custom de teste
TEST_STATUS_NAME="teste automatizado $(date +%H%M%S)"
echo "→ Criando etapa: $TEST_STATUS_NAME"
sql "
  INSERT INTO service_order_statuses (organization_id, name, color, sort_order, is_final, is_default)
  VALUES ('$ORG_ID', '$TEST_STATUS_NAME', '#06b6d4', 999, false, false)
  RETURNING id;
" > /tmp/os_status_create.json

STATUS_ID=$(python3 -c "import json; print(json.load(open('/tmp/os_status_create.json'))[0]['id'])")
echo "✅ Etapa criada: $STATUS_ID"

# 4) Editar etapa
sql "
  UPDATE service_order_statuses
  SET name = '${TEST_STATUS_NAME} (editada)', color = '#3b82f6'
  WHERE id = '$STATUS_ID' AND organization_id = '$ORG_ID'
  RETURNING name, color;
" > /tmp/os_status_update.json
UPDATED_NAME=$(python3 -c "import json; print(json.load(open('/tmp/os_status_update.json'))[0]['name'])")
echo "✅ Etapa editada: $UPDATED_NAME"

# 5) Próximo código
CODE=$(sql "SELECT public.next_service_order_code('$ORG_ID'::uuid) AS code;" | python3 -c "import sys,json; print(json.load(sys.stdin)[0]['code'])")
echo "✅ Código gerado: $CODE"

# 6) Criar OS automatizada
echo "→ Criando ordem de serviço automatizada..."
sql "
  INSERT INTO service_orders (
    organization_id, code, status_id, client_name, client_phone,
    responsible_name, service_name, diagnosis, solution,
    starts_at, ends_at, is_single_day, address, total, subtotal
  ) VALUES (
    '$ORG_ID', '$CODE', '$STATUS_ID',
    'Cliente Teste Automatizado', '5599999999999',
    'Agente Cursor', 'Instalação teste',
    'Diagnóstico gerado por teste automatizado',
    'Solução aplicada no teste',
    now(), now() + interval '1 day', false,
    'Rua Teste, 123', 150.00, 150.00
  )
  RETURNING id, code, status_id;
" > /tmp/os_create.json

OS_ID=$(python3 -c "import json; print(json.load(open('/tmp/os_create.json'))[0]['id'])")
OS_CODE=$(python3 -c "import json; print(json.load(open('/tmp/os_create.json'))[0]['code'])")
echo "✅ OS criada: $OS_CODE ($OS_ID)"

# 7) Vincular produto gasto (item item)
sql "
  INSERT INTO service_order_items (
    service_order_id, organization_id, item_type, name, quantity, unit_price, total_price
  ) VALUES (
    '$OS_ID', '$ORG_ID', 'product', 'Produto Teste Automatizado', 2, 75.00, 150.00
  )
  RETURNING id, total_price;
" > /tmp/os_item.json
ITEM_TOTAL=$(python3 -c "import json; print(json.load(open('/tmp/os_item.json'))[0]['total_price'])")
echo "✅ Produto vinculado: total R$ $ITEM_TOTAL"

# 8) Checklist
sql "
  INSERT INTO service_order_checklist_items (service_order_id, organization_id, title, is_done, sort_order)
  VALUES
    ('$OS_ID', '$ORG_ID', 'Verificar material', false, 10),
    ('$OS_ID', '$ORG_ID', 'Executar serviço', false, 20)
  RETURNING id;
" > /tmp/os_check.json
CHECK_COUNT=$(python3 -c "import json; print(len(json.load(open('/tmp/os_check.json'))))")
echo "✅ Checklist: $CHECK_COUNT itens"

# 9) Mudar etapa da OS para Finalizado (se existir)
FINAL_ID=$(sql "
  SELECT id FROM service_order_statuses
  WHERE organization_id = '$ORG_ID' AND is_final = true
  ORDER BY sort_order DESC LIMIT 1;
" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d[0]['id'] if d else '')")

if [ -n "$FINAL_ID" ]; then
  sql "
    UPDATE service_orders SET status_id = '$FINAL_ID'
    WHERE id = '$OS_ID' AND organization_id = '$ORG_ID'
    RETURNING status_id;
  " > /tmp/os_move.json
  echo "✅ OS movida para etapa final: $FINAL_ID"
fi

# 10) Validar leitura
sql "
  SELECT so.code, so.client_name, so.total, st.name AS status_name,
         (SELECT COUNT(*) FROM service_order_items i WHERE i.service_order_id = so.id) AS items,
         (SELECT COUNT(*) FROM service_order_checklist_items c WHERE c.service_order_id = so.id) AS checklist
  FROM service_orders so
  LEFT JOIN service_order_statuses st ON st.id = so.status_id
  WHERE so.id = '$OS_ID';
" > /tmp/os_verify.json

python3 - <<'PY'
import json
row = json.load(open('/tmp/os_verify.json'))[0]
assert row['code'], 'código ausente'
assert row['client_name'] == 'Cliente Teste Automatizado'
assert float(row['total']) == 150
assert int(row['items']) == 1
assert int(row['checklist']) == 2
print(f"✅ Validação OK — OS {row['code']} | status={row['status_name']} | itens={row['items']} | checklist={row['checklist']}")
PY

# 11) Soft delete da OS de teste (mantém etapa custom para inspeção visual)
sql "
  UPDATE service_orders SET deleted_at = now()
  WHERE id = '$OS_ID'
  RETURNING id;
" > /dev/null
echo "✅ OS de teste soft-deleted (não aparece na listagem)"

# 12) Remover etapa de teste
sql "
  DELETE FROM service_order_statuses
  WHERE id = '$STATUS_ID' AND organization_id = '$ORG_ID'
  RETURNING id;
" > /dev/null
echo "✅ Etapa de teste removida"

echo ""
echo "════════════════════════════════════════"
echo "✅ TODOS OS TESTES DE ORDEM DE SERVIÇO PASSARAM"
echo "   Org: $ORG_ID"
echo "   OS testada: $OS_CODE"
echo "════════════════════════════════════════"
