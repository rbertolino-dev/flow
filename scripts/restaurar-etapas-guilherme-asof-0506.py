#!/usr/bin/env python3
"""
Restaura stage_id da org GUILHERME FERREIRA MÓVEIS usando o melhor dado disponível
para o fim do dia 05/06/2026 (horário Brasil).

Descoberta importante: backups físicos (04/06 a 08/06) mostram os 96 leads na
etapa 0 no banco — a edição manual do dia 05/06 NÃO foi persistida. O histórico
de atividades (status_change) é a melhor fonte restante.

Uso:
  export PGPASSWORD='...'
  python3 scripts/restaurar-etapas-guilherme-asof-0506.py --dry-run
  python3 scripts/restaurar-etapas-guilherme-asof-0506.py
  python3 scripts/restaurar-etapas-guilherme-asof-0506.py --csv etapas_cliente.csv
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

ORG_ID = "20b10048-88c4-4a9e-b72a-ac1c407e95c6"
ORG_NAME = "GUILHERME FERREIRA MÓVEIS"
# Fim do dia 05/06/2026 em BRT (UTC-3) = 06/06 03:00 UTC
CUTOFF_UTC = "2026-06-06 03:00:00+00"
NEGADAS_STAGE_ID = "5a0e9544-c455-41c1-92b0-ed83b2968c1f"
NEGADAS_LEAD_ID = "3ef249e3-8b13-48d4-8a49-d1329f2013bd"  # Claudinéia — estava em Negadas antes do incidente
REPORT_DIR = Path(__file__).resolve().parent.parent / "tmp" / "restauracao-guilherme-ferreira"


def pg_env() -> dict[str, str]:
    env = os.environ.copy()
    env.setdefault("PGUSER", "postgres.ogeljmbhqxpfjbpnbwog")
    env.setdefault("PGHOST", "aws-1-sa-east-1.pooler.supabase.com")
    env.setdefault("PGPORT", "5432")
    env.setdefault("PGDATABASE", "postgres")
    env.setdefault("PGSSLMODE", "require")
    if not env.get("PGPASSWORD"):
        raise RuntimeError("Defina PGPASSWORD antes de executar.")
    return env


def sql_json(query: str) -> list[dict]:
    env = pg_env()
    stripped = query.strip().rstrip(";")
    proc = subprocess.run(
        [
            "psql", "-v", "ON_ERROR_STOP=1", "-t", "-A", "-c",
            f"SELECT COALESCE(json_agg(t), '[]'::json)::text FROM ({stripped}) t;",
        ],
        env=env,
        capture_output=True,
        text=True,
        check=False,
    )
    if proc.returncode != 0:
        raise RuntimeError(proc.stderr.strip() or proc.stdout.strip())
    raw = proc.stdout.strip()
    if not raw:
        return []
    data = json.loads(raw)
    return data if isinstance(data, list) else [data]


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


def export_rollback() -> Path:
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    path = REPORT_DIR / f"rollback_asof_0506_{ts}.sql"
    rows = sql_json(
        f"""
        SELECT id, stage_id FROM public.leads
        WHERE organization_id = '{ORG_ID}' AND deleted_at IS NULL ORDER BY id
        """
    )
    lines = [
        "-- ROLLBACK antes da restauração as-of 05/06",
        f"-- {datetime.now(timezone.utc).isoformat()}",
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


def preview_activity_based() -> list[dict]:
    return sql_json(
        f"""
        WITH stages AS (
          SELECT id, name, position FROM public.pipeline_stages
          WHERE organization_id = '{ORG_ID}'
        ),
        max_pos AS (SELECT MAX(position) AS m FROM stages),
        prior AS (
          SELECT a.lead_id, COUNT(*)::int AS prior_moves
          FROM public.activities a
          WHERE a.organization_id = '{ORG_ID}'
            AND a.type = 'status_change'
            AND a.created_at < '{CUTOFF_UTC}'
          GROUP BY a.lead_id
        ),
        target AS (
          SELECT
            l.id AS lead_id,
            l.name,
            CASE
              WHEN l.id = '{NEGADAS_LEAD_ID}' THEN '{NEGADAS_STAGE_ID}'::uuid
              ELSE (
                SELECT s.id FROM stages s
                WHERE s.position = LEAST(COALESCE(p.prior_moves, 0), (SELECT m FROM max_pos))
              )
            END AS stage_id
          FROM public.leads l
          LEFT JOIN prior p ON p.lead_id = l.id
          WHERE l.organization_id = '{ORG_ID}' AND l.deleted_at IS NULL
        )
        SELECT ps.position, ps.name, COUNT(*)::int AS leads
        FROM target t
        JOIN stages ps ON ps.id = t.stage_id
        GROUP BY ps.position, ps.name
        ORDER BY ps.position
        """
    )


def load_csv(path: Path) -> dict[str, str]:
    mapping: dict[str, str] = {}
    with path.open(newline="", encoding="utf-8") as fh:
        reader = csv.DictReader(fh)
        for row in reader:
            lead_id = (row.get("lead_id") or row.get("id") or "").strip()
            stage_id = (row.get("stage_id") or "").strip()
            if lead_id and stage_id:
                mapping[lead_id] = stage_id
    return mapping


def apply_activity_based(dry_run: bool) -> int:
    preview = preview_activity_based()
    print("Distribuição alvo (histórico até fim de 05/06/2026):")
    for row in preview:
        print(f"  {row['leads']:3d}  [{row['position']:2d}] {row['name']}")

    changes = sql_json(
        f"""
        WITH stages AS (
          SELECT id, position FROM public.pipeline_stages WHERE organization_id = '{ORG_ID}'
        ),
        max_pos AS (SELECT MAX(position) AS m FROM stages),
        prior AS (
          SELECT a.lead_id, COUNT(*)::int AS prior_moves
          FROM public.activities a
          WHERE a.organization_id = '{ORG_ID}'
            AND a.type = 'status_change'
            AND a.created_at < '{CUTOFF_UTC}'
          GROUP BY a.lead_id
        ),
        target AS (
          SELECT
            l.id AS lead_id,
            CASE
              WHEN l.id = '{NEGADAS_LEAD_ID}' THEN '{NEGADAS_STAGE_ID}'::uuid
              ELSE (
                SELECT s.id FROM stages s
                WHERE s.position = LEAST(COALESCE(p.prior_moves, 0), (SELECT m FROM max_pos))
              )
            END AS stage_id
          FROM public.leads l
          LEFT JOIN prior p ON p.lead_id = l.id
          WHERE l.organization_id = '{ORG_ID}' AND l.deleted_at IS NULL
        )
        SELECT COUNT(*)::int AS c
        FROM public.leads l
        JOIN target t ON t.lead_id = l.id
        WHERE l.stage_id IS DISTINCT FROM t.stage_id
        """
    )
    n = changes[0]["c"] if changes else 0
    print(f"Leads a atualizar: {n}")

    if dry_run or n == 0:
        return 0

    rollback = export_rollback()
    print(f"Rollback: {rollback}")

    sql_exec(
        f"""
        BEGIN;
        WITH stages AS (
          SELECT id, position FROM public.pipeline_stages WHERE organization_id = '{ORG_ID}'
        ),
        max_pos AS (SELECT MAX(position) AS m FROM stages),
        prior AS (
          SELECT a.lead_id, COUNT(*)::int AS prior_moves
          FROM public.activities a
          WHERE a.organization_id = '{ORG_ID}'
            AND a.type = 'status_change'
            AND a.created_at < '{CUTOFF_UTC}'
          GROUP BY a.lead_id
        ),
        target AS (
          SELECT
            l.id AS lead_id,
            CASE
              WHEN l.id = '{NEGADAS_LEAD_ID}' THEN '{NEGADAS_STAGE_ID}'::uuid
              ELSE (
                SELECT s.id FROM stages s
                WHERE s.position = LEAST(COALESCE(p.prior_moves, 0), (SELECT m FROM max_pos))
              )
            END AS stage_id
          FROM public.leads l
          LEFT JOIN prior p ON p.lead_id = l.id
          WHERE l.organization_id = '{ORG_ID}' AND l.deleted_at IS NULL
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
    )
    return n


