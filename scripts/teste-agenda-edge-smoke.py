#!/usr/bin/env python3
"""
Smoke test CAUTELOSO — edge process-scheduled-messages (agenda de leads).

- Apenas POST vazio (mesmo que o cron): processa pendentes existentes, não cria registros.
- NÃO altera scheduled_messages via API de teste.
- Exit: 0 OK, 1 falha HTTP/resposta, 2 ambiente (sem chaves — skip, não falha o pipeline)

Uso:
  python3 scripts/teste-agenda-edge-smoke.py
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
import urllib.error
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REF_FILE = os.path.join(ROOT, "supabase", ".temp", "project-ref")


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


def load_service_key() -> str | None:
    env = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    if env:
        return env
    try:
        ref = load_project_ref()
    except OSError:
        return None
    proc = subprocess.run(
        ["supabase", "projects", "api-keys", "--project-ref", ref],
        capture_output=True,
        text=True,
        cwd=ROOT,
        timeout=60,
    )
    if proc.returncode != 0:
        return None
    table = _parse_api_keys_table(proc.stdout)
    return table.get("service_role") or None


def main() -> int:
    log("=== Smoke — process-scheduled-messages (somente leitura de fila) ===\n")

    service_key = load_service_key()
    if not service_key:
        log("⏭️  SUPABASE_SERVICE_ROLE_KEY / supabase CLI indisponível — smoke ignorado (exit 2)")
        return 2

    try:
        ref = load_project_ref()
    except OSError as e:
        log(f"⏭️  project-ref ausente: {e} — ignorado (exit 2)")
        return 2

    url = f"https://{ref}.supabase.co/functions/v1/process-scheduled-messages"
    req = urllib.request.Request(
        url,
        data=b"{}",
        method="POST",
        headers={
            "Authorization": f"Bearer {service_key}",
            "apikey": service_key,
            "Content-Type": "application/json",
        },
    )

    try:
        with urllib.request.urlopen(req, timeout=90) as resp:
            body = resp.read().decode("utf-8", errors="replace")
            code = resp.status
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        log(f"❌ HTTP {e.code}: {body[:500]}")
        return 1
    except Exception as e:
        log(f"❌ Erro de rede: {e}")
        return 1

    if code < 200 or code >= 300:
        log(f"❌ HTTP {code}: {body[:500]}")
        return 1

    try:
        data = json.loads(body) if body.strip() else {}
    except json.JSONDecodeError:
        log(f"❌ Resposta não é JSON: {body[:300]}")
        return 1

    if not isinstance(data, dict):
        log(f"❌ JSON inesperado: {type(data)}")
        return 1

    # Campos comuns da edge (não exige processar > 0)
    for key in ("processed", "success", "message"):
        if key in data:
            log(f"   campo {key}: {data[key]!r}")

    log(f"✅ Edge respondeu HTTP {code} com JSON válido (sem criar agendamentos de teste)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
