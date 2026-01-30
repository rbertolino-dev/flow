#!/usr/bin/env bash
# ============================================
# Verifica integridade de um checkpoint do Disparador 2
# Uso: ./rollback/disparador-2/verificar-checkpoint.sh [NOME_DO_CHECKPOINT]
# Ex.: ./rollback/disparador-2/verificar-checkpoint.sh CHECKPOINT-2025-01-27
# ============================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CHECKPOINT_NAME="${1:-CHECKPOINT-2025-01-27}"
CHECKPOINT_DIR="${SCRIPT_DIR}/${CHECKPOINT_NAME}"

if [[ ! -d "$CHECKPOINT_DIR" ]]; then
  echo "Erro: diretório do checkpoint não encontrado: $CHECKPOINT_DIR"
  echo "Uso: $0 [NOME_DO_CHECKPOINT]"
  exit 1
fi

if command -v sha256sum &>/dev/null; then
  HASH_CMD="sha256sum"
elif command -v shasum &>/dev/null; then
  HASH_CMD="shasum -a 256"
else
  echo "Erro: nem sha256sum nem shasum encontrados. Instale um deles para verificar checksums."
  exit 1
fi

echo "============================================"
echo "Verificação do checkpoint: $CHECKPOINT_NAME"
echo "Diretório: $CHECKPOINT_DIR"
echo "============================================"
echo ""

cd "$CHECKPOINT_DIR"

# Todos os arquivos exceto os próprios .md de documentação
echo "Checksums atuais dos arquivos do checkpoint:"
echo "---------------------------------------------"
find . -type f ! -name "MANIFEST.md" ! -name "RESTAURAR.md" | sort | while read -r f; do
  if [[ -f "$f" ]]; then
    $HASH_CMD "$f" 2>/dev/null
  fi
done

# Listar todos os arquivos do checkpoint para conferência
echo ""
echo "---------------------------------------------"
echo "Arquivos no checkpoint:"
find . -type f | sort | sed 's|^\./||'
echo ""
echo "Compare os hashes acima com a seção '2. Checksums' do MANIFEST.md."
echo "Se todos coincidirem, o checkpoint está íntegro."
