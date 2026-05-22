#!/usr/bin/env python3
"""
Monitora oscilações de is_connected no Supabase (org IClass por padrão).

Uso:
  ./scripts/teste-oscilacao-status-evolution.py
  ./scripts/teste-oscilacao-status-evolution.py --org ORG_ID --seconds 120 --interval 2

Saída:
  - total de flips (true↔false) por instância
  - instâncias mais voláteis
  - exit 1 se alguma instância passar do limite (--max-flips, default 3)
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

ICLASS_ORG = "34086d07-9181-43fc-a3e8-6aa28974d68b"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REF_FILE = os.path.join(ROOT, "supabase", ".temp", "project-ref")


def load_project_ref() -> str:
    with open(REF_FILE) as f:
        return f.read().strip()


def load_service_role_key() -> str:
    env = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    if env:
        return env
    ref = load_project_ref()
    proc = subprocess.run(
        ["supabase", "projects", "api-keys", "--project-ref", ref],
        capture_output=True,
        text=True,
        cwd=ROOT,
        timeout=60,
    )
    if proc.returncode != 0:
        raise RuntimeError("service_role: supabase projects api-keys falhou")
    for line in proc.stdout.splitlines():
        line = line.strip()
        if line.startswith("|") or not line or "NAME" in line or "---" in line:
            continue
        parts = [p.strip() for p in line.split("|") if p.strip()]
        if len(parts) >= 2 and parts[0] == "service_role":
            return parts[1]
    raise RuntimeError("service_role key não encontrada")


def rest_select_evolution_config(org_id: str) -> list[dict]:
    ref = load_project_ref()
    key = load_service_role_key()
    url = (
        f"https://{ref}.supabase.co/rest/v1/evolution_config"
        f"?organization_id=eq.{urllib.parse.quote(org_id)}"
        "&select=id,instance_name,is_connected,updated_at"
        "&order=instance_name.asc"
    )
    req = urllib.request.Request(
        url,
        headers={
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Accept": "application/json",
        },
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.loads(resp.read())


def load_snapshot(org_id: str) -> dict[str, tuple[str, bool | None]]:
    rows = rest_select_evolution_config(org_id)
    out: dict[str, tuple[str, bool | None]] = {}
    for r in rows:
        raw = r.get("is_connected")
        val = True if raw is True else False if raw is False else None
        out[str(r["id"])] = (str(r["instance_name"]), val)
    return out


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--org", default=ICLASS_ORG)
    p.add_argument("--seconds", type=int, default=90)
    p.add_argument("--interval", type=float, default=2.0)
    p.add_argument("--max-flips", type=int, default=3, help="Falha se uma instância oscilar mais que N vezes")
    args = p.parse_args()

    print(f"Monitorando is_connected | org={args.org} | {args.seconds}s | intervalo={args.interval}s\n")

    flip_counts: dict[str, int] = {}
    last: dict[str, bool | None] = {}
    names: dict[str, str] = {}
    samples = 0
    t0 = time.time()

    while time.time() - t0 < args.seconds:
        snap = load_snapshot(args.org)
        samples += 1
        for iid, (name, val) in snap.items():
            names[iid] = name
            prev = last.get(iid)
            if prev is not None and val is not None and prev != val:
                flip_counts[iid] = flip_counts.get(iid, 0) + 1
            if val is not None:
                last[iid] = val
        time.sleep(args.interval)

    volatile = sorted(flip_counts.items(), key=lambda x: -x[1])
    total_flips = sum(flip_counts.values())
    connected = sum(1 for v in last.values() if v is True)
    disconnected = sum(1 for v in last.values() if v is False)

    print(f"Amostras: {samples} | Instâncias: {len(last)}")
    print(f"Estado final: conectadas={connected} desconectadas={disconnected}")
    print(f"Total de flips (mudanças true↔false): {total_flips}\n")

    if volatile:
        print("Instâncias mais voláteis:")
        for iid, n in volatile[:15]:
            print(f"  {names.get(iid, iid)}: {n} flip(s)")
    else:
        print("Nenhuma oscilação detectada no banco durante o período.")

    worst = volatile[0][1] if volatile else 0
    if worst > args.max_flips:
        print(
            f"\n❌ FALHA: pior instância com {worst} flips (limite {args.max_flips}). "
            "CRM ainda está alternando is_connected no Supabase.",
        )
        return 1

    print(f"\n✅ OK: nenhuma instância passou de {args.max_flips} flips no período.")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except urllib.error.HTTPError as e:
        print(f"Erro HTTP ao consultar Supabase: {e}", file=sys.stderr)
        sys.exit(2)
