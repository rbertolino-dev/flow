#!/bin/bash
# Helper para usar credenciais GitHub automaticamente

# Carregar credenciais GitHub
load_github_credentials() {
    local script_dir
    if [ -n "$BASH_SOURCE" ]; then
        script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    elif [ -n "$0" ]; then
        script_dir="$(cd "$(dirname "$0")" && pwd)"
    else
        script_dir="$(cd "$(dirname "${BASH_SOURCE}")" && pwd)"
    fi
    
    local creds_file="$script_dir/.github-credentials"
    
    if [ -f "$creds_file" ]; then
        source "$creds_file"
        export GITHUB_TOKEN
        export GITHUB_USER
        export GITHUB_REPO
        return 0
    else
        # Tentar caminho relativo do projeto
        local project_root="$(cd "$(dirname "$0")/.." && pwd)"
        creds_file="$project_root/scripts/.github-credentials"
        if [ -f "$creds_file" ]; then
            source "$creds_file"
            export GITHUB_TOKEN
            export GITHUB_USER
            export GITHUB_REPO
            return 0
        else
            echo "❌ Arquivo scripts/.github-credentials não encontrado" >&2
            return 1
        fi
    fi
}

# Configurar Git para usar token automaticamente
setup_git_credentials() {
    if load_github_credentials; then
        # Configurar URL do remote com token (se necessário)
        local current_remote=$(git config --get remote.origin.url)
        
        if [[ "$current_remote" == *"git@"* ]]; then
            # Remote usa SSH, não precisa mudar
            echo "✅ Remote configurado com SSH (não precisa de token)"
        elif [[ "$current_remote" == *"https://"* ]]; then
            # Remote usa HTTPS, pode usar token
            echo "✅ Remote configurado com HTTPS (token disponível se necessário)"
        fi
        
        # Configurar credential helper se ainda não estiver
        if ! git config --global credential.helper | grep -q "store"; then
            git config --global credential.helper store
            echo "✅ Credential helper configurado"
        fi
    fi
}

# Fazer push usando token automaticamente
github_push() {
    if load_github_credentials; then
        local branch="${1:-main}"
        echo "📤 Fazendo push para GitHub..."
        git push "https://${GITHUB_TOKEN}@github.com/${GITHUB_USER}/${GITHUB_REPO}.git" "$branch"
        return $?
    else
        return 1
    fi
}

# Fazer pull usando token automaticamente
github_pull() {
    if load_github_credentials; then
        local branch="${1:-main}"
        echo "📥 Fazendo pull do GitHub..."
        git pull "https://${GITHUB_TOKEN}@github.com/${GITHUB_USER}/${GITHUB_REPO}.git" "$branch"
        return $?
    else
        return 1
    fi
}

# Obter token (para uso em scripts)
get_github_token() {
    if load_github_credentials; then
        echo "$GITHUB_TOKEN"
        return 0
    else
        return 1
    fi
}

# Verificar se token está configurado
check_github_token() {
    if load_github_credentials && [ -n "$GITHUB_TOKEN" ]; then
        echo "✅ Token GitHub configurado"
        echo "   Usuário: $GITHUB_USER"
        echo "   Repositório: $GITHUB_REPO"
        return 0
    else
        echo "❌ Token GitHub não configurado"
        return 1
    fi
}
