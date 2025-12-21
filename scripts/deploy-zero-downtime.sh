#!/bin/bash

# 🚀 Script: Deploy Zero-Downtime (Blue-Green Deployment)
# Descrição: Faz deploy sem downtime usando estratégia blue-green
# Uso: ./scripts/deploy-zero-downtime.sh [--rollback] [--test-first] [--skip-git-check]
# 
# Opções:
#   --rollback        Faz rollback para versão anterior
#   --test-first      Faz deploy para ambiente de teste primeiro (porta 3002)
#   --skip-git-check  Pula verificações Git (use apenas em casos especiais)
# 
# NOTA: Script usa orquestração para evitar conflitos quando múltiplos agentes trabalham juntos
# NOTA: Verificações Git são obrigatórias por padrão (garante sincronização entre agentes)

set -e

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Diretório do script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
HEALTH_CHECK="$SCRIPT_DIR/health-check.sh"
ORCHESTRATOR="$SCRIPT_DIR/docker-orchestrator.sh"
GET_LAST_DEPLOY="$SCRIPT_DIR/get-last-deploy.sh"
VERIFY_LAST_DEPLOY="$SCRIPT_DIR/verify-last-deploy-in-air.sh"
VERIFY_VERSION="$SCRIPT_DIR/verify-container-version.sh"

# Lock específico para deploy (sem timeout - aguarda indefinidamente)
DEPLOY_LOCK_FILE="/tmp/deploy-zero-downtime.lock"
DEPLOY_LOCK_FD=200

# Variáveis
ROLLBACK_MODE=false
TEST_FIRST=false
CURRENT_VERSION="blue"
NEW_VERSION="green"
STABILITY_WAIT=30

# Verificar argumentos
SKIP_GIT_CHECK=false
ROLLBACK_MODE=false
TEST_FIRST=false
AUTO_COMMIT=false
AUTO_COMMIT_MESSAGE=""

for arg in "$@"; do
    case "$arg" in
        --rollback)
    ROLLBACK_MODE=true
    CURRENT_VERSION="green"
    NEW_VERSION="blue"
            ;;
        --test-first)
    TEST_FIRST=true
            ;;
        --skip-git-check)
            SKIP_GIT_CHECK=true
            ;;
        --auto-commit)
            AUTO_COMMIT=true
            # Próximo argumento é a mensagem do commit
            if [ -n "$2" ] && [ "${2#-}" = "$2" ]; then
                AUTO_COMMIT_MESSAGE="$2"
                shift
            else
                AUTO_COMMIT_MESSAGE="chore: commit automático antes do deploy"
            fi
            ;;
    esac
done

if [ "$SKIP_GIT_CHECK" = true ]; then
    log_warn "⚠️  Modo --skip-git-check ativado (pulando verificações Git)"
    log_warn "   Use apenas em casos especiais (ex: servidor sem acesso ao GitHub)"
fi

log() {
    echo -e "${BLUE}[ZERO-DOWNTIME]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_success() {
    echo -e "${GREEN}[ZERO-DOWNTIME]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_error() {
    echo -e "${RED}[ZERO-DOWNTIME]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_warn() {
    echo -e "${YELLOW}[ZERO-DOWNTIME]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

# Função helper para operações Docker protegidas pelo lock do deploy
docker_with_deploy_lock() {
    local cmd="$*"
    # Executar comando Docker diretamente (já estamos dentro do lock do deploy)
    eval "$cmd"
}

# Função de rollback automático
rollback() {
    log_error "Erro detectado! Executando rollback automático..."
    
    # Voltar tráfego para versão anterior usando nginx-helper
    if [ -f "/etc/nginx/sites-enabled/kanban-buzz" ]; then
        log "Revertendo Nginx para ${CURRENT_VERSION}..."
        source "$SCRIPT_DIR/nginx-helper.sh" 2>/dev/null || true
        CURRENT_PORT=$([ "$CURRENT_VERSION" = "blue" ] && echo "3000" || echo "3001")
        update_nginx "$CURRENT_VERSION" "$CURRENT_PORT" 2>/dev/null || {
            # Fallback se nginx-helper não funcionar
            sed -i "s/default green;/default ${CURRENT_VERSION};/" /etc/nginx/sites-available/kanban-buzz 2>/dev/null || true
            nginx -s reload 2>/dev/null || true
        }
    fi
    
    # Remover versão problemática
    log "Removendo container ${NEW_VERSION}..."
    docker_with_deploy_lock "docker compose -f docker-compose.${NEW_VERSION}.yml down" 2>/dev/null || true
    
    # Atualizar .last-deploy com versão restaurada
    log "Atualizando .last-deploy com versão restaurada (${CURRENT_VERSION})..."
    LAST_DEPLOY_FILE="$PROJECT_DIR/.last-deploy"
    DEPLOY_ID=$(uuidgen 2>/dev/null || date +%s | sha256sum | cut -d' ' -f1)
    RESTORED_IMAGE_ID=$(docker inspect "kanban-buzz-95241-app-${CURRENT_VERSION}:latest" --format='{{.Id}}' 2>/dev/null || echo "")
    TIMESTAMP_ISO=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    
    jq -n \
        --arg version "$CURRENT_VERSION" \
        --arg timestamp "$TIMESTAMP_ISO" \
        --arg image_id "$RESTORED_IMAGE_ID" \
        --arg deploy_id "$DEPLOY_ID" \
        '{
            version: $version,
            timestamp: $timestamp,
            image_id: $image_id,
            deploy_id: $deploy_id
        }' > "$LAST_DEPLOY_FILE" 2>/dev/null || {
        echo "{\"version\":\"$CURRENT_VERSION\",\"timestamp\":\"$TIMESTAMP_ISO\",\"image_id\":\"$RESTORED_IMAGE_ID\",\"deploy_id\":\"$DEPLOY_ID\"}" > "$LAST_DEPLOY_FILE"
    }
    
    log_error "Rollback concluído. Sistema voltou para ${CURRENT_VERSION}."
    
    # Liberar lock antes de sair
    release_lock
    
    exit 1
}

