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
    only_discounts = "--so-descontos" in sys.argv or "--so-ajustes" in sys.argv

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
        if "payment_discounts" in payload:
            body["payment_discounts"] = payload["payment_discounts"]
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
        if "payment_discounts" in body:
            got_discounts = data.get("payment_discounts") or []
            if isinstance(got_discounts, str):
                got_discounts = json.loads(got_discounts)
            expected_pairs = {
                (item["method"], round(float(item["percent"]), 2)) for item in body["payment_discounts"]
            }
            got_pairs = {
                (item.get("method"), round(float(item.get("percent") or 0), 2)) for item in got_discounts
            }
            if got_pairs != expected_pairs:
                mismatches.append(f"payment_discounts={got_pairs!r}")
        for field in ("payment_surcharges", "promotions"):
            if field not in body:
                continue
            got_rows = data.get(field) or []
            if isinstance(got_rows, str):
                got_rows = json.loads(got_rows)
            if field == "payment_surcharges":
                expected_rows = {
                    (
                        item["method"],
                        round(float(item["percent"]), 2),
                        item.get("installments_from"),
                        item.get("installments_to"),
                    )
                    for item in body[field]
                }
                actual_rows = {
                    (
                        item.get("method"),
                        round(float(item.get("percent") or 0), 2),
                        item.get("installments_from"),
                        item.get("installments_to"),
                    )
                    for item in got_rows
                }
            else:
                expected_rows = {
                    (item["name"], item.get("valid_until"), round(float(item["percent"]), 2), tuple(item.get("categories") or []))
                    for item in body[field]
                }
                actual_rows = {
                    (
                        item.get("name"),
                        item.get("valid_until"),
                        round(float(item.get("percent") or 0), 2),
                        tuple(item.get("categories") or []),
                    )
                    for item in got_rows
                }
            if actual_rows != expected_rows:
                mismatches.append(f"{field}={actual_rows!r}")
        if mismatches:
            fail(f"{label}: divergiu {', '.join(mismatches)}")
        else:
            ok(label)

    def payment_discounts_scenarios() -> None:
        info("Desconto por forma de pagamento")
        base = {
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
        }
        status, filtered = api.call(
            "/functions/v1/pos-sales",
            "POST",
            {
                "action": "save_pos_settings",
                **base,
                "payment_discounts": [
                    {"method": "pix", "percent": 10},
                    {"method": "metodo_invalido", "percent": 20},
                    {"method": "dinheiro", "percent": 150},
                    {"method": "boleto", "percent": 0},
                    {"method": "dinheiro", "percent": 5},
                ],
            },
        )
        stored = ((filtered or {}).get("data") or {}).get("payment_discounts") or []
        if isinstance(stored, str):
            stored = json.loads(stored)
        stored_pairs = {
            (item.get("method"), round(float(item.get("percent") or 0), 2)) for item in stored
        }
        if status != 200 or stored_pairs != {("pix", 10.0), ("dinheiro", 5.0)}:
            fail(f"Filtro de desconto inválido: HTTP {status} {stored_pairs}")
        else:
            ok("Ignora método inválido, percentual acima de 100 e desconto zero")
        rules = [
            {"method": "pix", "percent": 10},
            {"method": "cheque", "percent": 11},
            {"method": "permuta", "percent": 10},
            {"method": "crediario", "percent": 10},
        ]
        save_settings(
            {**base, "payment_discounts": rules},
            "Pix 10%, Cheque 11%, Permuta 10% e Crediário 10%",
        )
        status, loaded = api.call("/functions/v1/pos-sales?action=pos_settings")
        loaded_rows = ((loaded or {}).get("data") or {}).get("payment_discounts") or []
        if isinstance(loaded_rows, str):
            loaded_rows = json.loads(loaded_rows)
        loaded_pairs = {
            (item.get("method"), round(float(item.get("percent") or 0), 2)) for item in loaded_rows
        }
        expected_pairs = {(item["method"], float(item["percent"])) for item in rules}
        if status != 200 or loaded_pairs != expected_pairs:
            fail(f"Leitura dos descontos: HTTP {status} {loaded_pairs}")
        else:
            ok("Leitura dos descontos confere com o que foi salvo")

        def discounted_total(percent: float) -> tuple[float, float]:
            amount = round(price * percent / 100, 2)
            return amount, round(price - amount, 2)

        for label, method, percent in (
            ("Desconto Pix 10%", "pix", 10),
            ("Desconto Cheque 11%", "cheque", 11),
            ("Desconto Permuta 10%", "permuta", 10),
            ("Desconto Crediário 10%", "crediario", 10),
        ):
            discount_amount, total = discounted_total(percent)
            sale = sell(
                label,
                total=total,
                discount_amount=discount_amount,
                items=[product_item()],
                payments=[{"method": method, "amount": total}],
            )
            if sale is not None and abs(float(sale.get("discount_amount") or 0) - discount_amount) > 0.05:
                fail(f"{label}: desconto gravado {sale.get('discount_amount')} ≠ {discount_amount}")

        sell(
            "Boleto sem desconto",
            total=price,
            discount_amount=0,
            items=[product_item()],
            payments=[{"method": "boleto", "amount": price}],
        )
        save_settings(
            {
                **base,
                "payment_discounts": [
                    {"method": "cheque", "percent": 11},
                    {"method": "permuta", "percent": 10},
                    {"method": "crediario", "percent": 10},
                ],
            },
            "Descontos ativos: Cheque 11%, Permuta 10% e Crediário 10%",
        )

    if not only_discounts:
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
        if "surcharge_amount" in body and abs(float(data.get("surcharge_amount") or 0) - float(body["surcharge_amount"])) > 0.05:
            fail(f"Venda {label}: acréscimo {data.get('surcharge_amount')} ≠ {body['surcharge_amount']}")
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

    def adjustment_scenarios() -> None:
        info("Acréscimos e promoções")
        category = str(product.get("category") or "").strip()
        categories = [category] if category else []
        base = {
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
        }
        status, filtered = api.call(
            "/functions/v1/pos-sales",
            "POST",
            {
                "action": "save_pos_settings",
                **base,
                "payment_surcharges": [
                    {"method": "pix", "percent": 3},
                    {"method": "metodo_invalido", "percent": 4},
                    {"method": "dinheiro", "percent": 150},
                    {"method": "cartao_credito", "percent": 8, "installments_from": 5, "installments_to": 2},
                    {"method": "cartao_credito", "percent": 1, "installments_from": 1, "installments_to": 2},
                ],
                "promotions": [
                    {"name": "", "percent": 10},
                    {"name": "acima de 100", "percent": 120},
                    {"name": "dia dos pais", "percent": 10, "valid_until": "2026-12-31", "categories": categories},
                ],
            },
        )
        stored = (filtered or {}).get("data") or {}
        surcharges = stored.get("payment_surcharges") or []
        promotions = stored.get("promotions") or []
        surcharge_pairs = {
            (item.get("method"), round(float(item.get("percent") or 0), 2), item.get("installments_from"), item.get("installments_to"))
            for item in surcharges
        }
        promo_names = {item.get("name") for item in promotions}
        if status != 200 or surcharge_pairs != {("pix", 3.0, None, None), ("cartao_credito", 1.0, 1, 2)} or promo_names != {"dia dos pais"}:
            fail(f"Filtro de acréscimo/promoção: HTTP {status} {surcharge_pairs} {promo_names}")
        else:
            ok("Ignora acréscimo inválido, faixa invertida e promoção sem nome")

        rules = [
            {"method": "pix", "percent": 3, "installments_from": None, "installments_to": None},
            {"method": "dinheiro", "percent": 5, "installments_from": None, "installments_to": None},
            {"method": "cartao_debito", "percent": 3, "installments_from": None, "installments_to": None},
            {"method": "carne", "percent": 2.5, "installments_from": None, "installments_to": None},
            {"method": "cartao_credito", "percent": 1, "installments_from": 1, "installments_to": 2},
            {"method": "cartao_credito", "percent": 8, "installments_from": 1, "installments_to": 3},
            {"method": "cartao_credito", "percent": 3, "installments_from": None, "installments_to": 2},
            {"method": "cartao_credito", "percent": 8, "installments_from": None, "installments_to": 3},
            {"method": "cartao_credito", "percent": 3, "installments_from": 1, "installments_to": 1},
        ]
        promo_list = [
            {"name": "dia dos pais", "percent": 10, "valid_until": "2026-12-31", "categories": categories},
            {"name": "Natal", "percent": 15, "valid_until": "2026-12-25", "categories": categories},
            {"name": "dia dos namorados", "percent": 25, "valid_until": "2024-06-12", "categories": categories},
            {"name": "bonificação", "percent": 100, "valid_until": None, "categories": []},
        ]
        save_settings(
            {**base, "payment_surcharges": rules, "promotions": promo_list},
            "Acréscimos por forma e promoções com validade",
        )

        pix_surcharge = round(price * 0.03, 2)
        sell(
            "Acréscimo Pix 3%",
            total=round(price + pix_surcharge, 2),
            discount_amount=0,
            surcharge_amount=pix_surcharge,
            items=[product_item()],
            payments=[{"method": "pix", "amount": round(price + pix_surcharge, 2)}],
        )
        promo_discount = round(price * 0.10, 2)
        sell(
            "Promoção dia dos pais 10%",
            total=round(price - promo_discount, 2),
            discount_amount=promo_discount,
            surcharge_amount=0,
            promotion_name="dia dos pais",
            items=[product_item()],
            payments=[{"method": "boleto", "amount": round(price - promo_discount, 2)}],
        )
        after_promo = round(price - promo_discount, 2)
        stacked_surcharge = round(after_promo * 0.03, 2)
        sell(
            "Promoção 10% + acréscimo Pix 3%",
            total=round(after_promo + stacked_surcharge, 2),
            discount_amount=promo_discount,
            surcharge_amount=stacked_surcharge,
            promotion_name="dia dos pais",
            items=[product_item()],
            payments=[{"method": "pix", "amount": round(after_promo + stacked_surcharge, 2)}],
        )
        card_surcharge = round(price * 0.01, 2)
        sell(
            "Cartão 2x na faixa de 1%",
            total=round(price + card_surcharge, 2),
            discount_amount=0,
            surcharge_amount=card_surcharge,
            items=[product_item()],
            payments=[{"method": "cartao_credito", "amount": round(price + card_surcharge, 2)}],
        )
        ok("Promoção vencida fica cadastrada e não entra nessas vendas")

    if "--so-ajustes" in sys.argv:
        adjustment_scenarios()
    else:
        payment_discounts_scenarios()

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
