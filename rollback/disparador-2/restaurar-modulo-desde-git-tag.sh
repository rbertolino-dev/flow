#!/usr/bin/env bash
# Restaura ficheiros do Disparador 2 a partir de uma tag Git anotada.
# Uso (na raiz do repo): ./rollback/disparador-2/restaurar-modulo-desde-git-tag.sh <tag> [paths.txt]
set -euo pipefail

TAG="${1:-}"
if [[ -z "$TAG" ]]; then
  echo "Uso: $0 <tag-git> [caminho-para-PATHS.checkout]" >&2
  echo "Ex.: $0 disparador-2-baseline-2026-03-21" >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
DEFAULT_PATHS="$SCRIPT_DIR/CHECKPOINT-2026-03-21/PATHS.checkout"
PATHS_FILE="${2:-$DEFAULT_PATHS}"

if [[ ! -f "$PATHS_FILE" ]]; then
  echo "Erro: ficheiro de paths não encontrado: $PATHS_FILE" >&2
  exit 1
fi

cd "$REPO_ROOT"

if ! git rev-parse "$TAG" >/dev/null 2>&1; then
  echo "Erro: tag ou ref inválida: $TAG (corre: git fetch --tags)" >&2
  exit 1
fi

mapfile -t paths < <(grep -v '^#' "$PATHS_FILE" | sed '/^[[:space:]]*$/d')

if [[ ${#paths[@]} -eq 0 ]]; then
  echo "Erro: lista de paths vazia em $PATHS_FILE" >&2
  exit 1
fi

echo "A restaurar ${#paths[@]} paths a partir de $TAG ..."
git checkout "$TAG" -- "${paths[@]}"
echo "Concluído. Revisa com: git status && git diff --stat"
