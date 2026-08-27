#!/usr/bin/env python3
"""
pubdigital 2: valida WhatsApp rotacionando TODAS as instâncias OPEN
e cria campanha draft (rotate) com a fila pendente. Não dispara envio.
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter
from datetime import datetime, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ORG = "1a6ab607-837b-48b4-a9b5-ec19187b3331"
REF = open(os.path.join(ROOT, "supabase", ".temp", "project-ref")).read().strip()
BASE = f"https://{REF}.supabase.co"
E2E_ENV = os.path.join(ROOT, ".env.e2e.local")
OUT_DIR = os.path.join(ROOT, "test-results")

MESSAGES = [
    "Olá {nome}! Teste automático Disparador 2 — rodízio completo (draft).",
    "Oi {nome}, mensagem 2 do teste rotate com todas as instâncias ativas.",
    "{nome}, mensagem 3 — validação + campanha draft pubdigital 2.",
]

# Números sintéticos extras (a maioria deve rejeitar; owners dos chips validam)
EXTRA_CONTACTS = [
    ("Contato Extra 1", "5511999002001"),
    ("Contato Extra 2", "5511999002002"),
    ("Contato Extra 3", "5511888002001"),
    ("Invalido Curto", "123456"),
    ("Zero Fake", "5500000000000"),
]


def log(msg: str) -> None:
    print(msg, flush=True)


def load_e2e() -> dict[str, str]:
    out: dict[str, str] = {}
    if not os.path.exists(E2E_ENV):
        return out
    with open(E2E_ENV) as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            out[k.strip()] = v.strip().strip('"').strip("'")
    return out


def load_keys() -> tuple[str, str]:
    anon = os.environ.get("SUPABASE_ANON_KEY", "").strip()
    service = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    if anon and service:
        return anon, service
    proc = subprocess.run(
        ["supabase", "projects", "api-keys", "--project-ref", REF],
        capture_output=True,
        text=True,
        cwd=ROOT,
        timeout=60,
    )
    for line in proc.stdout.splitlines():
        parts = [p.strip() for p in line.split("|") if p.strip()]
        if len(parts) >= 2 and parts[0] == "anon":
            anon = parts[1]
        if len(parts) >= 2 and parts[0] == "service_role":
            service = parts[1]
    if not anon or not service:
        raise RuntimeError("chaves anon/service_role não encontradas")
    return anon, service


def http(method: str, url: str, headers: dict, body=None, timeout: int = 120):
    data = None if body is None else json.dumps(body).encode()
    req = urllib.request.Request(url, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read().decode()
            return resp.status, (json.loads(raw) if raw.strip() else None)
    except urllib.error.HTTPError as e:
        raw = e.read().decode(errors="replace")
        try:
            parsed = json.loads(raw)
        except Exception:
            parsed = {"raw": raw[:800]}
        return e.code, parsed
    except Exception as e:
        return 0, {"error": str(e)}


def rest(method: str, path: str, token: str, anon: str, body=None, prefer: str = "return=representation"):
    h = {
        "apikey": anon,
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "Prefer": prefer,
    }
    if method == "GET":
        h.pop("Content-Type", None)
    return http(method, f"{BASE}/rest/v1/{path}", h, body)


def normalize(phone: str) -> str:
    d = "".join(c for c in phone if c.isdigit())
    if not d:
        return ""
    if d.startswith("55"):
        return d
    if 10 <= len(d) <= 11:
        return "55" + d
    return d


def connection_state(chip: dict) -> str:
    name = chip["instance_name"]
    base_url = str(chip["api_url"]).rstrip("/").replace("/manager", "")
    if base_url.startswith("http://"):
        base_url = "https://" + base_url[7:]
    enc = urllib.parse.quote(name)
    p = subprocess.run(
        ["curl", "-sS", "-m", "12", "-H", f"apikey: {chip['api_key']}", f"{base_url}/instance/connectionState/{enc}"],
        capture_output=True,
        text=True,
    )
    try:
        j = json.loads(p.stdout)
        return ((j.get("instance") or {}).get("state") or "").lower()
    except Exception:
        return "?"


def owner_jid(chip: dict) -> str | None:
    base_url = str(chip["api_url"]).rstrip("/")
    p = subprocess.run(
        ["curl", "-sS", "-m", "25", "-H", f"apikey: {chip['api_key']}", f"{base_url}/instance/fetchInstances"],
        capture_output=True,
        text=True,
    )
    try:
        data = json.loads(p.stdout)
    except Exception:
        return None
    rows = data if isinstance(data, list) else [data]
    target = str(chip["instance_name"]).strip().lower()
    for row in rows:
        if not isinstance(row, dict):
            continue
        inst = row.get("instance") if isinstance(row.get("instance"), dict) else row
        name = str(inst.get("instanceName") or "").strip().lower()
        if name != target:
            continue
        owner = str(inst.get("ownerJid") or "").split("@")[0]
        if owner.isdigit() and len(owner) >= 12:
            return owner
    return None


def main() -> int:
    e2e = load_e2e()
    email = e2e.get("E2E_EMAIL") or "pubdigital.net@gmail.com"
    password = e2e.get("E2E_PASSWORD") or "123456"
    anon, service = load_keys()
    errors: list[str] = []

    log("=== Campanha com TODAS instâncias ativas (rotate) — pubdigital 2 ===")
    log(f"org={ORG} user={email}")

    code, auth = http(
        "POST",
        f"{BASE}/auth/v1/token?grant_type=password",
        {"apikey": anon, "Content-Type": "application/json"},
        {"email": email, "password": password},
    )
    if code != 200 or not isinstance(auth, dict) or not auth.get("access_token"):
        log(f"❌ login falhou http={code} {auth}")
        return 1
    access = auth["access_token"]
    user_id = auth["user"]["id"]
    log(f"✅ login OK")

    _, chips = rest(
        "GET",
        f"evolution_config?organization_id=eq.{ORG}&select=id,instance_name,api_url,api_key,is_connected&order=instance_name.asc",
        service,
        service,
    )
    chips = chips if isinstance(chips, list) else []
    connected_db = [c for c in chips if c.get("is_connected")]
    log(f"chips total={len(chips)} db_connected={len(connected_db)}")

    ready: list[dict] = []
    for c in connected_db:
        state = connection_state(c)
        ok = state in {"open", "connected", "online", "ready", "authenticated"}
        log(f"  [{c['instance_name']}] live={state} {'✅' if ok else '❌'}")
        if ok:
            ready.append(c)
        else:
            errors.append(f"chip db_connected mas live={state}: {c['instance_name']}")
        time.sleep(0.12)

    if not ready:
        log("❌ nenhuma instância OPEN")
        return 1

    pool = ready  # TODAS ativas
    pool_ids = [c["id"] for c in pool]
    pool_names = [c["instance_name"] for c in pool]
    log(f"\n✅ Pool completo: {len(pool)} instâncias OPEN")
    log("  " + ", ".join(pool_names))

    # Contatos: owners de TODOS os chips + extras
    contacts: list[dict[str, str]] = []
    seen: set[str] = set()
    log("\nColetando ownerJid de cada chip ativo…")
    for c in pool:
        own = owner_jid(c)
        if own:
            n = normalize(own)
            if n and n not in seen:
                seen.add(n)
                contacts.append({"name": f"Owner {c['instance_name']}", "phone": n})
                log(f"  + {c['instance_name']}: {n}")
        else:
            errors.append(f"sem ownerJid: {c['instance_name']}")
        time.sleep(0.15)

    for name, phone in EXTRA_CONTACTS:
        n = normalize(phone)
        if n and n not in seen:
            seen.add(n)
            contacts.append({"name": name, "phone": n})

    numbers = [c["phone"] for c in contacts]
    log(f"\nContatos totais para validar: {len(numbers)}")

    # Rodízio: 1 lote por chip preferred (até esgotar números), batches de 5
    batch_size = 5
    batches = [numbers[i : i + batch_size] for i in range(0, len(numbers), batch_size)]
    validated: set[str] = set()
    rejected: set[str] = set()
    used_names: list[str] = []
    batch_results: list[dict] = []

    log(f"\n--- Validação edge: {len(batches)} lotes, preferred rotativo em {len(pool)} chips ---")
    for bi, batch in enumerate(batches):
        preferred = pool_ids[bi % len(pool_ids)]
        pref_name = pool_names[bi % len(pool_names)]
        log(f"\nLote {bi + 1}/{len(batches)} preferred={pref_name} nums={len(batch)}")
        code, edge = http(
            "POST",
            f"{BASE}/functions/v1/validate-broadcast-whatsapp",
            {
                "Authorization": f"Bearer {access}",
                "apikey": anon,
                "Content-Type": "application/json",
            },
            {
                "organizationId": ORG,
                "instanceIds": pool_ids,  # TODAS ativas
                "numbers": batch,
                "useLatamValidator": False,
                "preferredInstanceId": preferred,
            },
            timeout=120,
        )
        ok = bool(isinstance(edge, dict) and edge.get("ok"))
        err = (edge or {}).get("error") if isinstance(edge, dict) else str(edge)
        used = (edge or {}).get("usedInstance") if isinstance(edge, dict) else None
        val = (edge or {}).get("validatedNumbers") or []
        rej = (edge or {}).get("rejectedNumbers") or []
        log(f"  http={code} ok={ok} used={used}")
        if not ok:
            errors.append(f"lote {bi + 1} preferred={pref_name}: {err}")
            log(f"  ❌ ERROR: {err}")
        for n in val:
            validated.add(normalize(n))
        for n in rej:
            rejected.add(normalize(n))
        if used:
            used_names.append(str(used))
        batch_results.append(
            {
                "batch": bi + 1,
                "preferred": pref_name,
                "used": used,
                "ok": ok,
                "error": err if not ok else None,
                "validated": len(val),
                "rejected": len(rej),
                "http": code,
            }
        )
        time.sleep(0.6)

    ok_batches = sum(1 for b in batch_results if b["ok"])
    log("\n=== RESUMO VALIDAÇÃO ===")
    log(f"lotes ok={ok_batches}/{len(batch_results)}")
    log(f"chips usados na validação: {sorted(set(used_names))}")
    log(f"validated={len(validated)} rejected={len(rejected)}")

    validated_contacts = [c for c in contacts if normalize(c["phone"]) in validated]
    if not validated_contacts:
        errors.append("0 contatos validados — não cria fila")
        log("❌ 0 validados — aborta criação de campanha com fila")
        # ainda reporta
        campaign = None
        queue_count = 0
        stamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    else:
        stamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
        camp_name = f"[FULL] rotate todas-ativas {stamp}"
        log(f"\nCriando campanha draft '{camp_name}' com {len(pool)} instâncias…")
        body = {
            "user_id": user_id,
            "organization_id": ORG,
            "name": camp_name,
            "instance_id": None,
            "custom_message": MESSAGES[0],
            "min_delay_seconds": 45,
            "max_delay_seconds": 90,
            "total_contacts": len(validated_contacts),
            "status": "draft",
            "sending_method": "rotate",
            "instance_ids": pool_ids,
        }
        code, created = rest("POST", "broadcast_campaigns_2", access, anon, body)
        if code not in (200, 201) or not created:
            log(f"  insert user falhou http={code} {created} — service_role")
            errors.append(f"insert campanha user JWT http={code}")
            code, created = rest("POST", "broadcast_campaigns_2", service, service, body)
        camp = created[0] if isinstance(created, list) else created
        if not isinstance(camp, dict) or not camp.get("id"):
            log(f"❌ falha criar campanha: {code} {created}")
            errors.append(f"criar campanha falhou: {created}")
            return 1
        campaign = camp
        log(f"  ✅ campanha id={camp['id']} status={camp.get('status')} method={camp.get('sending_method')}")
        log(f"  instance_ids count={len(camp.get('instance_ids') or pool_ids)}")

        queue_items = []
        for i, contact in enumerate(validated_contacts):
            msg = (
                MESSAGES[i % len(MESSAGES)]
                .replace("{nome}", contact["name"])
                .replace("{name}", contact["name"])
            )
            queue_items.append(
                {
                    "campaign_id": camp["id"],
                    "organization_id": ORG,
                    "instance_id": pool_ids[i % len(pool_ids)],
                    "phone": contact["phone"],
                    "name": contact["name"],
                    "personalized_message": msg,
                    "status": "pending",
                }
            )

        # insert fila em lotes
        batch_ins = 40
        for i in range(0, len(queue_items), batch_ins):
            chunk = queue_items[i : i + batch_ins]
            code, resp = rest(
                "POST", "broadcast_queue_2", access, anon, chunk, prefer="return=minimal"
            )
            if code not in (200, 201):
                code, resp = rest(
                    "POST", "broadcast_queue_2", service, service, chunk, prefer="return=minimal"
                )
            if code not in (200, 201):
                errors.append(f"insert fila http={code} {resp}")
                log(f"  ❌ fila lote falhou http={code}")
        queue_count = len(queue_items)
        log(f"  ✅ fila={queue_count} pending")

        dist: Counter[str] = Counter()
        for i, _q in enumerate(queue_items):
            dist[pool_names[i % len(pool_names)]] += 1
        log("  distribuição rotate na fila:")
        for n, cnt in sorted(dist.items()):
            log(f"    {n}: {cnt}")

        # Verificar campanha e fila no banco
        log("\n--- Verificação pós-criação ---")
        _, camp_db = rest(
            "GET",
            f"broadcast_campaigns_2?id=eq.{camp['id']}&select=id,name,status,sending_method,total_contacts,sent_count,failed_count,instance_ids",
            service,
            service,
        )
        camp_row = camp_db[0] if isinstance(camp_db, list) and camp_db else {}
        ids_db = camp_row.get("instance_ids") or []
        log(f"  DB status={camp_row.get('status')} method={camp_row.get('sending_method')} total={camp_row.get('total_contacts')}")
        log(f"  DB instance_ids={len(ids_db)} (esperado {len(pool_ids)})")
        if len(ids_db) != len(pool_ids):
            errors.append(f"instance_ids no DB={len(ids_db)} != pool={len(pool_ids)}")

        _, qstats = http(
            "POST",
            f"https://api.supabase.com/v1/projects/{REF}/database/query",
            {
                "Authorization": f"Bearer {open(os.path.expanduser('~/.supabase/access-token')).read().strip()}",
                "Content-Type": "application/json",
            },
            {
                "query": f"""
                SELECT status, COUNT(*) AS n,
                       COUNT(DISTINCT instance_id) AS chips
                FROM broadcast_queue_2
                WHERE campaign_id = '{camp["id"]}'
                GROUP BY 1 ORDER BY 1;
                """
            },
        )
        log(f"  fila stats: {qstats}")

        # Erros na fila?
        _, qerr = rest(
            "GET",
            f"broadcast_queue_2?campaign_id=eq.{camp['id']}&status=eq.failed&select=id,phone,error_message,failure_code&limit=20",
            service,
            service,
        )
        if isinstance(qerr, list) and qerr:
            errors.append(f"{len(qerr)} itens failed na fila")
            for row in qerr[:5]:
                log(f"  ❌ failed: {row.get('phone')} {row.get('error_message')}")
        else:
            log("  ✅ nenhum item failed na fila (todos pending)")

    os.makedirs(OUT_DIR, exist_ok=True)
    path = os.path.join(OUT_DIR, f"campanha-full-rotate-pubdigital2-{stamp}.json")
    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "organization_id": ORG,
        "pool_size": len(pool),
        "pool_names": pool_names,
        "batches": batch_results,
        "chips_used_validation": sorted(set(used_names)),
        "validated": len(validated),
        "rejected": len(rejected),
        "campaign_id": (campaign or {}).get("id"),
        "campaign_name": (campaign or {}).get("name"),
        "campaign_status": (campaign or {}).get("status"),
        "sending_method": "rotate",
        "queue_count": queue_count,
        "errors": errors,
        "note": "DRAFT — não dispara. Use o painel para iniciar se quiser.",
    }
    with open(path, "w") as f:
        json.dump(payload, f, indent=2, ensure_ascii=False)

    log(f"\nSalvo: {path}")
    log("\n=== ERROS / AVISOS ===")
    if not errors:
        log("✅ Nenhum erro crítico")
    else:
        for e in errors:
            log(f"  ⚠️ {e}")

    if campaign and ok_batches == len(batch_results) and queue_count > 0:
        log("\nDIAGNÓSTICO: OK — validou com rodízio, campanha draft criada com todas as ativas.")
        return 0
    if campaign and ok_batches > 0:
        log("\nDIAGNÓSTICO: parcial — campanha criada, mas houve avisos (ver lista).")
        return 0
    log("\nDIAGNÓSTICO: falhou.")
    return 1


if __name__ == "__main__":
    sys.exit(main())