# Trap para rollback em caso de erro
trap rollback ERR

cd "$PROJECT_DIR"

# Adquirir lock de deploy (aguarda indefinidamente se outro deploy em andamento)
log "Aguardando lock de deploy (se outro deploy estiver em andamento, aguardará até concluir)..."
if ! command -v flock &> /dev/null; then
    log_error "flock não está disponível. Instalando..."
    if command -v apt-get &> /dev/null; then
        apt-get update && apt-get install -y util-linux
    else
        log_error "Não foi possível instalar flock. Executando sem lock (não recomendado)."
    fi
fi

# Verificar se há lock órfão (sem processo usando)
cleanup_orphan_lock() {
    if [ -f "$DEPLOY_LOCK_FILE" ]; then
        # Verificar se há processo realmente usando o lock
        LOCK_USERS=$(lsof "$DEPLOY_LOCK_FILE" 2>/dev/null | awk 'NR>1 {print $2}' | sort -u || echo "")
        
        if [ -n "$LOCK_USERS" ]; then
            # Verificar se processos estão realmente ativos
            ACTIVE_PROCESSES=""
            for pid in $LOCK_USERS; do
                if ps -p "$pid" >/dev/null 2>&1; then
                    # Verificar se é processo de deploy
                    if ps -p "$pid" -o cmd= | grep -q "deploy-zero-downtime"; then
                        ACTIVE_PROCESSES="$ACTIVE_PROCESSES $pid"
                    fi
                fi
            done
            
            if [ -z "$ACTIVE_PROCESSES" ]; then
                log_warn "Lock órfão detectado (sem processo ativo). Limpando..."
                rm -f "$DEPLOY_LOCK_FILE"
                log_success "Lock órfão removido"
            fi
        else
            # Nenhum processo usando - lock órfão
            log_warn "Lock órfão detectado (nenhum processo usando). Limpando..."
            rm -f "$DEPLOY_LOCK_FILE"
            log_success "Lock órfão removido"
        fi
    fi
}

# Limpar lock órfão antes de tentar adquirir
cleanup_orphan_lock

# Criar arquivo de lock se não existir
touch "$DEPLOY_LOCK_FILE"

# Variável global para armazenar FD (acessível no trap)
DEPLOY_LOCK_FD=""

# Função para liberar lock ao sair (melhorada e mais robusta)
release_lock() {
    # Sempre tentar liberar, mesmo se variável não estiver definida
    if [ -f "$DEPLOY_LOCK_FILE" ]; then
        # Tentar liberar usando FD se disponível
        if [ -n "$DEPLOY_LOCK_FD" ] && [ "$DEPLOY_LOCK_FD" != "" ] && [ "$DEPLOY_LOCK_FD" != "200" ]; then
            flock -u "$DEPLOY_LOCK_FD" 2>/dev/null || true
            exec {DEPLOY_LOCK_FD}>&- 2>/dev/null || true
        fi
        
        # Verificar se ainda há processo usando (com timeout para evitar travamento)
        LOCK_USERS=$(timeout 2 lsof "$DEPLOY_LOCK_FILE" 2>/dev/null | awk 'NR>1 {print $2}' | sort -u || echo "")
        
        # Verificar se algum processo é realmente nosso processo de deploy
        OUR_PID=$$
        IS_OUR_LOCK=false
        
        if [ -n "$LOCK_USERS" ]; then
            for pid in $LOCK_USERS; do
                # Verificar se é nosso processo ou processo filho
                if [ "$pid" = "$OUR_PID" ] || ps -p "$pid" -o ppid= 2>/dev/null | grep -q "^$OUR_PID$"; then
                    IS_OUR_LOCK=true
                    break
                fi
                # Verificar se é processo de deploy ativo
                if ps -p "$pid" >/dev/null 2>&1 && ps -p "$pid" -o cmd= | grep -q "deploy-zero-downtime"; then
                    # Verificar se é processo diferente do nosso
                    if [ "$pid" != "$OUR_PID" ]; then
                        log "Outro processo de deploy ($pid) está usando o lock. Não removendo."
                        return 0
                    fi
                fi
            done
        fi
        
        # Se não há processos usando OU se é nosso lock, remover
        if [ -z "$LOCK_USERS" ] || [ "$IS_OUR_LOCK" = true ]; then
            # Nenhum processo usando ou é nosso lock - remover
            rm -f "$DEPLOY_LOCK_FILE" 2>/dev/null || true
            log "Lock de deploy liberado e removido"
        else
            # Ainda há processo usando - apenas log
            log "Lock de deploy liberado (outro processo pode estar usando)"
        fi
    fi
}

# Trap para garantir que lock é liberado mesmo em caso de erro
trap release_lock EXIT INT TERM

# Adquirir lock (sem timeout - aguarda indefinidamente)
exec {DEPLOY_LOCK_FD}>"$DEPLOY_LOCK_FILE"

# Tentar adquirir lock sem bloqueio primeiro
if flock -n "$DEPLOY_LOCK_FD" 2>/dev/null; then
    log_success "Lock adquirido imediatamente. Iniciando deploy..."
