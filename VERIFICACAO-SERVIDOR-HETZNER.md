# 🔍 Verificação e Backup do Servidor Hetzner

**Data**: 15/12/2025  
**Servidor**: root@95.217.2.116  
**Diretório no servidor**: /opt/app

---

## 📋 Status Atual

### ✅ Arquivos Locais Verificados

O relatório completo dos arquivos locais foi gerado em:
- **Arquivo**: `backups/relatorios/relatorio_arquivos_*.txt`

**Resumo dos arquivos locais:**
- ✅ **409 arquivos** em `src/` (4.7M)
- ✅ **536 arquivos** em `supabase/` (3.5M)
- ✅ **86 Edge Functions** em `supabase/functions/`
- ✅ **220 Migrations** em `supabase/migrations/`
- ✅ **53 scripts** em `scripts/`
- ✅ Todos os arquivos de configuração (package.json, docker-compose.yml, Dockerfile, etc.)

---

## 🚀 Scripts Criados

### 1. Verificar Arquivos Locais
```bash
./scripts/verificar-arquivos-locais.sh
```
**O que faz:**
- Gera relatório completo dos arquivos locais
- Lista todos os arquivos importantes
- Conta Edge Functions e Migrations
- Calcula tamanhos e estatísticas

**Resultado:** Relatório salvo em `backups/relatorios/relatorio_arquivos_*.txt`

---

### 2. Comparar Local vs Servidor
```bash
./scripts/comparar-com-servidor.sh [IP_SERVIDOR]
```
**O que faz:**
- Tenta conectar ao servidor via SSH
- Compara arquivos locais com os do servidor
- Identifica arquivos faltantes
- Gera relatório de comparação

**Resultado:** Relatório salvo em `backups/comparacao/comparacao_*.txt`

**Nota:** Requer conexão SSH ao servidor. Se não conectar automaticamente, execute manualmente:
```bash
ssh root@95.217.2.116
```

---

### 3. Verificar Servidor Remoto (NOVO - Mais Completo)
```bash
# Copiar script para servidor
scp scripts/executar-no-hetzner-verificacao.sh root@95.217.2.116:/tmp/

# Conectar ao servidor
ssh root@95.217.2.116

# Executar no servidor
bash /tmp/executar-no-hetzner-verificacao.sh

# Copiar relatório de volta
scp root@95.217.2.116:/tmp/relatorios/relatorio_completo_*.txt ./backups/relatorios/
```
**O que faz:**
- ✅ Gera relatório COMPLETO dos arquivos no servidor
- ✅ Verifica containers Docker
- ✅ Verifica configurações Nginx
- ✅ Lista Edge Functions e Migrations no servidor
- ✅ Verifica espaço em disco
- ✅ Verifica processos relacionados
- ✅ Compara com estrutura local esperada

### 3.1. Verificar Servidor Remoto (Versão Antiga)
```bash
# Copiar script para servidor
scp scripts/verificar-servidor-remoto.sh root@95.217.2.116:/tmp/

# Conectar ao servidor
ssh root@95.217.2.116

# Executar no servidor
bash /tmp/verificar-servidor-remoto.sh

# Copiar relatório de volta
scp root@95.217.2.116:/tmp/relatorios/relatorio_servidor_*.txt ./backups/relatorios/
```

---

### 4. Verificação Completa Automática
```bash
./scripts/verificar-hetzner-completo.sh
```
**O que faz:**
- ✅ Tenta conectar ao servidor via SSH
- ✅ Verifica arquivos locais
- ✅ Verifica estrutura no servidor (se conectado)
- ✅ Compara arquivos importantes
- ✅ Faz backup do servidor (se conectado)

**Resultado:** 
- Relatórios em `backups/relatorios/`
- Backup em `backups/hetzner/backup_*/`

**Nota:** Requer chave SSH configurada ou senha via `export SSH_PASSWORD='senha'`

### 5. Verificar e Fazer Backup do Servidor (Versão Antiga)
```bash
./scripts/verificar-servidor-hetzner.sh
```
**O que faz:**
- Verifica conexão SSH
- Verifica estrutura no servidor
- Compara arquivos importantes
- Faz backup do servidor

**Resultado:** Backup salvo em `backups/hetzner/backup_hetzner_*/`

---

## 📝 Passo a Passo para Verificação Completa

### Opção 1: Verificação Automática (Requer SSH configurado)

1. **Verificar arquivos locais:**
   ```bash
   cd /root/kanban-buzz-95241
   ./scripts/verificar-arquivos-locais.sh
   ```

2. **Comparar com servidor:**
   ```bash
   ./scripts/comparar-com-servidor.sh
   ```

