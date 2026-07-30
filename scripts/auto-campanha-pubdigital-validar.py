#!/usr/bin/env python3
"""
Automação Disparador 2 — org pubdigital (pubdgital):

1. Login com credenciais E2E
2. Sincroniza / lista instâncias conectadas
3. Monta campanha: modo rotacionar + variações com tags {nome}
4. Valida WhatsApp via edge validate-broadcast-whatsapp
5. Cria campanha draft + fila com contatos validados (não dispara)

Uso:
  python3 scripts/auto-campanha-pubdigital-validar.py
  python3 scripts/auto-campanha-pubdigital-validar.py --dry-run   # só valida, não cria
  python3 scripts/auto-campanha-pubdigital-validar.py --save
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from typing import Any

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REF_FILE = os.path.join(ROOT, "supabase", ".temp", "project-ref")
E2E_ENV = os.path.join(ROOT, ".env.e2e.local")
OUT_DIR = os.path.join(ROOT, "test-results")

PUBDIGITAL_ORG = "8127ebc7-f911-4dcc-90d0-9d2cd851d469"

# Sequência de números para validação (formato BR com nomes → tags {nome})
# Mistura: formatos válidos sintéticos + inválidos óbvios (não spam real)
CONTACT_SEQUENCE = [
    ("5511999000001", "Ana Teste"),
    ("5511999000002", "Bruno Teste"),
    ("5511999000003", "Carla Teste"),
    ("5511999000004", "Diego Teste"),
    ("5511999000005", "Elena Teste"),
    ("5511888000001", "Fabio Teste"),
    ("5511888000002", "Gisele Teste"),
    ("5511777000001", "Hugo Teste"),
    ("11999000099", "Iris Local"),  # sem DDI — normaliza para 55
    ("5500000000000", "Joao Invalido"),
    ("123456", "Numero Curto"),
    ("5511912345678", "Karen Teste"),
]

# Sintaxes rotacionadas com tags de personalização
MESSAGE_VARIATIONS = [
    "Olá {nome}! Tudo bem? Aqui é da equipe. Posso te enviar uma informação rápida?",
    "Oi {nome}, tudo certo? Passando para compartilhar uma novidade com você.",
    "{nome}, boa tarde! Temos um recado importante — posso falar um minuto?",
]


def log(msg: str) -> None:
    print(msg, flush=True)


def load_dotenv_file(path: str) -> dict[str, str]:
    out: dict[str, str] = {}
    if not os.path.exists(path):
        return out
    with open(path) as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            out[k.strip()] = v.strip().strip('"').strip("'")
    return out


def load_project_ref() -> str:
    return open(REF_FILE).read().strip()


def load_keys() -> tuple[str, str]:
    ref = load_project_ref()
    proc = subprocess.run(
        ["supabase", "projects", "api-keys", "--project-ref", ref],
        capture_output=True,
        text=True,
        cwd=ROOT,
        timeout=60,
    )
    anon = service = ""
    for line in proc.stdout.splitlines():
        parts = [p.strip() for p in line.split("|") if p.strip()]
        if len(parts) >= 2 and parts[0] == "anon":
            anon = parts[1]
        if len(parts) >= 2 and parts[0] == "service_role":
            service = parts[1]
    if not anon or not service:
        raise RuntimeError("Não foi possível obter chaves anon/service_role")
    return anon, service


def http_json(
    method: str,
    url: str,
    headers: dict[str, str],
    body: dict | list | None = None,
    timeout: int = 90,
) -> tuple[int, Any]:
    data = None if body is None else json.dumps(body).encode()
    req = urllib.request.Request(url, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read().decode()
            parsed: Any = json.loads(raw) if raw.strip() else None
            return resp.status, parsed
    except urllib.error.HTTPError as e:
        raw = e.read().decode(errors="replace")
        try:
            parsed = json.loads(raw) if raw.strip() else {"error": raw}
        except json.JSONDecodeError:
            parsed = {"error": raw[:500]}
        return e.code, parsed


def normalize_phone_br(phone: str) -> str:
    digits = "".join(c for c in phone if c.isdigit())
    if not digits:
        return ""
    if digits.startswith("55"):
        return digits
    if 10 <= len(digits) <= 11:
        return "55" + digits
    return digits


def login(anon: str, email: str, password: str) -> dict[str, Any]:
    ref = load_project_ref()
    code, data = http_json(
        "POST",
        f"https://{ref}.supabase.co/auth/v1/token?grant_type=password",
        {"apikey": anon, "Content-Type": "application/json"},
        {"email": email, "password": password},
        timeout=30,
    )
    if code != 200 or not isinstance(data, dict) or not data.get("access_token"):
        raise RuntimeError(f"Login falhou http={code}: {data}")
    return data


def rest(
    method: str,
    table_query: str,
    token: str,
    key: str,
    body: dict | list | None = None,
    prefer: str = "return=representation",
) -> Any:
    ref = load_project_ref()
    url = f"https://{ref}.supabase.co/rest/v1/{table_query}"
    headers = {
        "apikey": key,
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Prefer": prefer,
    }
    code, data = http_json(method, url, headers, body)
    if code >= 400:
        raise RuntimeError(f"REST {method} {table_query} http={code}: {data}")
    return data


def curl_evo(api_url: str, api_key: str, path: str, method: str = "GET", body: dict | None = None) -> tuple[int, Any]:
    base = api_url.rstrip("/").replace("/manager", "").replace("/dashboard", "")
    if base.startswith("http://") and "atendimentoagilize.com" in base:
        base = "https://" + base[len("http://") :]
    url = f"{base}{path}"
    cmd = ["curl", "-sS", "-L", "--post301", "--post302", "--post303", "-m", "20", "-w", "\n%{http_code}", "-H", f"apikey: {api_key}"]
    if method == "POST":
        cmd += ["-X", "POST", "-H", "Content-Type: application/json", "-d", json.dumps(body or {})]
    cmd.append(url)
    proc = subprocess.run(cmd, capture_output=True, text=True)
    parts = proc.stdout.rsplit("\n", 1)
    raw = parts[0] if len(parts) == 2 else proc.stdout
    http = int(parts[1].strip()) if len(parts) == 2 and parts[1].strip().isdigit() else 0
    try:
        parsed = json.loads(raw) if raw.strip() else None
    except json.JSONDecodeError:
        parsed = raw
    return http, parsed


def live_connected_chips(chips: list[dict]) -> list[dict]:
    ready: list[dict] = []
    for c in chips:
        name = str(c.get("instance_name") or "").strip()
        api_url = str(c.get("api_url") or "").strip()
        api_key = str(c.get("api_key") or "").strip()
        if not name or not api_url or not api_key:
            continue
        http, data = curl_evo(api_url, api_key, f"/instance/connectionState/{urllib.parse.quote(name)}")
        state = "?"
        if isinstance(data, dict):
            inst = data.get("instance") if isinstance(data.get("instance"), dict) else {}
            state = str(inst.get("state") or data.get("state") or "?").lower()
        live = state in {"open", "connected", "online", "ready", "authenticated"}
        c = {**c, "live_state": state, "live_open": live}
        log(f"  [{name}] db_connected={c.get('is_connected')} live={state} → {'OPEN' if live else 'off'}")
        if live:
            ready.append(c)
        time.sleep(0.35)
    return ready


def owner_numbers_from_fetch(chip: dict) -> list[str]:
    http, data = curl_evo(
        str(chip["api_url"]),
        str(chip["api_key"]),
        "/instance/fetchInstances",
    )
    if http != 200 or not data:
        return []
    rows = data if isinstance(data, list) else [data]
    out: list[str] = []
    target = str(chip["instance_name"]).strip().lower()
    for row in rows:
        if not isinstance(row, dict):
            continue
        inst = row.get("instance") if isinstance(row.get("instance"), dict) else row
        name = str(inst.get("instanceName") or inst.get("name") or row.get("instanceName") or "").strip().lower()
        if name != target:
            continue
        owner = str(inst.get("ownerJid") or row.get("ownerJid") or "").split("@")[0]
        if owner.isdigit() and len(owner) >= 12:
            out.append(owner)
    return out


def validate_whatsapp(
    access_token: str,
    anon: str,
    org_id: str,
    instance_ids: list[str],
    numbers: list[str],
) -> dict[str, Any]:
    ref = load_project_ref()
    url = f"https://{ref}.supabase.co/functions/v1/validate-broadcast-whatsapp"
    code, data = http_json(
        "POST",
        url,
        {
            "Authorization": f"Bearer {access_token}",
            "apikey": anon,
            "Content-Type": "application/json",
        },
        {
            "organizationId": org_id,
            "instanceIds": instance_ids,
            "numbers": numbers,
            "useLatamValidator": False,
            "preferredInstanceId": instance_ids[0] if instance_ids else None,
        },
        timeout=90,
    )
    if not isinstance(data, dict):
        return {"ok": False, "error": f"resposta inválida http={code}", "http": code, "raw": data}
    data["http"] = code
    return data


def build_contacts_text(extra_owners: list[tuple[str, str]]) -> tuple[str, list[dict[str, str]]]:
    contacts: list[dict[str, str]] = []
    seen: set[str] = set()
    for phone, name in extra_owners + CONTACT_SEQUENCE:
        norm = normalize_phone_br(phone)
        if not norm or norm in seen:
            continue
        seen.add(norm)
        contacts.append({"phone": norm, "name": name})
    # Formato lista do Disparador: Nome, telefone
    lines = [f"{c['name']}, {c['phone']}" for c in contacts]
    return "\n".join(lines), contacts


def create_campaign(
    user_token: str,
    anon: str,
    user_id: str,
    org_id: str,
    name: str,
    instance_ids: list[str],
    validated: list[dict[str, str]],
    variations: list[str],
) -> dict[str, Any]:
    campaign_body = {
        "user_id": user_id,
        "organization_id": org_id,
        "name": name,
        "instance_id": None,
        "message_template_id": None,
        "custom_message": variations[0],
        "min_delay_seconds": 30,
        "max_delay_seconds": 60,
        "total_contacts": len(validated),
        "status": "draft",
        "sending_method": "rotate",
        "instance_ids": instance_ids,
    }
    # Prefer user JWT para respeitar RLS de insert
    created = rest("POST", "broadcast_campaigns_2", user_token, anon, campaign_body)
    if isinstance(created, list):
        campaign = created[0]
    else:
        campaign = created
    campaign_id = campaign["id"]

    queue_items = []
    for index, contact in enumerate(validated):
        msg = variations[index % len(variations)]
        personalized = msg.replace("{nome}", contact.get("name") or "").replace("{name}", contact.get("name") or "")
        queue_items.append(
            {
                "campaign_id": campaign_id,
                "organization_id": org_id,
                "instance_id": instance_ids[index % len(instance_ids)],
                "phone": contact["phone"],
                "name": contact.get("name"),
                "personalized_message": personalized,
                "status": "pending",
            }
        )

    # insert em lotes
    batch = 50
    for i in range(0, len(queue_items), batch):
        rest("POST", "broadcast_queue_2", user_token, anon, queue_items[i : i + batch], prefer="return=minimal")

    return {
        "campaign": campaign,
        "queue_count": len(queue_items),
        "variations_used": len(variations),
        "instances_used": len(instance_ids),
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--org", default=None)
    parser.add_argument("--dry-run", action="store_true", help="Só valida WhatsApp, não cria campanha")
    parser.add_argument("--save", action="store_true")
    parser.add_argument("--no-owners", action="store_true", help="Não inclui ownerJid dos chips")
    args = parser.parse_args()

    e2e = load_dotenv_file(E2E_ENV)
    email = e2e.get("E2E_EMAIL") or os.environ.get("E2E_EMAIL") or "pubdigital.net@gmail.com"
    password = e2e.get("E2E_PASSWORD") or os.environ.get("E2E_PASSWORD") or "123456"
    org_id = args.org or e2e.get("E2E_ORG_ID") or PUBDIGITAL_ORG

    log("=== Auto campanha pubdigital: rotate + tags + validar WhatsApp ===")
    log(f"org={org_id} user={email} dry_run={args.dry_run}")

    anon, service = load_keys()
    auth = login(anon, email, password)
    access = auth["access_token"]
    user_id = auth["user"]["id"]
    log(f"login OK user_id={user_id[:8]}…")

    chips = rest(
        "GET",
        f"evolution_config?organization_id=eq.{org_id}&select=id,instance_name,api_url,api_key,is_connected&order=instance_name.asc",
        service,
        service,
    )
    if not isinstance(chips, list) or not chips:
        log("❌ Nenhuma evolution_config na org")
        return 2

    log(f"\nProbing {len(chips)} chips (connectionState ao vivo)…")
    ready = live_connected_chips(chips)
    if not ready:
        log("❌ Nenhuma instância OPEN ao vivo — não dá para validar")
        return 1

    instance_ids = [str(c["id"]) for c in ready]
    instance_names = [str(c["instance_name"]) for c in ready]
    log(f"\nInstâncias OPEN selecionadas ({len(ready)}): {', '.join(instance_names)}")

    extra_owners: list[tuple[str, str]] = []
    if not args.no_owners:
        for c in ready[:3]:
            for own in owner_numbers_from_fetch(c):
                extra_owners.append((own, f"Owner {c['instance_name']}"))
                log(f"  + ownerJid {c['instance_name']}: {own}")

    contacts_text, contacts = build_contacts_text(extra_owners)
    numbers = [c["phone"] for c in contacts]
    log(f"\nLista de contatos: {len(contacts)} números")
    log("--- preview ---")
    for line in contacts_text.splitlines()[:8]:
        log(f"  {line}")
    if len(contacts) > 8:
        log(f"  … +{len(contacts) - 8} mais")

    log("\nValidando WhatsApp via edge (mesma do Disparador 2)…")
    edge = validate_whatsapp(access, anon, org_id, instance_ids, numbers)
    log(f"  http={edge.get('http')} ok={edge.get('ok')} usedInstance={edge.get('usedInstance')}")
    if edge.get("error"):
        log(f"  error={edge.get('error')}")

    validated_nums = set(normalize_phone_br(n) for n in (edge.get("validatedNumbers") or []))
    rejected_nums = set(normalize_phone_br(n) for n in (edge.get("rejectedNumbers") or []))
    validated_contacts = [c for c in contacts if normalize_phone_br(c["phone"]) in validated_nums]
    rejected_contacts = [c for c in contacts if normalize_phone_br(c["phone"]) in rejected_nums]

    log(f"\nResultado validação:")
    log(f"  ✅ WhatsApp OK: {len(validated_contacts)}")
    log(f"  ❌ Rejeitados:  {len(rejected_contacts)}")
    for c in validated_contacts[:10]:
        log(f"    OK  {c['name']}: {c['phone']}")
    for c in rejected_contacts[:10]:
        log(f"    NO  {c['name']}: {c['phone']}")

    stamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    campaign_name = f"[AUTO] rotate+tags {stamp}"
    created_info: dict[str, Any] | None = None

    if args.dry_run:
        log("\n--dry-run: campanha NÃO criada")
    elif not edge.get("ok") and len(validated_contacts) == 0:
        log("\n⚠️ Validação falhou / 0 válidos — campanha NÃO criada (evita fila vazia)")
    else:
        # Mesmo com 0 válidos se ok=true com lista vazia; só cria se houver validados
        if len(validated_contacts) == 0:
            log("\n⚠️ Nenhum número com WhatsApp — cria campanha draft só com metadados? Não — aborta create.")
        else:
            log(f"\nCriando campanha draft '{campaign_name}'…")
            log(f"  sending_method=rotate | tags={{nome}} | {len(MESSAGE_VARIATIONS)} sintaxes")
            created_info = create_campaign(
                access,
                anon,
                user_id,
                org_id,
                campaign_name,
                instance_ids,
                validated_contacts,
                MESSAGE_VARIATIONS,
            )
            camp = created_info["campaign"]
            log(f"  ✅ campanha id={camp['id']}")
            log(f"  fila={created_info['queue_count']} msgs | instâncias={created_info['instances_used']}")
            log(f"  status={camp.get('status')} method={camp.get('sending_method')}")

    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "organization_id": org_id,
        "email": email,
        "instances_open": [{"id": c["id"], "name": c["instance_name"], "state": c.get("live_state")} for c in ready],
        "contacts_total": len(contacts),
        "message_variations": MESSAGE_VARIATIONS,
        "sending_method": "rotate",
        "validation": {
            "ok": edge.get("ok"),
            "error": edge.get("error"),
            "usedInstance": edge.get("usedInstance"),
            "validated": len(validated_contacts),
            "rejected": len(rejected_contacts),
            "validatedNumbers": list(validated_nums),
            "rejectedNumbers": list(rejected_nums),
        },
        "campaign": created_info,
        "contacts_text_preview": contacts_text[:800],
    }

    if args.save:
        os.makedirs(OUT_DIR, exist_ok=True)
        path = os.path.join(OUT_DIR, f"auto-campanha-pubdigital-{stamp}.json")
        with open(path, "w") as f:
            json.dump(payload, f, indent=2, ensure_ascii=False)
        log(f"\nSalvo: {path}")

    # Exit codes
    if edge.get("error") and not edge.get("ok"):
        log("\nDIAGNÓSTICO: falha na validação WhatsApp (mesmo erro do painel se sessão/API ruim).")
        return 1
    if len(validated_contacts) == 0:
        log("\nDIAGNÓSTICO: edge respondeu, mas 0 números com WhatsApp (esperado para lista sintética).")
        # Ainda é sucesso do fluxo se a API validou (ok=true)
        return 0 if edge.get("ok") else 1

    log("\nDIAGNÓSTICO: fluxo OK — validação WhatsApp funcionou e campanha draft criada (rotate + tags).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