else
    log "Outro deploy em andamento. Verificando se é lock órfão..."
    
    # Verificar se é lock órfão antes de aguardar
    cleanup_orphan_lock
    
    # Tentar novamente após limpeza
    if flock -n "$DEPLOY_LOCK_FD" 2>/dev/null; then
        log_success "Lock adquirido após limpeza. Iniciando deploy..."
    else
        log "Deploy legítimo em andamento. Aguardando na fila (sem timeout)..."
        # Aguardar indefinidamente até lock ser liberado (sem -w, sem timeout)
        flock "$DEPLOY_LOCK_FD"
        log_success "Lock adquirido! Iniciando deploy..."
    fi
fi

log "=========================================="
log "🚀 Deploy Zero-Downtime - Blue-Green"
log "=========================================="
log "Versão atual: ${CURRENT_VERSION}"
log "Nova versão: ${NEW_VERSION}"
if [ "$TEST_FIRST" = true ]; then
    log "Modo: Teste primeiro (--test-first)"
fi
log "PID: $$"
log "Timestamp: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
log ""

# Se modo test-first, fazer deploy para teste primeiro
if [ "$TEST_FIRST" = true ]; then
    log "🧪 Modo test-first: Fazendo deploy para ambiente de teste primeiro..."
    DEPLOY_TEST="$SCRIPT_DIR/deploy-to-test.sh"
    if [ -f "$DEPLOY_TEST" ]; then
        chmod +x "$DEPLOY_TEST" 2>/dev/null || true
        if "$DEPLOY_TEST"; then
            log_success "Deploy para teste concluído com sucesso!"
            log "Agora você pode testar em http://localhost:3002"
            log "Quando estiver pronto, execute novamente sem --test-first para fazer deploy em produção"
        else
            log_error "Deploy para teste falhou!"
            release_lock
            exit 1
        fi
    else
        log_error "Script deploy-to-test.sh não encontrado!"
        release_lock
        exit 1
    fi
    log ""
    log "Continuando com deploy de produção..."
    log ""
fi

# Verificar último deploy ANTES de iniciar novo deploy
log "Verificando último deploy antes de iniciar..."
if [ -f "$GET_LAST_DEPLOY" ]; then
    chmod +x "$GET_LAST_DEPLOY" 2>/dev/null || true
    LAST_DEPLOY=$("$GET_LAST_DEPLOY" 2>/dev/null || echo "")
    if [ -n "$LAST_DEPLOY" ] && [ "$LAST_DEPLOY" != "" ]; then
        log "Último deploy identificado: ${LAST_DEPLOY}"
        # Se tentando fazer deploy da mesma versão que já é a última, avisar
        if [ "$NEW_VERSION" = "$LAST_DEPLOY" ]; then
            log_warn "Atenção: Tentando fazer deploy de ${NEW_VERSION}, mas ${LAST_DEPLOY} já é o último deploy."
            log_warn "Isso pode ser intencional (rollback ou correção). Continuando..."
        fi
    fi
fi
log ""

# Verificar pré-requisitos
log "1/9 - Verificando pré-requisitos..."

if ! command -v docker &> /dev/null; then
    log_error "Docker não está instalado"
    exit 1
fi

if ! docker compose version &> /dev/null; then
    log_error "Docker Compose não está instalado"
    exit 1
fi

# Tornar scripts executáveis
chmod +x "$HEALTH_CHECK" 2>/dev/null || true

log_success "Pré-requisitos OK"

