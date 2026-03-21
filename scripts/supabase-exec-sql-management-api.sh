#!/usr/bin/env bash
# Executa um ficheiro .sql no Postgres do projeto Supabase linkado,
# via Management API (POST /v1/projects/{ref}/database/query).
# Requer: supabase link + `supabase login` (token em ~/.supabase/access-token).
# Uso: ./scripts/supabase-exec-sql-management-api.sh caminho/para/arquivo.sql
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SQL_FILE="${1:?Uso: $0 <ficheiro.sql>}"
TOKEN_FILE="${SUPABASE_ACCESS_TOKEN_FILE:-$HOME/.supabase/access-token}"
REF_FILE="$ROOT/supabase/.temp/project-ref"
[[ -f "$SQL_FILE" ]] || { echo "Ficheiro não encontrado: $SQL_FILE" >&2; exit 1; }
[[ -f "$TOKEN_FILE" ]] || { echo "Token não encontrado: $TOKEN_FILE (faça supabase login)" >&2; exit 1; }
[[ -f "$REF_FILE" ]] || { echo "Projeto não linkado: falta $REF_FILE" >&2; exit 1; }
TOKEN="$(cat "$TOKEN_FILE")"
REF="$(tr -d '[:space:]' < "$REF_FILE")"
TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT
jq -n --rawfile q "$SQL_FILE" '{query: $q}' >"$TMP"
curl -sS -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d @"$TMP" \
  "https://api.supabase.com/v1/projects/$REF/database/query"
echo
