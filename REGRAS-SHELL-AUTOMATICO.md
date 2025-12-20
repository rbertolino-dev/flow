# 💻 Regras Shell/Terminal Automáticas

## 🎯 Regra Principal: Acesso ao Shell Automático

**O Cursor TEM acesso completo ao shell/terminal e DEVE executar comandos automaticamente quando necessário, SEM pedir confirmação.**

---

## 🚀 Quando Executar Comandos no Shell

**SEMPRE** executar automaticamente no shell quando:

- ✅ Verificar status de serviços → `docker compose ps`, `systemctl status`
- ✅ Ver logs → `docker compose logs`, `tail -f arquivo.log`
- ✅ Instalar dependências → `npm install`, `apt install`
- ✅ Executar scripts → `./scripts/nome.sh`
- ✅ Verificar arquivos → `ls -la`, `cat arquivo`
- ✅ Testar conectividade → `curl`, `ping`, `ssh`
- ✅ Aplicar mudanças → `git pull`, `npm run build`
- ✅ Verificar processos → `ps aux`, `top`
- ✅ Verificar espaço → `df -h`, `du -sh`
- ✅ Qualquer comando necessário para completar a tarefa

---

## 📋 Fluxo Automático para Shell

### Fluxo Completo (SEM Perguntar):

```
Usuário pede: "Verifique se Docker está rodando" ou "Instale X"
    ↓
Cursor AUTOMATICAMENTE executa no shell:
  1. Identifica comando necessário
  2. Executa comando diretamente
  3. Analisa resultado
  4. Toma ação baseada no resultado
    ↓
✅ Se sucesso → Continua com próxima ação
❌ Se falhar → Tenta correção automática
```

---

## 🔧 Comandos que SEMPRE Executar Automaticamente

### Verificação e Status:

```bash
# Docker
docker compose ps
docker compose logs --tail=50
docker images
docker ps -a

# Sistema
systemctl status [serviço]
ps aux | grep [processo]
df -h
free -h

# Aplicação
curl -f http://localhost:3000
netstat -tulpn | grep 3000
```

### Instalação e Atualização:

```bash
# Dependências Node
npm install
npm install --legacy-peer-deps
npm update

# Sistema (se necessário)
apt update && apt install -y [pacote]
```

### Execução de Scripts:

```bash
# Scripts do projeto
./scripts/deploy-automatico.sh
./scripts/rebuild-docker.sh
./scripts/aplicar-migrations-ssh.sh

# Com permissão
chmod +x scripts/*.sh && ./scripts/nome.sh
```

### Git e Código:

```bash
# Atualizar código
git pull
git status
git log --oneline -5

# Build
npm run build
npm run test
```

---

## 🖥️ Executar no Servidor Remoto - Automático

**SEMPRE** executar via SSH automaticamente quando necessário:

```bash
# Carregar credenciais
export SERVER_IP="95.217.2.116"
export SERVER_USER="root"
export SERVER_PASSWORD="grkjuXfEbwaF"
export SERVER_DIR="/opt/app"

# Executar comando no servidor
sshpass -p "$SERVER_PASSWORD" ssh "$SERVER_USER@$SERVER_IP" "cd $SERVER_DIR && [comando]"
```

---

## ✅ Verificação Automática de Resultados

**SEMPRE** verificar resultado dos comandos:

```bash
# Verificar exit code
echo $?  # Deve ser 0 para sucesso

# Verificar output
if [ $? -eq 0 ]; then
    echo "✅ Comando executado com sucesso"
else
    echo "❌ Erro ao executar comando"
    # Tentar correção automática
fi
```

---

## 🚫 O Que NUNCA Fazer com Shell

1. ❌ **NUNCA** pedir confirmação antes de executar comandos de verificação
2. ❌ **NUNCA** pedir confirmação antes de executar comandos de leitura (ls, cat, etc.)
3. ❌ **NUNCA** pedir confirmação antes de executar scripts do projeto
4. ❌ **NUNCA** pedir confirmação antes de verificar status
5. ❌ **NUNCA** executar comandos destrutivos sem contexto (rm -rf /, etc.)
6. ❌ **NUNCA** ignorar erros sem tentar correção

---

## ⚠️ Comandos que Requerem Cuidado (Mas Executar se Necessário)

**SEMPRE** executar, mas informar o que foi feito:

```bash
# Comandos que modificam sistema (executar se necessário)
apt install -y [pacote]
systemctl restart [serviço]
docker system prune -f  # Se necessário para limpar

# Comandos Git (executar se necessário)
git reset --hard  # Apenas se usuário pedir explicitamente
git clean -fd     # Apenas se usuário pedir explicitamente
```

---

## ✅ Padrões Obrigatórios para Shell

1. ✅ **SEMPRE** executar comandos de verificação automaticamente
2. ✅ **SEMPRE** verificar exit code após comandos
3. ✅ **SEMPRE** analisar output para tomar decisões
4. ✅ **SEMPRE** tentar correção automática se houver erro
5. ✅ **SEMPRE** informar resultado ao usuário
6. ✅ **SEMPRE** usar credenciais salvas para SSH

---

## 📝 Exemplo Completo de Uso do Shell

### Exemplo 1: Verificar Status

**Usuário pede:**
```
Verifique se a aplicação está rodando
```

**Cursor faz automaticamente:**

1. **Executa comandos:**
   ```bash
   docker compose ps
   curl -f http://localhost:3000
   docker compose logs --tail=20 app
   ```

2. **Analisa resultados:**
   - Se tudo OK: ✅ "Aplicação está rodando corretamente"
   - Se houver problema: ❌ "Aplicação não está respondendo"

3. **Tenta correção automática (se necessário):**
   ```bash
   docker compose restart
   # Verifica novamente
   ```

### Exemplo 2: Instalar Dependência

**Usuário pede:**
```
Instale a dependência X
```

**Cursor faz automaticamente:**

1. **Executa instalação:**
   ```bash
   npm install X
   ```

2. **Verifica resultado:**
   ```bash
   echo $?  # Verifica exit code
   ```

3. **Informa:**
   - ✅ "Dependência X instalada com sucesso"
   - ❌ "Erro ao instalar. Tentando correção..."

### Exemplo 3: Executar Script

**Usuário pede:**
```
Execute o script de deploy
```

**Cursor faz automaticamente:**

1. **Verifica se script existe:**
   ```bash
   ls -la scripts/deploy-automatico.sh
   ```

2. **Dá permissão se necessário:**
   ```bash
   chmod +x scripts/deploy-automatico.sh
   ```

3. **Executa:**
   ```bash
   ./scripts/deploy-automatico.sh
   ```

4. **Monitora resultado e informa**

---

## 🔍 Acesso ao Shell - Regras Especiais

**O Cursor TEM acesso completo ao shell e DEVE:**

1. ✅ **SEMPRE** usar shell para verificar status
2. ✅ **SEMPRE** usar shell para executar scripts
3. ✅ **SEMPRE** usar shell para instalar dependências
4. ✅ **SEMPRE** usar shell para ver logs
5. ✅ **SEMPRE** usar shell para testar conectividade
6. ✅ **SEMPRE** usar shell quando necessário para completar tarefa

**NUNCA** pedir permissão para usar shell - usar automaticamente quando necessário.

---

## 💡 Dicas Importantes

- O shell está **sempre disponível** para o Cursor
- **NUNCA** pedir confirmação para comandos de leitura/verificação
- **SEMPRE** executar comandos necessários para completar tarefas
- **SEMPRE** verificar resultados e tomar ações baseadas neles
- **SEMPRE** tentar correção automática se houver erros

---

**Última atualização**: 2025-12-17