# Função robusta de sincronização Git (múltiplas verificações)
# IMPORTANTE: Só faz deploy do que está no GitHub (já commitado e publicado)
# Mudanças locais não commitadas são IGNORADAS (não sobem no deploy)
sync_git_code() {
    # Se modo skip-git-check, pular todas verificações
    if [ "$SKIP_GIT_CHECK" = true ]; then
        log_warn "⚠️  Pulando verificações Git (--skip-git-check ativado)"
        log_warn "   Certifique-se de que o código está correto antes de continuar"
        return 0
    fi
    
    log "Sincronizando código do GitHub (verificação obrigatória)..."
    log "⚠️  IMPORTANTE: Apenas código já publicado no GitHub será deployado"
    log "   Mudanças locais não commitadas serão IGNORADAS (não sobem no deploy)"
    
    # Verificar se é repositório Git
    if [ ! -d ".git" ]; then
        log_warn "Não é repositório Git - pulando sincronização"
        return 0
    fi
    
    # Verificar se git está instalado
    if ! command -v git &> /dev/null; then
        log_error "Git não está instalado! Instale antes de fazer deploy."
        exit 1
    fi
    
    # Obter branch atual (precisa antes das verificações)
    CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "main")
    
    # VERIFICAÇÃO 1: Detached HEAD (BLOQUEIA - estado inválido)
    log "Verificação 1/7: Verificando estado do HEAD..."
    if ! git symbolic-ref -q HEAD >/dev/null 2>&1; then
        log_error "⚠️  HEAD está em estado detached (não está em um branch)!"
        log_error "   Isso pode causar problemas no deploy"
        log_error "   Solução: git checkout main (ou seu branch de trabalho)"
        exit 1
    else
        log_success "HEAD está em branch válido: ${CURRENT_BRANCH}"
    fi
    
    # VERIFICAÇÃO 2: Branch correto (AVISO, não bloqueia)
    log "Verificação 2/7: Verificando branch..."
    if [ "$CURRENT_BRANCH" != "main" ] && [ "$CURRENT_BRANCH" != "master" ]; then
        log_warn "⚠️  Você está no branch '${CURRENT_BRANCH}' (não é main/master)"
        log_warn "   Certifique-se de que é o branch correto para produção"
        log_warn "   Continuando deploy mesmo assim (apenas aviso)..."
    else
        log_success "Branch correto: ${CURRENT_BRANCH}"
    fi
    
    # VERIFICAÇÃO 3: Status do repositório
    log "Verificação 3/7: Verificando status do repositório..."
    if ! git status &>/dev/null; then
        log_error "Repositório Git inválido ou corrompido!"
        exit 1
    fi
    
    # VERIFICAÇÃO 4: Commits locais não pushados (AVISO, não bloqueia)
    log "Verificação 4/7: Verificando commits locais não pushados..."
    # Fetch primeiro para ter referências atualizadas
    git fetch origin "$CURRENT_BRANCH" &>/dev/null || true
    LOCAL_AHEAD=$(git rev-list --count "origin/${CURRENT_BRANCH}..HEAD" 2>/dev/null || echo "0")
    if [ "$LOCAL_AHEAD" -gt "0" ]; then
        log_warn "⚠️  Há $LOCAL_AHEAD commit(s) local(is) não pushado(s)!"
        log_warn "   Esses commits NÃO estarão disponíveis para outros agentes"
        log_warn "   Recomendado: git push origin ${CURRENT_BRANCH}"
        log_warn "   Continuando deploy mesmo assim (apenas aviso)..."
        log "   Últimos commits locais não pushados:"
        git log "origin/${CURRENT_BRANCH}..HEAD" --oneline -5 2>/dev/null || true
    else
        log_success "Todos os commits locais já foram pushados"
    fi
    
    # VERIFICAÇÃO 5: Mudanças locais não commitadas (BLOQUEIA deploy se houver)
    log "Verificação 5/7: Verificando mudanças locais não commitadas..."
    if ! git diff --quiet || ! git diff --cached --quiet; then
        log_error "⚠️  Há mudanças locais não commitadas!"
        git status --short
        log_error ""
        log_error "   PROBLEMA: Se você fizer deploy agora, essas mudanças NÃO vão para o GitHub"
        log_error "   E outros agentes NÃO vão pegar essas mudanças no próximo deploy deles!"
        log_error ""
        log_error "   SOLUÇÃO OBRIGATÓRIA:"
        log_error "   1. git add ."
        log_error "   2. git commit -m 'Sua mensagem'"
        log_error "   3. git push origin $(git rev-parse --abbrev-ref HEAD)"
        log_error "   4. Execute o deploy novamente"
        log_error ""
        log_error "   DEPLOY CANCELADO para evitar que mudanças não sejam compartilhadas entre agentes"
        exit 1
    else
        log_success "Nenhuma mudança local não commitada"
    fi
    
    # VERIFICAÇÃO 6: Fetch e Pull (primeira tentativa)
    log "Verificação 6/7: Sincronizando com repositório remoto (primeira tentativa)..."
    log "Branch atual: ${CURRENT_BRANCH}"
    
    # Fetch para atualizar referências remotas
    if ! git fetch origin "$CURRENT_BRANCH" 2>&1 | tee /tmp/git-fetch.log; then
        log_error "Git fetch falhou! Verifique conexão com repositório remoto."
        cat /tmp/git-fetch.log
        exit 1
    fi
    
    # Verificar se há mudanças remotas
    LOCAL_COMMIT=$(git rev-parse HEAD 2>/dev/null || echo "")
    REMOTE_COMMIT=$(git rev-parse "origin/${CURRENT_BRANCH}" 2>/dev/null || echo "")
    
    if [ -z "$LOCAL_COMMIT" ] || [ -z "$REMOTE_COMMIT" ]; then
        log_error "Não foi possível obter commits local/remoto"
        exit 1
    fi
    
    if [ "$LOCAL_COMMIT" = "$REMOTE_COMMIT" ]; then
        log_success "Código local já está atualizado (sem mudanças remotas)"
    else
        log "Mudanças remotas detectadas no GitHub (outro agente já publicou mudanças)"
        log "Fazendo pull para pegar as mudanças mais recentes..."
        
        # Pull com estratégia de merge segura
        if ! git pull origin "$CURRENT_BRANCH" --no-rebase 2>&1 | tee /tmp/git-pull.log; then
            log_error "Git pull falhou! Pode haver conflitos."
            cat /tmp/git-pull.log
            
            # Verificar se há conflitos
            if git diff --check 2>/dev/null | grep -q "^\+<<<<<<<"; then
                log_error "CONFLITOS DETECTADOS após git pull!"
                log_error "Resolva os conflitos manualmente antes de fazer deploy:"
                log_error "  1. git status"
                log_error "  2. Resolver conflitos nos arquivos marcados"
                log_error "  3. git add <arquivos>"
                log_error "  4. git commit"
                exit 1
            else
                log_error "Git pull falhou por outro motivo. Verifique logs acima."
                exit 1
            fi
        fi
        
        log_success "Código atualizado do repositório remoto (mudanças de outros agentes incorporadas)"
    fi
    
    # Mostrar resumo do que será deployado (informação, não é verificação)
    log "Resumo do que será deployado:"
    log "Últimos commits que serão deployados:"
    git log --oneline -5 "origin/${CURRENT_BRANCH}" 2>/dev/null || git log --oneline -5 || true
    
    # Verificar última tag se existir
    LAST_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "")
    if [ -n "$LAST_TAG" ]; then
        TAG_COMMIT=$(git rev-parse "$LAST_TAG" 2>/dev/null || echo "")
        CURRENT_COMMIT=$(git rev-parse HEAD 2>/dev/null || echo "")
        if [ "$TAG_COMMIT" = "$CURRENT_COMMIT" ]; then
            log_success "Deployando versão taggeada: ${LAST_TAG}"
        else
            log "Última tag: ${LAST_TAG} (não é o commit atual)"
        fi
    fi
    
    # VERIFICAÇÃO 7: Verificação redundante (segunda tentativa)
    log "Verificação 7/7: Verificação redundante (garantindo sincronização)..."
    sleep 1  # Pequeno delay para garantir que tudo foi escrito
    
    # Fetch novamente para garantir
    if ! git fetch origin "$CURRENT_BRANCH" &>/dev/null; then
        log_warn "Segundo fetch falhou (continuando com código já atualizado)"
    fi
    
    # Verificar novamente se está sincronizado
    LOCAL_COMMIT_AFTER=$(git rev-parse HEAD 2>/dev/null || echo "")
    REMOTE_COMMIT_AFTER=$(git rev-parse "origin/${CURRENT_BRANCH}" 2>/dev/null || echo "")
    
    if [ "$LOCAL_COMMIT_AFTER" != "$REMOTE_COMMIT_AFTER" ]; then
        log_warn "Código ainda não está sincronizado após pull. Tentando novamente..."
        
        # Segunda tentativa de pull
        if ! git pull origin "$CURRENT_BRANCH" --no-rebase &>/dev/null; then
            log_error "Segunda tentativa de pull falhou!"
            log_error "Código pode não estar totalmente sincronizado."
            exit 1
        fi
        
        # Verificar terceira vez
        LOCAL_COMMIT_FINAL=$(git rev-parse HEAD 2>/dev/null || echo "")
        REMOTE_COMMIT_FINAL=$(git rev-parse "origin/${CURRENT_BRANCH}" 2>/dev/null || echo "")
        
        if [ "$LOCAL_COMMIT_FINAL" != "$REMOTE_COMMIT_FINAL" ]; then
            log_error "FALHA CRÍTICA: Código não sincronizado após múltiplas tentativas!"
            log_error "Local:  ${LOCAL_COMMIT_FINAL:0:8}"
            log_error "Remoto: ${REMOTE_COMMIT_FINAL:0:8}"
            exit 1
        fi
    fi
    
    # Verificar conflitos finais
    if git diff --check 2>/dev/null | grep -q "^\+<<<<<<<"; then
        log_error "CONFLITOS DETECTADOS após sincronização!"
        log_error "Resolva os conflitos antes de fazer deploy"
        exit 1
    fi
    
    # Log commit atual para rastreabilidade (informação final)
    log "Informações do commit que será deployado:"
    CURRENT_COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
    CURRENT_BRANCH_FINAL=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
    COMMIT_MESSAGE=$(git log -1 --pretty=format:"%s" 2>/dev/null || echo "unknown")
    COMMIT_AUTHOR=$(git log -1 --pretty=format:"%an" 2>/dev/null || echo "unknown")
    COMMIT_DATE=$(git log -1 --pretty=format:"%ad" --date=short 2>/dev/null || echo "unknown")
    
    log_success "Código sincronizado!"
    log "   Commit: ${CURRENT_COMMIT}"
    log "   Branch: ${CURRENT_BRANCH_FINAL}"
    log "   Mensagem: ${COMMIT_MESSAGE}"
    log "   Autor: ${COMMIT_AUTHOR}"
    log "   Data: ${COMMIT_DATE}"
    
    # Verificação final de integridade (informação)
    log "Verificação final de integridade..."
    if ! git diff-index --quiet HEAD -- 2>/dev/null; then
        log_warn "⚠️  Ainda há mudanças não commitadas após sincronização (pode ser normal)"
    fi
    
    # Verificar se há arquivos não rastreados importantes
    UNTRACKED_COUNT=$(git ls-files --others --exclude-standard | wc -l 2>/dev/null || echo "0")
    if [ "$UNTRACKED_COUNT" -gt "0" ]; then
        log_warn "⚠️  Há $UNTRACKED_COUNT arquivo(s) não rastreado(s) (não afetam deploy)"
    fi
    
    log_success "Todas verificações Git concluídas com sucesso!"
    
    return 0
}

