#!/bin/bash

# 🔐 Helper: Funções SSH com Chave
# Descrição: Funções auxiliares para usar SSH com chave ao invés de senha
# Uso: source ./scripts/ssh-helper.sh

# Configuração do servidor
SSH_HOST_ALIAS="kanban-buzz-server"
SSH_HOST_IP="95.217.2.116"
SSH_USER="root"
SSH_DIR="/opt/app"

# Função para executar comando SSH sem senha
ssh_exec() {
    local command="$1"
    ssh "$SSH_HOST_ALIAS" "cd $SSH_DIR && $command"
}

# Função para copiar arquivo via SCP sem senha
ssh_copy() {
    local local_file="$1"
    local remote_file="${2:-$(basename "$local_file")}"
    scp "$local_file" "$SSH_HOST_ALIAS:$SSH_DIR/$remote_file"
}

# Função para executar comando SSH com heredoc
ssh_exec_heredoc() {
    ssh "$SSH_HOST_ALIAS" << ENDSSH
cd $SSH_DIR
$1
ENDSSH
}

# Exportar variáveis
export SSH_HOST_ALIAS SSH_HOST_IP SSH_USER SSH_DIR