3. **Fazer backup do servidor:**
   ```bash
   ./scripts/verificar-servidor-hetzner.sh
   ```

---

### Opção 2: Verificação Manual (Se SSH não estiver configurado)

1. **Gerar relatório local:**
   ```bash
   cd /root/kanban-buzz-95241
   ./scripts/verificar-arquivos-locais.sh
   ```

2. **Copiar script para servidor:**
   ```bash
   scp scripts/verificar-servidor-remoto.sh root@95.217.2.116:/tmp/
   ```

3. **Conectar ao servidor:**
   ```bash
   ssh root@95.217.2.116
   ```

4. **Executar verificação no servidor:**
   ```bash
   bash /tmp/verificar-servidor-remoto.sh
   ```

5. **Copiar relatório do servidor:**
   ```bash
   # No servidor, copiar o caminho do relatório
   # Depois, na sua máquina:
   scp root@95.217.2.116:/tmp/relatorios/relatorio_servidor_*.txt ./backups/relatorios/
   ```

6. **Comparar relatórios:**
   ```bash
   # Ver relatório local
   cat backups/relatorios/relatorio_arquivos_*.txt
   
   # Ver relatório do servidor
   cat backups/relatorios/relatorio_servidor_*.txt
   ```

---

## 💾 Fazer Backup do Servidor

### Backup Completo

Se quiser fazer backup completo do servidor:

```bash
# Usar script de backup existente
./scripts/hetzner/backup-app.sh
```

Ou manualmente:

```bash
# Conectar ao servidor
ssh root@95.217.2.116

# Criar backup
cd /opt/app
tar -czf /tmp/backup_app_$(date +%Y%m%d_%H%M%S).tar.gz .

# Copiar para sua máquina
# (Na sua máquina)
scp root@95.217.2.116:/tmp/backup_app_*.tar.gz ./backups/hetzner/
```

---

## 🔍 O Que Verificar

### Arquivos Críticos que DEVEM estar no servidor:

1. **Configuração:**
   - ✅ `package.json`
   - ✅ `docker-compose.yml`
   - ✅ `Dockerfile`
   - ✅ `vite.config.ts`
   - ✅ `tsconfig.json`

2. **Código Fonte:**
   - ✅ `src/` (409 arquivos, 4.7M)
   - ✅ `public/` (3 arquivos)

3. **Supabase:**
   - ✅ `supabase/config.toml`
   - ✅ `supabase/functions/` (86 funções)
   - ✅ `supabase/migrations/` (220 migrations)

4. **Scripts:**
   - ✅ `scripts/` (53 arquivos)

---

## ⚠️ Problemas Comuns

### 1. Não consegue conectar via SSH

**Solução:**
- Verificar se o IP está correto: `95.217.2.116`
- Verificar se a chave SSH está configurada
- Tentar conexão manual: `ssh root@95.217.2.116`

### 2. Diretório não encontrado no servidor

**Possíveis localizações:**
- `/opt/app`
- `/root/kanban-buzz-95241`
- `/var/www/app`
- Verificar com: `find / -name "package.json" 2>/dev/null`

### 3. Arquivos faltando no servidor

**Solução:**
- Fazer deploy: `./scripts/hetzner/deploy-app.sh`
- Ou copiar manualmente via SCP/RSYNC

---

## 📊 Próximos Passos

Após verificação:

1. ✅ **Se tudo estiver sincronizado:**
   - Fazer backup do servidor
   - Documentar status atual

2. ⚠️ **Se faltar arquivos no servidor:**
   - Fazer deploy: `./scripts/hetzner/deploy-app.sh`
   - Verificar novamente

3. ⚠️ **Se faltar arquivos localmente:**
   - Fazer backup do servidor primeiro
   - Copiar arquivos do servidor para local

---

## 📁 Estrutura de Backups

```
backups/
├── relatorios/
│   ├── relatorio_arquivos_*.txt      # Relatório local
│   └── relatorio_servidor_*.txt       # Relatório do servidor
├── comparacao/
│   └── comparacao_*.txt               # Comparação local vs servidor
└── hetzner/
    └── backup_hetzner_*/               # Backup completo do servidor
```

---

## 🔗 Scripts Relacionados

- `scripts/verificar-arquivos-locais.sh` - Relatório local
- `scripts/comparar-com-servidor.sh` - Comparação
- `scripts/verificar-servidor-remoto.sh` - Verificação no servidor
- `scripts/verificar-servidor-hetzner.sh` - Verificação completa + backup
- `scripts/hetzner/deploy-app.sh` - Deploy para servidor
- `scripts/hetzner/backup-app.sh` - Backup do servidor

---

**Última atualização**: 15/12/2025 12:07

