#!/usr/bin/env bash
# Rollback controlado do hardening Evolution (18/06/2026).
#
# Uso no servidor Evolution (62.72.8.186):
#   ./evolution-hardening-rollback.sh --dry-run
#   ./evolution-hardening-rollback.sh
#   ./evolution-hardening-rollback.sh --partial redis
#
# Backups: /root/evolution-hardening-backups/
set -euo pipefail

EVO_YAML="/root/evolution.yaml"
BACKUP_DIR="/root/evolution-hardening-backups"
DEFAULT_BACKUP="${BACKUP_DIR}/evolution.yaml.20260618-190956.bak"
TS="$(date -u +%Y%m%d-%H%M%S)"

DRY_RUN=false
PARTIAL=""
BACKUP_FILE="$DEFAULT_BACKUP"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN=true; shift ;;
    --partial) PARTIAL="${2:-}"; shift 2 ;;
    --backup) BACKUP_FILE="${2:-}"; shift 2 ;;
    -h|--help)
      echo "Uso: $0 [--dry-run] [--partial redis] [--backup /caminho/backup.bak]"
      exit 0
      ;;
    *) echo "Opção desconhecida: $1" >&2; exit 1 ;;
  esac
done

log() { echo "[$(date -u +%H:%M:%S)] $*"; }
fail() { echo "❌ $*" >&2; exit 1; }

command -v docker >/dev/null || fail "docker não encontrado"
[[ -f "$EVO_YAML" ]] || fail "Não encontrado: $EVO_YAML"

mkdir -p "$BACKUP_DIR"

log "=== ROLLBACK Evolution Hardening ==="
log "Modo: $([ "$DRY_RUN" = true ] && echo 'DRY-RUN' || echo 'APLICAR')"
log "Tipo: $([ -n "$PARTIAL" ] && echo "parcial ($PARTIAL)" || echo 'completo (yaml backup)')"

OPEN_BEFORE=$(docker exec "$(docker ps --filter name=postgres_postgres --format '{{.Names}}' | head -1)" \
  psql -U postgres -d evolution -Atc 'select count(*) from "Instance" where "connectionStatus"::text = '\''open'\'';' 2>/dev/null || echo "?")
log "Instâncias open agora: ${OPEN_BEFORE}"

if [[ -n "$PARTIAL" ]]; then
  case "$PARTIAL" in
    redis)
      log "Rollback parcial: CACHE_REDIS_SAVE_INSTANCES=false (mantém Chatwoot e imagem)"
      if $DRY_RUN; then
        log "DRY-RUN: sed CACHE_REDIS_SAVE_INSTANCES=true -> false em $EVO_YAML"
        exit 0
      fi
      cp -a "$EVO_YAML" "${BACKUP_DIR}/evolution.yaml.pre-partial-redis.${TS}.bak"
      sed -i 's/CACHE_REDIS_SAVE_INSTANCES=true/CACHE_REDIS_SAVE_INSTANCES=false/' "$EVO_YAML"
      ;;
    *)
      fail "Partial desconhecido: $PARTIAL (use: redis)"
      ;;
  esac
else
  [[ -f "$BACKUP_FILE" ]] || fail "Backup não encontrado: $BACKUP_FILE"
  log "Restaurando backup: $BACKUP_FILE"
  if $DRY_RUN; then
    log "DRY-RUN: conteúdo chave do backup:"
    grep -E 'image:|CACHE_REDIS_SAVE_INSTANCES|CHATWOOT_IMPORT|CONFIG_SESSION_PHONE_VERSION' "$BACKUP_FILE" \
      | sed -E 's/postgresql:\/\/postgres:[^@]+/postgresql:\/\/postgres:***/g' || true
    log "DRY-RUN: não aplicando stack deploy"
    exit 0
  fi
  cp -a "$EVO_YAML" "${BACKUP_DIR}/evolution.yaml.pre-rollback.${TS}.bak"
  log "Backup do estado atual: ${BACKUP_DIR}/evolution.yaml.pre-rollback.${TS}.bak"
  cp -a "$BACKUP_FILE" "$EVO_YAML"
fi

log "⚠️  Aplicando stack deploy (restart Evolution — impacto em todas instâncias)..."
docker stack deploy -c "$EVO_YAML" evolution

log "Aguardando replicas 1/1..."
for i in $(seq 1 36); do
  REPLICAS=$(docker service ls --filter name=evolution_evolution --format '{{.Replicas}}' 2>/dev/null || echo "")
  log "  $i/36 replicas=${REPLICAS}"
  [[ "$REPLICAS" == "1/1" ]] && sleep 15 && break
  sleep 5
done

ENV_NOW=$(docker service inspect evolution_evolution --format '{{range .Spec.TaskTemplate.ContainerSpec.Env}}{{println .}}{{end}}' \
  | grep -E 'CACHE_REDIS_SAVE_INSTANCES|CHATWOOT_IMPORT|image' | sed -E 's/postgresql:\/\/postgres:[^@]+/postgresql:\/\/postgres:***/g' || true)
log "Env após rollback:"
echo "$ENV_NOW"

OPEN_AFTER=$(docker exec "$(docker ps --filter name=postgres_postgres --format '{{.Names}}' | head -1)" \
  psql -U postgres -d evolution -Atc 'select count(*) from "Instance" where "connectionStatus"::text = '\''open'\'';' 2>/dev/null || echo "?")
log "Instâncias open: ${OPEN_AFTER} (antes do rollback: ${OPEN_BEFORE})"
log "✅ Rollback concluído. Chips podem precisar reconectar (QR) — aguardar 15–30 min."