# Verificar qual versão está rodando atualmente
log "2/9 - Verificando versão atual..."

# Remover containers antigos que não são blue/green (podem causar conflito)
log "Removendo containers antigos que não são blue/green..."
docker ps -a --format '{{.Names}}' | grep -E "^kanban-buzz-app$" | while read container; do
    log "Removendo container antigo: $container"
    docker stop "$container" 2>/dev/null || true
    docker rm "$container" 2>/dev/null || true
done

BLUE_RUNNING=false
GREEN_RUNNING=false

if docker ps --format '{{.Names}}' | grep -q "kanban-buzz-app-blue"; then
    BLUE_RUNNING=true
    log "  - Blue está rodando"
    
    # Verificar se Blue está realmente saudável
    if ! "$HEALTH_CHECK" blue 10 >/dev/null 2>&1; then
        log_warn "Blue está rodando mas não está saudável. Reiniciando..."
        docker compose -f docker-compose.blue.yml restart
        sleep 5
        if ! "$HEALTH_CHECK" blue 30; then
            log_error "Blue não conseguiu ficar saudável"
            exit 1
        fi
    fi
fi

if docker ps --format '{{.Names}}' | grep -q "kanban-buzz-app-green"; then
    GREEN_RUNNING=true
    log "  - Green está rodando"
    
    # Verificar se Green está realmente saudável
    if ! "$HEALTH_CHECK" green 10 >/dev/null 2>&1; then
        log_warn "Green está rodando mas não está saudável. Reiniciando..."
        docker compose -f docker-compose.green.yml restart
        sleep 5
        if ! "$HEALTH_CHECK" green 30; then
            log_error "Green não conseguiu ficar saudável"
            exit 1
        fi
    fi
