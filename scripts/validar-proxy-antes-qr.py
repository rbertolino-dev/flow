#!/usr/bin/env python3
"""
Checklist rápido (~2 min): validar proxy ANTES de conectar o QR na Evolution.

Uso:
  ./scripts/validar-proxy-antes-qr.py \\
    --host 104.165.142.91 --port 6724 --user USER --pass SENHA

  ./scripts/validar-proxy-antes-qr.py \\
    --proxy http://USER:SENHA@104.165.142.91:6724

  # Só analisar um IP de saída já conhecido:
  ./scripts/validar-proxy-antes-qr.py --ip 104.165.142.91

Critérios (pass/fail):
  1) Proxy responde e devolve IP público
  2) Geo comercial = Brasil (ip-api / ipinfo)
  3) WHOIS do bloco NÃO em US/CA (evita aviso "Califórnia" no WhatsApp)
  4) IP de saída ≠ IP do servidor Evolution (datacenter FI/Hetzner)
  5) Aviso se IP parece datacenter óbvio (Hetzner, AWS, etc.)
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
import urllib.parse
import urllib.request
from datetime import datetime, timezone

BR_COUNTRY = {"brazil", "brasil", "br"}
DATACENTER_HINTS = (
    "hetzner",
    "amazon",
    "aws",
    "google",
    "microsoft",
    "digitalocean",
    "ovh",
    "linode",
    "vultr",
    "contabo",
    "cloudflare",
)


def http_json(url: str, timeout: int = 12) -> dict:
    req = urllib.request.Request(url, headers={"User-Agent": "validar-proxy-antes-qr/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read().decode())
    except Exception as exc:
        return {"_error": str(exc)[:160]}


def parse_proxy_url(url: str) -> dict:
    u = urllib.parse.urlparse(url)
    if not u.hostname or not u.port:
        raise SystemExit("URL de proxy inválida. Ex.: http://user:pass@host:porta")
    return {
        "protocol": (u.scheme or "http").lower(),
        "host": u.hostname,
        "port": str(u.port),
        "username": urllib.parse.unquote(u.username) if u.username else None,
        "password": urllib.parse.unquote(u.password) if u.password else None,
    }


def test_outbound(host: str, port: str, protocol: str, username: str | None, password: str | None) -> dict:
    proto = (protocol or "http").lower().replace("socks", "socks5")
    if proto not in ("http", "https", "socks4", "socks5"):
        proto = "http"

    auth = ""
    if username:
        auth = f"{urllib.parse.quote(username, safe='')}:{urllib.parse.quote(password or '', safe='')}@"

    proxy_url = f"{proto}://{auth}{host}:{port}"
    if proto.startswith("socks"):
        cmd = ["curl", "-sS", "-m", "18", "--proxy", proxy_url, "https://api.ipify.org"]
    else:
        cmd = ["curl", "-sS", "-m", "18", "-x", proxy_url, "https://api.ipify.org"]

    proc = subprocess.run(cmd, capture_output=True, text=True)
    out = (proc.stdout or "").strip()
    if proc.returncode == 0 and out and "." in out and len(out) < 45:
        return {"ok": True, "ip": out, "proxy_masked": f"{proto}://{host}:{port}"}
    err = (proc.stderr or proc.stdout or "falha").strip()[:220]
    return {"ok": False, "error": err, "proxy_masked": f"{proto}://{host}:{port}"}


def geo_ipapi(ip: str) -> dict:
    data = http_json(
        f"http://ip-api.com/json/{urllib.parse.quote(ip)}"
        "?fields=status,message,country,countryCode,regionName,city,isp,org,as,query,proxy,hosting"
    )
    if data.get("status") != "success":
        return {"ok": False, "source": "ip-api", "error": data.get("message") or data.get("_error")}
    return {
        "ok": True,
        "source": "ip-api",
        "country": data.get("country"),
        "country_code": data.get("countryCode"),
        "region": data.get("regionName"),
        "city": data.get("city"),
        "isp": data.get("isp"),
        "org": data.get("org"),
        "as": data.get("as"),
        "hosting_flag": bool(data.get("hosting") or data.get("proxy")),
    }


def geo_ipinfo(ip: str) -> dict:
    data = http_json(f"https://ipinfo.io/{urllib.parse.quote(ip)}/json")
    if data.get("_error") or not data.get("ip"):
        return {"ok": False, "source": "ipinfo", "error": data.get("_error") or "sem dados"}
    country = data.get("country")
    return {
        "ok": True,
        "source": "ipinfo",
        "country": country,
        "country_code": country,
        "region": data.get("region"),
        "city": data.get("city"),
        "org": data.get("org"),
        "hostname": data.get("hostname"),
    }


def whois_summary(ip: str) -> dict:
    try:
        proc = subprocess.run(["whois", ip], capture_output=True, text=True, timeout=20)
    except Exception as exc:
        return {"ok": False, "error": str(exc)[:120]}

    text = proc.stdout or ""
    if proc.returncode != 0 and not text.strip():
        return {"ok": False, "error": (proc.stderr or "whois falhou")[:160]}

    fields: dict[str, str] = {}
    for line in text.splitlines():
        if ":" not in line:
            continue
        key, val = line.split(":", 1)
        key_l = key.strip().lower()
        val = val.strip()
        if not val:
            continue
        if key_l in ("orgname", "org-name", "organization", "org"):
            fields.setdefault("org", val)
        elif key_l in ("netname",):
            fields.setdefault("netname", val)
        elif key_l in ("country",):
            fields.setdefault("country", val)
        elif key_l in ("city",):
            fields.setdefault("city", val)
        elif key_l in ("stateprov", "state", "state/province"):
            fields.setdefault("state", val)
        elif key_l in ("address",) and "address" not in fields:
            fields["address"] = val

    country = (fields.get("country") or "").strip().upper()
    state = (fields.get("state") or "").strip().upper()
    city = (fields.get("city") or "").strip().lower()
    address = (fields.get("address") or "").strip().lower()

    # Só campos estruturados (evitar falso positivo: "us" dentro de "users"/RIPE)
    looks_us = country in ("US", "USA", "UNITED STATES")
    looks_ca_state = state in ("CA", "CALIFORNIA")
    looks_california = looks_ca_state or "santa clara" in city or "santa clara" in address
    looks_us_or_ca = looks_us or looks_california
    return {
        "ok": True,
        "org": fields.get("org"),
        "netname": fields.get("netname"),
        "country": fields.get("country"),
        "state": fields.get("state"),
        "city": fields.get("city"),
        "address": fields.get("address"),
        "looks_us_or_ca": looks_us_or_ca,
        "looks_california": looks_california,
    }


def looks_datacenter(geo_parts: list[dict], whois: dict) -> bool:
    blob = " ".join(
        str(x.get(k) or "")
        for x in geo_parts
        for k in ("isp", "org", "as", "hostname")
    ).lower()
    blob += " " + " ".join(str(whois.get(k) or "") for k in ("org", "netname")).lower()
    if any(h in blob for h in DATACENTER_HINTS):
        return True
    for g in geo_parts:
        if g.get("hosting_flag"):
            return True
    return False


def is_br(geo: dict) -> bool:
    code = (geo.get("country_code") or "").lower()
    name = (geo.get("country") or "").lower()
    return code in BR_COUNTRY or name in BR_COUNTRY or code == "br"


def verdict(report: dict) -> tuple[str, list[str], list[str]]:
    """Retorna (APROVADO|ATENÇÃO|REPROVADO, motivos_ok, motivos_risco)."""
    ok: list[str] = []
    risco: list[str] = []

    outbound = report.get("outbound") or {}
    if not outbound.get("ok"):
        return "REPROVADO", ok, [f"Proxy não responde: {outbound.get('error')}"]

    ok.append(f"Proxy OK — IP de saída {outbound['ip']}")

    geos = [g for g in report.get("geos") or [] if g.get("ok")]
    if not geos:
        risco.append("Não foi possível geolocalizar o IP (checkers)")
    else:
        br_count = sum(1 for g in geos if is_br(g))
        if br_count == len(geos):
            cities = ", ".join(f"{g.get('city') or '?'} ({g['source']})" for g in geos)
            ok.append(f"Geo comercial = Brasil ({cities})")
        elif br_count > 0:
            risco.append("Geo comercial divergente entre checkers (nem todos dizem BR)")
        else:
            risco.append("Geo comercial NÃO é Brasil — WhatsApp pode alertar país errado")

    whois = report.get("whois") or {}
    if whois.get("ok"):
        loc = ", ".join(
            filter(
                None,
                [
                    whois.get("city"),
                    whois.get("state"),
                    whois.get("country"),
                    whois.get("org"),
                ],
            )
        )
        if whois.get("looks_california") or whois.get("looks_us_or_ca"):
            risco.append(
                f"WHOIS parece EUA/Califórnia ({loc or 'ver detalhes'}) — "
                "WhatsApp costuma mostrar Califórnia mesmo se checkers dizem BR"
            )
        else:
            ok.append(f"WHOIS sem marca US/CA óbvia ({loc or 'ok'})")
    else:
        risco.append(f"WHOIS indisponível: {whois.get('error')}")

    if report.get("is_datacenter"):
        risco.append("IP parece datacenter/cloud — alto risco no WhatsApp")

    server = report.get("compare_server_ip")
    if server and outbound.get("ip") and server == outbound.get("ip"):
        risco.append("IP de saída = IP do servidor Evolution (proxy NÃO está mascarando)")

    if any("WHOIS" in r or "NÃO é Brasil" in r or "datacenter" in r.lower() or "não responde" in r.lower() for r in risco):
        # WHOIS CA ou geo fora do BR = reprovado para QR "limpo"
        hard = [
            r
            for r in risco
            if "WHOIS" in r or "NÃO é Brasil" in r or "datacenter" in r.lower() or "não está mascarando" in r
        ]
        if hard and (whois.get("looks_california") or whois.get("looks_us_or_ca") or report.get("is_datacenter") or not any(is_br(g) for g in geos)):
            return "REPROVADO", ok, risco
        return "ATENÇÃO", ok, risco

    if risco:
        return "ATENÇÃO", ok, risco
    return "APROVADO", ok, risco


def print_report(report: dict) -> int:
    status, oks, riscos = verdict(report)
    colors = {
        "APROVADO": "\033[92m",
        "ATENÇÃO": "\033[93m",
        "REPROVADO": "\033[91m",
    }
    reset = "\033[0m"
    color = colors.get(status, "")

    print()
    print("=" * 64)
    print("  VALIDAÇÃO DE PROXY — antes de escanear o QR")
    print(f"  {report.get('gerado_em')}")
    print("=" * 64)

    if report.get("proxy_masked"):
        print(f"\nProxy testado: {report['proxy_masked']}")
    if (report.get("outbound") or {}).get("ip"):
        print(f"IP de saída:  {report['outbound']['ip']}")

    print("\n--- Geolocalização (checkers) ---")
    for g in report.get("geos") or []:
        if not g.get("ok"):
            print(f"  [{g.get('source')}] ERRO: {g.get('error')}")
            continue
        print(
            f"  [{g['source']}] {g.get('city')}, {g.get('region')}, "
            f"{g.get('country') or g.get('country_code')} | {g.get('isp') or g.get('org')}"
        )

    print("\n--- WHOIS (cadastro do bloco — o que o WhatsApp costuma 'parecer') ---")
    w = report.get("whois") or {}
    if w.get("ok"):
        for k in ("org", "netname", "address", "city", "state", "country"):
            if w.get(k):
                print(f"  {k}: {w[k]}")
        print(f"  risco_california_us: {w.get('looks_us_or_ca') or w.get('looks_california')}")
    else:
        print(f"  ERRO: {w.get('error')}")

    print("\n--- Checklist ---")
    for line in oks:
        print(f"  ✅ {line}")
    for line in riscos:
        print(f"  ⚠️  {line}")

    print(f"\n{color}>>> VEREDITO: {status}{reset}")
    if status == "APROVADO":
        print(
            "\nPode conectar:\n"
            "  1) Configure o proxy na Evolution (enabled=true)\n"
            "  2) Só então gere/escaneie o QR\n"
            "  3) Não mude o proxy depois sem reconectar"
        )
        code = 0
    elif status == "ATENÇÃO":
        print(
            "\nPode funcionar, mas há risco de aviso no WhatsApp.\n"
            "Prefira outro proxy se o objetivo for localização BR limpa."
        )
        code = 2
    else:
        print(
            "\nNÃO recomendo conectar o QR com este proxy agora.\n"
            "Troque por ISP/residencial/móvel BR com WHOIS também BR\n"
            "(1 IP dedicado por chip, sticky)."
        )
        code = 1

    print()
    return code


def main() -> int:
    parser = argparse.ArgumentParser(description="Validar proxy antes do QR (WhatsApp/Evolution)")
    parser.add_argument("--proxy", help="URL completa http://user:pass@host:port")
    parser.add_argument("--host")
    parser.add_argument("--port")
    parser.add_argument("--user")
    parser.add_argument("--pass", dest="password")
    parser.add_argument("--protocol", default="http", help="http|socks5 (default http)")
    parser.add_argument("--ip", help="Pular teste de proxy; analisar só este IP")
    parser.add_argument("--compare-server-ip", help="IP do servidor Evolution (ex.: 65.109.132.220)")
    parser.add_argument("--json", action="store_true", help="Saída JSON")
    parser.add_argument("--save", help="Salvar JSON neste caminho")
    args = parser.parse_args()

    host = port = username = password = protocol = None
    if args.proxy:
        p = parse_proxy_url(args.proxy)
        host, port = p["host"], p["port"]
        username, password, protocol = p["username"], p["password"], p["protocol"]
    elif args.host and args.port:
        host, port = args.host, str(args.port)
        username, password = args.user, args.password
        protocol = args.protocol
    elif not args.ip:
        parser.error("Informe --proxy OU (--host e --port) OU --ip")

    report: dict = {
        "gerado_em": datetime.now(timezone.utc).isoformat(),
        "compare_server_ip": args.compare_server_ip,
    }

    if args.ip:
        outbound = {"ok": True, "ip": args.ip, "proxy_masked": "(análise só do IP)"}
        report["proxy_masked"] = outbound["proxy_masked"]
    else:
        assert host and port
        outbound = test_outbound(host, port, protocol or "http", username, password)
        report["proxy_masked"] = outbound.get("proxy_masked")

    report["outbound"] = outbound

    if outbound.get("ok") and outbound.get("ip"):
        ip = outbound["ip"]
        geos = [geo_ipapi(ip), geo_ipinfo(ip)]
        whois = whois_summary(ip)
        report["geos"] = geos
        report["whois"] = whois
        report["is_datacenter"] = looks_datacenter([g for g in geos if g.get("ok")], whois if whois.get("ok") else {})
    else:
        report["geos"] = []
        report["whois"] = {"ok": False, "error": "sem IP para analisar"}
        report["is_datacenter"] = False

    status, oks, riscos = verdict(report)
    report["veredito"] = status
    report["checklist_ok"] = oks
    report["checklist_risco"] = riscos

    if args.save:
        with open(args.save, "w", encoding="utf-8") as f:
            json.dump(report, f, indent=2, ensure_ascii=False)

    if args.json:
        print(json.dumps(report, indent=2, ensure_ascii=False))
        return 0 if status == "APROVADO" else (2 if status == "ATENÇÃO" else 1)

    return print_report(report)


if __name__ == "__main__":
    raise SystemExit(main())
