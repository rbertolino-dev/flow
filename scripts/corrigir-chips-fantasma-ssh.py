#!/usr/bin/env python3
"""
Corrige chips FANTASMA (Postgres/Manager=open, connectionState≠open).

Para cada chip:
  1. Tenta DELETE /instance/logout via API
  2. Via SSH no Postgres Evolution: apaga Session + marca Instance.connectionStatus=close
  3. Atualiza CRM is_connected=false

Uso:
  ./scripts/corrigir-chips-fantasma-ssh.sh --dry-run
  ./scripts/corrigir-chips-fantasma-ssh.sh --chips "Fatima,Silvia"
  ./scripts/corrigir-chips-fantasma-ssh.sh --org ORG_ID
"""
from __future__ import annotations

import argparse
import json
import os
import shlex
import subprocess
import sys
import time
import urllib.parse
import urllib.request

ICLASS_ORG = "34086d07-9181-43fc-a3e8-6aa28974d68b"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REF_FILE = os.path.join(ROOT, "supabase", ".temp", "project-ref")
EVO_CRED_FILE = os.path.join(ROOT, "scripts", ".evolution-ssh-credentials")
POSTGRES_CONTAINER = "postgres_postgres.1.mzh6iioeiyn40wokomoq0ifxg"
POSTGRES_DB = "evolution"
OPEN = {"open", "connected", "online", "up", "ready", "authenticated", "logged", "active"}


def load_evo_credentials() -> dict[str, str]:
    creds: dict[str, str] = {}
    with open(EVO_CRED_FILE) as f:
        for line in f:
            line = line.rstrip("\n")
            if not line or line.lstrip().startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            creds[k.strip()] = v
    return creds


def load_service_role_key() -> str:
    env = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    if env:
        return env
    ref = open(REF_FILE).read().strip()
    proc = subprocess.run(
        ["supabase", "projects", "api-keys", "--project-ref", ref],
        capture_output=True,
        text=True,
        cwd=ROOT,
        timeout=60,
    )
    for line in proc.stdout.splitlines():
        parts = [p.strip() for p in line.split("|") if p.strip()]
        if len(parts) >= 2 and parts[0] == "service_role":
            return parts[1]
    raise SystemExit("service_role não encontrada")


