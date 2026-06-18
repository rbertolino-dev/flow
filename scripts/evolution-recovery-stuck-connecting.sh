#!/usr/bin/env bash
# Recuperação: instâncias presas em "connecting" após hardening (18/06/2026).
#
# Hipótese: CACHE_REDIS_SAVE_INSTANCES + restart deixou estado Baileys inconsistente
# entre Redis (hash) e Postgres (Session). Sessões existem no DB mas /connect retorna QR.
#
# Ações:
#  1. Backup yaml atual
#  2. CACHE_REDIS_SAVE_INSTANCES=false (reverte persistência Redis de instância)
#  3. CONFIG_SESSION_PHONE_VERSION=2.3000.1019673114 (valor do backup pré-hardening)
#  4. Mantém CHATWOOT corrigido e imagem v2.3.7
#  5. Remove chaves evolution:instance:* do Redis db 8 (força releitura do Postgres)
#  6. stack deploy + monitora open count
#
# Uso: ./scripts/evolution-recovery-stuck-connecting.sh [--dry-run]
set -euo pipefail

DRY_RUN=false
[[ "${1:-}" == "--dry-run" ]] && DRY_RUN=true

EVO_YAML="/root/evolution.yaml"
BACKUP_DIR="/root/evolution-hardening-backups"
TS="$(date -u +%Y%m%d-%H%M%S)"

log() { echo "[$(date -u +%H:%M:%S)] $*"; }

command -v docker >/dev/null || { echo "docker não encontrado"; exit 1; }
[[ -f "$EVO_YAML" ]] || { echo "Não encontrado: $EVO_YAML"; exit 1; }
mkdir -p "$BACKUP_DIR"

OPEN_BEFORE=$(docker exec "$(docker ps --filter name=postgres_postgres --format '{{.Names}}' | head -1)" \
  psql -U postgres -d evolution -Atc 'select count(*) from "Instance" where "connectionStatus"::text = '\''open'\'';' 2>/dev/null || echo "?")
CONN_BEFORE=$(docker exec "$(docker ps --filter name=postgres_postgres --format '{{.Names}}' | head -1)" \
  psql -U postgres -d evolution -Atc 'select count(*) from "Instance" where "connectionStatus"::text = '\''connecting'\'';' 2>/dev/null || echo "?")
log "ANTES: open=${OPEN_BEFORE} connecting=${CONN_BEFORE}"

if $DRY_RUN; then
  log "DRY-RUN: aplicaria CACHE_REDIS_SAVE_INSTANCES=false, PHONE_VERSION=2.3000.1019673114, flush redis instance keys, stack deploy"
  exit 0
fi

cp -a "$EVO_YAML" "${BACKUP_DIR}/evolution.yaml.pre-recovery.${TS}.bak"
log "Backup: ${BACKUP_DIR}/evolution.yaml.pre-recovery.${TS}.bak"

python3 <<'PY'
from pathlib import Path
import re
path = Path("/root/evolution.yaml")
text = path.read_text()
text = re.sub(r"CACHE_REDIS_SAVE_INSTANCES=true", "CACHE_REDIS_SAVE_INSTANCES=false", text)
text = re.sub(
    r"CONFIG_SESSION_PHONE_VERSION=[^\n]+",
    "CONFIG_SESSION_PHONE_VERSION=2.3000.1019673114",
    text,
    count=1,
)
path.write_text(text)
print("yaml patched")
PY

REDIS_CONTAINER=$(docker ps --filter name=redis_redis --format '{{.Names}}' | head -1)
if [[ -n "$REDIS_CONTAINER" ]]; then
  log "Removendo chaves evolution:instance:* do Redis db 8..."
  COUNT=0
  while IFS= read -r key; do
    [[ -z "$key" ]] && continue
    docker exec "$REDIS_CONTAINER" redis-cli -n 8 DEL "$key" >/dev/null
    COUNT=$((COUNT + 1))
  done < <(docker exec "$REDIS_CONTAINER" redis-cli -n 8 --scan --pattern 'evolution:instance:*' 2>/dev/null || true)
  log "Chaves removidas: ${COUNT}"
fi

log "stack deploy..."
docker stack deploy -c "$EVO_YAML" evolution

for i in $(seq 1 24); do
  REPLICAS=$(docker service ls --filter name=evolution_evolution --format '{{.Replicas}}' 2>/dev/null || echo "")
  log "  aguardando $i/24 replicas=${REPLICAS}"
  [[ "$REPLICAS" == "1/1" ]] && sleep 20 && break
  sleep 5
done

log "Monitorando reconexão (6 x 30s)..."
for i in $(seq 1 6); do
  OPEN_NOW=$(docker exec "$(docker ps --filter name=postgres_postgres --format '{{.Names}}' | head -1)" \
    psql -U postgres -d evolution -Atc 'select count(*) from "Instance" where "connectionStatus"::text = '\''open'\'';' 2>/dev/null || echo "?")
  CONN_NOW=$(docker exec "$(docker ps --filter name=postgres_postgres --format '{{.Names}}' | head -1)" \
    psql -U postgres -d evolution -Atc 'select count(*) from "Instance" where "connectionStatus"::text = '\''connecting'\'';' 2>/dev/null || echo "?")
  log "  t+${i}*30s: open=${OPEN_NOW} connecting=${CONN_NOW}"
  [[ "$OPEN_NOW" != "?" && "$OPEN_NOW" -gt 0 ]] && break
  sleep 30
done

OPEN_AFTER=$(docker exec "$(docker ps --filter name=postgres_postgres --format '{{.Names}}' | head -1)" \
  psql -U postgres -d evolution -Atc 'select count(*) from "Instance" where "connectionStatus"::text = '\''open'\'';' 2>/dev/null || echo "?")
log "DEPOIS: open=${OPEN_AFTER} (antes: ${OPEN_BEFORE})"
log "✅ Recovery concluído. Se open=0: chips precisam QR manual no CRM (sessão Baileys invalidada)."
