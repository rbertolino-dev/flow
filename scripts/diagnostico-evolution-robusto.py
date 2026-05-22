#!/usr/bin/env python3
"""
Diagnóstico robusto: CRM (Supabase) vs Evolution API.

Classifica cada instância:
  - ok_open          DB conectado + connectionState open
  - fantasma_crm     DB conectado + connectionState close/connecting (lista pode dizer open)
  - fantasma_lista   fetchInstances open + connectionState close
  - db_atrasado      DB desconectado + connectionState open
  - ambos_close      DB desconectado + connectionState close
  - transitorio      connectionState connecting/qr (não alterar DB em sync em lote)
  - erro_api         HTTP/timeout na Evolution

Uso:
  ./scripts/diagnostico-evolution-robusto.py [organization_id] [--limit N] [--json]
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
import urllib.parse
import urllib.request
from collections import Counter
from concurrent.futures import ThreadPoolExecutor, as_completed

REF_FILE = os.path.join(os.path.dirname(__file__), "..", "supabase", ".temp", "project-ref")
TOKEN_FILE = os.path.expanduser("~/.supabase/access-token")

OPEN = {"open", "connected", "online", "up", "ready", "authenticated", "logged", "active"}
CLOSE = {"close", "closed", "disconnected", "offline", "down"}
TRANS = {"pairing", "connecting", "qr", "waiting", "timeout", "syncing", "loading"}


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
    with urllib.request.urlopen(req, timeout=120) as resp:
        return json.loads(resp.read())


def curl_json(url: str, api_key: str, method: str = "GET", body: dict | None = None) -> tuple[int, object]:
    cmd = ["curl", "-sS", "-m", "18", "-w", "\n%{http_code}", "-H", f"apikey: {api_key}"]
    if method == "POST" and body is not None:
        cmd += ["-X", "POST", "-H", "Content-Type: application/json", "-d", json.dumps(body)]
    cmd.append(url)
    proc = subprocess.run(cmd, capture_output=True, text=True)
    parts = proc.stdout.rsplit("\n", 1)
    raw = parts[0] if len(parts) == 2 else proc.stdout
    http = int(parts[1].strip()) if len(parts) == 2 and parts[1].strip().isdigit() else 0
    try:
        return http, json.loads(raw) if raw else None
    except json.JSONDecodeError:
        return http, raw[:200] if raw else None


def norm_base(api_url: str) -> str:
    return (
        api_url.rstrip("/")
        .replace("/manager", "")
        .replace("/dashboard", "")
        .replace("/app", "")
    )


def parse_state(body: object) -> str:
    if not isinstance(body, dict):
        return "?"
    inst = body.get("instance") if isinstance(body.get("instance"), dict) else {}
    for key in ("state", "status"):
        v = inst.get(key) or body.get(key)
        if isinstance(v, str) and v.strip():
            return v.strip().lower()
    return "?"


def fetch_instances_map(base: str, api_key: str) -> dict[str, str]:
    http, data = curl_json(f"{base}/instance/fetchInstances", api_key)
    out: dict[str, str] = {}
    if http < 200 or http >= 300:
        return out
    rows = data if isinstance(data, list) else [data] if data else []
    for row in rows:
        if not isinstance(row, dict):
            continue
        inst = row.get("instance") if isinstance(row.get("instance"), dict) else row
        name = str(inst.get("instanceName") or inst.get("name") or "").strip().lower()
        st = str(inst.get("status") or inst.get("state") or row.get("status") or "?").lower()
        if name:
            out[name] = st
    return out


def classify_row(r: dict, lista: dict[str, str]) -> dict:
    base = norm_base(r["api_url"])
    name = r["instance_name"]
    key = name.strip().lower()
    url = f"{base}/instance/connectionState/{urllib.parse.quote(name)}"
    http, body = curl_json(url, r["api_key"])
    state = parse_state(body) if http == 200 else "?"
    list_st = lista.get(key, "(ausente)")

    db = r["is_connected"]
    db_bool = True if db is True else False if db is False else None

    if http != 200:
        tag = "erro_api"
    elif state in TRANS:
        tag = "transitorio"
    elif state in OPEN:
        if db_bool is True:
            tag = "ok_open"
        elif db_bool is False:
            tag = "db_atrasado"
        else:
            tag = "evo_open_db_null"
    elif state in CLOSE:
        tag = "ambos_close" if db_bool is False else "fantasma_crm"
    else:
        tag = "desconhecido"

    if list_st in OPEN and state in CLOSE:
        tag = "fantasma_lista" if tag != "db_atrasado" else tag

    return {
        "instance_name": name,
        "db_is_connected": db_bool,
        "connectionState": state,
        "fetchInstances_status": list_st,
        "http": http,
        "classificacao": tag,
        "envio_seguro": state in OPEN,
    }


def main():
    org = "34086d07-9181-43fc-a3e8-6aa28974d68b"
    limit = 0
    as_json = False
    args = sys.argv[1:]
    for a in args:
        if a == "--json":
            as_json = True
        elif a == "--limit" and args.index(a) + 1 < len(args):
            limit = int(args[args.index(a) + 1])
        elif not a.startswith("-") and org == "34086d07-9181-43fc-a3e8-6aa28974d68b":
            org = a

    lim_sql = f" LIMIT {limit}" if limit > 0 else ""
    rows = query(
        f"""SELECT id, instance_name, is_connected, api_url, api_key
        FROM evolution_config
        WHERE organization_id = '{org}'
        ORDER BY instance_name{lim_sql}"""
    )

    if not rows:
        print("Nenhuma instância encontrada.")
        return

    sample = rows[0]
    lista = fetch_instances_map(norm_base(sample["api_url"]), sample["api_key"])

    results: list[dict] = []
    with ThreadPoolExecutor(max_workers=6) as pool:
        futs = [pool.submit(classify_row, r, lista) for r in rows]
        for fut in as_completed(futs):
            results.append(fut.result())

    results.sort(key=lambda x: x["instance_name"])
    counts = Counter(r["classificacao"] for r in results)
    prontos = sum(1 for r in results if r["envio_seguro"])

    summary = {
        "organization_id": org,
        "total": len(results),
        "prontos_para_disparo": prontos,
        "classificacao": dict(counts),
        "nota": (
            "fantasma_crm/lista = painel ou lista Evolution diz conectado mas sessão real está fechada. "
            "Limpar na Evolution: reconectar QR ou DELETE /instance/delete/{nome} (irreversível). "
            "CRM não remove instância na Evolution automaticamente."
        ),
        "instancias": results,
    }

    if as_json:
        print(json.dumps(summary, indent=2, ensure_ascii=False))
        return

    print(f"\n=== Diagnóstico Evolution — org {org[:8]}… ===\n")
    print(f"Total: {len(results)} | Prontas para disparo (connectionState open): {prontos}\n")
    print("Resumo:")
    for k, v in sorted(counts.items(), key=lambda x: -x[1]):
        print(f"  {k}: {v}")
    print(f"\n{summary['nota']}\n")
    print("Detalhe (problemas primeiro):")
    order = ["fantasma_crm", "fantasma_lista", "db_atrasado", "erro_api", "transitorio", "ambos_close", "ok_open"]
    for tag in order:
        for r in results:
            if r["classificacao"] == tag:
                print(
                    f"  [{r['classificacao']}] {r['instance_name']}: "
                    f"DB={r['db_is_connected']} evo={r['connectionState']} lista={r['fetchInstances_status']}"
                )


if __name__ == "__main__":
    main()
