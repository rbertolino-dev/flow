#!/usr/bin/env python3
"""
Teste automatizado (moderado) dos cenários de validação WhatsApp — Disparador 2 / IClass.

Stress controlado na Evolution API:
  - poucas instâncias por status (open/close/connecting)
  - delay entre chamadas
  - números inválidos sintéticos (sem spam)
  - sem disparo de mensagens reais

Uso:
  python3 scripts/teste-validacao-disparador2-evolution.py
  python3 scripts/teste-validacao-disparador2-evolution.py --org 34086d07-9181-43fc-a3e8-6aa28974d68b
  python3 scripts/teste-validacao-disparador2-evolution.py --open-limit 2 --delay 2 --json

Exit codes:
  0 — cenários críticos OK (avisos permitidos)
  1 — falha em cenário crítico
  2 — erro de ambiente (sem token, sem api_key, etc.)
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
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from typing import Any

ICLASS_ORG_DEFAULT = "34086d07-9181-43fc-a3e8-6aa28974d68b"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REF_FILE = os.path.join(ROOT, "supabase", ".temp", "project-ref")
TOKEN_FILE = os.path.expanduser("~/.supabase/access-token")
EVOLUTION_BASE = "https://api.ordemservico.com"

# Números claramente inválidos / sintéticos — não usar lista real de leads
INVALID_NUMBERS = [
    "5511999999999",
    "5511888888888",
    "5500000000000",
    "123456",
]


@dataclass
class ScenarioResult:
    id: str
    title: str
    status: str  # pass | fail | warn | skip
    detail: str
    data: dict[str, Any] = field(default_factory=dict)


def log(msg: str) -> None:
    print(msg, flush=True)


def sleep_delay(seconds: float) -> None:
    if seconds > 0:
        time.sleep(seconds)


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
    """Fallback via Management API — pode retornar 403 em alguns ambientes."""
    ref = load_project_ref()
    token = open(TOKEN_FILE).read().strip()
    body = json.dumps({"query": sql}).encode()
    req = urllib.request.Request(
        f"https://api.supabase.com/v1/projects/{ref}/database/query",
        data=body,
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        data = json.loads(resp.read())
    if isinstance(data, dict) and "message" in data:
        raise RuntimeError(data["message"])
    return data if isinstance(data, list) else []


def curl_request(
    url: str,
    api_key: str,
    method: str = "GET",
    body: dict | None = None,
    timeout: int = 25,
) -> tuple[int, str]:
    cmd = ["curl", "-sS", "-m", str(timeout), "-w", "\n%{http_code}", "-H", f"apikey: {api_key}"]
    if method == "POST" and body is not None:
        cmd += ["-X", "POST", "-H", "Content-Type: application/json", "-d", json.dumps(body)]
    cmd.append(url)
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        return 0, proc.stderr or proc.stdout
    parts = proc.stdout.rsplit("\n", 1)
    raw = parts[0] if len(parts) == 2 else proc.stdout
    http = int(parts[1].strip()) if len(parts) == 2 and parts[1].strip().isdigit() else 0
    return http, raw


def parse_fetch_list(raw: str) -> list[dict]:
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return []
    if isinstance(data, list):
        return [x for x in data if isinstance(x, dict)]
    if isinstance(data, dict):
        return [data]
    return []


def instance_name_from_row(row: dict) -> str:
    inst = row.get("instance") if isinstance(row.get("instance"), dict) else {}
    return str(
        inst.get("instanceName")
        or inst.get("name")
        or row.get("instanceName")
        or row.get("name")
        or "",
    ).strip()


def connection_status_from_row(row: dict) -> str:
    inst = row.get("instance") if isinstance(row.get("instance"), dict) else {}
    return str(
        inst.get("connectionStatus")
        or inst.get("status")
        or inst.get("state")
        or row.get("connectionStatus")
        or row.get("status")
        or row.get("state")
        or "",
    ).strip().lower()


def parse_connection_state(raw: str) -> str:
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return "?"
    if not isinstance(data, dict):
        return "?"
    inst = data.get("instance") if isinstance(data.get("instance"), dict) else {}
    return str(inst.get("state") or data.get("state") or "?").lower()


def is_connection_closed_payload(raw: str) -> bool:
    lower = raw.lower()
    return "connection closed" in lower or "precondition required" in lower


def normalize_phone_br(phone: str) -> str:
    digits = "".join(c for c in phone if c.isdigit())
    if not digits:
        return ""
    if digits.startswith("55"):
        return digits
    if 10 <= len(digits) <= 11:
        return "55" + digits
    return digits


def match_validated(exists_numbers: list[str], input_phone: str) -> bool:
    """Espelha regra conservadora da edge validate-broadcast-whatsapp."""
    digits = normalize_phone_br(input_phone).replace(" ", "")
    if not digits:
        return False
    for ex in exists_numbers:
        ex_digits = "".join(c for c in ex if c.isdigit())
        if not ex_digits:
            continue
        if ex_digits == digits:
            return True
        if len(digits) >= 10 and len(ex_digits) >= 10:
            if ex_digits[-10:] == digits[-10:] or ex_digits[-11:] == digits[-11:]:
                return True
    return False


def load_org_api_key(org_id: str) -> tuple[str, str]:
    rows = rest_get(
        f"evolution_config?organization_id=eq.{urllib.parse.quote(org_id)}"
        "&api_key=not.is.null"
        "&select=api_url,api_key"
        "&limit=1"
    )
    if not rows:
        raise RuntimeError(f"Nenhuma evolution_config com api_key para org {org_id}")
    api_url = str(rows[0].get("api_url") or EVOLUTION_BASE).rstrip("/")
    api_key = str(rows[0].get("api_key") or "").strip()
    if not api_key:
        raise RuntimeError("api_key vazia")
    return api_url, api_key


def scenario_fetch_instances_parse(
    api_key: str, base: str, delay: float
) -> ScenarioResult:
    sleep_delay(delay)
    http, raw = curl_request(f"{base}/instance/fetchInstances", api_key)
    rows = parse_fetch_list(raw)
    parsed_names = sum(1 for r in rows if instance_name_from_row(r))
    open_count = sum(1 for r in rows if connection_status_from_row(r) == "open")
    ok = http == 200 and parsed_names >= 5 and open_count >= 1
    return ScenarioResult(
        id="fetch_instances_parse",
        title="Parser fetchInstances (name + connectionStatus)",
        status="pass" if ok else "fail",
        detail=f"http={http} total={len(rows)} names={parsed_names} open={open_count}",
        data={"http": http, "total": len(rows), "parsed_names": parsed_names, "open": open_count},
    )


def scenario_crm_name_match(
    org_id: str, api_key: str, base: str, delay: float
) -> ScenarioResult:
    sleep_delay(delay)
    http, raw = curl_request(f"{base}/instance/fetchInstances", api_key)
    rows = parse_fetch_list(raw)
    evo_open = {
        instance_name_from_row(r).lower()
        for r in rows
        if connection_status_from_row(r) == "open" and instance_name_from_row(r)
    }
    db_rows = rest_get(
        f"evolution_config?organization_id=eq.{urllib.parse.quote(org_id)}"
        "&select=instance_name,is_connected"
        "&order=instance_name.asc"
    )
    matched_open = 0
    missing = 0
    for r in db_rows:
        name = str(r.get("instance_name") or "").strip().lower()
        if not name:
            continue
        if name in evo_open:
            matched_open += 1
        else:
            missing += 1
    ok = http == 200 and matched_open >= 5
    return ScenarioResult(
        id="crm_name_match",
        title="Nomes CRM batem com open na Evolution",
        status="pass" if ok else ("warn" if matched_open >= 1 else "fail"),
        detail=f"crm={len(db_rows)} matched_open={matched_open} not_in_evo_open={missing}",
        data={"matched_open": matched_open, "crm_total": len(db_rows), "missing": missing},
    )


def scenario_open_whatsapp_numbers(
    api_key: str,
    base: str,
    inst: dict,
    delay: float,
    owner_pool: list[str],
) -> ScenarioResult:
    name = instance_name_from_row(inst) or str(inst.get("name") or "")
    enc = urllib.parse.quote(name)
    sleep_delay(delay)
    http_cs, raw_cs = curl_request(f"{base}/instance/connectionState/{enc}", api_key)
    conn_state = parse_connection_state(raw_cs)

    valid_candidates: list[str] = []
    own = str(inst.get("ownerJid") or "").split("@")[0]
    if own.isdigit() and len(own) >= 12:
        valid_candidates.append(own)
    for n in owner_pool:
        if n not in valid_candidates:
            valid_candidates.append(n)
        if len(valid_candidates) >= 2:
            break
    numbers = valid_candidates + INVALID_NUMBERS[:3]

    sleep_delay(delay)
    http, raw = curl_request(
        f"{base}/chat/whatsappNumbers/{enc}",
        api_key,
        method="POST",
        body={"numbers": numbers},
    )

    if is_connection_closed_payload(raw):
        return ScenarioResult(
            id=f"open_validate_{name[:20]}",
            title=f"OPEN whatsappNumbers: {name}",
            status="warn",
            detail=f"lista=open mas whatsappNumbers Connection Closed (http={http})",
            data={"instance": name, "connectionState": conn_state, "http": http},
        )

    try:
        arr = json.loads(raw)
    except json.JSONDecodeError:
        return ScenarioResult(
            id=f"open_validate_{name[:20]}",
            title=f"OPEN whatsappNumbers: {name}",
            status="fail",
            detail=f"resposta não JSON http={http}",
            data={"raw": raw[:200]},
        )

    if not isinstance(arr, list):
        return ScenarioResult(
            id=f"open_validate_{name[:20]}",
            title=f"OPEN whatsappNumbers: {name}",
            status="fail",
            detail="resposta não é array",
            data={},
        )

    exists_true = [str(r.get("number")) for r in arr if r.get("exists") is True]
    exists_false = sum(1 for r in arr if r.get("exists") is False)
    has_true = len(exists_true) > 0
    has_false = exists_false > 0
    owner_ok = any(match_validated(exists_true, own) for own in valid_candidates[:1]) if valid_candidates else False

    ok = http == 200 and has_true and has_false
    status = "pass" if ok else ("warn" if http == 200 and has_false and not has_true else "fail")
    return ScenarioResult(
        id=f"open_validate_{name[:20]}",
        title=f"OPEN whatsappNumbers: {name}",
        status=status,
        detail=f"http={http} true={len(exists_true)} false={exists_false} owner_matched={owner_ok}",
        data={
            "instance": name,
            "connectionState": conn_state,
            "exists_true": len(exists_true),
            "exists_false": exists_false,
            "owner_matched": owner_ok,
        },
    )


def scenario_closed_or_connecting(
    api_key: str,
    base: str,
    inst: dict,
    list_status: str,
    delay: float,
) -> ScenarioResult:
    name = instance_name_from_row(inst) or str(inst.get("name") or "")
    enc = urllib.parse.quote(name)
    sleep_delay(delay)
    http, raw = curl_request(
        f"{base}/chat/whatsappNumbers/{enc}",
        api_key,
        method="POST",
        body={"numbers": [INVALID_NUMBERS[0]]},
    )
    closed = is_connection_closed_payload(raw) or http in (400, 428)
    status = "pass" if closed else "warn"
    return ScenarioResult(
        id=f"{list_status}_validate_{name[:16]}",
        title=f"{list_status.upper()} whatsappNumbers: {name}",
        status=status,
        detail=f"http={http} connection_closed={closed}",
        data={"instance": name, "list_status": list_status, "http": http},
    )


def scenario_phone_format(
    api_key: str, base: str, open_inst: dict, delay: float
) -> ScenarioResult:
    name = instance_name_from_row(open_inst) or str(open_inst.get("name") or "")
    own = str(open_inst.get("ownerJid") or "").split("@")[0]
    if not own.isdigit():
        return ScenarioResult(
            id="phone_format",
            title="Formatos de telefone (DDI vs local)",
            status="skip",
            detail="sem ownerJid válido",
        )
    enc = urllib.parse.quote(name)
    variants = [
        own,
        f"+{own}",
        f"{own[:2]} {own[2:4]} {own[4:9]}-{own[9:]}",
        f"({own[2:4]}) {own[4:9]}-{own[9:]}",
    ]
    sleep_delay(delay)
    http, raw = curl_request(
        f"{base}/chat/whatsappNumbers/{enc}",
        api_key,
        method="POST",
        body={"numbers": variants},
    )
    if is_connection_closed_payload(raw):
        return ScenarioResult(
            id="phone_format",
            title="Formatos de telefone (DDI vs local)",
            status="warn",
            detail="instância open na lista mas Connection Closed na validação",
        )
    try:
        arr = json.loads(raw)
    except json.JSONDecodeError:
        return ScenarioResult(
            id="phone_format",
            title="Formatos de telefone (DDI vs local)",
            status="fail",
            detail="resposta inválida",
        )
    by_num = {str(r.get("number")): r.get("exists") for r in arr if isinstance(r, dict)}
    ddi_ok = by_num.get(own) is True or by_num.get(f"+{own}") is True
    local_key = f"({own[2:4]}) {own[4:9]}-{own[9:]}"
    local_fail = by_num.get(local_key) is False
    ok = http == 200 and ddi_ok and local_fail
    return ScenarioResult(
        id="phone_format",
        title="Formatos de telefone (DDI vs local)",
        status="pass" if ok else "warn",
        detail=f"ddi_ok={ddi_ok} local_sem_ddi_false={local_fail} http={http}",
        data={"by_num": {k: by_num[k] for k in list(by_num)[:4]}},
    )


def scenario_all_false_not_error(
    api_key: str, base: str, open_inst: dict, delay: float
) -> ScenarioResult:
    """Simula lista só com inválidos: API deve retornar 200 + todos exists:false (não erro técnico)."""
    name = instance_name_from_row(open_inst) or str(open_inst.get("name") or "")
    enc = urllib.parse.quote(name)
    sleep_delay(delay)
    http, raw = curl_request(
        f"{base}/chat/whatsappNumbers/{enc}",
        api_key,
        method="POST",
        body={"numbers": INVALID_NUMBERS},
    )
    if is_connection_closed_payload(raw):
        return ScenarioResult(
            id="all_false_sem_erro",
            title="Somente inválidos → 0 válidos (sem Connection Closed)",
            status="warn",
            detail="Connection Closed — cenário inconclusivo nesta instância",
        )
    try:
        arr = json.loads(raw)
    except json.JSONDecodeError:
        return ScenarioResult(
            id="all_false_sem_erro",
            title="Somente inválidos → 0 válidos (sem Connection Closed)",
            status="fail",
            detail="resposta não JSON",
        )
    if not isinstance(arr, list) or len(arr) == 0:
        return ScenarioResult(
            id="all_false_sem_erro",
            title="Somente inválidos → 0 válidos (sem Connection Closed)",
            status="fail",
            detail="array vazio",
        )
    all_false = all(r.get("exists") is False for r in arr)
    ok = http == 200 and all_false
    return ScenarioResult(
        id="all_false_sem_erro",
        title="Somente inválidos → 0 válidos (sem Connection Closed)",
        status="pass" if ok else "fail",
        detail=f"http={http} all_exists_false={all_false} count={len(arr)}",
    )


def main() -> int:
    parser = argparse.ArgumentParser(description="Teste moderado validação Disparador 2 / Evolution")
    parser.add_argument("--org", default=ICLASS_ORG_DEFAULT, help="organization_id UUID")
    parser.add_argument("--open-limit", type=int, default=3, help="máx instâncias OPEN testadas")
    parser.add_argument("--delay", type=float, default=1.2, help="segundos entre chamadas Evolution")
    parser.add_argument("--json", action="store_true", help="imprimir JSON completo no stdout")
    parser.add_argument(
        "--output",
        default=os.path.join(ROOT, "test-results", "validacao-disparador2-evolution.json"),
        help="arquivo JSON de relatório",
    )
    args = parser.parse_args()

    if not os.path.isfile(REF_FILE):
        log("❌ Ambiente: supabase/.temp/project-ref ausente")
        return 2

    log("=== Teste moderado — validação Disparador 2 / Evolution ===")
    log(f"org={args.org} open_limit={args.open_limit} delay={args.delay}s")

    try:
        base, api_key = load_org_api_key(args.org)
    except Exception as e:
        log(f"❌ {e}")
        return 2

    base = base.rstrip("/").replace("/manager", "").replace("/dashboard", "")

    sleep_delay(args.delay)
    http, raw = curl_request(f"{base}/instance/fetchInstances", api_key)
    items = parse_fetch_list(raw)
    if http != 200 or not items:
        log(f"❌ fetchInstances falhou http={http}")
        return 2

    open_items = [r for r in items if connection_status_from_row(r) == "open"]
    close_items = [r for r in items if connection_status_from_row(r) == "close"]
    conn_items = [r for r in items if connection_status_from_row(r) == "connecting"]

    owner_pool: list[str] = []
    for r in items:
        jid = str(r.get("ownerJid") or "")
        num = jid.split("@")[0]
        if num.isdigit() and len(num) >= 12 and num not in owner_pool:
            owner_pool.append(num)

    log(
        f"Evolution: total={len(items)} open={len(open_items)} "
        f"close={len(close_items)} connecting={len(conn_items)}"
    )

    results: list[ScenarioResult] = []
    results.append(scenario_fetch_instances_parse(api_key, base, args.delay))
    results.append(scenario_crm_name_match(args.org, api_key, base, args.delay))

    for inst in open_items[: max(0, args.open_limit)]:
        results.append(
            scenario_open_whatsapp_numbers(api_key, base, inst, args.delay, owner_pool)
        )

    if open_items:
        results.append(scenario_phone_format(api_key, base, open_items[0], args.delay))
        results.append(scenario_all_false_not_error(api_key, base, open_items[0], args.delay))

    if close_items:
        results.append(
            scenario_closed_or_connecting(api_key, base, close_items[0], "close", args.delay)
        )
    if conn_items:
        results.append(
            scenario_closed_or_connecting(api_key, base, conn_items[0], "connecting", args.delay)
        )

    passed = sum(1 for r in results if r.status == "pass")
    warned = sum(1 for r in results if r.status == "warn")
    failed = sum(1 for r in results if r.status == "fail")
    skipped = sum(1 for r in results if r.status == "skip")

    log("")
    log("--- Resultados ---")
    for r in results:
        icon = {"pass": "✅", "fail": "❌", "warn": "⚠️", "skip": "⏭️"}.get(r.status, "?")
        log(f"{icon} [{r.status.upper()}] {r.title}")
        log(f"    {r.detail}")

    report = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "organization_id": args.org,
        "evolution_summary": {
            "total": len(items),
            "open": len(open_items),
            "close": len(close_items),
            "connecting": len(conn_items),
        },
        "config": {
            "open_limit": args.open_limit,
            "delay_seconds": args.delay,
        },
        "summary": {
            "pass": passed,
            "warn": warned,
            "fail": failed,
            "skip": skipped,
        },
        "scenarios": [asdict(r) for r in results],
    }

    os.makedirs(os.path.dirname(args.output), exist_ok=True)
    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    log(f"\nRelatório: {args.output}")

    if args.json:
        print(json.dumps(report, ensure_ascii=False, indent=2))

    critical_fail = any(
        r.status == "fail"
        for r in results
        if r.id in ("fetch_instances_parse", "all_false_sem_erro", "phone_format")
        or r.id.startswith("open_validate_")
    )
    if critical_fail:
        log("\n❌ Falha em cenário crítico")
        return 1
    log(f"\n✅ Concluído: {passed} pass, {warned} warn, {failed} fail, {skipped} skip")
    return 0


if __name__ == "__main__":
    sys.exit(main())
