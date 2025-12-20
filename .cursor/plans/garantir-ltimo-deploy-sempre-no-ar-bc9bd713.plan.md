<!-- bc9bd713-5170-498a-8d3a-6a94bc2cb5c4 24ebeddd-7bb9-4932-ad70-4e5ef2322c88 -->
# Plano: Garantir que Último Deploy Sempre Fica no Ar

## Objetivo

Garantir 100% que o último deploy sempre está no ar, mesmo com múltiplos agentes trabalhando simultaneamente.

## Componentes a Implementar

### 1. Sistema de Identificação do Último Deploy (Duplo Método)

**Método Primário: Timestamp da Imagem Docker**

- Usar `docker inspect` para obter timestamp de criação da imagem
- Comparar timestamps de `kanban-buzz-95241-app-blue:latest` e `kanban-buzz-95241-app-green:latest`
- Versão com timestamp mais recente = último deploy

**Método Secundário: Arquivo de Controle**

- Criar arquivo `.last-deploy` em `$PROJECT_DIR/.last-deploy`
- Formato JSON: `{"version": "blue|green", "timestamp": "ISO8601", "image_id": "sha256:...", "deploy_id": "uuid"}`
- Atualizar após cada deploy bem-sucedido
- Usar como confirmação/fallback se timestamp da imagem não estiver disponível

**Arquivos:**

- `scripts/get-last-deploy.sh` - Função para identificar último deploy (usa ambos métodos)
- Atualizar `scripts/deploy-zero-downtime.sh` para criar/atualizar `.last-deploy`

### 2. Fila de Deploys Sequenciais

**Usando Docker Orchestrator Existente:**

- O `docker-orchestrator.sh` já usa file locking (`flock`)
- Expandir para garantir que deploys sejam sequenciais
- Se um deploy está em andamento, próximo aguarda na fila

**Implementação:**

- Criar lock específico para deploy: `/tmp/deploy-zero-downtime.lock`
- Script de deploy adquire lock no início
- Se lock já existe, aguarda até 1 hora (timeout configurável)
- Após deploy concluir, libera lock para próximo na fila

**Arquivos:**

- Atualizar `scripts/deploy-zero-downtime.sh` para usar lock de deploy
- Criar `scripts/deploy-queue.sh` (wrapper que gerencia fila)

### 3. Garantia de Último Deploy no Ar

**Antes de Parar Versão Antiga:**

1. Verificar que nova versão está saudável (já existe)
2. Verificar timestamp da imagem nova vs antiga (nova deve ser mais recente)
3. Verificar arquivo `.last-deploy` confirma nova versão
4. Verificar que Nginx está apontando para nova versão
5. Verificar que nova versão está recebendo tráfego (health check via Nginx)
6. Aguardar estabilidade adicional (30s já existe, aumentar para 60s)
7. Verificar versão no container (se disponível via `/version.json`)

**Só Parar Versão Antiga Se:**

- Todas verificações acima passarem
- Nova versão está estável há pelo menos 60 segundos
- Nginx confirmou que está direcionando para nova versão
- Arquivo `.last-deploy` foi atualizado com sucesso

**Arquivos:**

- Atualizar `scripts/deploy-zero-downtime.sh` (linhas 393-425)
- Criar `scripts/verify-last-deploy-in-air.sh` - Script de verificação completa

### 4. Script de Proteção Aprimorado

**Atualizar `proteger-containers-blue-green.sh`:**

- Usar `get-last-deploy.sh` para identificar qual deveria estar no ar
- Se container do último deploy não está rodando, restaurar automaticamente
- Se Nginx não aponta para último deploy, corrigir automaticamente
- Garantir que sempre há container do último deploy rodando

**Arquivos:**

- Atualizar `scripts/proteger-containers-blue-green.sh`
- Integrar com `get-last-deploy.sh`

### 5. Verificação de Versão no Container

**Adicionar verificação de versão:**

- Container deve servir `/version.json` (já existe no build)
- Script de deploy verifica que versão no container corresponde à esperada
- Se não corresponder, não considera deploy completo

**Arquivos:**

- Atualizar `scripts/deploy-zero-downtime.sh` para verificar `/version.json`
- Criar `scripts/verify-container-version.sh`

## Fluxo Completo

```
Deploy Inicia
    ↓
Adquire lock de deploy (aguarda se outro deploy em andamento)
    ↓
Identifica versão atual rodando
    ↓
Faz build da nova versão
    ↓
Sobe nova versão
    ↓
3 verificações de saúde
    ↓
Alterna Nginx para nova versão
    ↓
3 verificações de estabilidade
    ↓
5 verificações finais críticas
    ↓
VERIFICAÇÕES ANTES DE PARAR ANTIGA:
  - Nova versão saudável ✓
  - Timestamp imagem nova > antiga ✓
  - Arquivo .last-deploy atualizado ✓
  - Nginx apontando para nova ✓
  - Nova versão recebendo tráfego ✓
  - Versão no container confere ✓
  - Estável há 60s ✓
    ↓
Atualiza .last-deploy
    ↓
Aguarda 60s estabilidade adicional
    ↓
Verifica novamente todas condições
    ↓
SÓ ENTÃO para versão antiga
    ↓
Executa script de proteção
    ↓
Libera lock (próximo deploy pode iniciar)
    ↓
Deploy concluído - último deploy garantido no ar
```

## Arquivos a Criar/Modificar

1. `scripts/get-last-deploy.sh` - Identifica último deploy (duplo método)
2. `scripts/verify-last-deploy-in-air.sh` - Verifica que último deploy está no ar
3. `scripts/verify-container-version.sh` - Verifica versão no container
4. `scripts/deploy-zero-downtime.sh` - Modificar para usar fila, verificações e .last-deploy
5. `scripts/proteger-containers-blue-green.sh` - Integrar com get-last-deploy
6. `.last-deploy` - Arquivo de controle (criado automaticamente)

## Regras Críticas

1. **NUNCA** parar versão antiga sem todas verificações passarem
2. **SEMPRE** atualizar `.last-deploy` antes de parar versão antiga
3. **SEMPRE** usar lock de deploy para garantir sequência
4. **SEMPRE** verificar que último deploy está no ar após cada operação
5. **SEMPRE** executar script de proteção após deploy

## Testes

- Testar com múltiplos deploys sequenciais
- Testar com deploy interrompido
- Testar com container removido manualmente
- Verificar que script de proteção restaura último deploy

### To-dos

- [ ] Criar script get-last-deploy.sh que identifica último deploy usando timestamp de imagem Docker + arquivo .last-deploy
- [ ] Criar script verify-last-deploy-in-air.sh que verifica todas condições antes de parar versão antiga
- [ ] Criar script verify-container-version.sh que verifica versão no container via /version.json
- [ ] Modificar deploy-zero-downtime.sh para usar lock de deploy (fila sequencial)
- [ ] Modificar deploy-zero-downtime.sh para criar/atualizar arquivo .last-deploy após deploy bem-sucedido
- [ ] Modificar deploy-zero-downtime.sh para executar todas verificações antes de parar versão antiga
- [ ] Atualizar proteger-containers-blue-green.sh para usar get-last-deploy e garantir último deploy sempre no ar
- [ ] Adicionar regras ao .cursorrules sobre garantia de último deploy sempre no ar