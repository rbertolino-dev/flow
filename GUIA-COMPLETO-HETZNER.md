# 🖥️ Guia Completo: Configurar Supabase Self-Hosted no Hetzner

**Versão**: 1.0  
**Data**: 14/12/2025  
**Status**: ✅ Guia Completo

---

## 📋 Pré-requisitos

- ✅ Conta na Hetzner Cloud
- ✅ Acesso SSH ao servidor
- ✅ Domínio (opcional mas recomendado)
- ✅ Conhecimento básico de Linux/Docker

---

## 🚀 Passo 1: Criar Servidor na Hetzner

### 1.1 Acessar Hetzner Cloud Console
1. Acesse: https://console.hetzner.cloud
2. Faça login na sua conta

### 1.2 Criar Novo Projeto
1. Clique em **"New Project"**
2. Nome: `supabase-production` (ou nome desejado)
3. Clique em **"Create Project"**

### 1.3 Criar Servidor
1. No projeto, clique em **"Add Server"**
2. Configure:
   - **Image**: Ubuntu 22.04
   - **Type**: CPX31 (4GB RAM, 2 vCPU) ou superior
     - **Mínimo recomendado**: CPX31
     - **Produção**: CPX41 (8GB RAM) ou superior
   - **Location**: Escolher mais próxima (ex: Falkenstein, Nuremberg)
   - **SSH Keys**: Adicionar sua chave SSH
   - **Networks**: Deixar padrão
   - **Firewall**: Criar novo ou usar existente
   - **Backups**: Ativar (recomendado)
   - **Volumes**: Não necessário inicialmente
3. Clique em **"Create & Buy Now"**
4. Anote o **IP Público** do servidor

---

## 🔧 Passo 2: Configurar Servidor

### 2.1 Conectar via SSH
```bash
ssh root@[IP_PUBLICO]
# OU se usar usuário:
ssh usuario@[IP_PUBLICO]
```

### 2.2 Atualizar Sistema
```bash
sudo apt update
sudo apt upgrade -y
sudo apt install -y curl wget git nano ufw
```

### 2.3 Instalar Docker
```bash
# Instalar Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Adicionar usuário ao grupo docker (se não for root)
sudo usermod -aG docker $USER

# Reiniciar sessão ou executar:
newgrp docker

# Verificar instalação
docker --version
docker-compose --version
```

### 2.4 Instalar Docker Compose (se não veio com Docker)
```bash
sudo apt install -y docker-compose-plugin
# OU
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

### 2.5 Configurar Firewall
```bash
# Permitir SSH
sudo ufw allow 22/tcp

# Permitir HTTP/HTTPS (se usar domínio)
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Permitir Supabase (portas padrão)
sudo ufw allow 8000/tcp  # API
sudo ufw allow 5432/tcp  # Postgres (apenas localhost)
sudo ufw allow 54322/tcp # Postgres (se expor externamente - NÃO RECOMENDADO)

# Ativar firewall
sudo ufw enable
sudo ufw status
```

---

## 📦 Passo 3: Instalar Supabase Self-Hosted

### 3.1 Clonar Repositório
```bash
cd /opt
sudo git clone --depth 1 https://github.com/supabase/supabase.git
cd supabase/docker
```

### 3.2 Configurar Variáveis de Ambiente
```bash
# Copiar arquivo de exemplo
sudo cp .env.example .env

# Editar arquivo
sudo nano .env
```

### 3.3 Configurações Importantes no .env

```bash
# ============================================
# POSTGRES
# ============================================
POSTGRES_PASSWORD=[GERAR_SENHA_FORTE_32_CARACTERES]
POSTGRES_HOST=db
POSTGRES_PORT=5432
POSTGRES_DB=postgres

# Gerar senha forte:
# openssl rand -base64 32

# ============================================
# API KEYS (GERAR NOVOS)
# ============================================
# Gerar Anon Key:
# openssl rand -base64 32

# Gerar Service Role Key:
# openssl rand -base64 32

ANON_KEY=[GERAR_COM_OPENSSL]
SERVICE_ROLE_KEY=[GERAR_COM_OPENSSL]

# ============================================
# JWT
# ============================================
JWT_SECRET=[GERAR_UUID_FORTE]
JWT_EXPIRY=3600

# Gerar JWT Secret:
# openssl rand -base64 32

# ============================================
# API URL
# ============================================
# Se usar IP público:
API_URL=http://[IP_PUBLICO]:8000

# Se usar domínio:
API_URL=https://supabase.seudominio.com

