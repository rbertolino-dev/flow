# 🐳 Regras Docker Automáticas

## 🎯 Regra Principal: Modificações Docker Automáticas

**SEMPRE** executar modificações no Docker automaticamente, **SEM pedir confirmação** ao usuário.

---

## 🚀 Quando Modificar Docker

**SEMPRE** executar automaticamente quando:

- ✅ Modificar Dockerfile → Rebuild automático
- ✅ Modificar docker-compose.yml → Rebuild e restart automático
- ✅ Adicionar dependências → Rebuild automático
- ✅ Mudar variáveis de ambiente → Rebuild automático
- ✅ Atualizar código → Rebuild e deploy automático
- ✅ Corrigir erro de build → Rebuild automático

---

## 📋 Fluxo Automático para Docker

### Fluxo Completo (SEM Perguntar):

```
Usuário pede: "Modifique Dockerfile" ou "Atualize docker-compose"
    ↓
Cursor modifica arquivo(s)
    ↓
Cursor AUTOMATICAMENTE executa rebuild:
  1. docker compose down
  2. docker compose build --no-cache
  3. docker compose up -d
    ↓
Cursor AUTOMATICAMENTE verifica status:
  4. docker compose ps
  5. docker compose logs --tail=50
    ↓
✅ Se sucesso → Informa conclusão
❌ Se falhar → Aplica correções e re-executa
```

---

## 🔧 Comandos Docker Automáticos

**SEMPRE** usar estes comandos na ordem:

```bash
# 1. Parar containers
docker compose down

# 2. Build sem cache (OBRIGATÓRIO para pegar mudanças)
docker compose build --no-cache

# 3. Subir containers
docker compose up -d

# 4. Verificar status
docker compose ps

# 5. Ver logs
docker compose logs --tail=50 app
```

---

## 📝 Informações do Servidor Docker

**SEMPRE** usar estas informações:

```bash
# Servidor
SERVER_IP="95.217.2.116"
SERVER_USER="root"
SERVER_PASSWORD="grkjuXfEbwaF"
SERVER_DIR="/opt/app"

# Docker
DOCKER_COMPOSE_CMD="docker compose"  # Versão v5 (sem hífen)
CONTAINER_NAME="kanban-buzz-app"
PORT="3000"
```

---

## 🔄 Modificar Dockerfile - Fluxo Automático

**SEMPRE** executar automaticamente:

1. **Modificar Dockerfile** (se necessário)
2. **AUTOMATICAMENTE** executar rebuild:
   ```bash
   cd /opt/app
   docker compose down
   docker compose build --no-cache
   docker compose up -d
   ```
3. **AUTOMATICAMENTE** verificar:
   ```bash
   docker compose ps
   docker compose logs --tail=50 app
   ```

**NUNCA** modificar Dockerfile sem executar rebuild automaticamente.

---

## 🔄 Modificar docker-compose.yml - Fluxo Automático

**SEMPRE** executar automaticamente:

1. **Modificar docker-compose.yml** (se necessário)
2. **AUTOMATICAMENTE** executar rebuild:
   ```bash
   cd /opt/app
   docker compose down
   docker compose build --no-cache
   docker compose up -d
   ```
3. **AUTOMATICAMENTE** verificar:
   ```bash
   docker compose ps
   docker compose logs --tail=50 app
   ```

**NUNCA** modificar docker-compose.yml sem executar rebuild automaticamente.

---

## 🖥️ Executar no Servidor - Fluxo Automático

**SEMPRE** executar comandos Docker no servidor automaticamente:

```bash
# Carregar credenciais
export SERVER_IP="95.217.2.116"
export SERVER_USER="root"
export SERVER_PASSWORD="grkjuXfEbwaF"
export SERVER_DIR="/opt/app"

# Executar via SSH
sshpass -p "$SERVER_PASSWORD" ssh "$SERVER_USER@$SERVER_IP" "cd $SERVER_DIR && docker compose down && docker compose build --no-cache && docker compose up -d"
```

---

## ✅ Verificação Automática

**SEMPRE** verificar após modificações:

```bash
# 1. Status dos containers
docker compose ps

# 2. Logs recentes
docker compose logs --tail=50 app

# 3. Testar aplicação
curl -f http://localhost:3000 || echo "Aplicação não está respondendo"
```

---

## 🚫 O Que NUNCA Fazer com Docker

1. ❌ **NUNCA** modificar Dockerfile sem rebuild automático
2. ❌ **NUNCA** modificar docker-compose.yml sem rebuild automático
3. ❌ **NUNCA** fazer build sem `--no-cache` (pode usar cache antigo)
4. ❌ **NUNCA** pedir confirmação antes de executar comandos Docker
5. ❌ **NUNCA** esquecer de verificar status após modificações
6. ❌ **NUNCA** usar `docker-compose` (com hífen) - sempre usar `docker compose` (sem hífen)

---

## ✅ Padrões Obrigatórios para Docker

1. ✅ **SEMPRE** usar `docker compose` (sem hífen) - versão v5
2. ✅ **SEMPRE** usar `--no-cache` no build
3. ✅ **SEMPRE** executar `down` antes de `build`
4. ✅ **SEMPRE** verificar status após `up -d`
5. ✅ **SEMPRE** ver logs se houver erro
6. ✅ **SEMPRE** executar no servidor via SSH se necessário

---

## 📝 Exemplo Completo

### Exemplo 1: Adicionar Variável no Dockerfile

**Usuário pede:**
```
Adicione a variável VITE_NEW_FEATURE=true no Dockerfile
```

**Cursor faz automaticamente:**

1. **Modifica Dockerfile:**
   ```dockerfile
   ARG VITE_NEW_FEATURE
   ENV VITE_NEW_FEATURE=$VITE_NEW_FEATURE
   ```

2. **Executa rebuild automaticamente:**
   ```bash
   docker compose down
   docker compose build --no-cache
   docker compose up -d
   ```

3. **Verifica automaticamente:**
   ```bash
   docker compose ps
   docker compose logs --tail=50 app
   ```

4. **Informa:**
   ```
   ✅ Dockerfile atualizado e rebuild executado com sucesso!
   ```

### Exemplo 2: Modificar docker-compose.yml

**Usuário pede:**
```
Aumente a memória do container para 2GB
```

**Cursor faz automaticamente:**

1. **Modifica docker-compose.yml:**
   ```yaml
   deploy:
     resources:
       limits:
         memory: 2G
   ```

2. **Executa rebuild automaticamente:**
   ```bash
   docker compose down
   docker compose build --no-cache
   docker compose up -d
   ```

3. **Verifica automaticamente:**
   ```bash
   docker compose ps
   ```

4. **Informa:**
   ```
   ✅ docker-compose.yml atualizado e containers reiniciados!
   ```

---

## 🔍 Troubleshooting Automático

Se houver erro, **SEMPRE** executar automaticamente:

```bash
# Ver logs detalhados
docker compose logs app

# Verificar status
docker compose ps

# Limpar e tentar novamente
docker compose down
docker system prune -f
docker compose build --no-cache
docker compose up -d
```

---

**Última atualização**: 2025-12-17


