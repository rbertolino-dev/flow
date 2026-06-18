#!/usr/bin/env python3
"""
Relatório read-only: servidor Evolution vs campanha (IClass).

Cruza instance_connection_events, broadcast_campaigns_2 e broadcast_queue_2.
Não chama Evolution API — zero carga nos chips.

Uso:
  python3 scripts/relatorio-servidor-vs-campanha-iclass.py
  python3 scripts/relatorio-servidor-vs-campanha-iclass.py --org ORG_ID --date 2026-06-17
  python3 scripts/relatorio-servidor-vs-campanha-iclass.py --json
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import urllib.parse
import urllib.request
from collections import Counter, defaultdict
from datetime import datetime, timezone

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
        headers={
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Accept": "application/json",
        },
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        return json.loads(resp.read())


def brt_from_iso(iso: str | None) -> str:
    if not iso:
        return "—"
    # Exibição simples UTC→BRT (-3h) para relatório
    try:
        dt = datetime.fromisoformat(iso.replace("Z", "+00:00"))
        from datetime import timedelta

        brt = dt - timedelta(hours=3)
        return brt.strftime("%Y-%m-%d %H:%M:%S")
    except Exception:
        return iso[:19]


def main() -> int:
    p = argparse.ArgumentParser(description="Relatório servidor vs campanha (read-only)")
    p.add_argument("--org", default=ICLASS_ORG)
    p.add_argument("--date", default=datetime.now(timezone.utc).strftime("%Y-%m-%d"))
    p.add_argument("--json", action="store_true")
    args = p.parse_args()

    key = load_service_role_key()
    org = args.org
    day = args.date
    day_end = f"{day}T23:59:59.999"

    # Instâncias
    instances = rest_get(
        f"/evolution_config?organization_id=eq.{org}"
        "&select=id,instance_name,is_connected"
        "&order=instance_name.asc",
        key,
    )
    inst_map = {r["id"]: r for r in instances}

    # Desconexões do dia
    events = rest_get(
        f"/instance_connection_events?organization_id=eq.{org}"
        f"&event_kind=eq.disconnect&occurred_at=gte.{day}T00:00:00"
        f"&occurred_at=lte.{day_end}"
        "&select=instance_id,occurred_at"
        "&order=occurred_at.asc",
        key,
    )

    # Desconexões de TODAS orgs no pico 13:08-13:11 UTC (10:08-10:11 BRT)
    pico_all = rest_get(
        "/instance_connection_events?event_kind=eq.disconnect"
        f"&occurred_at=gte.{day}T13:08:00"
        f"&occurred_at=lt.{day}T13:11:00"
        "&select=organization_id,instance_id,occurred_at",
        key,
    )
    pico_by_org = Counter(e["organization_id"] for e in pico_all)

    # Campanhas do dia
    camps = rest_get(
        f"/broadcast_campaigns_2?organization_id=eq.{org}"
        f"&select=id,name,status,started_at,sent_count,failed_count,total_contacts,sending_method,instance_ids"
        f"&order=started_at.desc.nullslast&limit=20",
        key,
    )
    camps_today = [
        c
        for c in camps
        if (c.get("started_at") or "").startswith(day) or c.get("status") == "running"
    ]
    running = next((c for c in camps if c.get("status") == "running"), None)
    # Pool: campanha do dia (mesmo se já pausou/completou) ou running atual
    pool_source = next(
        (c for c in camps_today if c.get("instance_ids")),
        running,
    )
    pool_ids = set(pool_source.get("instance_ids") or []) if pool_source else set()

    # Envios do dia
    sends = rest_get(
        f"/broadcast_queue_2?organization_id=eq.{org}"
        f"&sent_at=gte.{day}T00:00:00&sent_at=lte.{day_end}"
        "&select=instance_id,status,sent_at"
        "&limit=5000",
        key,
    )
    sends_ok = Counter(s["instance_id"] for s in sends if s.get("status") == "sent")
    sends_fail = Counter(s["instance_id"] for s in sends if s.get("status") == "failed")

    # Agregações
    disc_by_inst: dict[str, list[str]] = defaultdict(list)
    for e in events:
        disc_by_inst[e["instance_id"]].append(e["occurred_at"])

    by_minute = Counter(e["occurred_at"][11:16] for e in events)  # HH:MM UTC

    hourly_sends = Counter()
    for s in sends:
        if s.get("status") == "sent" and s.get("sent_at"):
            hourly_sends[s["sent_at"][11:13]] += 1

    primeira_queda = events[0]["occurred_at"] if events else None
    camp_start = None
    for c in camps_today:
        if c.get("started_at"):
            camp_start = c["started_at"]
            break

    # Veredito
    outras_orgs_pico = sum(1 for oid, n in pico_by_org.items() if oid != org and n > 0)
    quedas_pico_iclass = pico_by_org.get(org, 0)
    quedas_pico_total = len(pico_all)

    if outras_orgs_pico > 0:
        veredito = "FORTE indício de problema no SERVIDOR Evolution (outras orgs caíram no mesmo minuto)"
    elif quedas_pico_iclass >= 5 and camp_start and primeira_queda:
        try:
            t0 = datetime.fromisoformat(primeira_queda.replace("Z", "+00:00"))
            t1 = datetime.fromisoformat(camp_start.replace("Z", "+00:00"))
            delta = abs((t0 - t1).total_seconds())
            if delta < 120:
                veredito = "MISTO: pico de quedas coincide com início da campanha (servidor OU 1ª onda do disparo)"
            else:
                veredito = "POSSÍVEL evento em massa na IClass; campanha e quedas em horários diferentes"
        except Exception:
            veredito = "MISTO: pico + campanha no mesmo dia"
    elif len(events) >= 10 and sum(sends_ok.values()) >= 50:
        veredito = "MAIS PROVÁVEL campanha/WhatsApp (muitas quedas + alto volume de envios no mesmo dia)"
    else:
        veredito = "Dados insuficientes ou quedas espalhadas — analisar logs do servidor Evolution"

    report = {
        "org_id": org,
        "date": day,
        "veredito": veredito,
        "instancias_total": len(instances),
        "conectadas_agora": sum(1 for i in instances if i.get("is_connected")),
        "desconexoes_hoje": len(events),
        "quedas_pico_13h08_13h11_utc": quedas_pico_iclass,
        "quedas_pico_todas_orgs": quedas_pico_total,
        "outras_orgs_no_pico": outras_orgs_pico,
        "primeira_queda_utc": primeira_queda,
        "campanha_running": (pool_source or running or {}).get("name"),
        "campanha_status": (pool_source or running or {}).get("status"),
        "campanha_inicio_utc": camp_start,
        "pool_chips": len(pool_ids),
        "envios_ok_hoje": sum(sends_ok.values()),
        "envios_falha_hoje": sum(sends_fail.values()),
        "chips": [],
    }

    chip_rows = []
    for iid, row in inst_map.items():
        chip_rows.append(
            {
                "nome": row["instance_name"],
                "agora": "ON" if row.get("is_connected") else "OFF",
                "no_pool": iid in pool_ids,
                "envios_ok": sends_ok.get(iid, 0),
                "envios_falha": sends_fail.get(iid, 0),
                "quedas_hoje": len(disc_by_inst.get(iid, [])),
                "primeira_queda_utc": disc_by_inst[iid][0] if disc_by_inst.get(iid) else None,
            }
        )
    chip_rows.sort(key=lambda x: (-x["envios_ok"], -x["quedas_hoje"], x["nome"]))
    report["chips"] = chip_rows

    if args.json:
        print(json.dumps(report, indent=2, ensure_ascii=False))
        return 0

    print("=" * 72)
    print("RELATÓRIO: Servidor Evolution vs Campanha (somente leitura)")
    print(f"Org: {org}  |  Data: {day}")
    print("=" * 72)
    print()
    print(f"VEREDITO: {veredito}")
    print()
    print("--- Resumo ---")
    print(f"  Instâncias: {report['instancias_total']} | Conectadas agora: {report['conectadas_agora']}")
    print(f"  Desconexões hoje: {report['desconexoes_hoje']}")
    print(f"  Pico 10:08–10:11 BRT (13:08–13:11 UTC): {quedas_pico_iclass} quedas IClass / {quedas_pico_total} total")
    print(f"  Outras organizações no mesmo pico: {outras_orgs_pico}")
    if pool_source or running:
        cinfo = pool_source or running
        print(f"  Campanha: {cinfo.get('name')} ({cinfo.get('status')})")
        print(f"  Início campanha (BRT): {brt_from_iso(camp_start)}")
        print(f"  Pool: {len(pool_ids)} chips | Envios OK hoje: {report['envios_ok_hoje']}")
    print(f"  Primeira queda IClass (BRT): {brt_from_iso(primeira_queda)}")
    print()

    if by_minute:
        print("--- Quedas por minuto (UTC) ---")
        for m in sorted(by_minute):
            print(f"  {m}  →  {by_minute[m]} queda(s)")
        print()

    if hourly_sends:
        print("--- Envios por hora (UTC) ---")
        for h in sorted(hourly_sends):
            print(f"  {h}h  →  {hourly_sends[h]} envio(s)")
        print()

    if pico_by_org:
        print("--- Quedas no pico por organização ---")
        for oid, n in pico_by_org.most_common():
            label = "IClass" if oid == org else oid[:8] + "…"
            print(f"  {label}: {n}")
        print()

    print("--- Chips (envios × quedas × status) ---")
    print(f"  {'Chip':<22} {'Agora':<5} {'Pool':<5} {'Envios':<7} {'Quedas':<7} 1ª queda BRT")
    print("  " + "-" * 68)
    for c in chip_rows:
        if c["envios_ok"] or c["quedas_hoje"] or c["agora"] == "OFF":
            pool = "sim" if c["no_pool"] else "não"
            print(
                f"  {c['nome']:<22} {c['agora']:<5} {pool:<5} {c['envios_ok']:<7} "
                f"{c['quedas_hoje']:<7} {brt_from_iso(c['primeira_queda_utc'])}"
            )

    print()
    print("Próximo passo (se veredito apontar servidor):")
    print("  docker inspect <evolution> --format '{{.State.StartedAt}}'")
    print("  docker logs <evolution> --since ... --until ... (janela 13:05–13:15 UTC)")
    print("=" * 72)
    return 0


if __name__ == "__main__":
    sys.exit(main())
