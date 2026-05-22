#!/usr/bin/env python3
"""
Configura Evolution + CRM para Disparador 2 (modo rotacionar).

1. Webhook connection.update em cada instância da org
2. Sync is_connected via connectionState
3. Relatório de chips prontos para rotação

Uso: python3 scripts/configurar-disparador2-rotate.py [--org UUID]
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from typing import Any

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REF_FILE = os.path.join(ROOT, "supabase", ".temp", "project-ref")
DEFAULT_ORG = "34086d07-9181-43fc-a3e8-6aa28974d68b"
# Evolution v2.3.7 exige objeto "webhook" aninhado + eventos em UPPER_SNAKE
WEBHOOK_EVENTS = [
    "CONNECTION_UPDATE",
    "MESSAGES_UPSERT",
    "QRCODE_UPDATED",
]


def load_project_ref() -> str:
    return open(REF_FILE).read().strip()


def load_service_role_key() -> str:
    env = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    if env:
        return env
    proc = subprocess.run(
        ["supabase", "projects", "api-keys", "--project-ref", load_project_ref()],
        capture_output=True,
        text=True,
        cwd=ROOT,
        timeout=60,
    )
    for line in proc.stdout.splitlines():
        parts = [p.strip() for p in line.split("|") if p.strip()]
        if len(parts) >= 2 and parts[0] == "service_role":
            return parts[1]
    raise RuntimeError("service_role não encontrado")


def rest_select(table: str, select: str, filters: dict[str, str] | None = None, limit: int | None = None):
    ref = load_project_ref()
    key = load_service_role_key()
    params = [f"select={urllib.parse.quote(select, safe='*,()')}"]
    if filters:
        for col, val in filters.items():
            params.append(f"{col}=eq.{urllib.parse.quote(val, safe='')}")
    if limit:
        params.append(f"limit={limit}")
    url = f"https://{ref}.supabase.co/rest/v1/{table}?{'&'.join(params)}"
    req = urllib.request.Request(
        url,
        headers={"apikey": key, "Authorization": f"Bearer {key}", "Accept": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        return json.loads(resp.read())


def rest_patch_connected(instance_name: str, is_connected: bool) -> None:
    ref = load_project_ref()
    key = load_service_role_key()
    url = f"https://{ref}.supabase.co/rest/v1/evolution_config?instance_name=eq.{urllib.parse.quote(instance_name)}"
    body = json.dumps(
        {"is_connected": is_connected, "updated_at": datetime.now(timezone.utc).isoformat()}
    ).encode()
    req = urllib.request.Request(
        url,
        data=body,
        method="PATCH",
        headers={
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            "Prefer": "return=minimal",
        },
    )
    urllib.request.urlopen(req, timeout=60)


def curl_json(method: str, url: str, headers: dict | None = None, body: dict | None = None, timeout: int = 25):
    cmd = ["curl", "-sS", "-m", str(timeout), "-w", "\n%{http_code}", "-X", method]
    if headers:
        for k, v in headers.items():
            cmd += ["-H", f"{k}: {v}"]
    if body is not None:
        cmd += ["-H", "Content-Type: application/json", "-d", json.dumps(body)]
    cmd.append(url)
    proc = subprocess.run(cmd, capture_output=True, text=True)
    parts = proc.stdout.rsplit("\n", 1)
    text = parts[0] if len(parts) == 2 else proc.stdout
    code = int(parts[1].strip()) if len(parts) == 2 and parts[1].strip().isdigit() else 0
    try:
        parsed = json.loads(text) if text.strip() else None
    except json.JSONDecodeError:
        parsed = text
    return code, parsed


def normalize_evo_base(api_url: str) -> str:
    base = api_url.rstrip("/")
    for suffix in ("/manager", "/dashboard", "/app"):
        if base.lower().endswith(suffix):
            base = base[: -len(suffix)]
    return base


def evo_connection_state(api_url: str, api_key: str, instance_name: str) -> str:
    base = normalize_evo_base(api_url)
    code, data = curl_json(
        "GET",
        f"{base}/instance/connectionState/{urllib.parse.quote(instance_name)}",
        headers={"apikey": api_key},
    )
    if code != 200 or not isinstance(data, dict):
        return f"http_{code}"
    inst = data.get("instance") or {}
    return str(inst.get("state") or data.get("state") or "?")


def persist_live(state: str) -> bool | None:
    v = state.strip().lower()
    if v in ("open", "connected", "online", "up", "ready", "authenticated", "logged", "active"):
        return True
    if v in (
        "connecting", "close", "closed", "disconnected", "offline", "down",
        "pairing", "qr", "waiting", "timeout", "syncing", "loading",
    ):
        return False
    return None


def webhook_url(secret: str) -> str:
    ref = load_project_ref()
    return f"https://{ref}.supabase.co/functions/v1/evolution-webhook?secret={urllib.parse.quote(secret, safe='')}"


def set_webhook(api_url: str, api_key: str, name: str, secret: str) -> tuple[bool, str]:
    code, parsed = curl_json(
        "POST",
        f"{normalize_evo_base(api_url)}/webhook/set/{urllib.parse.quote(name)}",
        headers={"apikey": api_key},
        body={
            "webhook": {
                "enabled": True,
                "url": webhook_url(secret),
                "webhookByEvents": False,
                "webhookBase64": False,
                "events": WEBHOOK_EVENTS,
            },
        },
    )
    if code in (200, 201):
        return True, "ok"
    return False, str(parsed)[:100]


def sync_org(org_id: str) -> int:
    rows = rest_select(
        "evolution_config",
        "instance_name,is_connected,api_url,api_key",
        {"organization_id": org_id},
        limit=500,
    )
    updated = 0
    for r in rows:
        live = persist_live(evo_connection_state(r["api_url"], r["api_key"], r["instance_name"]))
        if live is None:
            continue
        if (r["is_connected"] is True) != live:
            rest_patch_connected(r["instance_name"], live)
            updated += 1
        time.sleep(0.08)
    return updated


def report_rotate(org_id: str) -> None:
    instances = rest_select(
        "evolution_config", "id,instance_name,is_connected,api_url,api_key",
        {"organization_id": org_id}, limit=500,
    )
    by_id = {str(i["id"]): i for i in instances}
    ready = []
    for inst in instances:
        if persist_live(evo_connection_state(inst["api_url"], inst["api_key"], inst["instance_name"])) is True:
            ready.append(inst["instance_name"])

    groups = rest_select("instance_groups", "name,instance_ids", {"organization_id": org_id}, limit=100)
    try:
        camps = rest_select(
            "broadcast_campaigns_2",
            "campaign_name,sending_method,instance_ids",
            {"organization_id": org_id},
            limit=50,
        )
    except urllib.error.HTTPError:
        camps = []
    rotate = [c for c in camps if c.get("sending_method") == "rotate"]

    print(f"\nProntas p/ rotação (connectionState=open): {len(ready)} / {len(instances)}")
    print(f"Grupos: {len(groups)} | Campanhas rotate: {len(rotate)}")
    for g in groups[:10]:
        ids = g.get("instance_ids") or []
        n = sum(
            1 for iid in ids
            if (row := by_id.get(str(iid)))
            and persist_live(evo_connection_state(row["api_url"], row["api_key"], row["instance_name"])) is True
        )
        print(f"  · {g.get('name')}: {n}/{len(ids)} chips prontos")


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--org", default=DEFAULT_ORG)
    p.add_argument("--skip-webhooks", action="store_true")
    p.add_argument("--skip-sync", action="store_true")
    args = p.parse_args()

    print("Disparador 2 — ROTACIONAR | org", args.org)

    if not args.skip_webhooks:
        rows = rest_select(
            "evolution_config",
            "instance_name,api_url,api_key,webhook_secret",
            {"organization_id": args.org},
            limit=500,
        )
        ok = fail = 0
        print(f"\n[1] Webhooks ({len(rows)} instâncias)...")
        for r in rows:
            secret = (r.get("webhook_secret") or r.get("api_key") or "").strip()
            if not all([r.get("instance_name"), r.get("api_url"), r.get("api_key"), secret]):
                continue
            s, d = set_webhook(r["api_url"], r["api_key"], r["instance_name"], secret)
            if s:
                ok += 1
            else:
                fail += 1
                print(f"  FALHA {r['instance_name']}: {d}")
            time.sleep(0.12)
        print(f"  Webhooks: {ok} ok, {fail} falha")

    if not args.skip_sync:
        print("\n[2] Sync connectionState → CRM...")
        n = sync_org(args.org)
        print(f"  {n} registro(s) atualizado(s)")

    print("\n[3] Relatório rotacionar")
    report_rotate(args.org)
    return 0


if __name__ == "__main__":
    sys.exit(main())
