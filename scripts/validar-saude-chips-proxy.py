#!/usr/bin/env python3
"""
Validação de saúde e estabilidade de chips Evolution com proxy BR.

Para cada chip:
  - Status ao vivo (connectionState × fetchInstances × CRM)
  - Estabilidade: 3 leituras de connectionState com intervalo (detecta oscilação)
  - Histórico de quedas (instance_connection_events, 7 e 30 dias)
  - Última queda Evolution (disconnectionReasonCode / disconnectionAt)
  - Saúde do proxy: 3 testes de IP + latência + consistência
  - Falhas recentes no Disparador 2 (broadcast_queue_2)

Uso:
  ./scripts/validar-saude-chips-proxy.py
  ./scripts/validar-saude-chips-proxy.py --chips "Aline Souza,Ana Iclass"
  ./scripts/validar-saude-chips-proxy.py --json --save
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
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REF_FILE = os.path.join(ROOT, "supabase", ".temp", "project-ref")
OUT_DIR = os.path.join(ROOT, "test-results")
ICLASS_ORG = "34086d07-9181-43fc-a3e8-6aa28974d68b"

DEFAULT_CHIPS = [
    "Aline Souza",
    "Ana Beatriz2",
    "Ana Clara",
    "Ana Iclass",
    "Fatima",
    "Paula Silva",
    "Silvia",
    "flavia",
    "maria alices",
    "sofia2",
]

OPEN = {"open", "connected", "online", "up", "ready", "authenticated", "logged", "active"}
CLOSE = {"close", "closed", "disconnected", "offline", "down"}
TRANS = {"pairing", "connecting", "qr", "waiting", "timeout", "syncing", "loading"}
BR_COUNTRY = {"brazil", "brasil"}

REASON_LABEL = {
    401: "loggedOut — sessão deslogada",
    403: "forbidden — WhatsApp negou acesso",
    408: "timeout/perda de rede",
    428: "connectionClosed — socket fechou",
    440: "connectionReplaced — sessão duplicada",
    500: "badSession — sessão corrompida",
    503: "serviço indisponível",
    515: "restartRequired",
}


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


def curl_json(url: str, api_key: str) -> tuple[int, object, float]:
    t0 = time.monotonic()
    cmd = ["curl", "-sS", "-m", "18", "-w", "\n%{http_code}", "-H", f"apikey: {api_key}", url]
    proc = subprocess.run(cmd, capture_output=True, text=True)
    elapsed_ms = round((time.monotonic() - t0) * 1000)
    parts = proc.stdout.rsplit("\n", 1)
    raw = parts[0] if len(parts) == 2 else proc.stdout
    http = int(parts[1].strip()) if len(parts) == 2 and parts[1].strip().isdigit() else 0
    try:
        return http, json.loads(raw) if raw else None, elapsed_ms
    except json.JSONDecodeError:
        return http, raw[:200] if raw else None, elapsed_ms


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


def geo_ip(ip: str) -> dict:
    if not ip:
        return {"ok": False}
    try:
        url = f"http://ip-api.com/json/{ip}?fields=status,country,countryCode,regionName,city,query"
        with urllib.request.urlopen(url, timeout=8) as resp:
            data = json.loads(resp.read())
        if data.get("status") == "success":
            return {
                "ok": True,
                "ip": data.get("query"),
                "country": data.get("country"),
                "city": data.get("city"),
            }
    except Exception as exc:
        return {"ok": False, "error": str(exc)[:80]}
    return {"ok": False}


def test_proxy(host: str, port: str, protocol: str, user: str | None, pwd: str | None) -> dict:
    proto = (protocol or "http").lower()
    if "socks" in proto:
        proto = "socks5" if "5" in proto or proto == "socks" else "socks4"
    auth = ""
    if user:
        auth = f"{urllib.parse.quote(user, safe='')}:{urllib.parse.quote(pwd or '', safe='')}@"
    proxy_url = f"{proto}://{auth}{host}:{port}"
    flag = "--proxy" if proto.startswith("socks") else "-x"
    t0 = time.monotonic()
    proc = subprocess.run(
        ["curl", "-sS", "-m", "12", flag, proxy_url, "https://api.ipify.org"],
        capture_output=True,
        text=True,
    )
    ms = round((time.monotonic() - t0) * 1000)
    ip = (proc.stdout or "").strip()
    if proc.returncode == 0 and ip and "." in ip and len(ip) < 40:
        return {"ok": True, "ip": ip, "latency_ms": ms, "geo": geo_ip(ip)}
    return {"ok": False, "latency_ms": ms, "error": (proc.stderr or proc.stdout or "falha")[:120]}


def score_chip(r: dict) -> tuple[str, int, list[str]]:
    """Retorna (veredito, pontuação 0-100, alertas)."""
    alerts: list[str] = []
    score = 100

    state = r.get("connection_state_final", "?")
    polls = r.get("stability_polls") or []
    unique_states = set(polls)

    if state not in OPEN:
        score -= 50
        alerts.append(f"Não está open agora ({state})")
    if len(unique_states) > 1:
        score -= 25
        alerts.append(f"Oscilação detectada: {sorted(unique_states)}")
    if r.get("fantasma"):
        score -= 20
        alerts.append("Lista Evolution ≠ connectionState (fantasma)")
    if r.get("db_mismatch"):
        score -= 10
        alerts.append("CRM is_connected desalinhado com Evolution")

    disc_7d = r.get("disconnects_7d", 0)
    disc_30d = r.get("disconnects_30d", 0)
    if disc_7d >= 5:
        score -= 20
        alerts.append(f"Muitas quedas em 7d: {disc_7d}")
    elif disc_7d >= 2:
        score -= 10
        alerts.append(f"Quedas em 7d: {disc_7d}")
    if disc_30d >= 15:
        score -= 10
        alerts.append(f"Quedas em 30d: {disc_30d}")

    code = r.get("last_disconnection_code")
    if code in (401, 403, 440, 500):
        score -= 15
        alerts.append(f"Última queda grave: {REASON_LABEL.get(code, code)}")

    proxy_tests = r.get("proxy_tests") or []
    ok_tests = [t for t in proxy_tests if t.get("ok")]
    if len(ok_tests) < len(proxy_tests):
        score -= 20
        alerts.append("Proxy com falha em teste de IP")
    elif ok_tests:
        ips = {t["ip"] for t in ok_tests}
        if len(ips) > 1:
            score -= 15
            alerts.append(f"IP do proxy instável: {ips}")
        geo = ok_tests[0].get("geo") or {}
        if geo.get("ok") and (geo.get("country") or "").lower() not in BR_COUNTRY:
            score -= 25
            alerts.append(f"IP fora do BR: {geo.get('country')}")
        latencies = [t["latency_ms"] for t in ok_tests]
        avg_lat = sum(latencies) / len(latencies)
        if avg_lat > 3000:
            score -= 10
            alerts.append(f"Proxy lento (média {avg_lat:.0f}ms)")

    fails_7d = r.get("send_failures_7d", 0)
    if fails_7d >= 10:
        score -= 15
        alerts.append(f"Falhas de envio em 7d: {fails_7d}")
    elif fails_7d >= 3:
        score -= 5
        alerts.append(f"Falhas de envio em 7d: {fails_7d}")

    score = max(0, min(100, score))
    if score >= 85 and state in OPEN:
        verdict = "SAUDÁVEL"
    elif score >= 65:
        verdict = "ESTÁVEL COM RESSALVAS"
    elif score >= 40:
        verdict = "INSTÁVEL"
    else:
        verdict = "CRÍTICO"

    return verdict, score, alerts


def validate_chip(row: dict, lista_row: dict | None, events_7d: list, events_30d: list, fails_7d: int) -> dict:
    base = norm_base(row["api_url"])
    name = row["instance_name"]
    enc = urllib.parse.quote(name)

    # Proxy Evolution
    http_pf, data_pf, _ = curl_json(f"{base}/proxy/find/{enc}", row["api_key"])
    proxy = data_pf if http_pf == 200 and isinstance(data_pf, dict) else None

    # Estabilidade: 3 polls
    polls: list[str] = []
    poll_times: list[int] = []
    for i in range(3):
        http, body, ms = curl_json(f"{base}/instance/connectionState/{enc}", row["api_key"])
        polls.append(parse_state(body) if http == 200 else "?")
        poll_times.append(ms)
        if i < 2:
            time.sleep(8)

    lista_st = (lista_row or {}).get("connectionStatus", "(ausente)")
    state_final = polls[-1]

    result = {
        "instance_name": name,
        "instance_id": row["id"],
        "phone_number": row.get("phone_number"),
        "owner_jid": (lista_row or {}).get("ownerJid"),
        "db_is_connected": row.get("is_connected"),
        "connection_state_final": state_final,
        "stability_polls": polls,
        "poll_latencies_ms": poll_times,
        "fetchInstances_status": lista_st,
        "fantasma": lista_st in OPEN and state_final in CLOSE,
        "db_mismatch": (row.get("is_connected") is True) != (state_final in OPEN),
        "proxy": {
            "host": proxy.get("host") if proxy else row.get("proxy_host"),
            "port": proxy.get("port") if proxy else row.get("proxy_port"),
            "protocol": proxy.get("protocol") if proxy else row.get("proxy_protocol"),
        },
        "last_disconnection_at": (lista_row or {}).get("disconnectionAt"),
        "last_disconnection_code": (lista_row or {}).get("disconnectionReasonCode"),
        "last_disconnection_label": REASON_LABEL.get((lista_row or {}).get("disconnectionReasonCode"), ""),
        "disconnects_7d": len([e for e in events_7d if e.get("event_kind") == "disconnect"]),
        "reconnects_7d": len([e for e in events_7d if e.get("event_kind") == "reconnect"]),
        "disconnects_30d": len([e for e in events_30d if e.get("event_kind") == "disconnect"]),
        "reconnects_30d": len([e for e in events_30d if e.get("event_kind") == "reconnect"]),
        "send_failures_7d": fails_7d,
        "recent_disconnects": [
            e["occurred_at"][:19] for e in events_7d if e.get("event_kind") == "disconnect"
        ][-5:],
    }

    # 3 testes de proxy
    if proxy and proxy.get("host"):
        tests = []
        for _ in range(3):
            tests.append(
                test_proxy(
                    str(proxy["host"]),
                    str(proxy["port"]),
                    str(proxy.get("protocol") or "http"),
                    proxy.get("username"),
                    proxy.get("password"),
                )
            )
            time.sleep(0.5)
        result["proxy_tests"] = tests
        ok = [t for t in tests if t.get("ok")]
        result["proxy_ip"] = ok[0]["ip"] if ok else None
        result["proxy_location"] = (
            f"{ok[0]['geo'].get('city', '?')}, {ok[0]['geo'].get('country', '?')}" if ok and ok[0].get("geo", {}).get("ok") else None
        )
        result["proxy_latency_avg_ms"] = round(sum(t["latency_ms"] for t in ok) / len(ok)) if ok else None
        result["proxy_ip_stable"] = len({t["ip"] for t in ok}) <= 1 if ok else False
    else:
        result["proxy_tests"] = []
        result["proxy_ip"] = None

    verdict, score, alerts = score_chip(result)
    result["score"] = score
    result["veredito"] = verdict
    result["alertas"] = alerts
    result["pronto_disparo"] = state_final in OPEN and score >= 65 and not result["fantasma"]
    return result


def render_md(summary: dict) -> str:
    lines = [
        "# Validação de Saúde e Estabilidade — Chips Proxy BR",
        "",
        f"**Gerado em:** {summary['gerado_em']}",
        f"**Chips avaliados:** {summary['total']}",
        f"**Saudáveis:** {summary['saudaveis']}",
        f"**Prontos para disparo:** {summary['prontos_disparo']}",
        "",
        "## Resumo executivo",
        "",
        "| Chip | Veredito | Score | Status | Proxy | IP | Quedas 7d | Falhas envio 7d |",
        "|------|----------|-------|--------|-------|-----|------------|-----------------|",
    ]
    for r in summary["chips"]:
        proxy = r.get("proxy") or {}
        ph = f"`{proxy.get('host')}:{proxy.get('port')}`" if proxy.get("host") else "—"
        lines.append(
            f"| {r['instance_name']} | **{r['veredito']}** | {r['score']} | "
            f"{r['connection_state_final']} | {ph} | {r.get('proxy_ip') or '—'} | "
            f"{r['disconnects_7d']} | {r['send_failures_7d']} |"
        )

    lines += ["", "## Detalhes por chip", ""]
    for r in summary["chips"]:
        lines += [
            f"### {r['instance_name']} — {r['veredito']} ({r['score']}/100)",
            "",
            f"- **Status ao vivo:** `{r['connection_state_final']}` (polls: {r['stability_polls']})",
            f"- **Lista Evolution:** `{r['fetchInstances_status']}` | **CRM DB:** `{r['db_is_connected']}`",
            f"- **Proxy:** `{r['proxy'].get('host')}:{r['proxy'].get('port')}` → IP `{r.get('proxy_ip')}` ({r.get('proxy_location') or '?'})",
            f"- **Latência proxy média:** {r.get('proxy_latency_avg_ms') or '?'} ms | IP estável: {r.get('proxy_ip_stable')}",
            f"- **Quedas:** 7d={r['disconnects_7d']} / 30d={r['disconnects_30d']} | Reconexões 7d={r['reconnects_7d']}",
            f"- **Última queda Evolution:** {r.get('last_disconnection_at') or '—'} — {r.get('last_disconnection_label') or 'sem registro'}",
            f"- **Falhas envio 7d:** {r['send_failures_7d']}",
            f"- **Pronto disparo:** {'✅ Sim' if r['pronto_disparo'] else '❌ Não'}",
        ]
        if r.get("alertas"):
            lines.append("- **Alertas:**")
            for a in r["alertas"]:
                lines.append(f"  - {a}")
        lines.append("")

    # Proxies compartilhados
    if summary.get("proxies_compartilhados"):
        lines += ["## Proxies compartilhados (risco de concentração)", ""]
        for px, chips in summary["proxies_compartilhados"].items():
            lines.append(f"- `{px}` → {', '.join(chips)}")
        lines.append("")

    lines += ["---", "*Validação automatizada. Polls de estabilidade com intervalo de 8s.*"]
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--org", default=ICLASS_ORG)
    parser.add_argument("--chips", help="Nomes separados por vírgula")
    parser.add_argument("--json", action="store_true")
    parser.add_argument("--save", action="store_true")
    args = parser.parse_args()

    chip_names = [c.strip() for c in args.chips.split(",")] if args.chips else DEFAULT_CHIPS
    key = load_service_role_key()

    # Buscar configs dos chips
    all_configs = rest_get(
        f"/evolution_config?organization_id=eq.{args.org}"
        "&select=id,instance_name,phone_number,is_connected,api_url,api_key,"
        "proxy_host,proxy_port,proxy_protocol,proxy_username,proxy_password",
        key,
    )
    name_map = {r["instance_name"].lower(): r for r in all_configs}
    rows = []
    missing = []
    for cn in chip_names:
        r = name_map.get(cn.lower())
        if r:
            rows.append(r)
        else:
            missing.append(cn)

    if missing:
        print(f"⚠️ Chips não encontrados: {', '.join(missing)}", file=sys.stderr)

    if not rows:
        print("Nenhum chip para validar.", file=sys.stderr)
        return 1

    # fetchInstances uma vez
    base = norm_base(rows[0]["api_url"])
    api_key = rows[0]["api_key"]
    http, data, _ = curl_json(f"{base}/instance/fetchInstances", api_key)
    lista: dict[str, dict] = {}
    if http == 200 and isinstance(data, list):
        for item in data:
            n = str(item.get("name") or "").strip().lower()
            if n:
                lista[n] = {
                    "connectionStatus": str(item.get("connectionStatus") or "?").lower(),
                    "ownerJid": item.get("ownerJid"),
                    "disconnectionAt": item.get("disconnectionAt"),
                    "disconnectionReasonCode": item.get("disconnectionReasonCode"),
                }

    now = datetime.now(timezone.utc)
    since_7d = (now - timedelta(days=7)).strftime("%Y-%m-%dT%H:%M:%SZ")
    since_30d = (now - timedelta(days=30)).strftime("%Y-%m-%dT%H:%M:%SZ")
    target_ids = {r["id"] for r in rows}

    events_all = rest_get(
        f"/instance_connection_events?organization_id=eq.{args.org}"
        f"&occurred_at=gte.{since_30d}"
        "&select=instance_id,event_kind,occurred_at&order=occurred_at.asc&limit=10000",
        key,
    )
    events_all = [e for e in events_all if e["instance_id"] in target_ids]
    events_by_inst: dict[str, list] = defaultdict(list)
    for e in events_all:
        events_by_inst[e["instance_id"]].append(e)

    fails_all = rest_get(
        f"/broadcast_queue_2?organization_id=eq.{args.org}"
        f"&failed_at=gte.{since_7d}&status=eq.failed"
        "&select=instance_id&limit=5000",
        key,
    )
    fails_all = [f for f in fails_all if f["instance_id"] in target_ids]
    fails_by_inst = Counter(f["instance_id"] for f in fails_all)

    results = []
    for row in rows:
        iid = row["id"]
        ev30 = events_by_inst.get(iid, [])
        ev7 = [e for e in ev30 if e["occurred_at"] >= since_7d]
        lr = lista.get(row["instance_name"].lower())
        results.append(
            validate_chip(row, lr, ev7, ev30, fails_by_inst.get(iid, 0))
        )

    results.sort(key=lambda x: (-x["score"], x["instance_name"]))

    proxy_groups: dict[str, list[str]] = defaultdict(list)
    for r in results:
        p = r.get("proxy") or {}
        if p.get("host"):
            k = f"{p['host']}:{p['port']}"
            proxy_groups[k].append(r["instance_name"])
    shared = {k: v for k, v in proxy_groups.items() if len(v) > 1}

    summary = {
        "gerado_em": now.isoformat(),
        "org": args.org,
        "total": len(results),
        "saudaveis": sum(1 for r in results if r["veredito"] == "SAUDÁVEL"),
        "prontos_disparo": sum(1 for r in results if r["pronto_disparo"]),
        "proxies_compartilhados": shared,
        "chips": results,
    }

    if args.json:
        print(json.dumps(summary, indent=2, ensure_ascii=False))
    else:
        print(render_md(summary))

    if args.save or not args.json:
        os.makedirs(OUT_DIR, exist_ok=True)
        ts = now.strftime("%Y%m%d-%H%M%S")
        jp = os.path.join(OUT_DIR, f"validacao-saude-chips-{ts}.json")
        mp = os.path.join(OUT_DIR, f"validacao-saude-chips-{ts}.md")
        with open(jp, "w", encoding="utf-8") as f:
            json.dump(summary, f, indent=2, ensure_ascii=False)
        with open(mp, "w", encoding="utf-8") as f:
            f.write(render_md(summary))
        if not args.json:
            print(f"\n📁 Salvos:\n  - {jp}\n  - {mp}", file=sys.stderr)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
