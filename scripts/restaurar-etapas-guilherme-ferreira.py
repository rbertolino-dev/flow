#!/usr/bin/env python3
"""
Restaura stage_id dos leads da org GUILHERME FERREIRA MÓVEIS a partir de um
projeto Supabase clonado do backup (Opção 1 — Restore to New Project).

Uso:
  # 1) No Dashboard Supabase: Database → Backups → Restore to new project
  #    Backup: 2026-06-08 04:38 UTC (antes do incidente às 12:31 UTC)
  # 2) Após o clone ficar ACTIVE_HEALTHY:
  export RESTORE_PROJECT_REF="<ref-do-projeto-clonado>"
  python3 scripts/restaurar-etapas-guilherme-ferreira.py

  # Dry-run (só gera relatório, não altera produção):
  python3 scripts/restaurar-etapas-guilherme-ferreira.py --dry-run

  # Aplicar a partir de CSV exportado manualmente do clone:
  python3 scripts/restaurar-etapas-guilherme-ferreira.py --csv backup_leads.csv
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import subprocess
import sys
import urllib.error
import urllib.request
from collections import Counter
from dataclasses import dataclass
from pathlib import Path
from typing import Any

ORG_ID = "20b10048-88c4-4a9e-b72a-ac1c407e95c6"
ORG_NAME = "GUILHERME FERREIRA MÓVEIS"
PRODUCTION_REF = "ogeljmbhqxpfjbpnbwog"
FIRST_STAGE_ID = "3ece7fe1-b7a8-4e45-a29c-8dd37d6d07ce"
INCIDENT_ISO = "2026-06-08T12:30:00+00:00"
REPORT_DIR = Path(__file__).resolve().parent.parent / "tmp" / "restauracao-guilherme-ferreira"


@dataclass
class LeadStage:
    lead_id: str
    name: str
    stage_id: str | None
    stage_name: str | None


def load_service_role(project_ref: str) -> str:
    env_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    if env_key:
        return env_key
    try:
        out = subprocess.check_output(
            ["supabase", "projects", "api-keys", "--project-ref", project_ref],
            stderr=subprocess.STDOUT,
            text=True,
        )
    except (subprocess.CalledProcessError, FileNotFoundError) as exc:
        raise RuntimeError(
            "Não foi possível obter service_role. Defina SUPABASE_SERVICE_ROLE_KEY "
            f"ou instale/autentique o Supabase CLI. Detalhe: {exc}"
        ) from exc
    for line in out.splitlines():
        parts = line.split("|")
        if len(parts) >= 3 and parts[1].strip() == "service_role":
            return parts[2].strip()
    raise RuntimeError("service_role não encontrado no output do supabase CLI")


def rest_get(project_ref: str, key: str, path: str, params: str = "") -> Any:
    url = f"https://{project_ref}.supabase.co/rest/v1/{path}"
    if params:
        url = f"{url}?{params}"
    req = urllib.request.Request(
        url,
        headers={
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Accept": "application/json",
        },
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        return json.loads(resp.read().decode())


def rest_patch(project_ref: str, key: str, lead_id: str, stage_id: str) -> None:
    url = (
        f"https://{project_ref}.supabase.co/rest/v1/leads"
        f"?id=eq.{lead_id}&organization_id=eq.{ORG_ID}"
    )
    body = json.dumps({"stage_id": stage_id}).encode()
    req = urllib.request.Request(
        url,
        data=body,
        method="PATCH",
        headers={
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            "Prefer": "return=minimal",
        },
    )
    with urllib.request.urlopen(req, timeout=60):
        return


def paginate_leads(project_ref: str, key: str) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    offset = 0
    page_size = 200
    while True:
        params = (
            f"organization_id=eq.{ORG_ID}"
            "&deleted_at=is.null"
            "&select=id,name,stage_id"
            f"&limit={page_size}&offset={offset}"
        )
        batch = rest_get(project_ref, key, "leads", params)
        if not batch:
            break
        rows.extend(batch)
        if len(batch) < page_size:
            break
        offset += page_size
    return rows


def load_stages(project_ref: str, key: str) -> dict[str, str]:
    params = (
        f"organization_id=eq.{ORG_ID}"
        "&select=id,name,position"
        "&order=position.asc"
    )
    stages = rest_get(project_ref, key, "pipeline_stages", params)
    return {s["id"]: s["name"] for s in stages}


def load_from_csv(path: Path) -> list[LeadStage]:
    rows: list[LeadStage] = []
    with path.open(newline="", encoding="utf-8") as fh:
        reader = csv.DictReader(fh)
        for row in reader:
            rows.append(
                LeadStage(
                    lead_id=row["lead_id"].strip(),
                    name=(row.get("name") or "").strip(),
                    stage_id=(row.get("stage_id") or "").strip() or None,
                    stage_name=(row.get("stage_name") or "").strip() or None,
                )
            )
    return rows


def load_from_project(project_ref: str) -> list[LeadStage]:
    key = load_service_role(project_ref)
    stage_names = load_stages(project_ref, key)
    leads = paginate_leads(project_ref, key)
    return [
        LeadStage(
            lead_id=l["id"],
            name=l.get("name") or "",
            stage_id=l.get("stage_id"),
            stage_name=stage_names.get(l.get("stage_id") or ""),
        )
        for l in leads
    ]


def write_report(name: str, payload: Any) -> Path:
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    path = REPORT_DIR / name
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    return path


def main() -> int:
    parser = argparse.ArgumentParser(description="Restaura etapas dos leads — Guilherme Ferreira Móveis")
    parser.add_argument("--dry-run", action="store_true", help="Não aplica PATCH em produção")
    parser.add_argument("--csv", type=Path, help="CSV com lead_id,stage_id,name,stage_name do backup")
    parser.add_argument(
        "--restore-project-ref",
        default=os.environ.get("RESTORE_PROJECT_REF", ""),
        help="Ref do projeto clonado do backup (Dashboard → Restore to new project)",
    )
    args = parser.parse_args()

    print(f"Organização: {ORG_NAME} ({ORG_ID})")
    print(f"Produção: {PRODUCTION_REF}")
    print(f"Incidente conhecido: {INCIDENT_ISO}")
    print()

    if args.csv:
        print(f"Fonte: CSV {args.csv}")
        backup_rows = load_from_csv(args.csv)
    elif args.restore_project_ref:
        print(f"Fonte: projeto clonado {args.restore_project_ref}")
        backup_rows = load_from_project(args.restore_project_ref)
    else:
        print("ERRO: informe --restore-project-ref ou --csv")
        print()
        print("Passos no Dashboard Supabase:")
        print("  1. Projeto flow → Database → Backups → Restore to new project")
        print("  2. Selecione backup: 2026-06-08 04:38 UTC")
        print("  3. Aguarde o clone ficar ACTIVE_HEALTHY")
        print("  4. Execute:")
        print("     export RESTORE_PROJECT_REF=<ref-do-clone>")
        print("     python3 scripts/restaurar-etapas-guilherme-ferreira.py")
        return 1

    prod_key = load_service_role(PRODUCTION_REF)
    prod_rows = paginate_leads(PRODUCTION_REF, prod_key)
    prod_by_id = {r["id"]: r for r in prod_rows}
    stage_names = load_stages(PRODUCTION_REF, prod_key)

    backup_by_id = {r.lead_id: r for r in backup_rows}
    changes: list[dict[str, Any]] = []
    skipped = 0

    for lead_id, backup in backup_by_id.items():
        prod = prod_by_id.get(lead_id)
        if not prod:
            skipped += 1
            continue
        target_stage = backup.stage_id
        if not target_stage:
            continue
        current_stage = prod.get("stage_id")
        if current_stage == target_stage:
            continue
        changes.append(
            {
                "lead_id": lead_id,
                "name": backup.name or prod.get("name"),
                "from_stage_id": current_stage,
                "from_stage_name": stage_names.get(current_stage or "", "(sem etapa)"),
                "to_stage_id": target_stage,
                "to_stage_name": backup.stage_name or stage_names.get(target_stage, "?"),
            }
        )

    dist_before = Counter(stage_names.get(r.get("stage_id") or "", "(sem)") for r in prod_rows)
    dist_after = Counter(
        stage_names.get(c["to_stage_id"] if any(c["lead_id"] == r["id"] for c in changes) else r.get("stage_id") or "", "(sem)")
        for r in prod_rows
    )
    for c in changes:
        dist_after[stage_names.get(c["to_stage_id"], "?")] += 0  # ensure keys exist

    # Recalcular dist_after corretamente
    after_map = {r["id"]: r.get("stage_id") for r in prod_rows}
    for c in changes:
        after_map[c["lead_id"]] = c["to_stage_id"]
    dist_after = Counter(stage_names.get(sid or "", "(sem)") for sid in after_map.values())

    report = {
        "org_id": ORG_ID,
        "org_name": ORG_NAME,
        "production_ref": PRODUCTION_REF,
        "restore_source": str(args.csv) if args.csv else args.restore_project_ref,
        "leads_in_backup": len(backup_rows),
        "leads_in_production": len(prod_rows),
        "changes_to_apply": len(changes),
        "skipped_missing_in_production": skipped,
        "distribution_before": dict(dist_before),
        "distribution_after": dict(dist_after),
        "changes": changes,
    }
    report_path = write_report("plano-restauracao.json", report)
    csv_path = REPORT_DIR / "updates.csv"
    with csv_path.open("w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(
            fh,
            fieldnames=["lead_id", "name", "from_stage_name", "to_stage_id", "to_stage_name"],
        )
        writer.writeheader()
        for c in changes:
            writer.writerow(
                {
                    "lead_id": c["lead_id"],
                    "name": c["name"],
                    "from_stage_name": c["from_stage_name"],
                    "to_stage_id": c["to_stage_id"],
                    "to_stage_name": c["to_stage_name"],
                }
            )

    print(f"Leads no backup: {len(backup_rows)}")
    print(f"Leads em produção: {len(prod_rows)}")
    print(f"Alterações necessárias: {len(changes)}")
    print(f"Relatório: {report_path}")
    print(f"CSV updates: {csv_path}")
    print()
    print("Distribuição ANTES (produção atual):")
    for name, count in sorted(dist_before.items(), key=lambda x: (-x[1], x[0])):
        print(f"  {count:3d}  {name}")
    print()
    print("Distribuição DEPOIS (prevista):")
    for name, count in sorted(dist_after.items(), key=lambda x: (-x[1], x[0])):
        print(f"  {count:3d}  {name}")

    if args.dry_run:
        print()
        print("DRY-RUN: nenhuma alteração aplicada.")
        return 0

    if not changes:
        print()
        print("Nada a restaurar — etapas já coincidem com o backup.")
        return 0

    print()
    print("Aplicando restauração em produção...")
    applied = 0
    errors: list[str] = []
    for c in changes:
        try:
            rest_patch(PRODUCTION_REF, prod_key, c["lead_id"], c["to_stage_id"])
            applied += 1
        except urllib.error.HTTPError as exc:
            body = exc.read().decode(errors="replace")
            errors.append(f"{c['lead_id']} ({c['name']}): HTTP {exc.code} {body}")
        except Exception as exc:  # noqa: BLE001
            errors.append(f"{c['lead_id']} ({c['name']}): {exc}")

    result = {"applied": applied, "errors": errors, "total": len(changes)}
    write_report("resultado-aplicacao.json", result)

    print(f"Aplicados: {applied}/{len(changes)}")
    if errors:
        print(f"Erros: {len(errors)}")
        for err in errors[:10]:
            print(f"  - {err}")
        return 1

    print("Restauração concluída com sucesso.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
