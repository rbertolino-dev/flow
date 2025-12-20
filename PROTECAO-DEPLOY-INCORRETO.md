# 🛡️ Proteção Contra Deploy Incorreto

## 🎯 Objetivo

**Detectar e prevenir uso do método antigo de deploy que causa downtime e erro 502.**

## 🔧 Componentes Implementados

### 1. Hook de Proteção

**Arquivo:** `scripts/hook-docker-compose.sh`

**O que faz:**
- ✅ Intercepta comandos `docker compose down` e `docker compose up`
- ✅ Detecta quando método antigo é usado (sem blue/green)
- ✅ Bloqueia execução e registra em log
- ✅ Mostra mensagem de erro com instruções

**Como funciona:**
- Wrapper function que intercepta `docker compose` commands
- Verifica se está usando `docker-compose.yml` (método antigo)
- Verifica se NÃO está usando blue/green
- Bloqueia e registra se detectar uso incorreto

### 2. Detector Contínuo

**Arquivo:** `scripts/detectar-deploy-incorreto.sh`

**O que faz:**
- ✅ Monitora containers a cada 10 segundos
- ✅ Detecta container antigo (`kanban-buzz-app` sem porta)
- ✅ Detecta ausência de containers blue/green
- ✅ Registra alertas em log

**Serviço:** `kanban-buzz-deploy-detector.service` (systemd)

### 3. Script de Visualização

**Arquivo:** `scripts/ver-deploys-incorretos.sh`

**O que faz:**
- ✅ Mostra últimos alertas de deploy incorreto
- ✅ Estatísticas de tentativas
- ✅ Informações sobre quem tentou usar método antigo

**Comando:** `ver-deploys-incorretos`

## 📋 Logs Criados

### 1. Log de Proteção
**Arquivo:** `/var/log/kanban-buzz-deploy-protection.log`

**Contém:**
- Todas as tentativas de deploy incorreto
- Detalhes do comando executado
- Usuário, PID, diretório, processo pai
- Stack trace

### 2. Log de Alertas
**Arquivo:** `/var/log/kanban-buzz-deploy-alerts.log`

**Contém:**
- Alertas críticos de tentativas de deploy incorreto
- Timestamp e usuário
- Comando tentado

### 3. Log do Detector
**Arquivo:** `/var/log/kanban-buzz-deploy-detector.log`

**Contém:**
- Logs do serviço detector
- Detecções de containers incorretos

## 🚀 Como Usar

### Ver Deploys Incorretos:

```bash
# Ver últimos alertas
ver-deploys-incorretos

# Ou diretamente
./scripts/ver-deploys-incorretos.sh

# Ver log completo
tail -f /var/log/kanban-buzz-deploy-alerts.log

# Ver log detalhado
tail -f /var/log/kanban-buzz-deploy-protection.log
```

### Status do Detector:

```bash
# Ver status
sudo systemctl status kanban-buzz-deploy-detector

# Ver logs
sudo journalctl -u kanban-buzz-deploy-detector -f

# Reiniciar
sudo systemctl restart kanban-buzz-deploy-detector
```

### Ativar Proteção Manualmente:

```bash
# Source o hook
source scripts/hook-docker-compose.sh

# Ou usar script de proteção
source scripts/proteger-deploy.sh
```

## 🔍 O Que é Detectado

### 1. Comandos Perigosos:
- ❌ `docker compose down` (sem especificar blue/green)
- ❌ `docker compose up` (sem especificar blue/green)
- ❌ `docker-compose down` (método antigo)
- ❌ `docker-compose up` (método antigo)

### 2. Containers Incorretos:
- ❌ `kanban-buzz-app` (sem porta mapeada)
- ❌ Ausência de `kanban-buzz-app-blue` ou `kanban-buzz-app-green`

### 3. Situações de Risco:
- ❌ Container rodando sem porta 3000 mapeada
- ❌ Nenhum container blue/green rodando

## 📊 Exemplo de Log

```
[2025-12-18 01:50:00] 🚨 TENTATIVA DE DEPLOY INCORRETO
[2025-12-18 01:50:00] Comando: docker compose down
[2025-12-18 01:50:00] Usuário: root
[2025-12-18 01:50:00] PID: 12345
[2025-12-18 01:50:00] Diretório: /root/kanban-buzz-95241
[2025-12-18 01:50:00] Processo pai: /bin/bash
[2025-12-18 01:50:00] Stack: 1 main ./test.sh
---
```

## ✅ Proteções Ativas

1. ✅ **Hook intercepta comandos** - bloqueia antes de executar
2. ✅ **Detector monitora containers** - detecta após execução
3. ✅ **Logs detalhados** - rastreia quem tentou usar método antigo
4. ✅ **Alertas em tempo real** - notifica imediatamente
5. ✅ **Serviço systemd** - roda continuamente

## 🎯 Resultado

**Agora você pode:**
- ✅ Ver quem tentou usar método antigo
- ✅ Rastrear quando e como foi tentado
- ✅ Identificar padrões de uso incorreto
- ✅ Corrigir agentes/scripts que usam método antigo
- ✅ Prevenir futuros erros

---

**Status:** ✅ Proteção instalada e ativa
**Logs:** `/var/log/kanban-buzz-deploy-*.log`


