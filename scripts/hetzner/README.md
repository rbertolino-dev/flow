# 🖥️ Scripts para Preparação do Ambiente Hetzner

Este diretório contém scripts automatizados para preparar o servidor Hetzner para hospedar a aplicação.

**⚠️ IMPORTANTE**: O Supabase será usado via **Cloud (site oficial)**, não self-hosted. Estes scripts preparam apenas o servidor para a aplicação frontend/backend.

---

## 📋 Scripts Disponíveis

### 1. `preparar-hetzner-completo.sh` ⭐ **RECOMENDADO**

Script master que executa toda a preparação automaticamente.

**Uso:**
```bash
./scripts/hetzner/preparar-hetzner-completo.sh [DOMINIO] [EMAIL] [PORTA_APP]
```

**Exemplo:**
```bash
./scripts/hetzner/preparar-hetzner-completo.sh app.seudominio.com admin@seudominio.com 3000
```

**O que faz:**
- ✅ Prepara servidor (Docker, firewall, dependências)
- ✅ Configura Nginx como reverse proxy
- ✅ Configura SSL com Let's Encrypt
- ✅ Orquestra todo o processo

---

### 2. `preparar-servidor.sh`

Prepara o servidor básico: instala Docker, configura firewall e dependências.

**Uso:**
```bash
./scripts/hetzner/preparar-servidor.sh
```

**O que faz:**
- ✅ Atualiza sistema
- ✅ Instala Docker e Docker Compose
- ✅ Configura firewall (UFW)
- ✅ Instala Fail2Ban
- ✅ Cria diretórios necessários
- ✅ Verifica recursos do sistema

**Requisitos:**
- Acesso root ou sudo
- Ubuntu 22.04 ou Debian 11+

---

### 3. `configurar-nginx.sh`

Configura Nginx como reverse proxy para a aplicação.

**Uso:**
```bash
./scripts/hetzner/configurar-nginx.sh <DOMINIO> [PORTA_APP]
```

**Exemplo:**
```bash
./scripts/hetzner/configurar-nginx.sh app.seudominio.com 3000
```

**O que faz:**
- ✅ Instala Nginx
- ✅ Cria configuração do site
- ✅ Configura reverse proxy
- ✅ Habilita site
- ✅ Testa configuração

**⚠️ IMPORTANTE:**
- Configure o DNS do domínio antes de executar
- O DNS deve apontar para o IP do servidor

---

### 4. `configurar-ssl.sh`

Configura certificado SSL gratuito via Let's Encrypt.

**Uso:**
```bash
./scripts/hetzner/configurar-ssl.sh <DOMINIO> [EMAIL]
```

**Exemplo:**
```bash
./scripts/hetzner/configurar-ssl.sh app.seudominio.com admin@seudominio.com
```

**O que faz:**
- ✅ Verifica configuração DNS
- ✅ Instala Certbot
- ✅ Obtém certificado SSL
- ✅ Configura renovação automática
- ✅ Atualiza configuração Nginx

**Requisitos:**
- DNS já configurado e propagado
- Nginx já configurado
- Porta 80 acessível externamente

---

### 5. `deploy-app.sh`

Faz deploy da aplicação no servidor.

**Uso:**
```bash
./scripts/hetzner/deploy-app.sh
```

**O que faz:**
- ✅ Faz backup da aplicação atual (se houver)
- ✅ Para aplicação atual
- ✅ Copia arquivos do projeto
- ✅ Configura variáveis de ambiente
- ✅ Faz build e inicia aplicação
- ✅ Verifica saúde da aplicação

**Suporta:**
- Docker Compose (`docker-compose.yml`)
- Dockerfile
- Aplicações Node.js (com PM2)

**⚠️ IMPORTANTE:**
- Execute no diretório do projeto ou copie arquivos para `/opt/app`
- Configure o arquivo `.env` antes do deploy

---

### 6. `backup-app.sh`

Faz backup completo da aplicação e dados.

**Uso:**
```bash
./scripts/hetzner/backup-app.sh
```

**O que faz:**
- ✅ Backup de arquivos da aplicação
- ✅ Backup de volumes Docker
- ✅ Backup de banco de dados (PostgreSQL)
- ✅ Backup de configurações (Nginx, SSL)
- ✅ Comprime tudo em arquivo único
- ✅ Remove backups antigos (mantém últimos 7 dias)

**Localização dos backups:**
- `/opt/backups/backup_YYYYMMDD_HHMMSS.tar.gz`

**Para backup automático:**
```bash
# Adicionar ao crontab
0 2 * * * /root/kanban-buzz-95241/scripts/hetzner/backup-app.sh
```

---

## 🚀 Ordem Recomendada de Execução

### Opção 1: Script Completo (Recomendado)

```bash
# 1. Executar script master (faz tudo automaticamente)
./scripts/hetzner/preparar-hetzner-completo.sh app.seudominio.com admin@seudominio.com 3000

# 2. Fazer deploy da aplicação
./scripts/hetzner/deploy-app.sh
```

### Opção 2: Passo a Passo Manual