fi

# Se nenhuma versão está rodando, iniciar blue primeiro
if [ "$BLUE_RUNNING" = false ] && [ "$GREEN_RUNNING" = false ]; then
    log_warn "Nenhuma versão está rodando. Iniciando Blue primeiro..."
    docker compose -f docker-compose.blue.yml up -d --build
    log "Aguardando Blue iniciar..."
    sleep 10
    "$HEALTH_CHECK" blue 60 || {
        log_error "Blue não iniciou corretamente"
        exit 1
    }
    BLUE_RUNNING=true
    CURRENT_VERSION="blue"
    NEW_VERSION="green"
fi

# Determinar versão atual e nova baseado no que está rodando
if [ "$BLUE_RUNNING" = true ] && [ "$GREEN_RUNNING" = false ]; then
    CURRENT_VERSION="blue"
    NEW_VERSION="green"
elif [ "$GREEN_RUNNING" = true ] && [ "$BLUE_RUNNING" = false ]; then
    CURRENT_VERSION="green"
    NEW_VERSION="blue"
elif [ "$BLUE_RUNNING" = true ] && [ "$GREEN_RUNNING" = true ]; then
    log_warn "Ambas versões estão rodando. Removendo ${NEW_VERSION} e recriando..."
    docker compose -f docker-compose.${NEW_VERSION}.yml down
fi

log "  - Versão atual: ${CURRENT_VERSION}"
log "  - Nova versão: ${NEW_VERSION}"

# Sincronização Git OBRIGATÓRIA antes do build
log "3/9 - Sincronizando código do Git (OBRIGATÓRIO)..."
sync_git_code || {
    log_error "Falha na sincronização Git! Deploy cancelado."
    exit 1
}

# Build da nova versão (usando lock do deploy - não precisa orchestrator)
log "4/9 - Fazendo build da nova versão (${NEW_VERSION})..."
log "  Isso pode levar alguns minutos..."
log "  Usando lock do deploy para evitar conflitos..."

docker_with_deploy_lock "docker compose -f docker-compose.${NEW_VERSION}.yml build --no-cache" || {
    log_error "Build falhou!"
    rollback
}

log_success "Build concluído"

# Subir nova versão (usando lock do deploy)
log "5/9 - Subindo nova versão (${NEW_VERSION}) na porta alternativa..."

docker_with_deploy_lock "docker compose -f docker-compose.${NEW_VERSION}.yml up -d" || {
    log_error "Falha ao subir ${NEW_VERSION}"
    rollback
}

log_success "Container ${NEW_VERSION} iniciado"

# Health check da nova versão - MÚLTIPLAS VERIFICAÇÕES
log "6/9 - Aguardando nova versão ficar saudável (timeout: 90s)..."

# Primeira verificação - aguarda container iniciar
log "Primeira verificação de saúde (aguardando container iniciar)..."
if ! "$HEALTH_CHECK" "${NEW_VERSION}" 90; then
    log_error "Nova versão não ficou saudável na primeira verificação"
    rollback
fi

# Segunda verificação - confirma que está estável
log "Segunda verificação de saúde (confirmando estabilidade)..."
sleep 5
if ! "$HEALTH_CHECK" "${NEW_VERSION}" 30; then
    log_error "Nova versão não está estável"
    rollback
fi

# Terceira verificação - última confirmação antes de alternar
log "Terceira verificação de saúde (última confirmação)..."
sleep 5
if ! "$HEALTH_CHECK" "${NEW_VERSION}" 30; then
    log_error "Nova versão falhou na verificação final"
    rollback
fi

log_success "Nova versão está saudável e estável (3 verificações OK)!"

# Garantir que versão atual ainda está rodando antes de alternar
log "Verificando que versão atual (${CURRENT_VERSION}) ainda está rodando..."
if ! "$HEALTH_CHECK" "${CURRENT_VERSION}" 10 >/dev/null 2>&1; then
    log_error "Versão atual (${CURRENT_VERSION}) não está respondendo! Não é seguro alternar."
    rollback
fi
log_success "Versão atual (${CURRENT_VERSION}) ainda está respondendo corretamente"

# Verificar se Nginx está configurado
log "7/9 - Verificando configuração do Nginx..."

NGINX_CONFIG="/etc/nginx/sites-available/kanban-buzz"
NGINX_ENABLED="/etc/nginx/sites-enabled/kanban-buzz"

if [ ! -f "$NGINX_CONFIG" ]; then
    log_warn "Nginx não está configurado. Configurando..."
    
    # Copiar configuração do reverse proxy
    sudo cp "$PROJECT_DIR/nginx-reverse-proxy.conf" "$NGINX_CONFIG"
    
    # Criar link simbólico
    sudo ln -sf "$NGINX_CONFIG" "$NGINX_ENABLED"
    
    # Testar configuração
    if sudo nginx -t; then
        sudo systemctl reload nginx || sudo nginx -s reload
        log_success "Nginx configurado e recarregado"
    else
        log_error "Configuração do Nginx inválida"
        rollback
    fi
else
    log "Nginx já está configurado"
fi

