#!/usr/bin/env python3
"""
Diagnóstico automatizado: instâncias Evolution × IP de saída (proxy).

Para cada chip no CRM (evolution_config):
  1. Status ao vivo: connectionState + fetchInstances
  2. Proxy no CRM (banco) vs Evolution API (/proxy/find/{nome})
  3. Teste de IP de saída via proxy (curl → ipify + geolocalização)
  4. IP direto do servidor Evolution (sem proxy) para comparação

Somente leitura na Evolution e no Supabase.

Uso:
  ./scripts/diagnostico-evolution-proxy-ip.py
  ./scripts/diagnostico-evolution-proxy-ip.py --org ORG_ID
  ./scripts/diagnostico-evolution-proxy-ip.py --json
  ./scripts/diagnostico-evolution-proxy-ip.py --save
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
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REF_FILE = os.path.join(ROOT, "supabase", ".temp", "project-ref")
OUT_DIR = os.path.join(ROOT, "test-results")

OPEN = {"open", "connected", "online", "up", "ready", "authenticated", "logged", "active"}
CLOSE = {"close", "closed", "disconnected", "offline", "down"}
TRANS = {"pairing", "connecting", "qr", "waiting", "timeout", "syncing", "loading"}
BR_COUNTRY = {"brazil", "brasil"}
INVALID_API_PREFIX = ("http://", "https://")


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
        raise RuntimeError("Não foi possível obter service_role key (supabase CLI)")
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


def curl_json(url: str, api_key: str, method: str = "GET", body: dict | None = None) -> tuple[int, object]:
    cmd = ["curl", "-sS", "-m", "20", "-w", "\n%{http_code}", "-H", f"apikey: {api_key}"]
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
        return http, raw[:300] if raw else None


def norm_base(api_url: str) -> str | None:
    if not api_url or not api_url.lower().startswith(INVALID_API_PREFIX):
        return None
    return (
        api_url.rstrip("/")
        .replace("/manager", "")
        .replace("/dashboard", "")
        .replace("/app", "")
    )


def parse_connection_state(body: object) -> str:
    if not isinstance(body, dict):
        return "?"
    inst = body.get("instance") if isinstance(body.get("instance"), dict) else {}
    for key in ("state", "status"):
        v = inst.get(key) or body.get(key)
        if isinstance(v, str) and v.strip():
            return v.strip().lower()
    return "?"


def geo_ip(ip: str) -> dict:
    if not ip or ip in ("?", "erro", "timeout"):
        return {"ip": ip, "ok": False}
    try:
        url = f"http://ip-api.com/json/{urllib.parse.quote(ip)}?fields=status,country,countryCode,regionName,city,query"
        with urllib.request.urlopen(url, timeout=8) as resp:
            data = json.loads(resp.read())
        if data.get("status") == "success":
            return {
                "ip": data.get("query", ip),
                "ok": True,
                "country": data.get("country"),
                "country_code": data.get("countryCode"),
                "region": data.get("regionName"),
                "city": data.get("city"),
            }
    except Exception as exc:
        return {"ip": ip, "ok": False, "error": str(exc)[:80]}
    return {"ip": ip, "ok": False}


def test_proxy_outbound(
    host: str,
    port: str,
    protocol: str,
    username: str | None = None,
    password: str | None = None,
) -> dict:
    proto = (protocol or "http").lower().replace("socks", "socks5")
    if proto not in ("http", "https", "socks4", "socks5"):
        proto = "http"

    auth = ""
    if username:
        user = urllib.parse.quote(username, safe="")
        pwd = urllib.parse.quote(password or "", safe="")
        auth = f"{user}:{pwd}@"

    if proto.startswith("socks"):
        proxy_url = f"{proto}://{auth}{host}:{port}"
        cmd = ["curl", "-sS", "-m", "15", "--proxy", proxy_url, "https://api.ipify.org"]
    else:
        proxy_url = f"{proto}://{auth}{host}:{port}"
        cmd = ["curl", "-sS", "-m", "15", "-x", proxy_url, "https://api.ipify.org"]

    proc = subprocess.run(cmd, capture_output=True, text=True)
    out = (proc.stdout or "").strip()
    if proc.returncode == 0 and out and "." in out and len(out) < 40:
        geo = geo_ip(out)
        return {"ok": True, "ip": out, "geo": geo, "proxy_url_masked": f"{proto}://{host}:{port}"}
    err = (proc.stderr or proc.stdout or "falha").strip()[:200]
    return {"ok": False, "error": err, "proxy_url_masked": f"{proto}://{host}:{port}"}


def get_server_direct_ip() -> dict:
    proc = subprocess.run(
        ["curl", "-sS", "-m", "12", "https://api.ipify.org"],
        capture_output=True,
        text=True,
    )
    ip = (proc.stdout or "").strip()
    if proc.returncode == 0 and ip:
        return {"ok": True, "ip": ip, "geo": geo_ip(ip)}
    return {"ok": False, "error": "não foi possível obter IP do servidor de diagnóstico"}


def fetch_instances_full(base: str, api_key: str) -> dict[str, dict]:
    http, data = curl_json(f"{base}/instance/fetchInstances", api_key)
    out: dict[str, dict] = {}
    if http < 200 or http >= 300:
        return out
    rows = data if isinstance(data, list) else [data] if data else []
    for row in rows:
        if not isinstance(row, dict):
            continue
        name = str(row.get("name") or row.get("instanceName") or "").strip()
        if not name:
            inst = row.get("instance") if isinstance(row.get("instance"), dict) else {}
            name = str(inst.get("instanceName") or inst.get("name") or "").strip()
        if not name:
            continue
        key = name.lower()
        proxy_obj = row.get("Proxy")
        out[key] = {
            "connectionStatus": str(row.get("connectionStatus") or row.get("status") or "?").lower(),
            "proxy_embedded": proxy_obj,
            "ownerJid": row.get("ownerJid"),
            "disconnectionReasonCode": row.get("disconnectionReasonCode"),
        }
    return out


def fetch_proxy_find(base: str, api_key: str, instance_name: str) -> dict | None:
    enc = urllib.parse.quote(instance_name)
    http, data = curl_json(f"{base}/proxy/find/{enc}", api_key)
    if http == 200 and isinstance(data, dict) and data.get("host"):
        return {
            "enabled": data.get("enabled"),
            "host": data.get("host"),
            "port": str(data.get("port", "")),
            "protocol": data.get("protocol"),
            "username": data.get("username"),
            "has_password": bool(data.get("password")),
        }
    return None


def classify_risk(row: dict) -> str:
    state = row.get("connection_state", "?")
    proxy = row.get("proxy_effective")
    outbound = row.get("outbound_ip_test") or {}
    geo = outbound.get("geo") or {}

    if not proxy:
        if state in OPEN:
            return "ALTO — open sem proxy (IP servidor direto)"
        return "MÉDIO — sem proxy"

    if not outbound.get("ok"):
        return "ALTO — proxy configurado mas IP não responde"

    country = (geo.get("country") or "").lower()
    if country and country not in BR_COUNTRY:
        return f"ALTO — IP fora do Brasil ({geo.get('country')})"

    if state in OPEN:
        return "OK — open com proxy BR"
    if state in TRANS:
        return "MÉDIO — connecting com proxy"
    return "BAIXO — close/offline"


def diagnose_instance(
    row: dict,
    lista: dict[str, dict],
    server_ip_cache: dict[str, dict],
) -> dict:
    base = norm_base(row["api_url"])
    name = row["instance_name"]
    key = name.strip().lower()

    result: dict = {
        "instance_name": name,
        "organization_id": row.get("organization_id"),
        "phone_number": row.get("phone_number"),
        "db_is_connected": row.get("is_connected"),
        "api_url": row.get("api_url"),
        "crm_proxy": {
            "host": row.get("proxy_host"),
            "port": row.get("proxy_port"),
            "protocol": row.get("proxy_protocol"),
            "username": row.get("proxy_username"),
            "has_password": bool(row.get("proxy_password")),
        },
    }

    if not base or not row.get("api_key"):
        result.update(
            {
                "erro": "api_url ou api_key inválidos",
                "connection_state": "?",
                "risco": "ERRO — config inválida",
            }
        )
        return result

    # connectionState
    enc = urllib.parse.quote(name)
    http_cs, body_cs = curl_json(f"{base}/instance/connectionState/{enc}", row["api_key"])
    state = parse_connection_state(body_cs) if http_cs == 200 else "?"
    result["connection_state"] = state
    result["connection_state_http"] = http_cs

    lista_row = lista.get(key, {})
    result["fetchInstances_status"] = lista_row.get("connectionStatus", "(ausente)")
    result["owner_jid"] = lista_row.get("ownerJid")
    result["disconnection_code"] = lista_row.get("disconnectionReasonCode")

    # Proxy Evolution API
    evo_proxy = fetch_proxy_find(base, row["api_key"], name)
    result["evolution_proxy"] = evo_proxy

    # Proxy efetivo: Evolution > CRM
    effective = None
    if evo_proxy and evo_proxy.get("host"):
        effective = evo_proxy
        result["proxy_source"] = "evolution_api"
    elif row.get("proxy_host"):
        effective = {
            "host": row["proxy_host"],
            "port": row.get("proxy_port") or "",
            "protocol": row.get("proxy_protocol") or "http",
            "username": row.get("proxy_username"),
            "has_password": bool(row.get("proxy_password")),
            "enabled": True,
        }
        result["proxy_source"] = "crm_db"
    else:
        result["proxy_source"] = "nenhum"

    result["proxy_effective"] = effective

    # CRM vs Evolution proxy mismatch
    crm_host = (row.get("proxy_host") or "").strip()
    evo_host = (evo_proxy or {}).get("host") or ""
    if crm_host and evo_host and crm_host != evo_host:
        result["proxy_mismatch"] = True
    elif crm_host and not evo_host:
        result["proxy_mismatch"] = "crm_tem_evo_nao"
    elif not crm_host and evo_host:
        result["proxy_mismatch"] = "evo_tem_crm_nao"
    else:
        result["proxy_mismatch"] = False

    # IP servidor Evolution
    server_key = base
    if server_key not in server_ip_cache:
        # tenta obter IP do host da API
        host = urllib.parse.urlparse(base).hostname or ""
        try:
            proc = subprocess.run(
                ["curl", "-sS", "-m", "12", f"https://{host}"],
                capture_output=True,
                text=True,
            )
        except Exception:
            pass
        # IP público do servidor Evolution via DNS resolve + geo do IP do host
        try:
            proc = subprocess.run(["getent", "hosts", host], capture_output=True, text=True, timeout=5)
            resolved = proc.stdout.split()[0] if proc.returncode == 0 and proc.stdout else None
        except Exception:
            resolved = None
        server_ip_cache[server_key] = {
            "host": host,
            "resolved_ip": resolved,
            "geo": geo_ip(resolved) if resolved else {"ok": False},
            "nota": "IP do host da Evolution API (sem proxy). Helsinki/Europa = aviso no WhatsApp.",
        }
    result["server_evolution"] = server_ip_cache[server_key]

    # Teste outbound via proxy
    if effective and effective.get("host") and effective.get("port"):
        pwd = row.get("proxy_password") if result["proxy_source"] == "crm_db" else None
        if result["proxy_source"] == "evolution_api" and evo_proxy:
            # buscar senha completa só na Evolution (já veio no find)
            http_pf, data_pf = curl_json(f"{base}/proxy/find/{enc}", row["api_key"])
            pwd = data_pf.get("password") if isinstance(data_pf, dict) else None
            user = data_pf.get("username") if isinstance(data_pf, dict) else effective.get("username")
        else:
            user = effective.get("username")

        outbound = test_proxy_outbound(
            host=str(effective["host"]),
            port=str(effective["port"]),
            protocol=str(effective.get("protocol") or "http"),
            username=user,
            password=pwd,
        )
        result["outbound_ip_test"] = outbound
        result["ip_conectado"] = outbound.get("ip") if outbound.get("ok") else None
        result["localizacao_ip"] = outbound.get("geo") if outbound.get("ok") else None
    else:
        result["outbound_ip_test"] = {"ok": False, "motivo": "sem_proxy_configurado"}
        result["ip_conectado"] = server_ip_cache[server_key].get("resolved_ip")
        result["localizacao_ip"] = server_ip_cache[server_key].get("geo")
        result["ip_origem"] = "servidor_evolution_direto"

    result["risco"] = classify_risk(result)
    result["envio_seguro"] = state in OPEN and (
        not effective or (result.get("outbound_ip_test") or {}).get("ok")
    )
    return result


def render_markdown(summary: dict) -> str:
    lines = [
        "# Diagnóstico Evolution — Instâncias × IP de Conexão",
        "",
        f"**Gerado em:** {summary['gerado_em']}",
        f"**Total instâncias:** {summary['total']}",
        f"**Open (connectionState):** {summary['por_status'].get('open', 0)}",
        f"**Com proxy:** {summary['com_proxy']}",
        f"**Sem proxy:** {summary['sem_proxy']}",
        f"**IP fora do Brasil:** {summary['ip_fora_br']}",
        f"**Proxy com falha de teste:** {summary['proxy_falha']}",
        "",
        "## Resumo por risco",
        "",
        "| Risco | Qtd |",
        "|-------|-----|",
    ]
    for risco, qtd in sorted(summary["por_risco"].items(), key=lambda x: -x[1]):
        lines.append(f"| {risco} | {qtd} |")

    lines += ["", "## Por servidor Evolution", ""]
    for srv, info in summary["por_servidor"].items():
        lines.append(f"- **{srv}**: {info['total']} chips | open={info['open']} | com_proxy={info['com_proxy']}")

    lines += [
        "",
        "## Tabela completa",
        "",
        "| Chip | Status | Proxy | IP saída | Localização | Risco |",
        "|------|--------|-------|----------|-------------|-------|",
    ]
    for r in summary["instancias"]:
        proxy = "—"
        if r.get("proxy_effective"):
            p = r["proxy_effective"]
            proxy = f"`{p.get('host')}:{p.get('port')}`"
        ip = r.get("ip_conectado") or "—"
        loc = "—"
        geo = r.get("localizacao_ip") or {}
        if geo.get("ok"):
            loc = f"{geo.get('city', '?')}, {geo.get('country', '?')}"
        lines.append(
            f"| {r['instance_name']} | {r.get('connection_state', '?')} | {proxy} | {ip} | {loc} | {r.get('risco', '?')} |"
        )

    lines += ["", "---", "*Somente leitura. Fonte: Supabase evolution_config + Evolution API ao vivo.*"]
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description="Diagnóstico Evolution: instâncias × IP/proxy")
    parser.add_argument("--org", help="Filtrar por organization_id")
    parser.add_argument("--limit", type=int, default=0, help="Limitar quantidade")
    parser.add_argument("--json", action="store_true", help="Saída JSON no stdout")
    parser.add_argument("--save", action="store_true", help="Salvar em test-results/")
    parser.add_argument("--workers", type=int, default=8)
    args = parser.parse_args()

    key = load_service_role_key()
    path = (
        "/evolution_config?select=id,instance_name,organization_id,phone_number,is_connected,"
        "api_url,api_key,proxy_host,proxy_port,proxy_protocol,proxy_username,proxy_password"
        "&order=instance_name"
    )
    if args.org:
        path += f"&organization_id=eq.{args.org}"
    if args.limit > 0:
        path += f"&limit={args.limit}"

    rows = rest_get(path, key)
    if not rows:
        print("Nenhuma instância encontrada.", file=sys.stderr)
        return 1

    # Filtrar URLs inválidas
    valid_rows = [r for r in rows if norm_base(r.get("api_url", "")) and r.get("api_key")]
    skipped = len(rows) - len(valid_rows)

    # Agrupar fetchInstances por servidor
    servers: dict[str, tuple[str, str]] = {}
    for r in valid_rows:
        base = norm_base(r["api_url"])
        if base:
            servers[base] = (base, r["api_key"])

    lista_maps: dict[str, dict[str, dict]] = {}
    for base, api_key in servers.values():
        lista_maps[base] = fetch_instances_full(base, api_key)

    server_ip_cache: dict[str, dict] = {}
    diag_runner_ip = get_server_direct_ip()

    results: list[dict] = []
    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        futs = []
        for r in valid_rows:
            base = norm_base(r["api_url"])
            lista = lista_maps.get(base or "", {})
            futs.append(pool.submit(diagnose_instance, r, lista, server_ip_cache))
        for fut in as_completed(futs):
            results.append(fut.result())

    results.sort(key=lambda x: (x.get("organization_id") or "", x.get("instance_name") or ""))

    por_status = Counter(r.get("connection_state", "?") for r in results)
    por_risco = Counter(r.get("risco", "?") for r in results)
    com_proxy = sum(1 for r in results if r.get("proxy_effective"))
    sem_proxy = len(results) - com_proxy
    ip_fora_br = sum(
        1
        for r in results
        if (r.get("localizacao_ip") or {}).get("ok")
        and (r.get("localizacao_ip") or {}).get("country", "").lower() not in BR_COUNTRY
    )
    proxy_falha = sum(
        1 for r in results if r.get("proxy_effective") and not (r.get("outbound_ip_test") or {}).get("ok")
    )

    por_servidor: dict[str, dict] = defaultdict(lambda: {"total": 0, "open": 0, "com_proxy": 0})
    for r in results:
        host = urllib.parse.urlparse(r.get("api_url", "")).netloc or "?"
        por_servidor[host]["total"] += 1
        if r.get("connection_state") in OPEN:
            por_servidor[host]["open"] += 1
        if r.get("proxy_effective"):
            por_servidor[host]["com_proxy"] += 1

    summary = {
        "gerado_em": datetime.now(timezone.utc).isoformat(),
        "org_filtro": args.org,
        "total": len(results),
        "ignoradas_url_invalida": skipped,
        "por_status": dict(por_status),
        "por_risco": dict(por_risco),
        "com_proxy": com_proxy,
        "sem_proxy": sem_proxy,
        "ip_fora_br": ip_fora_br,
        "proxy_falha": proxy_falha,
        "ip_maquina_diagnostico": diag_runner_ip,
        "por_servidor": dict(por_servidor),
        "instancias": results,
    }

    if args.json:
        print(json.dumps(summary, indent=2, ensure_ascii=False))
    else:
        print(render_markdown(summary))

    if args.save or not args.json:
        os.makedirs(OUT_DIR, exist_ok=True)
        ts = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
        json_path = os.path.join(OUT_DIR, f"diagnostico-evolution-proxy-ip-{ts}.json")
        md_path = os.path.join(OUT_DIR, f"diagnostico-evolution-proxy-ip-{ts}.md")
        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(summary, f, indent=2, ensure_ascii=False)
        with open(md_path, "w", encoding="utf-8") as f:
            f.write(render_markdown(summary))
        if not args.json:
            print(f"\n📁 Relatórios salvos:\n  - {json_path}\n  - {md_path}", file=sys.stderr)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
