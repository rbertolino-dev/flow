#!/usr/bin/env python3
"""Cadastra e confere cenários de PDV na organização Pubdigital."""
from __future__ import annotations

import json
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ERRORS = 0


def load_env() -> dict[str, str]:
    env: dict[str, str] = {}
    for name in (".env", ".env.e2e.local"):
        path = ROOT / name
        if not path.exists():
            continue
        for line in path.read_text().splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            value = value.strip().strip('"').strip("'")
            env.setdefault(key, value)
    return env


def ok(message: str) -> None:
    print(f"\033[0;32m✅ {message}\033[0m")


def fail(message: str) -> None:
    global ERRORS
    ERRORS += 1
    print(f"\033[0;31m❌ {message}\033[0m")


def info(message: str) -> None:
    print(f"\033[0;34m→ {message}\033[0m")


class Api:
    def __init__(self, base: str, key: str, token: str, org_id: str):
        self.base = base.rstrip("/")
        self.key = key
        self.token = token
        self.org_id = org_id

    def call(self, path: str, method: str = "GET", body: dict | None = None, org: bool = True):
        headers = {
            "apikey": self.key,
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json",
        }
        if org:
            headers["X-Organization-Id"] = self.org_id
        data = json.dumps(body).encode() if body is not None else None
        req = urllib.request.Request(self.base + path, data=data, headers=headers, method=method)
        try:
            with urllib.request.urlopen(req, timeout=60) as response:
                raw = response.read().decode()
                return response.status, json.loads(raw) if raw else {}
        except urllib.error.HTTPError as error:
            raw = error.read().decode()
            try:
                payload = json.loads(raw) if raw else {}
            except json.JSONDecodeError:
                payload = {"error": raw[:400]}
            return error.code, payload