# Alternar tráfego para nova versão
log "8/9 - Alternando tráfego para ${NEW_VERSION}..."

# Garantir que ambas versões estão rodando antes de alternar
log "Verificando que ambas versões estão rodando antes de alternar..."
if ! docker ps --format '{{.Names}}' | grep -q "kanban-buzz-app-${CURRENT_VERSION}"; then
    log_error "Versão atual (${CURRENT_VERSION}) não está rodando! Não é seguro alternar."
    rollback
fi
if ! docker ps --format '{{.Names}}' | grep -q "kanban-buzz-app-${NEW_VERSION}"; then
    log_error "Nova versão (${NEW_VERSION}) não está rodando! Não é seguro alternar."
    rollback
fi
log_success "Ambas versões estão rodando - seguro para alternar"

# Atualizar configuração do Nginx usando nginx-helper (protegido e sincronizado)
log "Atualizando Nginx usando helper protegido..."
NEW_PORT=$([ "$NEW_VERSION" = "blue" ] && echo "3000" || echo "3001")
source "$SCRIPT_DIR/nginx-helper.sh" 2>/dev/null || true

if command -v update_nginx &> /dev/null; then
    if update_nginx "$NEW_VERSION" "$NEW_PORT"; then
        log_success "Nginx atualizado e recarregado - tráfego alternado para ${NEW_VERSION}"
    else
        log_error "Falha ao atualizar Nginx usando helper"
        rollback
    fi
else
    # Fallback se nginx-helper não estiver disponível
    log_warn "nginx-helper não disponível. Usando método direto (não recomendado)..."
    sudo sed -i "s/default [a-z]*;/default ${NEW_VERSION};/" "$NGINX_CONFIG" || {
        log_error "Falha ao atualizar configuração do Nginx"
        rollback
    }
    
    # Testar configuração ANTES de recarregar
    if ! sudo nginx -t; then
        log_error "Configuração do Nginx inválida após atualização"
        sudo sed -i "s/default ${NEW_VERSION};/default ${CURRENT_VERSION};/" "$NGINX_CONFIG"
        rollback
    fi
    
    # Recarregar Nginx
    if sudo systemctl reload nginx 2>/dev/null || sudo nginx -s reload 2>/dev/null; then
        log_success "Nginx recarregado - tráfego alternado para ${NEW_VERSION}"
    else
        log_error "Falha ao recarregar Nginx"
        rollback
    fi
fi

# Aguardar um pouco e verificar se nova versão está recebendo tráfego
sleep 3
if ! "$HEALTH_CHECK" "${NEW_VERSION}" 10 >/dev/null 2>&1; then
    log_error "Nova versão não está respondendo após alternância!"
    rollback
fi
log_success "Nova versão está recebendo e respondendo ao tráfego"

# Aguardar estabilidade - MÚLTIPLAS VERIFICAÇÕES
log "9/9 - Aguardando estabilidade (${STABILITY_WAIT}s)..."

# Verificação 1: Após 10 segundos
sleep 10
if ! "$HEALTH_CHECK" "${NEW_VERSION}" 10 >/dev/null 2>&1; then
    log_error "Nova versão não está estável (verificação 1)"
    rollback
fi
log "Verificação 1/3: OK"

# Verificação 2: Após mais 10 segundos
sleep 10
if ! "$HEALTH_CHECK" "${NEW_VERSION}" 10 >/dev/null 2>&1; then
    log_error "Nova versão não está estável (verificação 2)"
    rollback
fi
log "Verificação 2/3: OK"

# Verificação 3: Após mais 10 segundos
sleep 10
if ! "$HEALTH_CHECK" "${NEW_VERSION}" 10 >/dev/null 2>&1; then
    log_error "Nova versão não está estável (verificação 3)"
    rollback
fi
log "Verificação 3/3: OK"

log_success "Nova versão estável após 3 verificações consecutivas!"

# VERIFICAÇÃO FINAL CRÍTICA - Garantir que nova versão está no ar
log "10/10 - Verificação final crítica - Garantindo que nova versão está no ar..."

# Verificar múltiplas vezes que nova versão está respondendo
VERIFICATION_PASSED=false
for i in {1..5}; do
    sleep 2
    if "$HEALTH_CHECK" "${NEW_VERSION}" 5 >/dev/null 2>&1; then
        log "Verificação final $i/5: OK"
        if [ $i -ge 3 ]; then
            VERIFICATION_PASSED=true
            break
        fi
    else
        log_warn "Verificação final $i/5: Falhou, tentando novamente..."
    fi
done

if [ "$VERIFICATION_PASSED" = false ]; then
    log_error "FALHA CRÍTICA: Nova versão não está respondendo após múltiplas tentativas!"
    log_error "Executando rollback de emergência..."
    rollback
    exit 1
fi

# Verificar que Nginx está direcionando para nova versão
NGINX_CURRENT=$(grep -o "default [a-z]*;" "$NGINX_CONFIG" 2>/dev/null | grep -o "[a-z]*" | tail -1)
if [ "$NGINX_CURRENT" != "$NEW_VERSION" ]; then
    log_error "FALHA CRÍTICA: Nginx não está direcionando para ${NEW_VERSION}!"
    log_error "Nginx está em: ${NGINX_CURRENT}, deveria estar em: ${NEW_VERSION}"
    rollback
    exit 1
fi

log_success "✅ GARANTIA: Nova versão ${NEW_VERSION} está no ar e recebendo tráfego!"

