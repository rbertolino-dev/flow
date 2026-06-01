#!/usr/bin/env python3
"""
Testes de integração — edge validate-broadcast-whatsapp (IClass).
Simula o frontend: lotes de 100 + rodízio de preferredInstanceId (opção 2).

Uso:
  python3 scripts/teste-validacao-edge-iclass.py
  python3 scripts/teste-validacao-edge-iclass.py --org 34086d07-9181-43fc-a3e8-6aa28974d68b

Exit: 0 OK, 1 falha crítica, 2 ambiente
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone

ICLASS_ORG = "34086d07-9181-43fc-a3e8-6aa28974d68b"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REF_FILE = os.path.join(ROOT, "supabase", ".temp", "project-ref")
BATCH_SIZE = 100
ROTATOR_MAX = 6
INTER_BATCH_DELAY = 1.2

# Números sintéticos (não usar leads reais)
SYNTHETIC_NUMBERS = [
    "5511999999999",
    "5511888888888",
    "5511777777777",
    "5511666666666",
    "5500000000000",
    "5511555555555",
    "5511444444444",
    "5511333333333",
]


@dataclass
class ScenarioResult:
    id: str
    title: str
    status: str  # pass | fail | warn | skip
    detail: str
    elapsed_ms: int = 0
    data: dict = field(default_factory=dict)


def log(msg: str) -> None:
    print(msg, flush=True)


def load_project_ref() -> str:
    with open(REF_FILE) as f:
        return f.read().strip()


def _parse_api_keys_table(stdout: str) -> dict[str, str]:
    out: dict[str, str] = {}
    for line in stdout.splitlines():
        if "|" not in line or "NAME" in line or "---" in line:
            continue
        parts = [p.strip() for p in line.split("|") if p.strip()]
        if len(parts) >= 2:
            out[parts[0]] = parts[1]
    return out


def load_keys() -> tuple[str, str]:
    env_anon = os.environ.get("SUPABASE_ANON_KEY", "").strip()
    env_service = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    if env_anon and env_service:
        return env_anon, env_service

    ref = load_project_ref()
    proc = subprocess.run(
        ["supabase", "projects", "api-keys", "--project-ref", ref],
        capture_output=True,
        text=True,
        cwd=ROOT,
        timeout=60,
    )
    if proc.returncode != 0:
        raise RuntimeError(f"supabase projects api-keys falhou: {proc.stderr or proc.stdout}")
    table = _parse_api_keys_table(proc.stdout)
    anon = table.get("anon", "")
    service = table.get("service_role", "")
    if not anon or not service:
        raise RuntimeError(f"anon/service_role não encontradas (chaves: {list(table.keys())})")
    return anon, service


def rest_get(path_query: str, service_key: str) -> list[dict]:
    ref = load_project_ref()
    url = f"https://{ref}.supabase.co/rest/v1/{path_query}"
    req = urllib.request.Request(
        url,
        headers={
            "apikey": service_key,
            "Authorization": f"Bearer {service_key}",
            "Accept": "application/json",
        },
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        data = json.loads(resp.read())
    return data if isinstance(data, list) else []


def login_user(anon_key: str, email: str, password: str) -> str:
    ref = load_project_ref()
    url = f"https://{ref}.supabase.co/auth/v1/token?grant_type=password"
    body = json.dumps({"email": email, "password": password}).encode()
    req = urllib.request.Request(
        url,
        data=body,
        headers={"apikey": anon_key, "Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        data = json.loads(resp.read())
    token = data.get("access_token")
    if not token:
        raise RuntimeError(f"login sem access_token: {data}")
    return str(token)


def build_rotator_pool(rows: list[dict], max_chips: int = ROTATOR_MAX) -> list[str]:
    pool: list[str] = []
    for row in rows:
        iid = str(row.get("id") or "").strip()
        if not iid:
            continue
        if row.get("is_connected") is False:
            continue
        pool.append(iid)
        if len(pool) >= max_chips:
            break
    if not pool and rows:
        pool.append(str(rows[0]["id"]))
    return pool


def make_number_list(count: int) -> list[str]:
    out: list[str] = []
    for i in range(count):
        base = SYNTHETIC_NUMBERS[i % len(SYNTHETIC_NUMBERS)]
        # variar último dígito para não repetir exatamente
        suffix = str(i % 10)
        if base.endswith("0"):
            out.append(base[:-1] + suffix)
        else:
            out.append(base)
    return out


def call_validate_edge(
    user_token: str,
    anon_key: str,
    org_id: str,
    instance_ids: list[str],
    numbers: list[str],
    preferred_instance_id: str | None = None,
    timeout: int = 120,
) -> tuple[int, dict, int]:
    ref = load_project_ref()
    url = f"https://{ref}.supabase.co/functions/v1/validate-broadcast-whatsapp"
    payload: dict = {
        "organizationId": org_id,
        "instanceIds": instance_ids,
        "numbers": numbers,
        "useLatamValidator": False,
    }
    if preferred_instance_id:
        payload["preferredInstanceId"] = preferred_instance_id

    body = json.dumps(payload).encode()
    req = urllib.request.Request(
        url,
        data=body,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {user_token}",
            "apikey": anon_key,
        },
        method="POST",
    )
    t0 = time.perf_counter()
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read()
            http = resp.status
    except urllib.error.HTTPError as e:
        raw = e.read()
        http = e.code
    elapsed = int((time.perf_counter() - t0) * 1000)
    try:
        data = json.loads(raw) if raw else {}
    except json.JSONDecodeError:
        data = {"_raw": raw.decode("utf-8", errors="replace")[:500]}
    return http, data if isinstance(data, dict) else {"data": data}, elapsed


def scenario_small_batch(
    token: str,
    anon: str,
    org: str,
    instance_ids: list[str],
    preferred: str | None,
) -> ScenarioResult:
    numbers = make_number_list(8)
    http, data, ms = call_validate_edge(token, anon, org, instance_ids, numbers, preferred)
    ok_body = data.get("ok") is True
    has_lists = "validatedNumbers" in data and "rejectedNumbers" in data
    no_504 = http != 504
    status = "pass" if no_504 and (ok_body or data.get("error")) and has_lists else "fail"
    if http == 504:
        status = "fail"
    return ScenarioResult(
        id="edge_small_batch",
        title="Edge: lote pequeno (8 números sintéticos)",
        status=status,
        detail=f"http={http} ok={data.get('ok')} ms={ms} used={data.get('usedInstance')}",
        elapsed_ms=ms,
        data={"http": http, "ok": data.get("ok"), "usedInstanceId": data.get("usedInstanceId")},
    )


def scenario_medium_batch(
    token: str,
    anon: str,
    org: str,
    instance_ids: list[str],
    preferred: str | None,
) -> ScenarioResult:
    numbers = make_number_list(50)
    http, data, ms = call_validate_edge(token, anon, org, instance_ids, numbers, preferred)
    under_60s = ms < 60000
    no_504 = http != 504
    status = "pass" if no_504 and under_60s and data.get("ok") is not None else "fail"
    return ScenarioResult(
        id="edge_medium_batch",
        title="Edge: lote médio (50 números — 1 chunk Evolution)",
        status=status,
        detail=f"http={http} ok={data.get('ok')} ms={ms} (<60s={under_60s})",
        elapsed_ms=ms,
    )


def scenario_large_batch_no_504(
    token: str,
    anon: str,
    org: str,
    instance_ids: list[str],
    preferred: str | None,
) -> ScenarioResult:
    numbers = make_number_list(100)
    http, data, ms = call_validate_edge(token, anon, org, instance_ids, numbers, preferred)
    no_504 = http != 504
    under_65s = ms < 65000
    status = "pass" if no_504 and under_65s else "fail"
    return ScenarioResult(
        id="edge_large_100",
        title="Edge: lote 100 números (anti-504)",
        status=status,
        detail=f"http={http} ok={data.get('ok')} ms={ms}",
        elapsed_ms=ms,
    )


def scenario_rotated_batches(
    token: str,
    anon: str,
    org: str,
    instance_ids: list[str],
    pool: list[str],
    working_instance_id: str | None,
) -> ScenarioResult:
    """Simula 90 números = 3 lotes × 30 com 3 chips diferentes (opção 2)."""
    if len(pool) < 2:
        return ScenarioResult(
            id="edge_rotated_batches",
            title="Edge: rodízio 3 lotes",
            status="skip",
            detail="menos de 2 chips conectados no pool",
        )

    rotate_ids = pool[:3]
    all_numbers = make_number_list(90)
    batches = [all_numbers[i : i + 30] for i in range(0, len(all_numbers), 30)]
    prefs_used: list[str] = []
    chips_used: list[str] = []
    http_codes: list[int] = []
    total_ms = 0
    batches_ok = 0

    for b, batch in enumerate(batches):
        if b > 0:
            time.sleep(INTER_BATCH_DELAY)
        pref = rotate_ids[b % len(rotate_ids)]
        prefs_used.append(pref)
        http, data, ms = call_validate_edge(token, anon, org, instance_ids, batch, pref)
        total_ms += ms
        http_codes.append(http)
        if data.get("usedInstanceId"):
            chips_used.append(str(data["usedInstanceId"]))
        covered = len(data.get("validatedNumbers") or []) + len(data.get("rejectedNumbers") or [])
        if http == 504:
            break
        if http == 200 and (data.get("ok") is True or covered >= len(batch)):
            batches_ok += 1

    no_504 = 504 not in http_codes
    distinct_prefs = len(set(prefs_used))
    distinct_chips = len(set(chips_used)) if chips_used else 0
    status = "pass" if no_504 and batches_ok == len(batches) and distinct_prefs >= 2 else "fail"
    if no_504 and batches_ok == len(batches) and distinct_prefs < 2:
        status = "warn"

    return ScenarioResult(
        id="edge_rotated_batches",
        title="Edge: rodízio 3 lotes (90 números, 3 chips)",
        status=status,
        detail=(
            f"batches={len(batches)} ok_batches={batches_ok}/{len(batches)} "
            f"http={http_codes} prefs_distintos={distinct_prefs} chips_distintos={distinct_chips} "
            f"total_ms={total_ms} working_ref={working_instance_id or 'n/a'}"
        ),
        elapsed_ms=total_ms,
        data={"prefs_used": prefs_used, "chips_used": chips_used, "http_codes": http_codes},
    )


def scenario_all_invalid(
    token: str,
    anon: str,
    org: str,
    instance_ids: list[str],
    preferred: str | None,
) -> ScenarioResult:
    numbers = ["123", "456", "00000000000"]
    http, data, ms = call_validate_edge(token, anon, org, instance_ids, numbers, preferred)
    ok = data.get("ok") is True
    validated = data.get("validatedNumbers") or []
    rejected = data.get("rejectedNumbers") or []
    status = "pass" if http == 200 and ok and len(validated) == 0 and len(rejected) >= 1 else "fail"
    return ScenarioResult(
        id="edge_all_invalid",
        title="Edge: só números inválidos → 0 validados (sem falso positivo)",
        status=status,
        detail=f"http={http} valid={len(validated)} rejected={len(rejected)}",
        elapsed_ms=ms,
    )


def scenario_bad_preferred_fallback(
    token: str,
    anon: str,
    org: str,
    instance_ids: list[str],
    good_preferred: str,
) -> ScenarioResult:
    fake_id = "00000000-0000-0000-0000-000000000099"
    numbers = make_number_list(5)
    http, data, ms = call_validate_edge(token, anon, org, instance_ids, numbers, fake_id)
    # Deve ainda responder 200 com ok true/false ou erro legível, nunca 504
    no_504 = http != 504
    status = "pass" if no_504 and http in (200, 401, 403) else "fail"
    if http == 200 and data.get("ok") is True:
        status = "pass"
    return ScenarioResult(
        id="edge_bad_preferred",
        title="Edge: preferredInstanceId inexistente (fallback)",
        status=status,
        detail=f"http={http} ok={data.get('ok')} err={str(data.get('error', ''))[:80]}",
        elapsed_ms=ms,
    )


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--org", default=ICLASS_ORG)
    parser.add_argument("--email", default=os.environ.get("TEST_LOGIN_EMAIL", "pubdigital.net@gmail.com"))
    parser.add_argument("--password", default=os.environ.get("TEST_LOGIN_PASSWORD", "123456"))
    parser.add_argument(
        "--output",
        default=os.path.join(ROOT, "test-results", "validacao-edge-iclass.json"),
    )
    args = parser.parse_args()

    if not os.path.isfile(REF_FILE):
        log("❌ project-ref ausente")
        return 2

    log("=== Testes integração edge — IClass (lotes + rodízio) ===\n")

    try:
        anon, service = load_keys()
        user_token = login_user(anon, args.email, args.password)
    except Exception as e:
        log(f"❌ Ambiente/auth: {e}")
        return 2

    log("✅ JWT de usuário obtido")

    rows = rest_get(
        f"evolution_config?organization_id=eq.{urllib.parse.quote(args.org)}"
        "&select=id,instance_name,is_connected"
        "&order=instance_name.asc",
        service,
    )
    if not rows:
        log("❌ Nenhuma evolution_config para a org")
        return 2

    instance_ids = [str(r["id"]) for r in rows if r.get("id")]
    pool = build_rotator_pool(rows)
    preferred = pool[0] if pool else None

    connected = sum(1 for r in rows if r.get("is_connected") is not False)
    log(f"Org: {args.org} | instâncias: {len(instance_ids)} | conectadas(CRM): {connected}")
    log(f"Pool rodízio ({len(pool)}): {[r.get('instance_name') for r in rows if str(r.get('id')) in pool[:6]]}\n")

    results: list[ScenarioResult] = []
    small = scenario_small_batch(user_token, anon, args.org, instance_ids, preferred)
    results.append(small)
    working_id = (small.data or {}).get("usedInstanceId") or preferred
    time.sleep(0.8)
    results.append(scenario_medium_batch(user_token, anon, args.org, instance_ids, working_id))
    time.sleep(0.8)
    results.append(scenario_large_batch_no_504(user_token, anon, args.org, instance_ids, preferred))
    time.sleep(1.0)
    results.append(scenario_all_invalid(user_token, anon, args.org, instance_ids, preferred))
    time.sleep(0.8)
    if preferred:
        results.append(
            scenario_bad_preferred_fallback(user_token, anon, args.org, instance_ids, preferred)
        )
    time.sleep(1.0)
    results.append(
        scenario_rotated_batches(user_token, anon, args.org, instance_ids, pool, working_id)
    )

    log("\n--- Resultados ---")
    for r in results:
        icon = {"pass": "✅", "fail": "❌", "warn": "⚠️", "skip": "⏭️"}.get(r.status, "?")
        log(f"{icon} [{r.status.upper()}] {r.title}")
        log(f"    {r.detail}")

    passed = sum(1 for r in results if r.status == "pass")
    failed = sum(1 for r in results if r.status == "fail")
    warned = sum(1 for r in results if r.status == "warn")

    report = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "organization_id": args.org,
        "instances_total": len(instance_ids),
        "rotator_pool_size": len(pool),
        "summary": {"pass": passed, "warn": warned, "fail": failed},
        "scenarios": [asdict(r) for r in results],
    }
    os.makedirs(os.path.dirname(args.output), exist_ok=True)
    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    log(f"\nRelatório: {args.output}")

    critical_fail = any(
        r.status == "fail"
        for r in results
        if r.id in ("edge_large_100", "edge_rotated_batches", "edge_small_batch")
    )
    if critical_fail:
        log("\n❌ Falha em cenário crítico — revisar edge ou Evolution")
        return 1
    log(f"\n✅ Suíte edge: {passed} pass, {warned} warn, {failed} fail")
    return 0


if __name__ == "__main__":
    sys.exit(main())
