#!/usr/bin/env python3
"""Cenários do PDV que a rodada anterior não cobriu, na organização Pubdigital."""
from __future__ import annotations

import json
import os
import subprocess
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ORG_ID = "8127ebc7-f911-4dcc-90d0-9d2cd851d469"
ERRORS = 0
CREATED: list[str] = []


def ok(message: str) -> None:
    print(f"\033[0;32m✅ {message}\033[0m")


def fail(message: str) -> None:
    global ERRORS
    ERRORS += 1
    print(f"\033[0;31m❌ {message}\033[0m")


def info(message: str) -> None:
    print(f"\033[0;34m→ {message}\033[0m")


def load_env() -> dict[str, str]:
    env: dict[str, str] = {}
    for name in (".env", ".env.e2e.local", "/root/postgresql-budget-credentials.txt"):
        path = Path(name) if name.startswith("/") else ROOT / name
        if not path.exists():
            continue
        for line in path.read_text().splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            env.setdefault(key, value.strip().strip('"').strip("'"))
    return env


class Api:
    def __init__(self, base: str, key: str, token: str):
        self.base = base.rstrip("/")
        self.key = key
        self.token = token

    def call(self, path: str, method: str = "GET", body: dict | None = None, org: bool = True):
        headers = {
            "apikey": self.key,
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json",
            "Prefer": "return=representation",
        }
        if org:
            headers["X-Organization-Id"] = ORG_ID
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

    boot = Api(base, key, "")
    status, auth = boot.call(
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
    api = Api(base, key, token)
    ok("Login OK")

    status, settings_body = api.call("/functions/v1/pos-sales?action=pos_settings")
    original = (settings_body or {}).get("data") if isinstance(settings_body, dict) else None
    if isinstance(original, dict):
        Path("/tmp/pos-settings-pubdigital.json").write_text(json.dumps(original))
    if isinstance(original, dict):
        api.call(
            "/functions/v1/pos-sales",
            "POST",
            {
                "action": "save_pos_settings",
                "sale_notes": original.get("sale_notes") or "",
                "financial_account": original.get("financial_account") or "",
                "financial_category": original.get("financial_category") or "",
                "default_lead_id": original.get("default_lead_id"),
                "default_lead_name": original.get("default_lead_name"),
                "simple_sale": bool(original.get("simple_sale")),
                "commission_required": bool(original.get("commission_required")),
                "show_payment_method": original.get("show_payment_method") is not False,
                "commission_type": original.get("commission_type") or "percent",
                "commission_value": original.get("commission_value") or 0,
                "stock_code_field": original.get("stock_code_field") or "sku",
                "block_out_of_stock": bool(original.get("block_out_of_stock")),
                "payment_discounts": [],
                "payment_surcharges": [],
                "promotions": [],
            },
        )

    status, products_body = api.call("/functions/v1/products")
    products = (products_body.get("data") or []) if isinstance(products_body, dict) else []
    product = next((item for item in products if float(item.get("price") or 0) > 0), None)
    if not product:
        fail("Sem produto")
        return 1
    price = float(product.get("price") or 0) or 10.0
    stock = float(product.get("stock_quantity") or 0)
    ok(f"Produto {product.get('name')} R$ {price:.2f} estoque {stock:.0f}")

    status, leads = api.call(
        f"/rest/v1/leads?organization_id=eq.{ORG_ID}&deleted_at=is.null&name=eq.Cliente%20Cen%C3%A1rios%20PDV&select=id,name,phone&limit=1"
    )
    lead = leads[0] if isinstance(leads, list) and leads else None
    if not lead:
        fail("Cliente de cenário ausente")
        return 1

    def sell(**extra) -> dict | None:
        label = extra.pop("label", "lacuna")
        total = float(extra.pop("total", price))
        body = {
            "action": "finalize_sale",
            "items": extra.pop(
                "items",
                [{
                    "item_type": "product",
                    "item_id": product["id"],
                    "name": product.get("name") or "Produto",
                    "sku": product.get("sku"),
                    "unit": product.get("unit") or "un",
                    "quantity": extra.pop("quantity", 1),
                    "unit_price": price,
                    "discount_amount": 0,
                }],
            ),
            "payments": extra.pop("payments", [{"method": "pix", "amount": total}]),
            "discount_amount": 0,
            "notes": f"CENARIO_LACUNA {label}",
            "customer_name": lead["name"],
            "lead_id": lead["id"],
            "apply_stock": False,
            "generate_financial": True,
            "sale_origin": "pdv",
            "sale_description": label,
        }
        body.update(extra)
        status, result = api.call("/functions/v1/pos-sales", "POST", body)
        data = (result or {}).get("data") or {}
        if status not in (200, 201) or not data.get("id"):
            fail(f"{label}: HTTP {status} {(result or {}).get('error')}")
            return None
        CREATED.append(str(data["id"]))
        ok(f"{label} #{data.get('sale_number')}")
        return data

    def sale_detail(sale_id: str) -> dict:
        status, body = api.call(f"/functions/v1/pos-sales?action=get_sale&id={sale_id}")
        if status != 200:
            fail(f"Detalhe {sale_id[:8]} HTTP {status}")
            return {}
        return (body or {}).get("data") or {}

    def entries(sale_id: str) -> list[dict]:
        query = (
            f"/rest/v1/financial_entries?organization_id=eq.{ORG_ID}"
            "&select=id,status,source_id,source_type,paid_at,direction,amount"
            f"&or=(source_id.eq.{sale_id},source_id.like.venda:{sale_id}:*,source_id.like.estorno-pdv:{sale_id}:*,source_id.eq.pdv:{sale_id})"
        )
        status, rows = api.call(query)
        if status != 200 or not isinstance(rows, list):
            fail(f"Financeiro HTTP {status}")
            return []
        return rows

    def cancel(sale_id: str) -> tuple[int, dict]:
        return api.call("/functions/v1/pos-sales", "POST", {"action": "cancel_sale", "sale_id": sale_id})

    def restore_settings() -> None:
        if not isinstance(original, dict):
            return
        status, restored = api.call(
            "/functions/v1/pos-sales",
            "POST",
            {
                "action": "save_pos_settings",
                "sale_notes": original.get("sale_notes") or "",
                "financial_account": original.get("financial_account") or "",
                "financial_category": original.get("financial_category") or "",
                "default_lead_id": original.get("default_lead_id"),
                "default_lead_name": original.get("default_lead_name"),
                "simple_sale": bool(original.get("simple_sale")),
                "commission_required": bool(original.get("commission_required")),
                "show_payment_method": original.get("show_payment_method") is not False,
                "commission_type": original.get("commission_type") or "percent",
                "commission_value": original.get("commission_value") or 0,
                "stock_code_field": original.get("stock_code_field") or "sku",
                "block_out_of_stock": bool(original.get("block_out_of_stock")),
                "payment_discounts": original.get("payment_discounts") or [],
                "payment_surcharges": original.get("payment_surcharges") or [],
                "promotions": original.get("promotions") or [],
            },
        )
        if status != 200:
            fail(f"Restaurar configuração HTTP {status}")
        else:
            ok("Configuração restaurada")

    try:
        info("Comissão sem gerar o financeiro da venda")
        quiet = sell(
            label="comissao sem financeiro",
            generate_financial=False,
            add_commission=True,
            commission_user_id=user_id,
            commission_user_name="PubDigital",
            default_commission_type="percent",
            default_commission_value=10,
        )
        if quiet:
            rows = entries(quiet["id"])
            commission = [row for row in rows if row.get("source_type") == "comissao"]
            titles = [row for row in rows if row.get("source_type") == "pdv"]
            if titles:
                fail("Venda sem financeiro gerou título de venda")
            elif not commission:
                fail("Comissão não foi lançada")
            else:
                ok(f"Comissão lançada sem título da venda: R$ {commission[0].get('amount')}")

        info("Excluir título já recebido e reativar")
        paid_sale = sell(
            label="ja recebido",
            add_commission=True,
            commission_user_id=user_id,
            commission_user_name="PubDigital",
            default_commission_type="fixed",
            default_commission_value=2,
        )
        if paid_sale:
            rows = [row for row in entries(paid_sale["id"]) if row.get("source_type") == "pdv"]
            if not rows:
                fail("Venda não gerou título para marcar como recebido")
            else:
                entry_id = rows[0]["id"]
                status, patched = api.call(
                    f"/rest/v1/financial_entries?id=eq.{entry_id}",
                    "PATCH",
                    {"status": "paid", "paid_at": "2026-10-06T15:00:00Z"},
                )
                if status not in (200, 204) or (isinstance(patched, list) and not patched):
                    fail(f"Marcar recebido HTTP {status}")
                else:
                    ok("Título marcado como recebido")
                status, result = cancel(paid_sale["id"])
                rows = entries(paid_sale["id"])
                payables = [
                    row for row in rows
                    if str(row.get("source_id") or "").startswith("estorno-pdv:")
                    and row.get("status") != "cancelled"
                ]
                pdv_rows = [row for row in rows if row.get("source_type") == "pdv" and not str(row.get("source_id") or "").startswith("estorno-pdv:")]
                if status != 200:
                    fail(f"Excluir venda recebida HTTP {status} {(result or {}).get('error')}")
                elif payables:
                    fail("Nasceu conta a pagar do valor já recebido")
                elif any(row.get("status") != "cancelled" for row in pdv_rows):
                    fail("Título recebido não foi cancelado")
                else:
                    ok("Título já recebido foi cancelado no lugar")
                detail = sale_detail(paid_sale["id"])
                if not detail.get("cancelled_at") or not detail.get("cancelled_by_name"):
                    fail(f"Exclusão sem data ou usuário: {detail.get('cancelled_at')} {detail.get('cancelled_by_name')}")
                else:
                    ok(f"Exclusão registrada por {detail.get('cancelled_by_name')}")
                status, reactivated = api.call(
                    "/functions/v1/pos-sales",
                    "POST",
                    {"action": "reactivate_sale", "sale_id": paid_sale["id"]},
                )
                detail = sale_detail(paid_sale["id"])
                rows = entries(paid_sale["id"])
                paid_again = [
                    row for row in rows
                    if row.get("source_type") == "pdv"
                    and not str(row.get("source_id") or "").startswith("estorno-pdv:")
                    and row.get("status") == "paid"
                ]
                commission = [row for row in rows if row.get("source_type") == "comissao" and row.get("status") != "cancelled"]
                if status != 200 or detail.get("status") != "completed":
                    fail(f"Reativar HTTP {status} status {detail.get('status')} {(reactivated or {}).get('error')}")
                elif not paid_again:
                    fail("Reativação não devolveu o título como recebido")
                elif not commission:
                    fail("Reativação não reabriu a comissão")
                else:
                    ok("Reativação devolveu o título recebido e a comissão")

        info("Devolução, troca, quantidade e forma de pagamento")
        mutable = sell(label="alteravel", quantity=2, total=round(price * 2, 2), payments=[{"method": "pix", "amount": round(price * 2, 2)}])
        if mutable:
            detail = sale_detail(mutable["id"])
            item = (detail.get("items") or [None])[0]
            payment = (detail.get("payments") or [None])[0]
            if not item or not payment:
                fail("Venda sem item ou pagamento")
            else:
                status, updated = api.call(
                    "/functions/v1/pos-sales",
                    "POST",
                    {"action": "update_sale_items", "sale_id": mutable["id"], "items": [{"id": item["id"], "quantity": 1}]},
                )
                detail = sale_detail(mutable["id"])
                qty = float(((detail.get("items") or [{}])[0]).get("quantity") or 0)
                if status != 200 or abs(qty - 1) > 0.001:
                    fail(f"Alterar quantidade HTTP {status} qty {qty} {(updated or {}).get('error')}")
                else:
                    ok("Quantidade alterada para 1")
                status, swapped = api.call(
                    "/functions/v1/pos-sales",
                    "POST",
                    {"action": "update_sale_payment", "sale_id": mutable["id"], "payment_id": payment["id"], "method": "dinheiro"},
                )
                detail = sale_detail(mutable["id"])
                method = ((detail.get("payments") or [{}])[0]).get("method")
                if status != 200 or method != "dinheiro":
                    fail(f"Trocar pagamento HTTP {status} {method} {(swapped or {}).get('error')}")
                else:
                    ok("Pagamento trocado para dinheiro")
                detail = sale_detail(mutable["id"])
                item = (detail.get("items") or [None])[0]
                status, returned = api.call(
                    "/functions/v1/pos-sales",
                    "POST",
                    {
                        "action": "return_exchange",
                        "sale_id": mutable["id"],
                        "returned_items": [{"item_id": item["id"], "quantity": 1}],
                        "replacement_items": [],
                        "settlement_method": "dinheiro",
                        "settle_now": False,
                    },
                )
                detail = sale_detail(mutable["id"])
                if status != 200 or not (detail.get("returns") or []):
                    fail(f"Devolução HTTP {status} {(returned or {}).get('error')}")
                else:
                    ok("Devolução registrada")
            exchange = sell(label="troca")
            if exchange:
                detail = sale_detail(exchange["id"])
                item = (detail.get("items") or [None])[0]
                status, exchanged = api.call(
                    "/functions/v1/pos-sales",
                    "POST",
                    {
                        "action": "return_exchange",
                        "sale_id": exchange["id"],
                        "returned_items": [{"item_id": item["id"], "quantity": 1}],
                        "replacement_items": [{
                            "item_type": "product",
                            "item_id": product["id"],
                            "name": product.get("name") or "Produto",
                            "quantity": 1,
                            "unit_price": price,
                        }],
                        "settlement_method": "pix",
                        "settle_now": False,
                    },
                )
                detail = sale_detail(exchange["id"])
                kinds = [row.get("kind") for row in detail.get("returns") or []]
                if status != 200 or "exchange" not in kinds:
                    fail(f"Troca HTTP {status} {kinds} {(exchanged or {}).get('error')}")
                else:
                    ok("Troca registrada")

        info("Caixa aberto único")
        status, first = api.call("/functions/v1/pos-sales", "POST", {"action": "open_cash", "opening_amount": 0, "notes": "CENARIO_LACUNA"})
        first_id = ((first or {}).get("data") or {}).get("id")
        already = "já existe" in str((first or {}).get("message") or "").lower()
        status2, second = api.call("/functions/v1/pos-sales", "POST", {"action": "open_cash", "opening_amount": 50})
        second_id = ((second or {}).get("data") or {}).get("id")
        if not first_id or first_id != second_id:
            fail(f"Dois caixas: {first_id} {second_id} HTTP {status}/{status2}")
        else:
            ok("Segundo abrir caixa devolve o mesmo caixa")
        if first_id and not already and status == 201:
            closed, close_body = api.call(
                "/functions/v1/pos-sales",
                "POST",
                {"action": "close_cash", "session_id": first_id, "closing_amount": 0},
            )
            if closed != 200:
                fail(f"Fechar caixa de teste HTTP {closed} {(close_body or {}).get('error')}")
            else:
                ok("Caixa de teste fechado")
        elif already:
            ok("Caixa que já estava aberto foi preservado")

        info("Bloqueio de estoque negativo")
        base_settings = original if isinstance(original, dict) else {}
        status, saved = api.call(
            "/functions/v1/pos-sales",
            "POST",
            {
                "action": "save_pos_settings",
                "sale_notes": base_settings.get("sale_notes") or "",
                "financial_account": base_settings.get("financial_account") or "",
                "financial_category": base_settings.get("financial_category") or "",
                "default_lead_id": base_settings.get("default_lead_id"),
                "default_lead_name": base_settings.get("default_lead_name"),
                "simple_sale": bool(base_settings.get("simple_sale")),
                "commission_required": bool(base_settings.get("commission_required")),
                "show_payment_method": base_settings.get("show_payment_method") is not False,
                "commission_type": base_settings.get("commission_type") or "percent",
                "commission_value": base_settings.get("commission_value") or 0,
                "stock_code_field": base_settings.get("stock_code_field") or "sku",
                "block_out_of_stock": True,
                "payment_discounts": [],
                "payment_surcharges": [],
                "promotions": [],
            },
        )
        if status != 200:
            fail(f"Ligar bloqueio HTTP {status}")
        else:
            huge = int(stock) + 50 if stock > 0 else 9999
            status, blocked = api.call(
                "/functions/v1/pos-sales",
                "POST",
                {
                    "action": "finalize_sale",
                    "items": [{
                        "item_type": "product",
                        "item_id": product["id"],
                        "name": product.get("name") or "Produto",
                        "quantity": huge,
                        "unit_price": price,
                        "discount_amount": 0,
                    }],
                    "payments": [{"method": "pix", "amount": round(price * huge, 2)}],
                    "notes": "CENARIO_LACUNA estoque",
                    "customer_name": lead["name"],
                    "lead_id": lead["id"],
                    "apply_stock": True,
                    "generate_financial": False,
                    "sale_origin": "pdv",
                },
            )
            blocked_id = str(((blocked or {}).get("data") or {}).get("id") or "")
            if blocked_id:
                CREATED.append(blocked_id)
            if status == 400 and "estoque" in str((blocked or {}).get("error") or "").lower():
                ok("Venda acima do estoque foi recusada")
            else:
                fail(f"Bloqueio de estoque HTTP {status} {(blocked or {}).get('error')}")

        info("Nota fiscal impede excluir")
        noted = sell(label="com nota", generate_financial=False)
        if noted and env.get("POSTGRES_PASSWORD"):
            sql_set = f"UPDATE pos_sales SET invoice_number = 'NF-TESTE' WHERE id = '{noted['id']}'"
            sql_clear = f"UPDATE pos_sales SET invoice_number = NULL WHERE id = '{noted['id']}'"
            env_sql = os.environ.copy()
            env_sql["PGPASSWORD"] = env["POSTGRES_PASSWORD"]
            marked = subprocess.run(
                ["psql", "-h", env.get("POSTGRES_HOST", "localhost"), "-p", env.get("POSTGRES_PORT", "5432"),
                 "-U", env.get("POSTGRES_USER", "budget_user"), "-d", env.get("POSTGRES_DB", "budget_services"),
                 "-c", sql_set],
                check=False, capture_output=True, text=True, env=env_sql,
            )
            if marked.returncode != 0:
                fail("Não foi possível marcar a nota fiscal de teste")
            status, blocked = cancel(noted["id"])
            if status == 400 and "nota" in str((blocked or {}).get("error") or "").lower():
                ok("Venda com nota fiscal não foi excluída")
            else:
                fail(f"Nota fiscal HTTP {status} {(blocked or {}).get('error')}")
            subprocess.run(
                ["psql", "-h", env.get("POSTGRES_HOST", "localhost"), "-p", env.get("POSTGRES_PORT", "5432"),
                 "-U", env.get("POSTGRES_USER", "budget_user"), "-d", env.get("POSTGRES_DB", "budget_services"),
                 "-c", sql_clear],
                check=False, capture_output=True, text=True, env=env_sql,
            )

        info("Períodos do caixa consolidado")
        from datetime import datetime
        now = datetime.now().astimezone()
        start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        end = now.replace(hour=23, minute=59, second=59, microsecond=0)
        for period in ("dawn", "afternoon", "night"):
            query = urllib.parse.urlencode({
                "action": "cash_consolidated",
                "date_from": start.isoformat(),
                "date_to": end.isoformat(),
                "day_period": period,
            })
            status, report = api.call(f"/functions/v1/pos-sales?{query}")
            data = (report or {}).get("data") or {}
            if status != 200 or not isinstance(data.get("payments"), list):
                fail(f"Consolidado {period} HTTP {status}")
            else:
                ok(f"Consolidado {period}")

        info("Vendedor sem ser administrador")
        status, members = api.call(
            f"/rest/v1/organization_members?organization_id=eq.{ORG_ID}&select=user_id,role&limit=50"
        )
        clerks = [row for row in members if isinstance(members, list) and row.get("role") not in ("owner", "admin")] if isinstance(members, list) else []
        if not clerks:
            info("Não há vendedor comum nesta organização para recusar a exclusão")
        else:
            info(f"{len(clerks)} membro(s) sem perfil de administrador; falta a senha deles para tentar excluir")
    finally:
        info("Limpando vendas de teste")
        for sale_id in CREATED:
            status, current = api.call(f"/functions/v1/pos-sales?action=get_sale&id={sale_id}")
            if status == 200 and ((current or {}).get("data") or {}).get("status") == "completed":
                cancel(sale_id)
        restore_settings()

    print()
    if ERRORS:
        fail(f"{ERRORS} cenário(s) com falha")
        return 1
    ok("Lacunas da API conferidas")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