# Criar/atualizar arquivo .last-deploy ANTES de parar versão antiga
log "10/10 - Criando/atualizando arquivo .last-deploy..."
LAST_DEPLOY_FILE="$PROJECT_DIR/.last-deploy"
DEPLOY_ID=$(uuidgen 2>/dev/null || date +%s | sha256sum | cut -d' ' -f1)
NEW_IMAGE_ID=$(docker inspect "kanban-buzz-95241-app-${NEW_VERSION}:latest" --format='{{.Id}}' 2>/dev/null || echo "")
TIMESTAMP_ISO=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

jq -n \
    --arg version "$NEW_VERSION" \
    --arg timestamp "$TIMESTAMP_ISO" \
    --arg image_id "$NEW_IMAGE_ID" \
    --arg deploy_id "$DEPLOY_ID" \
    '{
        version: $version,
        timestamp: $timestamp,
        image_id: $image_id,
        deploy_id: $deploy_id
    }' > "$LAST_DEPLOY_FILE" 2>/dev/null || {
    # Fallback se jq não estiver disponível
    echo "{\"version\":\"$NEW_VERSION\",\"timestamp\":\"$TIMESTAMP_ISO\",\"image_id\":\"$NEW_IMAGE_ID\",\"deploy_id\":\"$DEPLOY_ID\"}" > "$LAST_DEPLOY_FILE"
}

log_success "Arquivo .last-deploy atualizado"

# VERIFICAÇÕES CRÍTICAS ANTES DE PARAR VERSÃO ANTIGA
log "11/11 - Executando verificações críticas antes de parar versão antiga..."

# Executar script de verificação completa
if [ -f "$VERIFY_LAST_DEPLOY" ]; then
    chmod +x "$VERIFY_LAST_DEPLOY" 2>/dev/null || true
    if ! "$VERIFY_LAST_DEPLOY" "$NEW_VERSION" "$CURRENT_VERSION"; then
        log_error "Verificações críticas falharam! NÃO parando versão antiga."
        log_error "Mantendo ambas versões rodando para segurança."
        release_lock
        exit 1
    fi
    log_success "Todas verificações críticas passaram"
else
    log_warn "Script verify-last-deploy-in-air.sh não encontrado. Executando verificações básicas..."
    
    # Verificações básicas se script não estiver disponível
    if ! "$HEALTH_CHECK" "${NEW_VERSION}" 10 >/dev/null 2>&1; then
        log_error "Nova versão não está saudável! NÃO parando versão antiga."
        exit 1
    fi
fi

# Aguardar estabilidade adicional (15 segundos conforme solicitado)
log "Aguardando estabilidade adicional (15s) antes de parar versão antiga..."
sleep 15

# Verificar novamente que nova versão está saudável antes de parar antiga
if ! "$HEALTH_CHECK" "${NEW_VERSION}" 10 >/dev/null 2>&1; then
    log_error "Nova versão não está saudável após estabilidade adicional! NÃO parando versão antiga."
    log_error "Mantendo ambas versões rodando para segurança."
    release_lock
    exit 1
fi

# Verificar que get-last-deploy confirma nova versão
if [ -f "$GET_LAST_DEPLOY" ]; then
    chmod +x "$GET_LAST_DEPLOY" 2>/dev/null || true
    LAST_DEPLOY=$( "$GET_LAST_DEPLOY" 2>/dev/null || echo "" )
    if [ -n "$LAST_DEPLOY" ] && [ "$LAST_DEPLOY" != "$NEW_VERSION" ]; then
        log_error "get-last-deploy indica versão diferente: ${LAST_DEPLOY} (esperado: ${NEW_VERSION})"
        log_error "NÃO parando versão antiga por segurança."
        release_lock
        exit 1
    fi
    log_success "get-last-deploy confirma que ${NEW_VERSION} é o último deploy"
fi

# Parar versão antiga (SÓ APÓS TODAS VERIFICAÇÕES)
log "Parando versão antiga (${CURRENT_VERSION})..."

docker compose -f docker-compose.${CURRENT_VERSION}.yml down || {
    log_warn "Aviso: Falha ao parar ${CURRENT_VERSION} (pode não estar rodando)"
}

log_success "Versão antiga parada"

# Executar script de proteção após parar versão antiga
PROTECTION_SCRIPT="$SCRIPT_DIR/proteger-containers-blue-green.sh"
if [ -f "$PROTECTION_SCRIPT" ]; then
    log "Executando script de proteção após parar versão antiga..."
    chmod +x "$PROTECTION_SCRIPT" 2>/dev/null || true
    "$PROTECTION_SCRIPT" || log_warn "Script de proteção retornou erro (continuando...)"
fi

# Limpar imagens antigas (opcional)
log "Limpando imagens antigas..."

docker image prune -f || true

log_success "Limpeza concluída"

# Resumo final
log ""
log "=========================================="
log_success "✅ Deploy Zero-Downtime concluído!"
log "=========================================="
log ""
log "Versão ativa: ${NEW_VERSION}"
log "Porta: $([ "$NEW_VERSION" = "blue" ] && echo "3000" || echo "3001")"
log ""
log "Comandos úteis:"
log "  - Ver logs: docker compose -f docker-compose.${NEW_VERSION}.yml logs -f"
log "  - Status: docker compose -f docker-compose.${NEW_VERSION}.yml ps"
log "  - Health check: $HEALTH_CHECK ${NEW_VERSION}"
log "  - Rollback: $0 --rollback"
log ""

# Remover trap de erro (mas manter trap de EXIT para liberar lock)
trap - ERR

# Liberar lock explicitamente antes de sair (garantia dupla)
release_lock

log_success "Deploy concluído. Lock liberado."

exit 0

