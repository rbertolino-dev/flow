#!/usr/bin/env python3
"""
Restauração automatizada e segura — GUILHERME FERREIRA MÓVEIS

Fluxo:
  1. Tenta clone via API Supabase (backup 2026-06-08 04:38 UTC) — método preferido
  2. Se API indisponível: restauração cirúrgica via SQL transacional usando
     histórico de atividades PRÉ-incidente (proxy do backup; sem movimentos legítimos 05/06→08/06)
  3. Gera rollback SQL antes de qualquer alteração

Uso:
  python3 scripts/restaurar-etapas-guilherme-auto.py
  python3 scripts/restaurar-etapas-guilherme-auto.py --skip-backup-api
  python3 scripts/restaurar-etapas-guilherme-auto.py --dry-run
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ORG_ID = "20b10048-88c4-4a9e-b72a-ac1c407e95c6"
ORG_NAME = "GUILHERME FERREIRA MÓVEIS"
PROD_REF = "ogeljmbhqxpfjbpnbwog"
BACKUP_ID = 847820491
BACKUP_ISO = "2026-06-08T04:38:54Z"
INCIDENT_START = "2026-06-08 12:31:00+00"
INCIDENT_END = "2026-06-08 12:32:00+00"
NEGADAS_STAGE_ID = "5a0e9544-c455-41c1-92b0-ed83b2968c1f"
REPORT_DIR = Path(__file__).resolve().parent.parent / "tmp" / "restauracao-guilherme-ferreira"


def load_token() -> str:
    path = Path.home() / ".supabase" / "access-token"
    if path.exists():
        return path.read_text().strip()
    raise RuntimeError("Token Supabase não encontrado em ~/.supabase/access-token")


def api(method: str, path: str, body: dict | None = None) -> tuple[int, Any]:
    token = load_token()
    url = f"https://api.supabase.com{path}"
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(
        url,
        data=data,
        method=method,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            raw = resp.read().decode()
            return resp.status, json.loads(raw) if raw else None
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode()
        try:
            payload = json.loads(raw)
        except json.JSONDecodeError:
            payload = {"message": raw}
        return exc.code, payload


def pg_env() -> dict[str, str]:
    env = os.environ.copy()
    env.setdefault("PGUSER", "postgres.ogeljmbhqxpfjbpnbwog")
    env.setdefault("PGHOST", "aws-1-sa-east-1.pooler.supabase.com")
    env.setdefault("PGPORT", "5432")
    env.setdefault("PGDATABASE", "postgres")
    env.setdefault("PGSSLMODE", "require")
    if not env.get("PGPASSWORD"):
        raise RuntimeError(
            "Defina PGPASSWORD (senha do banco Supabase) antes de executar o script."
        )
    return env


def sql_exec(query: str) -> None:
    env = pg_env()
    proc = subprocess.run(
        ["psql", "-v", "ON_ERROR_STOP=1", "-c", query],
        env=env,
        capture_output=True,
        text=True,
        check=False,
    )
    if proc.returncode != 0:
        raise RuntimeError(proc.stderr.strip() or proc.stdout.strip())


def sql_query(_ref: str, query: str, read_only: bool = False) -> list[dict]:
    del read_only  # postgres direto
    stripped = query.strip().rstrip(";")
    if not stripped.upper().startswith("SELECT"):
        sql_exec(query)
        return []

    env = pg_env()
    json_proc = subprocess.run(
        [
            "psql",
            "-v",
            "ON_ERROR_STOP=1",
            "-t",
            "-A",
            "-c",
            f"SELECT COALESCE(json_agg(t), '[]'::json)::text FROM ({stripped}) t;",
        ],
        env=env,
        capture_output=True,
        text=True,
        check=False,
    )
    if json_proc.returncode != 0:
        raise RuntimeError(json_proc.stderr.strip() or json_proc.stdout.strip())
    raw = json_proc.stdout.strip()
    if not raw:
        return []
    data = json.loads(raw)
    return data if isinstance(data, list) else [data]


def load_service_role(project_ref: str) -> str:
    env_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    if env_key:
        return env_key
    out = subprocess.check_output(
        ["supabase", "projects", "api-keys", "--project-ref", project_ref],
        text=True,
    )
    for line in out.splitlines():
        parts = [p.strip() for p in line.split("|")]
        if len(parts) >= 3 and parts[1] == "service_role":
            return parts[2]
    raise RuntimeError("service_role não encontrado")


def rest_get(ref: str, key: str, table: str, params: str) -> list[dict]:
    url = f"https://{ref}.supabase.co/rest/v1/{table}?{params}"
    req = urllib.request.Request(
        url,
        headers={"apikey": key, "Authorization": f"Bearer {key}"},
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        return json.loads(resp.read().decode())


def try_backup_clone(max_wait_sec: int = 180) -> str | None:
    print("Tentando clone do backup via Management API...")
    deadline = time.time() + max_wait_sec
    attempt = 0
    while time.time() < deadline:
        attempt += 1
        status, payload = api(
            "POST",
            f"/v1/projects/{PROD_REF}/database/backups/restore",
            {"id": BACKUP_ID},
        )
        if status in (200, 201, 202):
            print("Restore API aceito — aguardando novo projeto...")
            break
        msg = (payload or {}).get("message", "")
        if "unavailable" not in msg.lower():
            print(f"Restore API resposta inesperada ({status}): {payload}")
            return None
        if attempt % 3 == 1:
            print(f"  API indisponível (tentativa {attempt})...")
        time.sleep(15)

    # Poll projects list for new project
    known = {PROD_REF, "ufjqxslicqxmeifbmcnj"}
    for _ in range(40):
        status, projects = api("GET", "/v1/projects")
        if status == 200 and isinstance(projects, list):
            for p in projects:
                ref = p.get("id") or p.get("ref")
                name = (p.get("name") or "").lower()
                if ref and ref not in known and "restore" in name:
                    print(f"Projeto clonado detectado: {ref} ({p.get('name')})")
                    return ref
        time.sleep(15)
    return None


def export_rollback(ref: str) -> Path:
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    path = REPORT_DIR / f"rollback_stage_ids_{ts}.sql"
    rows = sql_query(
        ref,
        f"""
        SELECT id, stage_id
        FROM public.leads
        WHERE organization_id = '{ORG_ID}' AND deleted_at IS NULL
        ORDER BY id
        """,
        read_only=True,
    )
    lines = [
        "-- ROLLBACK: restaurar stage_id dos leads antes da correção",
        f"-- Gerado em {datetime.now(timezone.utc).isoformat()}",
        "BEGIN;",
    ]
    for r in rows:
        sid = "NULL" if r["stage_id"] is None else f"'{r['stage_id']}'"
        lines.append(
            f"UPDATE public.leads SET stage_id = {sid}, updated_at = now() "
            f"WHERE id = '{r['id']}' AND organization_id = '{ORG_ID}';"
        )
    lines.append("COMMIT;")
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return path


def restore_from_clone(clone_ref: str, dry_run: bool) -> int:
    key = load_service_role(clone_ref)
    prod_key = load_service_role(PROD_REF)
    backup_rows = rest_get(
        clone_ref,
        key,
        "leads",
        f"organization_id=eq.{ORG_ID}&deleted_at=is.null&select=id,name,stage_id",
    )
    prod_rows = rest_get(
        PROD_REF,
        prod_key,
        "leads",
        f"organization_id=eq.{ORG_ID}&deleted_at=is.null&select=id,stage_id",
    )
    prod_map = {r["id"]: r.get("stage_id") for r in prod_rows}
    changes = [
        r for r in backup_rows
        if r.get("stage_id") and prod_map.get(r["id"]) != r.get("stage_id")
    ]
    print(f"Clone: {len(backup_rows)} leads | Alterações: {len(changes)}")
    if dry_run or not changes:
        return 0
    rollback = export_rollback(PROD_REF)
    print(f"Rollback salvo: {rollback}")
    # Apply via SQL transaction
    values = ",\n".join(
        f"('{c['id']}'::uuid, '{c['stage_id']}'::uuid)" for c in changes if c.get("stage_id")
    )
    update_sql = f"""
    BEGIN;
    WITH backup(stage_id, lead_id) AS (
      VALUES {values}
    )
    UPDATE public.leads l
    SET stage_id = b.stage_id, updated_at = now()
    FROM backup b
    WHERE l.id = b.lead_id
      AND l.organization_id = '{ORG_ID}'
      AND l.deleted_at IS NULL
      AND l.stage_id IS DISTINCT FROM b.stage_id;
    COMMIT;
    """
    sql_query(PROD_REF, update_sql)
    return len(changes)


def restore_from_activity_proxy(dry_run: bool) -> int:
    print("Aplicando restauração via histórico de atividades (proxy do backup)...")
    preview = sql_query(
        PROD_REF,
        f"""
        WITH stages AS (
          SELECT id, name, position
          FROM public.pipeline_stages
          WHERE organization_id = '{ORG_ID}'
        ),
        max_pos AS (SELECT MAX(position) AS m FROM stages),
        incident AS (
          SELECT DISTINCT a.lead_id
          FROM public.activities a
          WHERE a.organization_id = '{ORG_ID}'
            AND a.type = 'status_change'
            AND a.created_at >= '{INCIDENT_START}'
            AND a.created_at < '{INCIDENT_END}'
        ),
        prior AS (
          SELECT a.lead_id, COUNT(*)::int AS prior_moves
          FROM public.activities a
          WHERE a.organization_id = '{ORG_ID}'
            AND a.type = 'status_change'
            AND a.created_at < '2026-06-08 12:30:00+00'
          GROUP BY a.lead_id
        ),
        recusou AS (
          SELECT lt.lead_id
          FROM public.lead_tags lt
          JOIN public.tags t ON t.id = lt.tag_id
          WHERE t.organization_id = '{ORG_ID}' AND lower(t.name) = 'recusou'
        ),
        target AS (
          SELECT
            i.lead_id,
            CASE
              WHEN r.lead_id IS NOT NULL THEN '{NEGADAS_STAGE_ID}'::uuid
              ELSE (
                SELECT s.id FROM stages s
                WHERE s.position = LEAST(COALESCE(p.prior_moves, 0), (SELECT m FROM max_pos))
              )
            END AS stage_id
          FROM incident i
          LEFT JOIN prior p ON p.lead_id = i.lead_id
          LEFT JOIN recusou r ON r.lead_id = i.lead_id
        )
        SELECT ps.name, ps.position, COUNT(*)::int AS leads
        FROM target t
        JOIN stages ps ON ps.id = t.stage_id
        GROUP BY ps.name, ps.position
        ORDER BY ps.position
        """,
        read_only=True,
    )
    print("Distribuição prevista:")
    for row in preview:
        print(f"  {row['leads']:3d}  [{row['position']:2d}] {row['name']}")

    count_row = sql_query(
        PROD_REF,
        f"""
        WITH incident AS (
          SELECT DISTINCT lead_id FROM public.activities
          WHERE organization_id='{ORG_ID}' AND type='status_change'
            AND created_at >= '{INCIDENT_START}' AND created_at < '{INCIDENT_END}'
        )
        SELECT COUNT(*)::int AS c FROM incident
        """,
        read_only=True,
    )
    n = count_row[0]["c"]
    print(f"Leads a corrigir: {n}")

    if dry_run:
        print("DRY-RUN: nenhuma alteração aplicada.")
        return 0

    rollback = export_rollback(PROD_REF)
    print(f"Rollback salvo: {rollback}")

    update_sql = f"""
    BEGIN;
    WITH stages AS (
      SELECT id, position FROM public.pipeline_stages WHERE organization_id = '{ORG_ID}'
    ),
    max_pos AS (SELECT MAX(position) AS m FROM stages),
    incident AS (
      SELECT DISTINCT a.lead_id
      FROM public.activities a
      WHERE a.organization_id = '{ORG_ID}'
        AND a.type = 'status_change'
        AND a.created_at >= '{INCIDENT_START}'
        AND a.created_at < '{INCIDENT_END}'
    ),
    prior AS (
      SELECT a.lead_id, COUNT(*)::int AS prior_moves
      FROM public.activities a
      WHERE a.organization_id = '{ORG_ID}'
        AND a.type = 'status_change'
        AND a.created_at < '2026-06-08 12:30:00+00'
      GROUP BY a.lead_id
    ),
    recusou AS (
      SELECT lt.lead_id
      FROM public.lead_tags lt
      JOIN public.tags t ON t.id = lt.tag_id
      WHERE t.organization_id = '{ORG_ID}' AND lower(t.name) = 'recusou'
    ),
    target AS (
      SELECT
        i.lead_id,
        CASE
          WHEN r.lead_id IS NOT NULL THEN '{NEGADAS_STAGE_ID}'::uuid
          ELSE (
            SELECT s.id FROM stages s
            WHERE s.position = LEAST(COALESCE(p.prior_moves, 0), (SELECT m FROM max_pos))
          )
        END AS stage_id
      FROM incident i
      LEFT JOIN prior p ON p.lead_id = i.lead_id
      LEFT JOIN recusou r ON r.lead_id = i.lead_id
    )
    UPDATE public.leads l
    SET stage_id = t.stage_id, updated_at = now()
    FROM target t
    WHERE l.id = t.lead_id
      AND l.organization_id = '{ORG_ID}'
      AND l.deleted_at IS NULL
      AND l.stage_id IS DISTINCT FROM t.stage_id;
    COMMIT;
    """
    sql_exec(update_sql)
    return n


def verify_distribution() -> None:
    rows = sql_query(
        PROD_REF,
        f"""
        SELECT ps.name, ps.position, COUNT(l.id)::int AS leads
        FROM public.pipeline_stages ps
        LEFT JOIN public.leads l
          ON l.stage_id = ps.id
         AND l.organization_id = ps.organization_id
         AND l.deleted_at IS NULL
        WHERE ps.organization_id = '{ORG_ID}'
        GROUP BY ps.name, ps.position
        ORDER BY ps.position
        """,
        read_only=True,
    )
    print("\nDistribuição ATUAL em produção:")
    for r in rows:
        print(f"  {r['leads']:3d}  [{r['position']:2d}] {r['name']}")


def cleanup_temp_projects() -> None:
    for ref in ("fwxmmfpudljwfixpazur",):
        status, payload = api("GET", f"/v1/projects/{ref}")
        if status == 200:
            print(f"Removendo projeto temporário {ref}...")
            api("DELETE", f"/v1/projects/{ref}")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--skip-backup-api", action="store_true")
    args = parser.parse_args()

    print("=" * 60)
    print(f"Restauração automática — {ORG_NAME}")
    print(f"Backup alvo: {BACKUP_ISO} (id {BACKUP_ID})")
    print("=" * 60)

    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    meta = {
        "started_at": datetime.now(timezone.utc).isoformat(),
        "org_id": ORG_ID,
        "backup_id": BACKUP_ID,
        "dry_run": args.dry_run,
    }
    (REPORT_DIR / "run_meta.json").write_text(json.dumps(meta, indent=2))

    clone_ref = None
    if not args.skip_backup_api:
        clone_ref = try_backup_clone(max_wait_sec=60)

    if clone_ref:
        print(f"Restaurando a partir do clone {clone_ref}...")
        n = restore_from_clone(clone_ref, args.dry_run)
        method = "backup_clone"
    else:
        print("Clone via API indisponível — usando proxy por histórico de atividades.")
        n = restore_from_activity_proxy(args.dry_run)
        method = "activity_proxy"

    if not args.dry_run:
        verify_distribution()
        cleanup_temp_projects()

    print(f"\nConcluído ({method}). Registros afetados: {n}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
