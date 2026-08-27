#!/usr/bin/env python3
"""Relatório mensal de desconexões IClass (read-only)."""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import urllib.request
from collections import Counter, defaultdict

ICLASS_ORG = "34086d07-9181-43fc-a3e8-6aa28974d68b"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REF_FILE = os.path.join(ROOT, "supabase", ".temp", "project-ref")


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
    if proc.returncode != 0:
        raise RuntimeError("Não foi possível obter service_role key")
    for line in proc.stdout.splitlines():
        parts = [p.strip() for p in line.split("|") if p.strip()]
        if len(parts) >= 2 and parts[0] == "service_role":
            return parts[1]
    raise RuntimeError("service_role key não encontrada")


def rest_get(path: str, key: str) -> list[dict]:
    ref = open(REF_FILE).read().strip()
    url = f"https://{ref}.supabase.co/rest/v1{path}"
    req = urllib.request.Request(
        url,
        headers={"apikey": key, "Authorization": f"Bearer {key}", "Accept": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=180) as resp:
        return json.loads(resp.read())


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--org", default=ICLASS_ORG)
    p.add_argument("--month", default="2026-06", help="YYYY-MM")
    p.add_argument("--json", action="store_true")
    args = p.parse_args()

    import calendar
    from datetime import datetime

    y, m = args.month.split("-")
    last_day = calendar.monthrange(int(y), int(m))[1]
    start = f"{y}-{m}-01T00:00:00"
    end = f"{y}-{m}-{last_day:02d}T23:59:59"
    key = load_service_role_key()
    org = args.org

    instances = {
        r["id"]: r
        for r in rest_get(
            f"/evolution_config?organization_id=eq.{org}&select=id,instance_name,is_connected",
            key,
        )
    }
    events = rest_get(
        f"/instance_connection_events?organization_id=eq.{org}"
        f"&occurred_at=gte.{start}&occurred_at=lte.{end}"
        "&select=instance_id,event_kind,occurred_at&order=occurred_at.asc&limit=10000",
        key,
    )
    camps = rest_get(
        f"/broadcast_campaigns_2?organization_id=eq.{org}&created_at=gte.{start}"
        "&select=id,name,status,started_at,sent_count,failed_count,instance_ids,sending_method"
        "&order=started_at.desc.nullslast",
        key,
    )
    sends = rest_get(
        f"/broadcast_queue_2?organization_id=eq.{org}"
        f"&sent_at=gte.{start}&sent_at=lte.{end}"
        "&select=instance_id,status,failure_code&limit=10000",
        key,
    )
    fails = rest_get(
        f"/broadcast_queue_2?organization_id=eq.{org}"
        f"&failed_at=gte.{start}&failed_at=lte.{end}&status=eq.failed"
        "&select=instance_id,failure_code&limit=5000",
        key,
    )

    disc = Counter()
    recon = Counter()
    by_day = Counter()
    for e in events:
        iid = e["instance_id"]
        if e["event_kind"] == "disconnect":
            disc[iid] += 1
            by_day[e["occurred_at"][:10]] += 1
        else:
            recon[iid] += 1

    send_ok = Counter(s["instance_id"] for s in sends if s.get("status") == "sent")
    fail_codes = Counter(f.get("failure_code") or "null" for f in fails)

    rows = []
    for iid, inst in instances.items():
        rows.append(
            {
                "name": inst["instance_name"],
                "connected": bool(inst.get("is_connected")),
                "disconnects": disc.get(iid, 0),
                "reconnects": recon.get(iid, 0),
                "sends_ok": send_ok.get(iid, 0),
            }
        )
    rows.sort(key=lambda x: (-x["disconnects"], -x["sends_ok"]))
    stable = [r for r in rows if r["disconnects"] == 0]
    unstable = [r for r in rows if r["disconnects"] > 0]

    report = {
        "month": args.month,
        "organization_id": org,
        "instances_total": len(instances),
        "connected_now": sum(1 for i in instances.values() if i.get("is_connected")),
        "disconnects_month": sum(disc.values()),
        "reconnects_month": sum(recon.values()),
        "stable_chips_0_disconnects": len(stable),
        "unstable_chips": len(unstable),
        "sends_ok_month": sum(send_ok.values()),
        "sends_failed_month": len(fails),
        "failure_codes": dict(fail_codes.most_common(10)),
        "disconnects_by_day": dict(sorted(by_day.items())),
        "campaigns": [
            {
                "name": c.get("name"),
                "status": c.get("status"),
                "started_at": c.get("started_at"),
                "sent": c.get("sent_count"),
                "failed": c.get("failed_count"),
                "pool_size": len(c.get("instance_ids") or []),
                "method": c.get("sending_method"),
            }
            for c in camps
        ],
        "top_unstable": rows[:15],
        "top_stable_by_sends": sorted(stable, key=lambda x: -x["sends_ok"])[:10],
        "avg_sends_stable": round(sum(r["sends_ok"] for r in stable) / max(len(stable), 1), 1),
        "avg_sends_unstable": round(sum(r["sends_ok"] for r in unstable) / max(len(unstable), 1), 1),
        "avg_disconnects_unstable": round(sum(r["disconnects"] for r in unstable) / max(len(unstable), 1), 1),
    }

    if args.json:
        print(json.dumps(report, indent=2, ensure_ascii=False))
        return 0

    print("=" * 72)
    print(f"RELATÓRIO MENSAL DESCONEXÕES — {args.month}")
    print("=" * 72)
    for k, v in report.items():
        if k not in ("top_unstable", "top_stable_by_sends", "campaigns", "disconnects_by_day", "failure_codes"):
            print(f"  {k}: {v}")
    print("\nQuedas por dia:", report["disconnects_by_day"])
    print("\nTop instáveis:", report["top_unstable"][:8])
    return 0


if __name__ == "__main__":
    sys.exit(main())
