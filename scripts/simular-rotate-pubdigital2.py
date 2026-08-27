#!/usr/bin/env python3
"""Simula Disparador 2 na pubdigital 2: valida em rodízio e cria campanha draft (não dispara)."""
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
ORG = "1a6ab607-837b-48b4-a9b5-ec19187b3331"  # pubdigital 2
REF = open(os.path.join(ROOT, "supabase", ".temp", "project-ref")).read().strip()
BASE = f"https://{REF}.supabase.co"
E2E_ENV = os.path.join(ROOT, ".env.e2e.local")
OUT_DIR = os.path.join(ROOT, "test-results")

MESSAGES = [
    "Olá {nome}! Tudo bem? Teste automático Disparador 2 (não enviar).",
    "Oi {nome}, teste de rodízio de chips — mensagem 2.",
    "{nome}, teste rotate pubdigital 2 — mensagem 3.",
]

CONTACTS = [
    ("Ana Rotacao", "5511999001001"),
    ("Bruno Rotacao", "5511999001002"),
    ("Carla Rotacao", "5511999001003"),
    ("Diego Rotacao", "5511999001004"),
    ("Elena Rotacao", "5511999001005"),
    ("Fabio Rotacao", "5511888001001"),
    ("Gisele Rotacao", "5511888001002"),
    ("Hugo Rotacao", "5511777001001"),
    ("Iris Rotacao", "11999001099"),
    ("Karen Rotacao", "5511912345678"),
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


def http(method: str, url: str, headers: dict, body=None, timeout: int = 90):
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
            parsed = {"raw": raw[:500]}
        return e.code, parsed


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


def main() -> int:
    e2e = load_e2e()
    email = e2e.get("E2E_EMAIL") or "pubdigital.net@gmail.com"
    password = e2e.get("E2E_PASSWORD") or "123456"
    anon, service = load_keys()

    log("=== SIMULAÇÃO pubdigital 2 — validar em RODÍZIO + campanha draft ===")
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
    log(f"✅ login OK user={user_id[:8]}…")

    code, chips = rest(
        "GET",
        f"evolution_config?organization_id=eq.{ORG}&select=id,instance_name,api_url,api_key,is_connected&order=instance_name.asc",
        service,
        service,
    )
    chips = chips if isinstance(chips, list) else []
    connected_db = [c for c in chips if c.get("is_connected")]
    log(f"chips total={len(chips)} db_connected={len(connected_db)}")

    ready = []
    for c in connected_db:
        name = c["instance_name"]
        base_url = str(c["api_url"]).rstrip("/").replace("/manager", "")
        if base_url.startswith("http://"):
            base_url = "https://" + base_url[7:]
        enc = urllib.parse.quote(name)
        p = subprocess.run(
            ["curl", "-sS", "-m", "10", "-H", f"apikey: {c['api_key']}", f"{base_url}/instance/connectionState/{enc}"],
            capture_output=True,
            text=True,
        )
        state = "?"
        try:
            j = json.loads(p.stdout)
            state = ((j.get("instance") or {}).get("state") or "").lower()
        except Exception:
            pass
        ok = state in {"open", "connected", "online", "ready", "authenticated"}
        log(f"  [{name}] live={state} {'✅' if ok else '❌'}")
        if ok:
            ready.append(c)
        time.sleep(0.15)

    if not ready:
        log("❌ nenhum OPEN")
        return 1

    pool = ready[:12]
    pool_ids = [c["id"] for c in pool]
    pool_names = [c["instance_name"] for c in pool]
    log(f"\nPool rodízio ({len(pool)}): {', '.join(pool_names)}")

    contacts: list[dict[str, str]] = []
    seen: set[str] = set()
    for c in pool[:3]:
        base_url = str(c["api_url"]).rstrip("/")
        p = subprocess.run(
            ["curl", "-sS", "-m", "20", "-H", f"apikey: {c['api_key']}", f"{base_url}/instance/fetchInstances"],
            capture_output=True,
            text=True,
        )
        try:
            data = json.loads(p.stdout)
        except Exception:
            data = []
        rows = data if isinstance(data, list) else [data]
        target = str(c["instance_name"]).strip().lower()
        for row in rows:
            if not isinstance(row, dict):
                continue
            inst = row.get("instance") if isinstance(row.get("instance"), dict) else row
            name = str(inst.get("instanceName") or "").strip().lower()
            if name != target:
                continue
            owner = str(inst.get("ownerJid") or "").split("@")[0]
            if owner.isdigit() and len(owner) >= 12:
                n = normalize(owner)
                if n not in seen:
                    seen.add(n)
                    contacts.append({"name": f"Owner {c['instance_name']}", "phone": n})
                    log(f"  + owner {c['instance_name']}: {n}")

    for name, phone in CONTACTS:
        n = normalize(phone)
        if n and n not in seen:
            seen.add(n)
            contacts.append({"name": name, "phone": n})

    numbers = [c["phone"] for c in contacts]
    log(f"\nContatos para validar: {len(numbers)}")

    batch_size = 4
    batches = [numbers[i : i + batch_size] for i in range(0, len(numbers), batch_size)]
    validated: set[str] = set()
    rejected: set[str] = set()
    used_names: list[str] = []
    batch_results: list[dict] = []

    log(f"\n--- Validação edge em {len(batches)} lotes (preferred rotativo) ---")
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
                "instanceIds": pool_ids,
                "numbers": batch,
                "useLatamValidator": False,
                "preferredInstanceId": preferred,
            },
            timeout=90,
        )
        ok = bool(isinstance(edge, dict) and edge.get("ok"))
        err = (edge or {}).get("error") if isinstance(edge, dict) else str(edge)
        used = (edge or {}).get("usedInstance") if isinstance(edge, dict) else None
        val = (edge or {}).get("validatedNumbers") or []
        rej = (edge or {}).get("rejectedNumbers") or []
        log(f"  http={code} ok={ok} usedInstance={used} (preferred={pref_name})")
        if err and not ok:
            log(f"  ERROR: {err}")
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
            }
        )
        time.sleep(0.8)

    log("\n=== RESUMO VALIDAÇÃO ===")
    log(f"ok_lotes={sum(1 for b in batch_results if b['ok'])}/{len(batch_results)}")
    log(f"chips usados: {sorted(set(used_names))}")
    log(f"validated={len(validated)} rejected={len(rejected)}")
    for b in batch_results:
        extra = f" ERR={str(b['error'])[:100]}" if b.get("error") else ""
        log(
            f"  lote{b['batch']}: preferred={b['preferred']} → used={b['used']} "
            f"ok={b['ok']} v={b['validated']} r={b['rejected']}{extra}"
        )

    validated_contacts = [c for c in contacts if normalize(c["phone"]) in validated]
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    camp_name = f"[SIM] rotate pubdigital2 {stamp}"
    campaign = None
    queue_count = 0

    if not any(b["ok"] for b in batch_results):
        log("\n❌ Validação falhou em todos os lotes — campanha NÃO criada")
    else:
        to_queue = validated_contacts
        if not to_queue:
            log("\n⚠️ 0 WhatsApp na lista sintética — cria draft rotate sem fila (só metadados).")
        log(f"\nCriando campanha draft '{camp_name}'…")
        body = {
            "user_id": user_id,
            "organization_id": ORG,
            "name": camp_name,
            "instance_id": None,
            "custom_message": MESSAGES[0],
            "min_delay_seconds": 30,
            "max_delay_seconds": 60,
            "total_contacts": len(to_queue),
            "status": "draft",
            "sending_method": "rotate",
            "instance_ids": pool_ids,
        }
        code, created = rest("POST", "broadcast_campaigns_2", access, anon, body)
        if code not in (200, 201) or not created:
            log(f"  insert user falhou http={code} — tentando service_role")
            code, created = rest("POST", "broadcast_campaigns_2", service, service, body)
        camp = created[0] if isinstance(created, list) else created
        if not isinstance(camp, dict) or not camp.get("id"):
            log(f"❌ falha criar campanha: {code} {created}")
            return 1
        campaign = camp
        log(f"  ✅ campanha id={camp['id']} status={camp.get('status')} method={camp.get('sending_method')}")

        queue_items = []
        for i, contact in enumerate(to_queue):
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
        if queue_items:
            code, _ = rest(
                "POST", "broadcast_queue_2", access, anon, queue_items, prefer="return=minimal"
            )
            if code not in (200, 201):
                code, _ = rest(
                    "POST", "broadcast_queue_2", service, service, queue_items, prefer="return=minimal"
                )
            queue_count = len(queue_items)
            log(f"  ✅ fila={queue_count} pending | chips no rodízio={len(pool_ids)}")
            dist: Counter[str] = Counter()
            for i, _q in enumerate(queue_items):
                dist[pool_names[i % len(pool_names)]] += 1
            log("  distribuição por chip:")
            for n, cnt in dist.items():
                log(f"    {n}: {cnt}")
        else:
            log("  (fila vazia — só draft)")

    os.makedirs(OUT_DIR, exist_ok=True)
    path = os.path.join(OUT_DIR, f"sim-rotate-pubdigital2-{stamp}.json")
    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "organization_id": ORG,
        "organization_name": "pubdigital 2",
        "pool": [{"id": c["id"], "name": c["instance_name"]} for c in pool],
        "batches": batch_results,
        "chips_used_in_validation": sorted(set(used_names)),
        "validated": len(validated),
        "rejected": len(rejected),
        "campaign_id": (campaign or {}).get("id"),
        "campaign_name": camp_name if campaign else None,
        "campaign_status": (campaign or {}).get("status"),
        "sending_method": "rotate",
        "queue_count": queue_count,
        "note": "Campanha DRAFT — não dispara mensagens reais.",
    }
    with open(path, "w") as f:
        json.dump(payload, f, indent=2, ensure_ascii=False)
    log(f"\nSalvo: {path}")

    if campaign:
        log("\nDIAGNÓSTICO: validação em rodízio executada; campanha draft criada (não enviou).")
        return 0 if any(b["ok"] for b in batch_results) else 1
    log("\nDIAGNÓSTICO: campanha não criada.")
    return 1


if __name__ == "__main__":
    sys.exit(main())
