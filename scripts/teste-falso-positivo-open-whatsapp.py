#!/usr/bin/env python3
"""
Teste automatizado: OPEN no painel vs validação whatsappNumbers.

Classifica cada chip:
  SAUDAVEL              — connectionState OPEN e whatsappNumbers responde OK
  FALSO_POSITIVO_OPEN   — parece OPEN, mas whatsappNumbers = Connection Closed / 428
  SESSAO_FECHADA        — não está OPEN e validação falha (esperado)
  ERRO_API              — timeout, 5xx, método indisponível, JSON inválido
  INCONCLUSIVO          — resposta ambígua

Somente leitura — não envia mensagens reais.
Números de teste são sintéticos/inválidos (não spam).

Uso:
  python3 scripts/teste-falso-positivo-open-whatsapp.py
  python3 scripts/teste-falso-positivo-open-whatsapp.py --org 8127ebc7-f911-4dcc-90d0-9d2cd851d469
  python3 scripts/teste-falso-positivo-open-whatsapp.py --chips lena --json --save
  python3 scripts/teste-falso-positivo-open-whatsapp.py --org-name pubdgital --limit 8
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
TOKEN_FILE = os.path.expanduser("~/.supabase/access-token")
OUT_DIR = os.path.join(ROOT, "test-results")

# Org "pubdgital" (typo no CRM) — onde está a instância lena
PUBDIGITAL_ORG_DEFAULT = "8127ebc7-f911-4dcc-90d0-9d2cd851d469"

INVALID_NUMBERS = ["5511999999999", "5500000000000", "123456"]
OPEN_STATES = {"open", "connected", "online", "up", "ready", "authenticated", "logged", "active"}


def log(msg: str) -> None:
    print(msg, flush=True)


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


def rest_get(path_query: str) -> list[dict]:
    ref = load_project_ref()
    key = load_service_role_key()
    url = f"https://{ref}.supabase.co/rest/v1/{path_query}"
    req = urllib.request.Request(
        url,
        headers={
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Accept": "application/json",
        },
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        data = json.loads(resp.read())
    return data if isinstance(data, list) else []


def query_sql(sql: str) -> list[dict]:
    ref = load_project_ref()
    token = open(TOKEN_FILE).read().strip()
    body = json.dumps({"query": sql}).encode()
    req = urllib.request.Request(
        f"https://api.supabase.com/v1/projects/{ref}/database/query",
        data=body,
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=90) as resp:
        data = json.loads(resp.read())
    if isinstance(data, dict) and "message" in data:
        raise RuntimeError(str(data["message"]))
    return data if isinstance(data, list) else []


def normalize_api_url(url: str) -> str:
    base = (url or "").strip().rstrip("/")
    base = base.replace("/manager", "").replace("/dashboard", "")
    # evo20/evo30 costumam redirecionar http→https; preferir https para POST não virar 308
    if base.startswith("http://") and "atendimentoagilize.com" in base:
        base = "https://" + base[len("http://") :]
    return base


def curl_request(
    url: str,
    api_key: str,
    method: str = "GET",
    body: dict | None = None,
    timeout: int = 20,
    follow: bool = True,
) -> tuple[int, str, float]:
    # -L segue redirect; --post301/--post302/--post303 mantém POST após 301/302/303
    cmd = [
        "curl",
        "-sS",
        "-m",
        str(timeout),
        "-w",
        "\n%{http_code}",
        "-H",
        f"apikey: {api_key}",
    ]
    if follow:
        cmd += ["-L", "--post301", "--post302", "--post303"]
    if method == "POST" and body is not None:
        cmd += ["-X", "POST", "-H", "Content-Type: application/json", "-d", json.dumps(body)]
    cmd.append(url)
    t0 = time.monotonic()
    proc = subprocess.run(cmd, capture_output=True, text=True)
    elapsed_ms = round((time.monotonic() - t0) * 1000)
    if proc.returncode != 0:
        return 0, (proc.stderr or proc.stdout or "curl_error")[:500], elapsed_ms
    parts = proc.stdout.rsplit("\n", 1)
    raw = parts[0] if len(parts) == 2 else proc.stdout
    http = int(parts[1].strip()) if len(parts) == 2 and parts[1].strip().isdigit() else 0
    return http, raw, elapsed_ms


def parse_connection_state(raw: str) -> str:
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return "?"
    if not isinstance(data, dict):
        return "?"
    inst = data.get("instance") if isinstance(data.get("instance"), dict) else {}
    return str(inst.get("state") or data.get("state") or "?").lower()


def is_connection_closed(http: int, raw: str) -> bool:
    lower = (raw or "").lower()
    if http == 428:
        return True
    if http == 400 and ("connection closed" in lower or "precondition required" in lower):
        return True
    return "connection closed" in lower


def is_technical_error(http: int, raw: str) -> bool:
    lower = (raw or "").lower()
    return (
        http >= 500
        or "p1001" in lower
        or "can't reach database" in lower
        or "prismaclient" in lower
        or "method not available" in lower
        or "internal server error" in lower
    )


def classify(
    conn_state: str,
    http_cs: int,
    http_wn: int,
    raw_wn: str,
    rows_count: int,
    *,
    redirect_trap: bool = False,
) -> tuple[str, str]:
    """Retorna (veredicto, explicacao)."""
    looks_open = conn_state in OPEN_STATES
    closed = is_connection_closed(http_wn, raw_wn)
    tech = is_technical_error(http_wn, raw_wn)
    timeout = http_wn == 0

    if redirect_trap:
        return (
            "RISCO_REDIRECT_HTTP",
            "api_url em http://: GET connectionState segue redirect e parece OPEN; "
            "POST whatsappNumbers pode falhar com 308 sem reenviar body — falso positivo de validação",
        )
    if timeout:
        return "ERRO_API", "Timeout ou URL inacessível no whatsappNumbers"
    if tech:
        return "ERRO_API", f"Erro técnico Evolution (http={http_wn})"
    if looks_open and closed:
        return (
            "FALSO_POSITIVO_OPEN",
            "connectionState OPEN, mas whatsappNumbers = sessão fechada — mesmo sintoma do erro da campanha (QR/sessão fantasma)",
        )
    if looks_open and http_wn == 200 and rows_count > 0:
        return "SAUDAVEL", "OPEN real: connectionState e whatsappNumbers OK"
    if looks_open and http_wn == 200 and rows_count == 0:
        return "INCONCLUSIVO", "OPEN + HTTP 200, mas whatsappNumbers sem resultados"
    if not looks_open and closed:
        return "SESSAO_FECHADA", f"Sessão realmente fechada (state={conn_state})"
    if not looks_open and http_wn == 200 and rows_count > 0:
        return (
            "INCONCLUSIVO",
            f"connectionState={conn_state} mas whatsappNumbers funcionou (cache/descompasso inverso)",
        )
    return (
        "INCONCLUSIVO",
        f"state={conn_state} http_cs={http_cs} http_wn={http_wn} rows={rows_count}",
    )


def load_chips(org_id: str, chips: list[str] | None, limit: int) -> list[dict[str, Any]]:
    if chips:
        names = ",".join(f'"{c}"' for c in chips)
        # PostgREST in.(...)
        enc_names = ",".join(urllib.parse.quote(c, safe="") for c in chips)
        rows = rest_get(
            f"evolution_config?organization_id=eq.{urllib.parse.quote(org_id)}"
            f"&instance_name=in.({enc_names})"
            "&select=id,instance_name,api_url,api_key,is_connected"
            "&order=instance_name.asc"
        )
        # fallback case-insensitive via SQL se REST não achar
        if not rows:
            safe = ",".join("'" + c.replace("'", "''") + "'" for c in chips)
            rows = query_sql(
                f"""SELECT id, instance_name, api_url, api_key, is_connected
                FROM evolution_config
                WHERE organization_id = '{org_id}'
                  AND lower(instance_name) IN ({",".join("'" + c.lower().replace("'", "''") + "'" for c in chips)})
                ORDER BY instance_name"""
            )
        return rows

    rows = rest_get(
        f"evolution_config?organization_id=eq.{urllib.parse.quote(org_id)}"
        "&select=id,instance_name,api_url,api_key,is_connected"
        "&order=is_connected.desc,instance_name.asc"
        f"&limit={limit}"
    )
    return rows


def resolve_org_id(org: str | None, org_name: str | None) -> tuple[str, str]:
    if org:
        rows = rest_get(f"organizations?id=eq.{urllib.parse.quote(org)}&select=id,name&limit=1")
        if rows:
            return str(rows[0]["id"]), str(rows[0].get("name") or org)
        return org, org
    if org_name:
        rows = query_sql(
            f"""SELECT id, name FROM organizations
            WHERE lower(name) LIKE '%{org_name.lower().replace("'", "''")}%'
            ORDER BY name LIMIT 5"""
        )
        if not rows:
            raise SystemExit(f"Nenhuma org com nome contendo '{org_name}'")
        if len(rows) > 1:
            log("Orgs encontradas:")
            for r in rows:
                log(f"  {r['id']}  {r['name']}")
        return str(rows[0]["id"]), str(rows[0]["name"])
    return PUBDIGITAL_ORG_DEFAULT, "pubdgital"


def probe_chip(row: dict[str, Any], delay: float) -> dict[str, Any]:
    name = str(row.get("instance_name") or "").strip()
    api_url_raw = str(row.get("api_url") or "").strip()
    api_url = normalize_api_url(api_url_raw)
    api_key = str(row.get("api_key") or "").strip()
    enc = urllib.parse.quote(name)

    # Trap: POST no http:// do DB SEM seguir redirect (clients que não reenviam body no 308)
    redirect_trap = False
    http_raw_base = api_url_raw.rstrip("/").replace("/manager", "").replace("/dashboard", "")
    if http_raw_base.startswith("http://"):
        if delay > 0:
            time.sleep(max(0.3, delay / 2))
        http_trap, raw_trap, _ = curl_request(
            f"{http_raw_base}/chat/whatsappNumbers/{enc}",
            api_key,
            method="POST",
            body={"numbers": [INVALID_NUMBERS[0]]},
            timeout=12,
            follow=False,
        )
        redirect_trap = http_trap in (301, 302, 307, 308) or (
            http_trap == 0 and "redirect" in (raw_trap or "").lower()
        )

    if delay > 0:
        time.sleep(delay)

    http_cs, raw_cs, ms_cs = curl_request(f"{api_url}/instance/connectionState/{enc}", api_key)
    conn_state = parse_connection_state(raw_cs)

    if delay > 0:
        time.sleep(delay)

    http_wn, raw_wn, ms_wn = curl_request(
        f"{api_url}/chat/whatsappNumbers/{enc}",
        api_key,
        method="POST",
        body={"numbers": INVALID_NUMBERS},
    )

    rows_count = 0
    exists_true = 0
    exists_false = 0
    try:
        parsed = json.loads(raw_wn) if raw_wn else None
        if isinstance(parsed, list):
            rows_count = len(parsed)
            exists_true = sum(1 for r in parsed if isinstance(r, dict) and r.get("exists") is True)
            exists_false = sum(1 for r in parsed if isinstance(r, dict) and r.get("exists") is False)
        elif isinstance(parsed, dict):
            arr = parsed.get("data") or parsed.get("results") or []
            if isinstance(arr, list):
                rows_count = len(arr)
    except json.JSONDecodeError:
        parsed = None

    # Se HTTPS (após normalizar) está saudável, o trap de redirect é aviso — não sobrescreve SAUDAVEL
    looks_open = conn_state in OPEN_STATES
    closed = is_connection_closed(http_wn, raw_wn)
    healthy_now = looks_open and http_wn == 200 and rows_count > 0 and not closed

    if redirect_trap and not healthy_now and not closed:
        verdict, explanation = classify(
            conn_state, http_cs, http_wn, raw_wn, rows_count, redirect_trap=True
        )
    else:
        verdict, explanation = classify(conn_state, http_cs, http_wn, raw_wn, rows_count)
        if redirect_trap and healthy_now:
            explanation += (
                " | AVISO: api_url no CRM ainda é http:// (308 no POST sem follow) — "
                "corrigir para https:// evita falso erro em alguns clientes"
            )

    return {
        "instance": name,
        "crm_is_connected": row.get("is_connected"),
        "api_url_db": api_url_raw,
        "api_url": api_url,
        "redirect_trap_http": redirect_trap,
        "connectionState": {
            "http": http_cs,
            "state": conn_state,
            "ms": ms_cs,
            "preview": (raw_cs or "")[:160],
        },
        "whatsappNumbers": {
            "http": http_wn,
            "ms": ms_wn,
            "rows": rows_count,
            "exists_true": exists_true,
            "exists_false": exists_false,
            "connection_closed": is_connection_closed(http_wn, raw_wn),
            "technical_error": is_technical_error(http_wn, raw_wn),
            "preview": (raw_wn or "")[:220],
        },
        "verdict": verdict,
        "explanation": explanation,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Teste OPEN vs whatsappNumbers (falso positivo)")
    parser.add_argument("--org", default=None, help="UUID da organização")
    parser.add_argument("--org-name", default=None, help="Busca org por nome (ex: pubdgital)")
    parser.add_argument("--chips", default=None, help="Lista CSV de instance_name (ex: lena)")
    parser.add_argument("--limit", type=int, default=6, help="Máx. chips se --chips não for passado")
    parser.add_argument("--delay", type=float, default=1.0, help="Pausa entre chamadas (s)")
    parser.add_argument("--json", action="store_true", help="Imprime JSON no stdout")
    parser.add_argument("--save", action="store_true", help="Salva relatório em test-results/")
    args = parser.parse_args()

    org_id, org_name = resolve_org_id(args.org, args.org_name)
    chip_list = [c.strip() for c in args.chips.split(",") if c.strip()] if args.chips else None

    # Default focado no caso do erro: lena
    if chip_list is None and args.org is None and args.org_name is None:
        chip_list = ["lena"]

    log(f"=== Teste falso positivo OPEN × whatsappNumbers ===")
    log(f"org={org_name} ({org_id})")
    log(f"chips={chip_list or f'top {args.limit}'} delay={args.delay}s")
    log("")

    try:
        rows = load_chips(org_id, chip_list, args.limit)
    except Exception as e:
        log(f"❌ Falha ao carregar chips: {e}")
        return 2

    if not rows:
        log("❌ Nenhum chip encontrado")
        return 2

    results: list[dict[str, Any]] = []
    for row in rows:
        name = str(row.get("instance_name") or "")
        log(f"→ Probe {name} ...")
        result = probe_chip(row, args.delay)
        results.append(result)
        tag = result["verdict"]
        cs = result["connectionState"]["state"]
        wn = result["whatsappNumbers"]
        log(
            f"  state={cs:12} | wn_http={wn['http']:3} closed={wn['connection_closed']} "
            f"rows={wn['rows']} | {tag}"
        )
        log(f"  {result['explanation']}")
        log("")

    counts: dict[str, int] = {}
    for r in results:
        counts[r["verdict"]] = counts.get(r["verdict"], 0) + 1

    log("--- Resumo ---")
    for k in sorted(counts):
        log(f"  {k}: {counts[k]}")

    # Interpretação para o caso da campanha
    fp = [r for r in results if r["verdict"] == "FALSO_POSITIVO_OPEN"]
    ok = [r for r in results if r["verdict"] == "SAUDAVEL"]
    closed = [r for r in results if r["verdict"] == "SESSAO_FECHADA"]
    api_err = [r for r in results if r["verdict"] == "ERRO_API"]

    log("")
    if fp:
        log(
            "DIAGNÓSTICO: FALSO POSITIVO confirmado — painel/OPEN mente; sessão WhatsApp "
            "não valida números. Reconectar QR do(s) chip(s): "
            + ", ".join(r["instance"] for r in fp)
        )
        exit_code = 1
    elif ok and not fp:
        log(
            "DIAGNÓSTICO: Chips saudáveis agora — o erro da campanha pode ter sido "
            "transitório ou já resolvido após reconexão."
        )
        exit_code = 0
    elif closed and not ok and not fp:
        log(
            "DIAGNÓSTICO: Sessão realmente fechada (não é falso positivo de OPEN). "
            "Reconecte o chip e tente a campanha de novo."
        )
        exit_code = 1
    elif api_err:
        log(
            "DIAGNÓSTICO: Problema na Evolution API (timeout/5xx/DB), não necessariamente "
            "QR. Verifique servidor Evolution."
        )
        exit_code = 1
    else:
        log("DIAGNÓSTICO: Inconclusivo — veja detalhes acima.")
        exit_code = 1

    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "organization_id": org_id,
        "organization_name": org_name,
        "counts": counts,
        "results": results,
        "exit_code": exit_code,
    }

    if args.save:
        os.makedirs(OUT_DIR, exist_ok=True)
        stamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
        path = os.path.join(OUT_DIR, f"teste-falso-positivo-open-{stamp}.json")
        with open(path, "w") as f:
            json.dump(payload, f, indent=2, ensure_ascii=False)
        log(f"\nSalvo: {path}")

    if args.json:
        print(json.dumps(payload, indent=2, ensure_ascii=False))

    return exit_code


if __name__ == "__main__":
    sys.exit(main())
