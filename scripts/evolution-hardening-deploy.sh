#!/usr/bin/env bash
# Hardening cauteloso da Evolution API no servidor (Docker Swarm).
# - Backup do evolution.yaml
# - CACHE_REDIS_SAVE_INSTANCES=true
# - Corrige CHATWOOT_IMPORT_DATABASE_CONNECTION_URI (pgvector -> postgres/chatwoot_nestor)
# - Fixa imagem em evoapicloud/evolution-api:v2.3.7 (sem upgrade para 2.4+)
# - Verificações antes/depois
#
# Uso (no servidor Evolution ou via SSH):
#   ./scripts/evolution-hardening-deploy.sh
#   ./scripts/evolution-hardening-deploy.sh --dry-run
set -euo pipefail

DRY_RUN=false
[[ "${1:-}" == "--dry-run" ]] && DRY_RUN=true

EVO_YAML="/root/evolution.yaml"
BACKUP_DIR="/root/evolution-hardening-backups"
TS="$(date -u +%Y%m%d-%H%M%S)"
BACKUP_FILE="${BACKUP_DIR}/evolution.yaml.${TS}.bak"

log() { echo "[$(date -u +%H:%M:%S)] $*"; }
fail() { echo "❌ $*" >&2; exit 1; }

command -v docker >/dev/null || fail "docker não encontrado"
[[ -f "$EVO_YAML" ]] || fail "Arquivo não encontrado: $EVO_YAML"

mkdir -p "$BACKUP_DIR"