```bash
# 1. Preparar servidor
./scripts/hetzner/preparar-servidor.sh

# 2. Configurar DNS no seu provedor
#    Tipo: A
#    Nome: app.seudominio.com
#    Valor: [IP_DO_SERVIDOR]

# 3. Aguardar propagação DNS (alguns minutos)

# 4. Configurar Nginx
./scripts/hetzner/configurar-nginx.sh app.seudominio.com 3000

# 5. Configurar SSL
./scripts/hetzner/configurar-ssl.sh app.seudominio.com admin@seudominio.com

# 6. Fazer deploy da aplicação
./scripts/hetzner/deploy-app.sh
```

---

## 📋 Pré-requisitos

### No Servidor Hetzner:
- ✅ Ubuntu 22.04 LTS ou Debian 11+
- ✅ Acesso root ou sudo
- ✅ IP público configurado
- ✅ Porta 22 (SSH) acessível

### Para SSL:
- ✅ Domínio configurado
- ✅ DNS apontando para o servidor
- ✅ Porta 80 acessível externamente

### Para Deploy:
- ✅ Aplicação pronta para deploy
- ✅ Arquivo `.env` configurado
- ✅ Docker/Docker Compose ou PM2 instalado

---

## 🔧 Configuração de Variáveis de Ambiente

Antes do deploy, configure o arquivo `.env` em `/opt/app/.env`:

```bash
# Exemplo .env
NODE_ENV=production
PORT=3000

# Supabase (Cloud)
VITE_SUPABASE_URL=https://[PROJECT_ID].supabase.co
VITE_SUPABASE_ANON_KEY=[ANON_KEY]

# Outras variáveis necessárias
# ...
```

---

## 📊 Estrutura de Diretórios

Após a preparação, a estrutura será:

```
/opt/
├── app/              # Aplicação
│   ├── .env         # Variáveis de ambiente
│   └── ...
├── backups/          # Backups automáticos
│   └── backup_*.tar.gz
└── logs/             # Logs da aplicação
```

---

## 🛠️ Comandos Úteis

### Verificar Status
```bash
# Status dos containers
docker ps
docker-compose ps

# Status do Nginx
sudo systemctl status nginx

# Status do SSL
sudo certbot certificates
```

### Logs
```bash
# Logs da aplicação
docker-compose logs -f
# ou
docker logs app -f

# Logs do Nginx
sudo tail -f /var/log/nginx/app.seudominio.com-access.log
sudo tail -f /var/log/nginx/app.seudominio.com-error.log
```

### Gerenciar Aplicação
```bash
# Parar
docker-compose down
# ou
docker stop app

# Iniciar
docker-compose up -d
# ou
docker start app

# Reiniciar
docker-compose restart
# ou
docker restart app
```

### Backup e Restore
```bash
# Fazer backup
./scripts/hetzner/backup-app.sh

# Listar backups
ls -lh /opt/backups/

# Restaurar (manual)
cd /opt/backups
tar -xzf backup_YYYYMMDD_HHMMSS.tar.gz
# Seguir instruções no backup_info.txt
```

---

## 🔒 Segurança

### Firewall (UFW)
- ✅ SSH (22) - permitido
- ✅ HTTP (80) - permitido
- ✅ HTTPS (443) - permitido
- ✅ Outras portas - bloqueadas

### Fail2Ban
- ✅ Proteção contra brute force
- ✅ Bloqueio automático de IPs suspeitos

### SSL
- ✅ Certificado Let's Encrypt
- ✅ Renovação automática
- ✅ Redirecionamento HTTP → HTTPS

---

## 🆘 Troubleshooting

### Nginx não inicia
```bash
# Verificar configuração
sudo nginx -t

# Ver logs
sudo tail -f /var/log/nginx/error.log
```

### SSL não funciona
```bash
# Verificar DNS
dig app.seudominio.com

# Verificar certificado
sudo certbot certificates

# Renovar manualmente
sudo certbot renew
```

### Aplicação não responde
```bash
# Verificar logs
docker-compose logs
docker logs app

# Verificar se está rodando
docker ps

# Verificar porta
sudo netstat -tulpn | grep 3000
```

### Backup falha
```bash
# Verificar espaço em disco
df -h

# Verificar permissões
ls -la /opt/backups/
```

---

## 📚 Documentação Relacionada

- `GUIA-COMPLETO-HETZNER.md` - Guia completo (inclui Supabase self-hosted)
- `PLANO-MIGRACAO-SUPABASE-COMPLETO.md` - Plano de migração
- `scripts/README.md` - Outros scripts do projeto

---

## ✅ Checklist Final

Após executar os scripts, verifique:

- [ ] Servidor preparado (Docker instalado)
- [ ] Firewall configurado
- [ ] Nginx configurado e rodando
- [ ] SSL configurado e funcionando
- [ ] Aplicação deployada e respondendo
- [ ] Backup automático configurado
- [ ] DNS propagado corretamente
- [ ] HTTPS funcionando
- [ ] Logs sendo gerados

---

**Última atualização**: 2025-01-30  
**Status**: ✅ Scripts prontos para uso



