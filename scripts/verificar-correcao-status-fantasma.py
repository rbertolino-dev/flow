#!/usr/bin/env python3
"""
Verificação automatizada da correção de status fantasma (Evolution + Supabase).

Uso:
  python3 scripts/verificar-correcao-status-fantasma.py
  python3 scripts/verificar-correcao-status-fantasma.py --org 34086d07-9181-43fc-a3e8-6aa28974d68b --limit 25
  python3 scripts/verificar-correcao-status-fantasma.py --skip-webhook-mutation

Requer: ~/.supabase/access-token e supabase/.temp/project-ref
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from datetime import datetime, timezone
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from typing import Any

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REF_FILE = os.path.join(ROOT, "supabase", ".temp", "project-ref")
TOKEN_FILE = os.path.expanduser("~/.supabase/access-token")
DEFAULT_ORG = "34086d07-9181-43fc-a3e8-6aa28974d68b"
FUNCTIONS_BASE = "https://ogeljmbhqxpfjbpnbwog.supabase.co/functions/v1"

# Instâncias citadas no diagnóstico (§8)
GHOST_SAMPLE_NAMES = [
    "Ana Carolina",
    "maria alices",
    "Paula Silva",
    "Aline Santos",
    "Maria Fernanda",
    "Maria Paulas",
    "Ana Julia",
    "Clara Silva",
]


@dataclass
class CheckResult:
    name: str
    ok: bool
    detail: str


def load_project_ref() -> str:
    with open(REF_FILE) as f:
        return f.read().strip()


def load_token() -> str:
    with open(TOKEN_FILE) as f:
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
        raise RuntimeError("Não foi possível obter service_role via supabase CLI")
    for line in proc.stdout.splitlines():
        line = line.strip()
        if line.startswith("|") or not line or line.startswith("NAME") or line.startswith("---"):
            continue
        parts = [p.strip() for p in line.split("|") if p.strip()]
        if len(parts) >= 2 and parts[0] == "service_role":
            return parts[1]
    raise RuntimeError("service_role não encontrado no output do supabase CLI")


def rest_select(
    table: str,
    select: str,
    filters: dict[str, str] | None = None,
    limit: int | None = None,
) -> list[dict[str, Any]]:
    ref = load_project_ref()
    service_key = load_service_role_key()
    base = f"https://{ref}.supabase.co/rest/v1/{table}"
    params = [f"select={urllib.parse.quote(select, safe='*,()')}"]
    if filters:
        for col, val in filters.items():
            params.append(f"{col}=eq.{urllib.parse.quote(val, safe='')}")
    if limit is not None:
        params.append(f"limit={limit}")
    url = f"{base}?{'&'.join(params)}"
    req = urllib.request.Request(
        url,
        headers={
            "apikey": service_key,
            "Authorization": f"Bearer {service_key}",
            "Accept": "application/json",
        },
        method="GET",
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        data = json.loads(resp.read())
    if isinstance(data, list):
        return data
    raise RuntimeError(f"Resposta inesperada REST: {str(data)[:300]}")


def sql_escape(value: str) -> str:
    return value.replace("'", "''")


def db_query(sql: str, retries: int = 4) -> list[dict[str, Any]]:
    ref = load_project_ref()
    token = load_token()
    body = json.dumps({"query": sql}).encode()
    last_err: Exception | None = None
    for attempt in range(retries):
        try:
            req = urllib.request.Request(
                f"https://api.supabase.com/v1/projects/{ref}/database/query",
                data=body,
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json",
                },
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=120) as resp:
                data = json.loads(resp.read())
            if isinstance(data, list):
                return data
            if isinstance(data, dict) and "message" in data:
                raise RuntimeError(data.get("message", str(data)))
            return data
        except urllib.error.HTTPError as e:
            last_err = e
            if e.code in (403, 429, 502, 503) and attempt < retries - 1:
                import time

                time.sleep(1.5 * (attempt + 1))
                continue
            raise
    if last_err:
        raise last_err
    return []


def curl_json(
    method: str,
    url: str,
    headers: dict[str, str] | None = None,
    body: dict | None = None,
    timeout: int = 30,
) -> tuple[int, str, Any]:
    cmd = ["curl", "-sS", "-m", str(timeout), "-w", "\n%{http_code}", "-X", method]
    if headers:
        for k, v in headers.items():
            cmd += ["-H", f"{k}: {v}"]
    if body is not None:
        cmd += ["-H", "Content-Type: application/json", "-d", json.dumps(body)]
    cmd.append(url)
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        raise RuntimeError(proc.stderr or proc.stdout)
    parts = proc.stdout.rsplit("\n", 1)
    text = parts[0] if len(parts) == 2 else proc.stdout
    code = int(parts[1].strip()) if len(parts) == 2 and parts[1].strip().isdigit() else 0
    parsed: Any = None
    if text.strip():
        try:
            parsed = json.loads(text)
        except json.JSONDecodeError:
            parsed = text
    return code, text, parsed


def normalize_evo_base(api_url: str) -> str:
    base = api_url.rstrip("/")
    for suffix in ("/manager", "/dashboard", "/app"):
        if base.lower().endswith(suffix):
            base = base[: -len(suffix)]
    return base


def evo_fetch_status(api_url: str, api_key: str, instance_name: str) -> str:
    base = normalize_evo_base(api_url)
    code, _, data = curl_json(
        "GET",
        f"{base}/instance/fetchInstances",
        headers={"apikey": api_key},
        timeout=25,
    )
    if code != 200 or not isinstance(data, list):
        return "?"
    key = instance_name.strip().lower()
    for row in data:
        name = str(row.get("name") or (row.get("instance") or {}).get("instanceName") or "").strip()
        if name.lower() != key:
            continue
        return str(
            row.get("connectionStatus")
            or row.get("status")
            or row.get("state")
            or "?"
        )
    return "missing"


def evo_connection_state(api_url: str, api_key: str, instance_name: str) -> str:
    base = normalize_evo_base(api_url)
    enc = urllib.parse.quote(instance_name)
    code, _, data = curl_json(
        "GET",
        f"{base}/instance/connectionState/{enc}",
        headers={"apikey": api_key},
        timeout=15,
    )
    if code != 200:
        return f"http_{code}"
    if isinstance(data, dict):
        inst = data.get("instance") or {}
        return str(inst.get("state") or data.get("state") or "?")
    return "?"


def is_open_state(state: str) -> bool:
    return state.strip().lower() in (
        "open",
        "connected",
        "online",
        "up",
        "ready",
        "authenticated",
        "logged",
        "active",
    )


def test_webhook_no_secret() -> CheckResult:
    code, text, parsed = curl_json(
        "POST",
        f"{FUNCTIONS_BASE}/evolution-webhook",
        body={
            "event": "connection.update",
            "instance": "TestInstance",
            "data": {"instance": "TestInstance", "state": "connecting"},
        },
    )
    if code == 401:
        err = (parsed or {}).get("error", "") if isinstance(parsed, dict) else ""
        if "secret" in str(err).lower() or "Missing webhook" in str(err):
            return CheckResult("webhook_sem_secret", True, "HTTP 401 Missing webhook secret (payload aceito)")
    if code == 400 and "Invalid payload" in text and "remoteJid" in text:
        return CheckResult(
            "webhook_sem_secret",
            False,
            "HTTP 400 ainda exige remoteJid — deploy/schema antigo",
        )
    return CheckResult("webhook_sem_secret", False, f"HTTP {code}: {text[:200]}")


def test_webhook_connecting_updates_db(instance_name: str, api_key: str) -> list[CheckResult]:
    results: list[CheckResult] = []
    rows = rest_select(
        "evolution_config",
        "instance_name,is_connected",
        {"instance_name": instance_name},
        limit=1,
    )
    before = rows[0]["is_connected"] is True if rows else None

    secret_url = urllib.parse.quote(api_key, safe="")
    payload = {
        "event": "connection.update",
        "instance": instance_name,
        "data": {
            "instance": instance_name,
            "state": "connecting",
            "statusReason": 200,
        },
    }
    code, text, parsed = curl_json(
        "POST",
        f"{FUNCTIONS_BASE}/evolution-webhook?secret={secret_url}",
        body=payload,
    )
    if code != 200:
        results.append(
            CheckResult("webhook_connecting_http", False, f"HTTP {code}: {text[:300]}")
        )
        return results
    if isinstance(parsed, dict) and parsed.get("success") is False:
        results.append(
            CheckResult("webhook_connecting_http", False, json.dumps(parsed)[:300])
        )
        return results
    if "Invalid payload" in text or "remoteJid" in text:
        results.append(
            CheckResult(
                "webhook_connecting_http",
                False,
                "Resposta ainda valida como mensagem (remoteJid)",
            )
        )
        return results
    results.append(CheckResult("webhook_connecting_http", True, "HTTP 200 success"))

    rows2 = rest_select(
        "evolution_config",
        "instance_name,is_connected",
        {"instance_name": instance_name},
        limit=1,
    )
    after = rows2[0]["is_connected"] is True if rows2 else None
    if after is False:
        results.append(
            CheckResult(
                "webhook_connecting_db",
                True,
                f"is_connected false no DB (antes={before})",
            )
        )
    else:
        results.append(
            CheckResult(
                "webhook_connecting_db",
                False,
                f"is_connected ainda true no DB (antes={before}, depois={after})",
            )
        )

    # Restaurar open se estava conectada antes (evita deixar produção alterada)
    if before is True:
        curl_json(
            "POST",
            f"{FUNCTIONS_BASE}/evolution-webhook?secret={secret_url}",
            body={
                "event": "connection.update",
                "instance": instance_name,
                "data": {"instance": instance_name, "state": "open"},
            },
        )
        results.append(
            CheckResult("webhook_restore_open", True, "Estado open reenviado para restaurar CRM")
        )
    return results


def persist_live_from_state(state: str) -> bool | None:
    v = state.strip().lower()
    if v in ("open", "connected", "online", "up", "ready", "authenticated", "logged", "active"):
        return True
    if v in (
        "connecting",
        "close",
        "closed",
        "disconnected",
        "offline",
        "down",
        "pairing",
        "qr",
        "waiting",
        "timeout",
        "syncing",
        "loading",
    ):
        return False
    return None


def rest_patch_is_connected(instance_name: str, is_connected: bool) -> None:
    ref = load_project_ref()
    service_key = load_service_role_key()
    enc_name = urllib.parse.quote(instance_name, safe="")
    url = (
        f"https://{ref}.supabase.co/rest/v1/evolution_config"
        f"?instance_name=eq.{enc_name}"
    )
    body = json.dumps(
        {
            "is_connected": is_connected,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
    ).encode()
    req = urllib.request.Request(
        url,
        data=body,
        headers={
            "apikey": service_key,
            "Authorization": f"Bearer {service_key}",
            "Content-Type": "application/json",
            "Prefer": "return=minimal",
        },
        method="PATCH",
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        if resp.status not in (200, 204):
            raise RuntimeError(f"PATCH falhou HTTP {resp.status}")


def fix_stale_db_from_connection_state(org_id: str, limit: int) -> CheckResult:
    rows = rest_select(
        "evolution_config",
        "instance_name,is_connected,api_url,api_key",
        {"organization_id": org_id},
        limit=int(limit),
    )
    updated = 0
    for r in rows:
        name = r["instance_name"]
        real_st = evo_connection_state(r["api_url"], r["api_key"], name)
        live = persist_live_from_state(real_st)
        if live is None:
            continue
        db_conn = r["is_connected"] is True
        if db_conn != live:
            rest_patch_is_connected(name, live)
            updated += 1
    return CheckResult(
        "corrigir_db_connection_state",
        True,
        f"{updated} registro(s) atualizado(s) via REST (connectionState)",
    )


def scan_ghosts(org_id: str, limit: int) -> tuple[list[CheckResult], dict[str, int]]:
    rows = rest_select(
        "evolution_config",
        "instance_name,is_connected,api_url,api_key",
        {"organization_id": org_id},
        limit=int(limit),
    )
    rows.sort(key=lambda x: (not x.get("is_connected"), x.get("instance_name") or ""))
    fetch_cache: dict[str, list] = {}
    stats = {
        "total": 0,
        "ghosts_evo": 0,
        "db_stale_connected": 0,
        "aligned": 0,
    }
    line_results: list[CheckResult] = []

    for r in rows:
        stats["total"] += 1
        name = r["instance_name"]
        api_url = r["api_url"]
        api_key = r["api_key"]
        db_conn = r["is_connected"] is True

        cache_key = f"{api_url}|||{api_key}"
        if cache_key not in fetch_cache:
            base = normalize_evo_base(api_url)
            code, _, data = curl_json(
                "GET",
                f"{base}/instance/fetchInstances",
                headers={"apikey": api_key},
                timeout=30,
            )
            fetch_cache[cache_key] = data if code == 200 and isinstance(data, list) else []

        fetch_st = evo_fetch_status(api_url, api_key, name)
        real_st = evo_connection_state(api_url, api_key, name)

        fetch_open = is_open_state(fetch_st)
        real_open = is_open_state(real_st)
        is_ghost = fetch_open and not real_open

        if is_ghost:
            stats["ghosts_evo"] += 1
        if is_ghost and db_conn:
            stats["db_stale_connected"] += 1
        if (db_conn and real_open) or ((not db_conn) and (not real_open or is_ghost)):
            stats["aligned"] += 1

    # Resumo por amostra do diagnóstico
    for sample in GHOST_SAMPLE_NAMES:
        match = next((x for x in rows if x["instance_name"] == sample), None)
        if not match:
            continue
        fetch_st = evo_fetch_status(match["api_url"], match["api_key"], sample)
        real_st = evo_connection_state(match["api_url"], match["api_key"], sample)
        db_conn = match["is_connected"] is True
        ghost = is_open_state(fetch_st) and not is_open_state(real_st)
        ok_db = not ghost or not db_conn
        line_results.append(
            CheckResult(
                f"amostra:{sample[:20]}",
                ok_db,
                f"fetch={fetch_st} real={real_st} db_connected={db_conn}"
                + (" FANTASMA+DB_STALE" if ghost and db_conn else ""),
            )
        )

    summary = CheckResult(
        "scan_resumo",
        stats["db_stale_connected"] == 0,
        (
            f"total={stats['total']} fantasmas_evo={stats['ghosts_evo']} "
            f"db_ainda_conectado_fantasma={stats['db_stale_connected']} "
            "(>0 => rodar sync no Disparador 2 ou aguardar webhooks)"
        ),
    )
    line_results.append(summary)
    return line_results, stats


def main() -> int:
    parser = argparse.ArgumentParser(description="Verifica correção status fantasma Evolution")
    parser.add_argument("--org", default=DEFAULT_ORG, help="organization_id UUID")
    parser.add_argument("--limit", type=int, default=30, help="Máx instâncias no scan")
    parser.add_argument(
        "--webhook-instance",
        default="Aline Santos",
        help="Instância para teste mutável do webhook",
    )
    parser.add_argument(
        "--skip-webhook-mutation",
        action="store_true",
        help="Não altera is_connected no DB (só teste 401)",
    )
    parser.add_argument(
        "--corrigir-db",
        action="store_true",
        help="Após scan, alinha is_connected no DB com connectionState (como sync em lote)",
    )
    args = parser.parse_args()

    print("=" * 60)
    print("Verificação: status fantasma Evolution + Supabase")
    print(f"Projeto: {load_project_ref()} | Org: {args.org}")
    print("=" * 60)

    all_checks: list[CheckResult] = []
    stats: dict[str, int] = {}

    print("\n[1/3] Webhook — payload connection.update")
    all_checks.append(test_webhook_no_secret())
    if not args.skip_webhook_mutation:
        try:
            key_rows = rest_select(
                "evolution_config",
                "instance_name,api_key",
                {"instance_name": args.webhook_instance},
                limit=1,
            )
            if not key_rows or not key_rows[0].get("api_key"):
                all_checks.append(
                    CheckResult(
                        "webhook_connecting",
                        False,
                        f"Instância {args.webhook_instance} não encontrada",
                    )
                )
            else:
                all_checks.extend(
                    test_webhook_connecting_updates_db(
                        args.webhook_instance, key_rows[0]["api_key"]
                    )
                )
        except Exception as e:
            all_checks.append(CheckResult("webhook_connecting", False, str(e)))
    else:
        print("  (mutação webhook ignorada — --skip-webhook-mutation)")

    print("\n[2/3] Scan Evolution fetchInstances vs connectionState vs DB")
    try:
        scan_lines, stats = scan_ghosts(args.org, args.limit)
        all_checks.extend(scan_lines)
    except Exception as e:
        all_checks.append(CheckResult("scan_ghosts", False, str(e)))

    if args.corrigir_db and stats.get("db_stale_connected", 0) > 0:
        print("\n[2b] Corrigindo DB stale (connectionState → is_connected)")
        try:
            all_checks.append(fix_stale_db_from_connection_state(args.org, args.limit))
            scan_lines2, stats = scan_ghosts(args.org, args.limit)
            # Substituir resultados do scan inicial pelo pós-correção
            all_checks = [
                c
                for c in all_checks
                if not (c.name.startswith("amostra:") or c.name == "scan_resumo")
            ] + scan_lines2
        except Exception as e:
            all_checks.append(CheckResult("corrigir_db", False, str(e)))

    print("\n[3/3] Relatório")
    passed = failed = 0
    for c in all_checks:
        icon = "OK" if c.ok else "FALHA"
        if c.ok:
            passed += 1
        else:
            failed += 1
        print(f"  [{icon}] {c.name}: {c.detail}")

    print("\n" + "-" * 60)
    print(f"Resultado: {passed} OK, {failed} FALHA")
    if stats.get("db_stale_connected", 0) > 0:
        print(
            "\nAção sugerida: abrir Disparador 2 e clicar "
            "'Sincronizar status com Evolution' para esta organização."
        )
    print("-" * 60)

    return 0 if failed == 0 else 1


if __name__ == "__main__":
    try:
        sys.exit(main())
    except urllib.error.HTTPError as e:
        print(f"Erro HTTP: {e.code} {e.read().decode()[:500]}", file=sys.stderr)
        sys.exit(2)
    except Exception as e:
        print(f"Erro: {e}", file=sys.stderr)
        sys.exit(2)