def rest_get(path: str, key: str) -> list[dict]:
    ref = open(REF_FILE).read().strip()
    req = urllib.request.Request(
        f"https://{ref}.supabase.co/rest/v1{path}",
        headers={"apikey": key, "Authorization": f"Bearer {key}", "Accept": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=180) as resp:
        return json.loads(resp.read())


def patch_crm(instance_id: str, key: str, dry_run: bool) -> None:
    if dry_run:
        return
    ref = open(REF_FILE).read().strip()
    req = urllib.request.Request(
        f"https://{ref}.supabase.co/rest/v1/evolution_config?id=eq.{instance_id}",
        data=json.dumps({"is_connected": False}).encode(),
        headers={
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            "Prefer": "return=minimal",
        },
        method="PATCH",
    )
    urllib.request.urlopen(req, timeout=60)


def ssh_psql(creds: dict[str, str], sql: str, dry_run: bool) -> tuple[int, str]:
    if dry_run:
        return 0, "(dry-run)"
    remote = (
        f"docker exec {POSTGRES_CONTAINER} psql -U postgres -d {POSTGRES_DB} "
        f"-c {shlex.quote(sql)}"
    )
    host = f"{creds['EVOLUTION_SSH_USER']}@{creds['EVOLUTION_SSH_HOST']}"
    proc = subprocess.run(
        [
            "sshpass",
            "-p",
            creds["EVOLUTION_SSH_PASSWORD"],
            "ssh",
            "-o",
            "StrictHostKeyChecking=no",
            host,
            remote,
        ],
        capture_output=True,
        text=True,
        timeout=90,
    )
    return proc.returncode, (proc.stdout + proc.stderr).strip()


def connection_state(base: str, api_key: str, name: str) -> str:
    enc = urllib.parse.quote(name, safe="")
    proc = subprocess.run(
        ["curl", "-sS", "-m", "15", "-H", f"apikey: {api_key}", f"{base}/instance/connectionState/{enc}"],
        capture_output=True,
        text=True,
    )
    try:
        return str(json.loads(proc.stdout).get("instance", {}).get("state", "?"))
    except json.JSONDecodeError:
        return "?"


def api_logout(base: str, api_key: str, name: str, dry_run: bool) -> str:
    if dry_run:
        return "dry-run"
    enc = urllib.parse.quote(name, safe="")
    proc = subprocess.run(
        ["curl", "-sS", "-m", "20", "-X", "DELETE", "-H", f"apikey: {api_key}", f"{base}/instance/logout/{enc}"],
        capture_output=True,
        text=True,
    )
    return proc.stdout[:120]


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--org", default=ICLASS_ORG)
    p.add_argument("--chips", default="", help="Opcional: só estes chips")
    p.add_argument("--dry-run", action="store_true")
    args = p.parse_args()

    creds = load_evo_credentials()
    key = load_service_role_key()
    rows = rest_get(
        f"/evolution_config?organization_id=eq.{args.org}"
        "&select=id,instance_name,is_connected,api_url,api_key&order=instance_name.asc",
        key,
    )
    if args.chips.strip():
        wanted = {c.strip().lower() for c in args.chips.split(",") if c.strip()}
        rows = [r for r in rows if r["instance_name"].lower() in wanted]

    base = (
        rows[0]["api_url"]
        .rstrip("/")
        .replace("/manager", "")
        .replace("/dashboard", "")
        .replace("/app", "")
    )

    # Postgres status
    names = [r["instance_name"] for r in rows]
    literals = ",".join("'" + n.replace("'", "''") + "'" for n in names)
    sql_q = f"SELECT name, \"connectionStatus\" FROM public.\"Instance\" WHERE name IN ({literals});"
    code, pg_out = ssh_psql(creds, sql_q, args.dry_run)
    pg_map = {}
    for line in pg_out.splitlines():
        if "|" in line:
            n, st = line.split("|", 1)
            pg_map[n.strip()] = st.strip()

    targets = []
    for inst in rows:
        name = inst["instance_name"]
        real = connection_state(base, inst["api_key"], name)
        pg = pg_map.get(name, "?")
        pg_open = str(pg).lower() in OPEN
        real_open = str(real).lower() in OPEN
        crm_on = inst.get("is_connected") is True
        if (pg_open or crm_on) and not real_open:
            targets.append({**inst, "real": real, "pg": pg})

    if not targets:
        print("✅ Nenhum chip fantasma encontrado.")
        return 0

    print(f"{'[DRY-RUN] ' if args.dry_run else ''}Corrigindo {len(targets)} chip(s) fantasma...\n")

    for t in targets:
        name = t["instance_name"]
        safe = name.replace("'", "''")
        print(f"▸ {name}  (PG={t['pg']} REAL={t['real']})")

        logout_resp = api_logout(base, t["api_key"], name, args.dry_run)
        print(f"  API logout: {logout_resp}")

        sql_fix = f"""
BEGIN;
DELETE FROM public."Session" s
USING public."Instance" i
WHERE s."sessionId" = i.id AND i.name = '{safe}';
UPDATE public."Instance"
SET "connectionStatus" = 'close',
    "disconnectionReasonCode" = 408,
    "disconnectionAt" = NOW(),
    "updatedAt" = NOW()
WHERE name = '{safe}';
COMMIT;
"""
        code, out = ssh_psql(creds, sql_fix, args.dry_run)
        print(f"  Postgres: {'OK' if code == 0 else 'ERRO'} {out[:100]}")

        patch_crm(t["id"], key, args.dry_run)
        print(f"  CRM is_connected → false")

        time.sleep(0.5)
        after = connection_state(base, t["api_key"], name)
        print(f"  connectionState após: {after}\n")

    print("Concluído. Reconecte cada chip no Manager (QR) se state=close.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