def apply_csv(csv_path: Path, dry_run: bool) -> int:
    mapping = load_csv(csv_path)
    if not mapping:
        raise RuntimeError(f"CSV vazio ou inválido: {csv_path}")

    stages = {r["id"] for r in sql_json(
        f"SELECT id FROM pipeline_stages WHERE organization_id = '{ORG_ID}'"
    )}
    invalid = [sid for sid in mapping.values() if sid not in stages]
    if invalid:
        raise RuntimeError(f"stage_id inválidos no CSV: {invalid[:3]}")

    n = sum(
        1
        for lead_id, stage_id in mapping.items()
        if sql_json(
            f"SELECT (stage_id IS DISTINCT FROM '{stage_id}'::uuid)::int AS c "
            f"FROM leads WHERE id = '{lead_id}' AND organization_id = '{ORG_ID}' "
            f"AND deleted_at IS NULL"
        )[0]["c"]
    )
    print(f"Leads a atualizar via CSV: {n}")
    if dry_run or n == 0:
        return 0

    rollback = export_rollback()
    print(f"Rollback: {rollback}")

    values = ",\n".join(
        f"('{lid}'::uuid, '{sid}'::uuid)" for lid, sid in mapping.items()
    )
    sql_exec(
        f"""
        BEGIN;
        WITH backup(lead_id, stage_id) AS (VALUES {values})
        UPDATE public.leads l
        SET stage_id = b.stage_id, updated_at = now()
        FROM backup b
        WHERE l.id = b.lead_id
          AND l.organization_id = '{ORG_ID}'
          AND l.deleted_at IS NULL
          AND l.stage_id IS DISTINCT FROM b.stage_id;
        COMMIT;
        """
    )
    return n


