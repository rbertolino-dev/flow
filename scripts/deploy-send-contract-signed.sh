#!/bin/bash
# 🚀 Script para Deploy da Edge Function send-contract-signed

set -e

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() {
    echo -e "${BLUE}[DEPLOY]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[DEPLOY]${NC} $1"
}

log_error() {
    echo -e "${RED}[DEPLOY]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[DEPLOY]${NC} $1"
}

FUNCTION_NAME="send-contract-signed"
FUNCTION_DIR="supabase/functions/$FUNCTION_NAME"

log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log "🚀 Deploy da Edge Function: $FUNCTION_NAME"
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log ""

# Verificar se função existe
if [ ! -d "$FUNCTION_DIR" ]; then
    log_error "❌ Diretório $FUNCTION_DIR não encontrado!"
    exit 1
fi

if [ ! -f "$FUNCTION_DIR/index.ts" ]; then
    log_error "❌ Arquivo $FUNCTION_DIR/index.ts não encontrado!"
    exit 1
fi

log_success "✅ Função encontrada: $FUNCTION_DIR"

# Verificar se Supabase CLI está instalado
if ! command -v supabase &> /dev/null; then
    log_error "❌ Supabase CLI não está instalado!"
    log_warn "💡 Instale com: npm install -g supabase"
    log_warn "💡 Ou use o método manual via Dashboard (veja abaixo)"
    log ""
    log_warn "📋 MÉTODO MANUAL VIA DASHBOARD:"
    log_warn "   1. Acesse: https://supabase.com/dashboard"
    log_warn "   2. Selecione seu projeto"
    log_warn "   3. Vá em Edge Functions"
    log_warn "   4. Encontre ou crie a função: $FUNCTION_NAME"
    log_warn "   5. Copie o conteúdo de: $FUNCTION_DIR/index.ts"
    log_warn "   6. Cole no editor e clique em Deploy"
    exit 1
fi

log_success "✅ Supabase CLI encontrado"

# Verificar se está linkado
if [ ! -f "supabase/.temp/project-ref" ]; then
    log_warn "⚠️  Projeto não está linkado ao Supabase"
    log_warn "💡 Para linkar, execute:"
    log_warn "   supabase link --project-ref [SEU_PROJECT_ID]"
    log ""
    log_warn "📋 Ou use o método manual via Dashboard (veja acima)"
    exit 1
fi

PROJECT_REF=$(cat supabase/.temp/project-ref 2>/dev/null || echo "desconhecido")
log "📦 Projeto: $PROJECT_REF"

# Fazer deploy
log "📤 Fazendo deploy de $FUNCTION_NAME..."
log ""

if supabase functions deploy "$FUNCTION_NAME" --no-verify-jwt; then
    log_success "✅ $FUNCTION_NAME deployado com sucesso!"
    log ""
    log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    log_success "🎉 Deploy concluído!"
    log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    log ""
    log "💡 Para verificar:"
    log "   1. Acesse: https://supabase.com/dashboard"
    log "   2. Vá em Edge Functions"
    log "   3. Verifique se $FUNCTION_NAME está na lista"
    log "   4. Clique na função → Logs para ver logs em tempo real"
    exit 0
else
    log_error "❌ Erro ao fazer deploy de $FUNCTION_NAME"
    log ""
    log_warn "📋 Tente o método manual via Dashboard:"
    log_warn "   1. Acesse: https://supabase.com/dashboard"
    log_warn "   2. Vá em Edge Functions"
    log_warn "   3. Encontre ou crie a função: $FUNCTION_NAME"
    log_warn "   4. Copie o conteúdo de: $FUNCTION_DIR/index.ts"
    log_warn "   5. Cole no editor e clique em Deploy"
    exit 1
fi

