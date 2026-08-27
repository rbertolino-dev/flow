#!/usr/bin/env bash
# Restaura etapas dos leads — GUILHERME FERREIRA MÓVEIS (Opção 1: backup)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  Restauração de etapas — Guilherme Ferreira Móveis          ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "Backup alvo: 2026-06-08 04:38 UTC (antes do incidente 12:31 UTC)"
echo ""

if [[ -z "${RESTORE_PROJECT_REF:-}" && -z "${1:-}" ]]; then
  echo "⚠️  RESTORE_PROJECT_REF não definido."
  echo ""
  echo "No Dashboard Supabase (projeto flow):"
  echo "  Database → Backups → Restore to new project"
  echo "  → backup de 08/06/2026 ~04:38 UTC"
  echo "  → aguarde o clone ficar ACTIVE_HEALTHY"
  echo ""
  echo "Depois execute:"
  echo "  export RESTORE_PROJECT_REF=<ref-do-projeto-clonado>"
  echo "  ./scripts/restaurar-etapas-guilherme-ferreira.sh"
  echo ""
  echo "Alternativa com CSV (SQL em scripts/exportar-etapas-backup-guilherme.sql):"
  echo "  ./scripts/restaurar-etapas-guilherme-ferreira.sh /caminho/backup_leads.csv"
  exit 1
fi

if [[ -n "${1:-}" ]]; then
  python3 scripts/restaurar-etapas-guilherme-ferreira.py --csv "$1"
else
  python3 scripts/restaurar-etapas-guilherme-ferreira.py --restore-project-ref "$RESTORE_PROJECT_REF"
fi