def export_preview_csv() -> Path:
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    path = REPORT_DIR / "preview_asof_0506.csv"
    rows = sql_json(
        f"""
        WITH stages AS (
          SELECT id, name, position FROM public.pipeline_stages
          WHERE organization_id = '{ORG_ID}'
        ),
        max_pos AS (SELECT MAX(position) AS m FROM stages),
        prior AS (
          SELECT a.lead_id, COUNT(*)::int AS prior_moves
          FROM public.activities a
          WHERE a.organization_id = '{ORG_ID}'
            AND a.type = 'status_change'
            AND a.created_at < '{CUTOFF_UTC}'
          GROUP BY a.lead_id
        ),
        target AS (
          SELECT
            l.id AS lead_id,
            l.name,
            CASE
              WHEN l.id = '{NEGADAS_LEAD_ID}' THEN '{NEGADAS_STAGE_ID}'::uuid
              ELSE (
                SELECT s.id FROM stages s
                WHERE s.position = LEAST(COALESCE(p.prior_moves, 0), (SELECT m FROM max_pos))
              )
            END AS stage_id
          FROM public.leads l
          LEFT JOIN prior p ON p.lead_id = l.id
          WHERE l.organization_id = '{ORG_ID}' AND l.deleted_at IS NULL
        )
        SELECT t.lead_id, t.name, t.stage_id, ps.name AS stage_name, ps.position AS stage_position,
               cur.name AS etapa_atual
        FROM target t
        JOIN stages ps ON ps.id = t.stage_id
        LEFT JOIN stages cur ON cur.id = (
          SELECT stage_id FROM leads WHERE id = t.lead_id
        )
        ORDER BY ps.position, t.name
        """
    )
    with path.open("w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(
            fh,
            fieldnames=[
                "lead_id", "name", "stage_id", "stage_name",
                "stage_position", "etapa_atual",
            ],
        )
        w.writeheader()
        w.writerows(rows)
    return path


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--csv", type=Path, help="CSV do cliente com lead_id,stage_id")
    parser.add_argument("--export-preview", action="store_true")
    args = parser.parse_args()

    print("=" * 60)
    print(f"Restauração as-of 05/06/2026 — {ORG_NAME}")
    print("=" * 60)

    preview_path = export_preview_csv()
    print(f"Preview CSV: {preview_path}")

    if args.csv:
        n = apply_csv(args.csv, args.dry_run)
    else:
        n = apply_activity_based(args.dry_run)

    if args.dry_run:
        print("DRY-RUN: nenhuma alteração aplicada.")
    elif n:
        rows = sql_json(
            f"""
            SELECT ps.position, ps.name, COUNT(l.id)::int AS leads
            FROM pipeline_stages ps
            LEFT JOIN leads l ON l.stage_id = ps.id
              AND l.organization_id = ps.organization_id AND l.deleted_at IS NULL
            WHERE ps.organization_id = '{ORG_ID}'
            GROUP BY ps.position, ps.name ORDER BY ps.position
            """
        )
        print("\nDistribuição APÓS correção:")
        for r in rows:
            print(f"  {r['leads']:3d}  [{r['position']:2d}] {r['name']}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