# ============================================
# STORAGE
# ============================================
STORAGE_BACKEND=file
STORAGE_FILE_SIZE_LIMIT=52428800  # 50MB

# ============================================
# EMAIL (Opcional)
# ============================================
# Se quiser usar SMTP customizado:
# SMTP_ADMIN_EMAIL=admin@seudominio.com
# SMTP_HOST=smtp.seudominio.com
# SMTP_PORT=587
# SMTP_USER=usuario@seudominio.com
# SMTP_PASS=senha
# SMTP_SENDER_NAME=Supabase

# ============================================
# OUTRAS CONFIGURAÇÕES
# ============================================
ENABLE_EMAIL_SIGNUP=true
ENABLE_PHONE_SIGNUP=false
```

### 3.4 Gerar Chaves Necessárias
```bash
# Gerar senha Postgres
openssl rand -base64 32

# Gerar Anon Key
openssl rand -base64 32

# Gerar Service Role Key
openssl rand -base64 32

# Gerar JWT Secret
openssl rand -base64 32
```

**⚠️ IMPORTANTE**: Salvar todas as chaves em local seguro!

---

## 🚀 Passo 4: Iniciar Supabase

### 4.1 Iniciar Containers
```bash
cd /opt/supabase/docker
sudo docker-compose up -d
```

### 4.2 Verificar Status
```bash
# Ver containers rodando
sudo docker-compose ps

# Ver logs
sudo docker-compose logs -f

# Ver logs de um serviço específico
sudo docker-compose logs -f postgres
sudo docker-compose logs -f api
```

### 4.3 Verificar Saúde
```bash
# Verificar API
curl http://localhost:8000/rest/v1/