def main() -> int:
    env = load_env()
    base = env.get("VITE_SUPABASE_URL", "")
    key = env.get("VITE_SUPABASE_PUBLISHABLE_KEY") or env.get("SUPABASE_ANON_KEY", "")
    email = env.get("E2E_EMAIL", "")
    password = env.get("E2E_PASSWORD", "")
    if not all([base, key, email, password]):
        fail("Credenciais E2E ausentes")
        return 1

    print("\033[0;34m╔════════════════════════════════════════╗\033[0m")
    print("\033[0;34m║  Cenários PDV — Pubdigital             ║\033[0m")
    print("\033[0;34m╚════════════════════════════════════════╝\033[0m")

    status, auth = Api(base, key, "", "").call(
        "/auth/v1/token?grant_type=password",
        "POST",
        {"email": email, "password": password},
        org=False,
    )
    token = auth.get("access_token") or ""
    user_id = (auth.get("user") or {}).get("id") or ""
    if status != 200 or not token:
        fail("Login falhou")
        return 1
    ok("Login OK")

    api = Api(base, key, token, "")
    status, orgs = api.call("/rest/v1/organizations?select=id,name&limit=200", org=False)
    rows = orgs if isinstance(orgs, list) else []
    chosen = None
    for preferred in ("pubdigital", "pubdgital"):
        chosen = next((org for org in rows if (org.get("name") or "").strip().lower() == preferred), None)
        if chosen:
            break
    if not chosen:
        fail("Organização Pubdigital não encontrada")
        return 1
    org_id = chosen["id"]
    api.org_id = org_id
    ok(f"Organização: {chosen['name']} ({org_id[:8]}…)")

    status, products_body = api.call("/functions/v1/products")
    products = (products_body.get("data") or []) if isinstance(products_body, dict) else []
    product = next((item for item in products if item.get("is_active", True) and float(item.get("price") or 0) > 0), None)
    if not product and products:
        product = products[0]
    if not product:
        fail("Nenhum produto na organização")
        return 1
    price = float(product.get("price") or 0) or 10.0
    ok(f"Produto: {product.get('name')} — R$ {price:.2f}")

    status, services_body = api.call("/functions/v1/get-services?active_only=true")
    services = (services_body.get("data") or []) if isinstance(services_body, dict) else []
    service = next((item for item in services if float(item.get("price") or 0) > 0), None)
    if service:
        ok(f"Serviço: {service.get('name')}")
    else:
        info("Sem serviço ativo com preço — cenário de serviço será pulado")

    status, members = api.call(
        f"/rest/v1/organization_members?organization_id=eq.{org_id}&select=user_id,role&limit=20"
    )
    member_ids = [row["user_id"] for row in members] if isinstance(members, list) else []
    seller_id = user_id or (member_ids[0] if member_ids else "")
    seller_name = "Pubdigital"
    if seller_id:
        status, profiles = api.call(
            f"/rest/v1/profiles?id=eq.{seller_id}&select=id,full_name,email&limit=1",
            org=False,
        )
        if isinstance(profiles, list) and profiles:
            seller_name = profiles[0].get("full_name") or profiles[0].get("email") or seller_name
    ok(f"Comissão vinculada a: {seller_name}")

    status, leads = api.call(
        f"/rest/v1/leads?organization_id=eq.{org_id}&deleted_at=is.null&name=eq.Cliente%20Cen%C3%A1rios%20PDV&select=id,name,phone&limit=1"
    )
    lead = leads[0] if isinstance(leads, list) and leads else None
    if not lead:
        status, created = api.call(
            "/rest/v1/leads",
            "POST",
            {
                "name": "Cliente Cenários PDV",
                "phone": "11900001111",
                "organization_id": org_id,
                "user_id": user_id,
                "status": "novo",
                "source": "PDV",
            },
        )
        if status not in (200, 201) or not isinstance(created, dict):
            # PostgREST pode devolver lista se Prefer return=representation não foi enviado
            fail(f"Não criou o cliente padrão (HTTP {status})")
            return 1
        lead = created[0] if isinstance(created, list) else created
    if not lead or not lead.get("id"):
        status, leads = api.call(
            f"/rest/v1/leads?organization_id=eq.{org_id}&deleted_at=is.null&name=eq.Cliente%20Cen%C3%A1rios%20PDV&select=id,name,phone&limit=1"
        )
        lead = leads[0] if isinstance(leads, list) and leads else None
    if not lead:
        fail("Cliente padrão indisponível")
        return 1
    ok(f"Cliente: {lead.get('name')}")

    def save_settings(payload: dict, label: str) -> None:
        body = {
            "action": "save_pos_settings",
            "sale_notes": payload.get("sale_notes", ""),
            "financial_account": payload.get("financial_account", ""),
            "financial_category": payload.get("financial_category", ""),
            "default_lead_id": payload.get("default_lead_id"),
            "default_lead_name": payload.get("default_lead_name"),
            "simple_sale": bool(payload.get("simple_sale")),
            "commission_required": bool(payload.get("commission_required")),
            "show_payment_method": payload.get("show_payment_method", True),
            "commission_type": payload.get("commission_type", "percent"),
            "commission_value": payload.get("commission_value", 0),
            "stock_code_field": payload.get("stock_code_field", "sku"),
            "block_out_of_stock": bool(payload.get("block_out_of_stock")),
        }
        status, saved = api.call("/functions/v1/pos-sales", "POST", body)
        data = (saved or {}).get("data") or {}
        if status != 200:
            fail(f"{label}: HTTP {status} {saved.get('error')}")
            return
        mismatches = []
        for field in (
            "sale_notes",
            "financial_account",
            "financial_category",
            "simple_sale",
            "commission_required",
            "show_payment_method",
            "commission_type",
            "stock_code_field",
            "block_out_of_stock",
        ):
            expected = body[field]
            got = data.get(field)
            if isinstance(expected, bool):
                got = bool(got)
            if field == "commission_value":
                continue
            if got != expected:
                mismatches.append(f"{field}={got!r}")
        if abs(float(data.get("commission_value") or 0) - float(body["commission_value"])) > 0.001:
            mismatches.append("commission_value")
        if body["default_lead_id"] and str(data.get("default_lead_id") or "") != str(body["default_lead_id"]):
            mismatches.append("default_lead_id")
        if mismatches:
            fail(f"{label}: divergiu {', '.join(mismatches)}")
        else:
            ok(label)

    info("Configurações — um cenário por vez, conferindo a gravação")
    save_settings(
        {
            "sale_notes": "Garantia de 90 dias. Pagamento conforme combinado.",
            "financial_account": "Pubdigital",
            "financial_category": "vendas",
        },
        "Observações, conta Pubdigital e categoria vendas",
    )
    save_settings(
        {
            "sale_notes": "Garantia de 90 dias. Pagamento conforme combinado.",
            "financial_account": "Pubdigital",
            "financial_category": "vendas",
            "default_lead_id": lead["id"],
            "default_lead_name": lead["name"],
        },
        "Cliente padrão",
    )
    save_settings(
        {
            "sale_notes": "Garantia de 90 dias. Pagamento conforme combinado.",
            "financial_account": "Pubdigital",
            "financial_category": "vendas",
            "default_lead_id": lead["id"],
            "default_lead_name": lead["name"],
            "simple_sale": True,
        },
        "Venda simples",
    )
    save_settings(
        {
            "sale_notes": "Garantia de 90 dias. Pagamento conforme combinado.",
            "financial_account": "Pubdigital",
            "financial_category": "vendas",
            "default_lead_id": lead["id"],
            "default_lead_name": lead["name"],
            "commission_required": True,
            "commission_type": "percent",
            "commission_value": 10,
        },
        "Comissão obrigatória de 10%",
    )
    save_settings(
        {
            "sale_notes": "Garantia de 90 dias. Pagamento conforme combinado.",
            "financial_account": "Pubdigital",
            "financial_category": "vendas",
            "default_lead_id": lead["id"],
            "default_lead_name": lead["name"],
            "show_payment_method": False,
        },
        "Ocultar meio de pagamento",
    )
    save_settings(
        {
            "sale_notes": "Garantia de 90 dias. Pagamento conforme combinado.",
            "financial_account": "Pubdigital",
            "financial_category": "vendas",
            "default_lead_id": lead["id"],
            "default_lead_name": lead["name"],
            "stock_code_field": "barcode",
            "block_out_of_stock": True,
            "commission_type": "fixed",
            "commission_value": 15,
        },
        "Código de barras, bloqueio de falta e comissão fixa",
    )

    info("Configuração que permanece no PDV da Pubdigital")
    save_settings(
        {
            "sale_notes": "Garantia de 90 dias. Pagamento conforme combinado.",
            "financial_account": "Pubdigital",
            "financial_category": "vendas",
            "default_lead_id": lead["id"],
            "default_lead_name": lead["name"],
            "simple_sale": False,
            "commission_required": False,
            "show_payment_method": True,
            "commission_type": "percent",
            "commission_value": 0,
            "stock_code_field": "sku",
            "block_out_of_stock": False,
        },
        "Configuração ativa: conta Pubdigital, cliente padrão, pagamento visível",
    )

    def sell(label: str, **extra) -> dict | None:
        total = float(extra.pop("total"))
        payments = extra.pop("payments")
        items = extra.pop("items")
        body = {
            "action": "finalize_sale",
            "items": items,
            "payments": payments,
            "discount_amount": extra.pop("discount_amount", 0),
            "notes": f"CENARIO_PDV {label}",
            "customer_name": lead["name"],
            "customer_phone": lead.get("phone"),
            "lead_id": lead["id"],
            "apply_stock": False,
            "generate_financial": True,
            "financial_account": "Pubdigital",
            "financial_category": extra.pop("financial_category", "vendas"),
            "sale_description": label,
            "sale_origin": "pdv",
            **extra,
        }
        status, result = api.call("/functions/v1/pos-sales", "POST", body)
        data = (result or {}).get("data") or {}
        if status not in (200, 201) or not data.get("id"):
            fail(f"Venda {label}: HTTP {status} {(result or {}).get('error')}")
            return None
        if abs(float(data.get("total") or 0) - total) > 0.05:
            fail(f"Venda {label}: total {data.get('total')} ≠ {total}")
            return None
        ok(f"Venda #{data.get('sale_number')} — {label} — R$ {float(data.get('total') or 0):.2f}")
        return data

    def product_item(qty: float = 1, unit_price: float | None = None) -> dict:
        return {
            "item_type": "product",
            "item_id": product["id"],
            "name": product.get("name") or "Produto",
            "sku": product.get("sku"),
            "unit": product.get("unit") or "un",
            "quantity": qty,
            "unit_price": price if unit_price is None else unit_price,
            "discount_amount": 0,
        }

    info("Vendas cadastradas na Pubdigital")
    half = round(price / 2, 2)
    rest = round(price - half, 2)
    sell(
        "PIX",
        total=price,
        items=[product_item()],
        payments=[{"method": "pix", "amount": price}],
    )
    sell(
        "Dinheiro",
        total=price,
        items=[product_item()],
        payments=[{"method": "dinheiro", "amount": price}],
    )
    sell(
        "Cartão de crédito",
        total=price,
        items=[product_item()],
        payments=[{"method": "cartao_credito", "amount": price}],
    )
    sell(
        "Cartão de débito",
        total=price,
        items=[product_item()],
        payments=[{"method": "cartao_debito", "amount": price}],
    )
    sell(
        "PIX + dinheiro",
        total=price,
        items=[product_item()],
        payments=[
            {"method": "pix", "amount": half},
            {"method": "dinheiro", "amount": rest},
        ],
    )
    discounted = round(price * 0.9, 2)
    sell(
        "Com desconto",
        total=discounted,
        discount_amount=round(price - discounted, 2),
        items=[product_item()],
        payments=[{"method": "pix", "amount": discounted}],
    )
    commission_sale = sell(
        "Comissão 10%",
        total=price,
        items=[product_item()],
        payments=[{"method": "pix", "amount": price}],
        add_commission=True,
        commission_user_id=seller_id,
        commission_user_name=seller_name,
        default_commission_type="percent",
        default_commission_value=10,
    )
    if commission_sale is not None:
        amount = float(commission_sale.get("commission_amount") or 0)
        if amount <= 0:
            fail("Comissão 10% não gerou valor")
        else:
            ok(f"Comissão calculada: R$ {amount:.2f}")

    sell(
        "Comissão fixa",
        total=price,
        items=[product_item()],
        payments=[{"method": "pix", "amount": price}],
        add_commission=True,
        commission_user_id=seller_id,
        commission_user_name=seller_name,
        default_commission_type="fixed",
        default_commission_value=15,
    )

    if service:
        service_price = float(service.get("price") or 0)
        sell(
            "Serviço",
            total=service_price,
            financial_category="servicos",
            items=[
                {
                    "item_type": "service",
                    "item_id": service["id"],
                    "name": service.get("name") or "Serviço",
                    "unit": "un",
                    "quantity": 1,
                    "unit_price": service_price,
                    "discount_amount": 0,
                }
            ],
            payments=[{"method": "pix", "amount": service_price}],
        )

    info("Caixa consolidado enxerga as vendas do mês")
    from datetime import datetime

    now = datetime.now().astimezone()
    start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    end = now.replace(hour=23, minute=59, second=59, microsecond=0)
    query = urllib.parse.urlencode(
        {
            "action": "cash_consolidated",
            "date_from": start.isoformat(),
            "date_to": end.isoformat(),
        }
    )
    status, report = api.call(f"/functions/v1/pos-sales?{query}")
    data = (report or {}).get("data") or {}
    methods = {row.get("method") for row in data.get("payments") or []}
    if status != 200:
        fail(f"Caixa consolidado HTTP {status}")
    elif not {"pix", "dinheiro", "cartao_credito", "cartao_debito"} <= methods:
        fail(f"Formas no consolidado: {sorted(methods)}")
    else:
        ok("Consolidado com PIX, dinheiro, crédito e débito")

    print()
    if ERRORS:
        fail(f"{ERRORS} cenário(s) com falha")
        return 1
    ok("Todos os cenários da Pubdigital foram cadastrados e conferidos")
    return 0


if __name__ == "__main__":
    sys.exit(main())