# --- estado ANTES ---
log "=== ANTES ==="
OPEN_BEFORE=$(docker exec "$(docker ps --filter name=postgres_postgres --format '{{.Names}}' | head -1)" \
  psql -U postgres -d evolution -Atc 'select count(*) from "Instance" where "connectionStatus"::text = '\''open'\'';' 2>/dev/null || echo "?")
log "Instâncias open no Postgres: ${OPEN_BEFORE}"

REDIS_CONTAINER=$(docker ps --filter name=redis_redis --format '{{.Names}}' | head -1)
REDIS_KEYS_BEFORE=0
if [[ -n "$REDIS_CONTAINER" ]]; then
  REDIS_KEYS_BEFORE=$(docker exec "$REDIS_CONTAINER" redis-cli -n 8 --scan --pattern 'evolution:*' 2>/dev/null | wc -l | tr -d ' ')
fi
log "Chaves Redis evolution:* (db 8): ${REDIS_KEYS_BEFORE}"

CURRENT_IMAGE=$(docker service inspect evolution_evolution --format '{{.Spec.TaskTemplate.ContainerSpec.Image}}' 2>/dev/null || echo "?")
log "Imagem atual do serviço: ${CURRENT_IMAGE}"

# --- patch evolution.yaml (dry-run usa cópia temporária) ---
PATCH_TARGET="$EVO_YAML"
if $DRY_RUN; then
  PATCH_TARGET="/tmp/evolution.yaml.dry-run.$$"
  cp -a "$EVO_YAML" "$PATCH_TARGET"
  log "DRY-RUN: simulando alterações em ${PATCH_TARGET}"
else
  cp -a "$EVO_YAML" "$BACKUP_FILE"
  log "Backup criado: $BACKUP_FILE"
fi

EVO_YAML="$PATCH_TARGET" python3 <<'PY'
from pathlib import Path
import re
import os

path = Path(os.environ.get("EVO_YAML", "/root/evolution.yaml"))
text = path.read_text()

# 1) Fixar imagem (evitar pull de atendai:latest diferente do que está rodando)
text = re.sub(
    r"image:\s*atendai/evolution-api:latest.*",
    "image: evoapicloud/evolution-api:v2.3.7",
    text,
    count=1,
)
text = re.sub(
    r"image:\s*evoapicloud/evolution-api:[^\s#]+",
    "image: evoapicloud/evolution-api:v2.3.7",
    text,
    count=1,
)

# 2) Redis persistência de instâncias
text = re.sub(
    r"CACHE_REDIS_SAVE_INSTANCES=false",
    "CACHE_REDIS_SAVE_INSTANCES=true",
    text,
)

# 3) Corrigir URI Chatwoot import a partir da URI principal do Postgres Evolution
m = re.search(r"DATABASE_CONNECTION_URI=postgresql://postgres:([^@]+)@postgres:5432/evolution", text)
if not m:
    raise SystemExit("Não foi possível localizar DATABASE_CONNECTION_URI no yaml")
password = m.group(1)
fixed_uri = f"postgresql://postgres:{password}@postgres:5432/chatwoot_nestor?sslmode=disable"
text = re.sub(
    r"CHATWOOT_IMPORT_DATABASE_CONNECTION_URI=postgresql://[^\n]+",
    f"CHATWOOT_IMPORT_DATABASE_CONNECTION_URI={fixed_uri}",
    text,
    count=1,
)

# 4) Sincronizar versão WA com a que está rodando no serviço (se diferente)
import subprocess, json
try:
    ins = subprocess.run(
        ["docker", "service", "inspect", "evolution_evolution"],
        capture_output=True, text=True, check=True,
    )
    env = json.loads(ins.stdout)[0]["Spec"]["TaskTemplate"]["ContainerSpec"].get("Env", [])
    running_ver = next((e.split("=", 1)[1] for e in env if e.startswith("CONFIG_SESSION_PHONE_VERSION=")), None)
    if running_ver:
        text = re.sub(
            r"CONFIG_SESSION_PHONE_VERSION=[^\n]+",
            f"CONFIG_SESSION_PHONE_VERSION={running_ver}",
            text,
            count=1,
        )
except Exception:
    pass

path.write_text(text)
print("✅ evolution.yaml atualizado")
PY

log "Diff resumido (sem senhas):"
grep -E 'image:|CACHE_REDIS_SAVE_INSTANCES|CHATWOOT_IMPORT_DATABASE_CONNECTION_URI|CONFIG_SESSION_PHONE_VERSION' "$PATCH_TARGET" \
  | sed -E 's/(PASSWORD|postgresql:\/\/postgres:)[^@]+/\1***/g' || true

if $DRY_RUN; then
  log "DRY-RUN: nenhuma alteração persistida em /root/evolution.yaml"
  rm -f "$PATCH_TARGET"
  exit 0
fi

EVO_YAML="/root/evolution.yaml"

# --- deploy cauteloso ---
log "Aplicando stack deploy (pode haver ~30-90s de indisponibilidade da Evolution)..."
docker stack deploy -c "$EVO_YAML" evolution

log "Aguardando serviço evolution_evolution convergir..."
for i in $(seq 1 36); do
  REPLICAS=$(docker service ls --filter name=evolution_evolution --format '{{.Replicas}}' 2>/dev/null || echo "")
  log "  tentativa $i/36 replicas=${REPLICAS}"
  if [[ "$REPLICAS" == "1/1" ]]; then
    # aguarda container novo
    sleep 15
    break
  fi
  sleep 5
done

# --- estado DEPOIS ---
log "=== DEPOIS ==="
ENV_AFTER=$(docker service inspect evolution_evolution --format '{{range .Spec.TaskTemplate.ContainerSpec.Env}}{{println .}}{{end}}' | grep -E 'CACHE_REDIS_SAVE_INSTANCES|CHATWOOT_IMPORT_DATABASE_CONNECTION_URI' | sed -E 's/postgresql:\/\/postgres:[^@]+/postgresql:\/\/postgres:***/g')
echo "$ENV_AFTER"

OPEN_AFTER=$(docker exec "$(docker ps --filter name=postgres_postgres --format '{{.Names}}' | head -1)" \
  psql -U postgres -d evolution -Atc 'select count(*) from "Instance" where "connectionStatus"::text = '\''open'\'';' 2>/dev/null || echo "?")
log "Instâncias open no Postgres: ${OPEN_AFTER} (antes: ${OPEN_BEFORE})"

REDIS_KEYS_AFTER=0
if [[ -n "$REDIS_CONTAINER" ]]; then
  REDIS_KEYS_AFTER=$(docker exec "$REDIS_CONTAINER" redis-cli -n 8 --scan --pattern 'evolution:*' 2>/dev/null | wc -l | tr -d ' ')
fi
log "Chaves Redis evolution:* (db 8): ${REDIS_KEYS_AFTER} (antes: ${REDIS_KEYS_BEFORE})"

# health HTTP interno (não falha o script se wget/curl indisponível)
EVO_CONTAINER=$(docker ps --filter name=evolution_evolution --format '{{.Names}}' | head -1)
if [[ -n "$EVO_CONTAINER" ]]; then
  HTTP_CODE="?"
  if docker exec "$EVO_CONTAINER" sh -c 'command -v wget >/dev/null' 2>/dev/null; then
    HTTP_CODE=$(docker exec "$EVO_CONTAINER" wget -qO- --server-response http://127.0.0.1:8080/ 2>&1 | awk '/HTTP\//{code=$2} END{print code+0}' || echo "?")
  elif docker exec "$EVO_CONTAINER" sh -c 'command -v curl >/dev/null' 2>/dev/null; then
    HTTP_CODE=$(docker exec "$EVO_CONTAINER" curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8080/ 2>/dev/null || echo "?")
  fi
  log "HTTP interno Evolution: ${HTTP_CODE}"
fi

# amostra logs recentes (sem ENOTFOUND pgvector)
LOG_FILE=$(docker inspect --format='{{.LogPath}}' "$EVO_CONTAINER" 2>/dev/null || true)
if [[ -n "$LOG_FILE" && -f "$LOG_FILE" ]]; then
  ENOTFOUND_COUNT=$(tail -n 500 "$LOG_FILE" | grep -ci 'ENOTFOUND.*pgvector' || true)
  log "ENOTFOUND pgvector nos últimos 500 logs: ${ENOTFOUND_COUNT}"
fi

log "Aguardando reconexão automática (até 5 min)..."
for i in $(seq 1 10); do
  OPEN_NOW=$(docker exec "$(docker ps --filter name=postgres_postgres --format '{{.Names}}' | head -1)" \
    psql -U postgres -d evolution -Atc 'select count(*) from "Instance" where "connectionStatus"::text = '\''open'\'';' 2>/dev/null || echo "?")
  CONN_NOW=$(docker exec "$(docker ps --filter name=postgres_postgres --format '{{.Names}}' | head -1)" \
    psql -U postgres -d evolution -Atc 'select count(*) from "Instance" where "connectionStatus"::text = '\''connecting'\'';' 2>/dev/null || echo "?")
  log "  reconexão ${i}/10: open=${OPEN_NOW} connecting=${CONN_NOW}"
  if [[ "$OPEN_NOW" != "?" && "$OPEN_NOW" -ge "$OPEN_BEFORE" ]]; then
    break
  fi
  sleep 30
done

log "✅ Hardening concluído. Backup: ${BACKUP_FILE}"
if [[ "$OPEN_AFTER" != "?" && "$OPEN_BEFORE" != "?" && "$OPEN_AFTER" -lt "$OPEN_BEFORE" ]]; then
  log "⚠️  Open caiu de ${OPEN_BEFORE} para ${OPEN_AFTER} logo após restart (esperado)."
  log "    Sessões válidas reconectam em background; chips sem sessão exigem novo QR no CRM."
fi