# Verificar se está respondendo
curl http://localhost:8000/health
```

**Todos os containers devem estar "Up" e saudáveis!**

---

## 🌐 Passo 5: Configurar Domínio e SSL (Opcional mas Recomendado)

### 5.1 Configurar DNS
1. No seu provedor de DNS, adicionar registro:
   - **Tipo**: A
   - **Nome**: `supabase` (ou subdomínio desejado)
   - **Valor**: `[IP_PUBLICO_DO_SERVIDOR]`
   - **TTL**: 3600

### 5.2 Instalar Nginx
```bash
sudo apt install -y nginx certbot python3-certbot-nginx
```

### 5.3 Configurar Nginx como Reverse Proxy
```bash
sudo nano /etc/nginx/sites-available/supabase
```

**Conteúdo:**
```nginx
server {
    listen 80;
    server_name supabase.seudominio.com;

    # Redirecionar para HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name supabase.seudominio.com;

    ssl_certificate /etc/letsencrypt/live/supabase.seudominio.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/supabase.seudominio.com/privkey.pem;

    # SSL Configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Headers
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;

    # API
    location / {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    # Realtime
    location /realtime {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

### 5.4 Habilitar Site
```bash
sudo ln -s /etc/nginx/sites-available/supabase /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 5.5 Configurar SSL com Let's Encrypt
```bash
sudo certbot --nginx -d supabase.seudominio.com
```

### 5.5.1 Atualizar .env com Domínio
```bash
# Editar .env
sudo nano /opt/supabase/docker/.env

# Atualizar:
API_URL=https://supabase.seudominio.com

# Reiniciar
sudo docker-compose restart
```

---

## 🔗 Passo 6: Linkar Projeto Local ao Supabase Self-Hosted

### 6.1 Obter Credenciais
```bash
# Acessar container do Postgres
sudo docker-compose exec postgres psql -U postgres

# OU obter do .env:
cat /opt/supabase/docker/.env | grep -E "POSTGRES_PASSWORD|ANON_KEY|SERVICE_ROLE_KEY"
```

### 6.2 Configurar Supabase CLI Local
```bash
# No seu computador local (não no servidor)
cd /root/kanban-buzz-95241

# Criar arquivo .env.local com credenciais
cat > .env.local << EOF
SUPABASE_URL=https://supabase.seudominio.com
SUPABASE_ANON_KEY=[ANON_KEY_DO_ENV]
SUPABASE_SERVICE_ROLE_KEY=[SERVICE_ROLE_KEY_DO_ENV]
POSTGRES_PASSWORD=[POSTGRES_PASSWORD_DO_ENV]
EOF
```

### 6.3 Linkar Projeto
```bash
# Linkar usando URL customizada
supabase link --project-ref [NOME_PROJETO] --db-url postgresql://postgres:[PASSWORD]@[IP_PUBLICO]:5432/postgres
```

**OU** criar projeto local e aplicar migrations:
```bash
# Aplicar migrations diretamente
supabase db push
```

---

## 📊 Passo 7: Aplicar Migrations e Deploy

### 7.1 Aplicar Migrations
```bash
cd /root/kanban-buzz-95241

# Se linkado:
supabase db push

# OU aplicar manualmente via psql:
# psql -h [IP_PUBLICO] -U postgres -d postgres -f migrations/[arquivo].sql
```

### 7.2 Deploy Edge Functions
```bash
# Deploy de todas as funções
./scripts/deploy-todas-funcoes.sh

# OU deploy manual:
for func in supabase/functions/*/; do
    func_name=$(basename "$func")
    supabase functions deploy "$func_name"
done
```

### 7.3 Configurar Secrets
```bash
# Via CLI
supabase secrets set FACEBOOK_APP_ID=1616642309241531

# OU via Dashboard (se tiver)
# Acessar: https://supabase.seudominio.com
```

---

## 🔄 Passo 8: Configurar Cron Jobs (pg_cron)

### 8.1 Habilitar Extensão pg_cron
```bash
# Acessar Postgres
sudo docker-compose exec postgres psql -U postgres

# No psql:
CREATE EXTENSION IF NOT EXISTS pg_cron;
```

### 8.2 Configurar Cron Jobs
Ver arquivo: `scripts/configurar-cron-jobs.sql`

```bash
# Aplicar script
sudo docker-compose exec postgres psql -U postgres -f /path/to/configurar-cron-jobs.sql
```

---

## 📈 Passo 9: Monitoramento e Manutenção

### 9.1 Verificar Logs
```bash
# Logs gerais
sudo docker-compose logs -f

# Logs de um serviço
sudo docker-compose logs -f api
sudo docker-compose logs -f postgres
```

### 9.2 Backup do Banco
```bash
# Criar script de backup
sudo nano /opt/backup-supabase.sh
```

**Conteúdo:**
```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/opt/backups"
mkdir -p $BACKUP_DIR

docker-compose exec -T postgres pg_dump -U postgres postgres | gzip > $BACKUP_DIR/backup_$DATE.sql.gz

# Manter apenas últimos 7 dias
find $BACKUP_DIR -name "backup_*.sql.gz" -mtime +7 -delete
```

```bash
# Tornar executável
sudo chmod +x /opt/backup-supabase.sh

# Adicionar ao crontab
sudo crontab -e
# Adicionar:
0 2 * * * /opt/backup-supabase.sh
```

### 9.3 Monitorar Recursos
```bash
# CPU e RAM
htop

# Disco
df -h

# Containers
docker stats
```

---

## 🔒 Passo 10: Segurança

### 10.1 Atualizar Sistema Regularmente
```bash
sudo apt update && sudo apt upgrade -y
```

### 10.2 Configurar Fail2Ban
```bash
sudo apt install -y fail2ban
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

### 10.3 Desabilitar Login Root (Opcional)
```bash
# Criar usuário não-root
sudo adduser supabase
sudo usermod -aG sudo supabase
sudo usermod -aG docker supabase

# Desabilitar login root
sudo passwd -l root
```

---

## ✅ Checklist Final

- [ ] Servidor criado na Hetzner
- [ ] Docker instalado
- [ ] Supabase self-hosted instalado
- [ ] .env configurado com todas as chaves
- [ ] Containers rodando (docker-compose ps)
- [ ] Domínio configurado (opcional)
- [ ] SSL configurado (Let's Encrypt)
- [ ] Migrations aplicadas
- [ ] Edge Functions deployadas
- [ ] Secrets configurados
- [ ] Cron jobs configurados
- [ ] Backup automático configurado
- [ ] Monitoramento configurado
- [ ] Firewall configurado
- [ ] Testes realizados

---

## 🆘 Troubleshooting

### Containers não iniciam
```bash
# Ver logs
sudo docker-compose logs

# Verificar .env
cat .env | grep -v "^#"

# Reiniciar
sudo docker-compose down
sudo docker-compose up -d
```

### Erro de conexão
```bash
# Verificar firewall
sudo ufw status

# Verificar portas
sudo netstat -tulpn | grep -E "8000|5432"
```

### Problemas com SSL
```bash
# Renovar certificado
sudo certbot renew

# Verificar certificado
sudo certbot certificates
```

---

**Última atualização**: 14/12/2025  
**Status**: ✅ Guia Completo para Hetzner
