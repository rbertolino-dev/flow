#!/bin/bash
# ✅ Checklist Interativo de Migração
# Guia passo a passo para migração segura

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 CHECKLIST DE MIGRAÇÃO DO SUPABASE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Cores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

check_item() {
    local item="$1"
    echo -n "   [ ] $item"
    read -p " (Pressione ENTER quando concluir): " -r
    echo ""
}

echo "📝 FASE 1: PREPARAÇÃO E BACKUP"
echo ""
check_item "Fazer backup completo do banco de dados"
check_item "Listar todas as variáveis de ambiente"
check_item "Documentar todas as integrações externas"
check_item "Criar novo projeto Supabase (ou configurar self-hosted)"
check_item "Testar conectividade com novo projeto"

echo ""
echo "📝 FASE 2: MIGRAÇÃO DO BANCO DE DADOS"
echo ""
check_item "Linkar ao novo projeto: supabase link --project-ref [NOVO_ID]"
check_item "Aplicar todas as migrations: supabase db push"
check_item "Verificar se todas as migrations foram aplicadas"
check_item "Validar estrutura do banco (tabelas, RLS policies)"
check_item "Migrar dados (se necessário)"

echo ""
echo "📝 FASE 3: MIGRAÇÃO DAS EDGE FUNCTIONS"
echo ""
check_item "Fazer deploy de todas as Edge Functions"
check_item "Verificar se todas as funções foram deployadas"
check_item "Configurar secrets/variáveis de ambiente no Dashboard"
check_item "Testar funções críticas (webhooks, callbacks)"

echo ""
echo "📝 FASE 4: ATUALIZAR FRONTEND"
echo ""
check_item "Atualizar VITE_SUPABASE_URL no .env ou Lovable Cloud"
check_item "Atualizar VITE_SUPABASE_PUBLISHABLE_KEY"
check_item "Regenerar types TypeScript: supabase gen types typescript"
check_item "Testar autenticação (login/logout)"
check_item "Testar funcionalidades principais"

echo ""
echo "📝 FASE 5: ATUALIZAR INTEGRAÇÕES EXTERNAS"
echo ""
check_item "Atualizar URLs de webhooks no Facebook Developer"
check_item "Atualizar URLs de webhooks na Evolution API"
check_item "Atualizar URLs de webhooks no Chatwoot"
check_item "Atualizar URLs de webhooks no Mercado Pago"
check_item "Atualizar URLs de webhooks no Asaas"
check_item "Atualizar Redirect URIs OAuth no Google Cloud Console"
check_item "Atualizar Redirect URIs OAuth no Facebook Developer"

echo ""
echo "📝 FASE 6: TESTES E VALIDAÇÃO"
echo ""
check_item "Testar autenticação completa"
check_item "Testar todas as Edge Functions principais"
check_item "Testar webhooks (enviar teste de cada serviço)"
check_item "Testar integrações OAuth (Google, Facebook)"
check_item "Validar dados migrados"
check_item "Monitorar logs por 24-48h"
check_item "Documentar novo projeto (IDs, URLs, credenciais)"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}✅ Checklist concluído!${NC}"
echo ""
echo "💡 Dica: Mantenha o projeto antigo ativo por alguns dias"
echo "   para garantir que tudo está funcionando antes de desativar."
echo ""
