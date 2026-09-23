#!/bin/bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
source "$SCRIPT_DIR/.ssh-credentials"
MIGRATION_FILE="$SCRIPT_DIR/../supabase/migrations/20260923140000_pos_settings.sql"
TEMP_FILE="/tmp/pos_settings.sql"

CREDS=$(sshpass -p "$SSH_PASSWORD" ssh -o StrictHostKeyChecking=no "$SSH_USER@$SSH_HOST" \
  "cat /root/postgresql-budget-credentials.txt 2>/dev/null || true")
POSTGRES_HOST=$(echo "$CREDS" | grep "POSTGRES_HOST=" | cut -d'=' -f2 | tr -d ' ')
POSTGRES_PORT=$(echo "$CREDS" | grep "POSTGRES_PORT=" | cut -d'=' -f2 | tr -d ' ')
POSTGRES_DB=$(echo "$CREDS" | grep "POSTGRES_DB=" | cut -d'=' -f2 | tr -d ' ')
POSTGRES_USER=$(echo "$CREDS" | grep "POSTGRES_USER=" | cut -d'=' -f2 | tr -d ' ')
POSTGRES_PASSWORD=$(echo "$CREDS" | grep "POSTGRES_PASSWORD=" | cut -d'=' -f2 | tr -d ' ')
POSTGRES_HOST=${POSTGRES_HOST:-localhost}
POSTGRES_PORT=${POSTGRES_PORT:-5432}
POSTGRES_DB=${POSTGRES_DB:-budget_services}
POSTGRES_USER=${POSTGRES_USER:-budget_user}

sshpass -p "$SSH_PASSWORD" scp -o StrictHostKeyChecking=no "$MIGRATION_FILE" "$SSH_USER@$SSH_HOST:$TEMP_FILE"
sshpass -p "$SSH_PASSWORD" ssh -o StrictHostKeyChecking=no "$SSH_USER@$SSH_HOST" \
  "export PGPASSWORD='$POSTGRES_PASSWORD' && psql -h $POSTGRES_HOST -p $POSTGRES_PORT -U $POSTGRES_USER -d $POSTGRES_DB -v ON_ERROR_STOP=1 -f $TEMP_FILE && rm -f $TEMP_FILE"
echo "✅ Migration pos_settings aplicada"
