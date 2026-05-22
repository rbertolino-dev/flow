#!/usr/bin/env python3
"""Compara is_connected no Supabase vs Evolution connectionState (somente leitura)."""
import json
import os
import subprocess
import sys
import urllib.parse
import urllib.request

REF_FILE = os.path.join(os.path.dirname(__file__), "..", "supabase", ".temp", "project-ref")
TOKEN_FILE = os.path.expanduser("~/.supabase/access-token")


def query(sql: str):
    ref = open(REF_FILE).read().strip()
    token = open(TOKEN_FILE).read().strip()
    body = json.dumps({"query": sql}).encode()
    req = urllib.request.Request(
        f"https://api.supabase.com/v1/projects/{ref}/database/query",
        data=body,
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=90) as resp:
        return json.loads(resp.read())


def evo_state(api_url: str, api_key: str, instance_name: str) -> tuple[str, str]:
    base = api_url.rstrip("/").replace("/manager", "").replace("/dashboard", "")
    url = f"{base}/instance/connectionState/{urllib.parse.quote(instance_name)}"
    proc = subprocess.run(
        ["curl", "-sS", "-m", "15", "-w", "\n%{http_code}", "-H", f"apikey: {api_key}", url],
        capture_output=True,
        text=True,
    )
    parts = proc.stdout.rsplit("\n", 1)
    body = parts[0] if len(parts) == 2 else proc.stdout
    http = parts[1].strip() if len(parts) == 2 else "?"
    state = "?"
    if body:
        try:
            j = json.loads(body)
            state = (j.get("instance") or {}).get("state") or j.get("state") or body[:40]
        except json.JSONDecodeError:
            state = body[:40]
    return http, str(state)


def main():
    org = sys.argv[1] if len(sys.argv) > 1 else "34086d07-9181-43fc-a3e8-6aa28974d68b"
    limit = int(sys.argv[2]) if len(sys.argv) > 2 else 12

    rows = query(
        f"""SELECT instance_name, is_connected, api_url, api_key
        FROM evolution_config
        WHERE organization_id = '{org}'
        ORDER BY is_connected ASC, instance_name
        LIMIT {limit}"""
    )

    falsos = 0
    confirmados = 0
    outros = 0

    print(f"org={org} amostra={len(rows)}\n")
    for r in rows:
        http, state = evo_state(r["api_url"], r["api_key"], r["instance_name"])
        db = r["is_connected"]
        st = str(state).lower()
        is_open = st in ("open", "connected", "online")
        is_close = st in ("close", "closed", "disconnected", "offline")

        if db is False and is_open:
            tag = "FALSO_NEGATIVO_DB"
            falsos += 1
        elif db is False and is_close:
            tag = "db_ok_evo_close"
            confirmados += 1
        elif db is True and is_open:
            tag = "ok"
            confirmados += 1
        elif db is True and is_close:
            tag = "FALSO_POSITIVO_DB"
            falsos += 1
        else:
            tag = f"indefinido http={http}"
            outros += 1

        print(f"  db={str(db):5} | evo={str(state):12} | http={http:3} | {r['instance_name'][:24]:24} | {tag}")

    print(f"\nResumo: falsos_desalinhamento={falsos}, alinhados_ou_close={confirmados}, indefinido={outros}")


if __name__ == "__main__":
    main()
