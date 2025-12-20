#!/bin/bash

# Script de Instalação do PostgreSQL no Servidor Hetzner
# Para gerenciamento de serviços do gerador de orçamento
# Data: $(date +%Y-%m-%d)

set -e

echo "🚀 Iniciando instalação do PostgreSQL..."

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Verificar se está rodando como root
if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}❌ Por favor, execute como root (sudo)${NC}"
    exit 1
fi

# Atualizar sistema
echo -e "${YELLOW}📦 Atualizando sistema...${NC}"
apt update && apt upgrade -y

# Instalar PostgreSQL 15+
echo -e "${YELLOW}📦 Instalando PostgreSQL...${NC}"
apt install -y postgresql postgresql-contrib

# Verificar versão instalada
PG_VERSION=$(psql --version | awk '{print $3}' | cut -d. -f1)
echo -e "${GREEN}✅ PostgreSQL versão $PG_VERSION instalado${NC}"

# Criar banco de dados e usuário
echo -e "${YELLOW}🔧 Configurando banco de dados...${NC}"

# Gerar senha aleatória para o usuário
DB_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)
DB_NAME="budget_services"
DB_USER="budget_user"

# Criar usuário e banco
sudo -u postgres psql <<EOF
-- Criar usuário
CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';

-- Criar banco de dados
CREATE DATABASE $DB_NAME OWNER $DB_USER;

-- Dar permissões
GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;

-- Conectar ao banco e dar permissões no schema public
\c $DB_NAME
GRANT ALL ON SCHEMA public TO $DB_USER;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO $DB_USER;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO $DB_USER;
EOF

echo -e "${GREEN}✅ Banco de dados '$DB_NAME' criado${NC}"
echo -e "${GREEN}✅ Usuário '$DB_USER' criado${NC}"

# Configurar PostgreSQL para aceitar apenas conexões locais
echo -e "${YELLOW}🔒 Configurando segurança...${NC}"

PG_CONF="/etc/postgresql/$PG_VERSION/main/postgresql.conf"
PG_HBA="/etc/postgresql/$PG_VERSION/main/pg_hba.conf"

# Configurar para escutar apenas localhost
sed -i "s/#listen_addresses = 'localhost'/listen_addresses = 'localhost'/" $PG_CONF

# Configurar pg_hba.conf para permitir apenas conexões locais
cat >> $PG_HBA <<EOF

# Conexões locais para budget_services
# TYPE  DATABASE        USER            ADDRESS                 METHOD
local   $DB_NAME        $DB_USER                                md5
host    $DB_NAME        $DB_USER        127.0.0.1/32            md5
host    $DB_NAME        $DB_USER        ::1/128                 md5
EOF

# Reiniciar PostgreSQL
echo -e "${YELLOW}🔄 Reiniciando PostgreSQL...${NC}"
systemctl restart postgresql
systemctl enable postgresql

# Verificar status
if systemctl is-active --quiet postgresql; then
    echo -e "${GREEN}✅ PostgreSQL está rodando${NC}"
else
    echo -e "${RED}❌ Erro ao iniciar PostgreSQL${NC}"
    exit 1
fi

# Configurar firewall (porta 5432 apenas localhost)
echo -e "${YELLOW}🔥 Configurando firewall...${NC}"
if command -v ufw &> /dev/null; then
    # Permitir apenas localhost (já está por padrão, mas garantir)
    ufw allow from 127.0.0.1 to any port 5432
    echo -e "${GREEN}✅ Firewall configurado${NC}"
else
    echo -e "${YELLOW}⚠️  UFW não encontrado, configure o firewall manualmente${NC}"
fi

# Criar script de backup automático
echo -e "${YELLOW}💾 Configurando backup automático...${NC}"

BACKUP_DIR="/var/backups/postgresql"
mkdir -p $BACKUP_DIR

cat > /usr/local/bin/backup-budget-services.sh <<'BACKUP_SCRIPT'
#!/bin/bash
# Script de backup do banco budget_services
BACKUP_DIR="/var/backups/postgresql"
DB_NAME="budget_services"
DB_USER="budget_user"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/budget_services_$DATE.sql.gz"

# Fazer backup
PGPASSWORD='DB_PASSWORD_PLACEHOLDER' pg_dump -U $DB_USER -h localhost $DB_NAME | gzip > $BACKUP_FILE

# Manter apenas últimos 7 dias de backup
find $BACKUP_DIR -name "budget_services_*.sql.gz" -mtime +7 -delete

echo "Backup criado: $BACKUP_FILE"
BACKUP_SCRIPT

# Substituir placeholder pela senha real
sed -i "s/DB_PASSWORD_PLACEHOLDER/$DB_PASSWORD/g" /usr/local/bin/backup-budget-services.sh
chmod +x /usr/local/bin/backup-budget-services.sh

# Configurar cron para backup diário às 2h da manhã
(crontab -l 2>/dev/null; echo "0 2 * * * /usr/local/bin/backup-budget-services.sh >> /var/log/postgresql-backup.log 2>&1") | crontab -

echo -e "${GREEN}✅ Backup automático configurado (diário às 2h)${NC}"

# Criar arquivo com credenciais
CREDENTIALS_FILE="/root/postgresql-budget-credentials.txt"
cat > $CREDENTIALS_FILE <<EOF
===========================================
CREDENCIAIS POSTGRESQL - BUDGET SERVICES
===========================================
Data de criação: $(date)
Servidor: $(hostname)
IP: $(hostname -I | awk '{print $1}')

BANCO DE DADOS:
Nome: $DB_NAME
Usuário: $DB_USER
Senha: $DB_PASSWORD

STRING DE CONEXÃO:
postgresql://$DB_USER:$DB_PASSWORD@localhost:5432/$DB_NAME

CONEXÃO VIA PSQL:
psql -h localhost -U $DB_USER -d $DB_NAME

VARIÁVEIS DE AMBIENTE:
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=$DB_NAME
POSTGRES_USER=$DB_USER
POSTGRES_PASSWORD=$DB_PASSWORD

BACKUP:
Script: /usr/local/bin/backup-budget-services.sh
Diretório: $BACKUP_DIR
Cron: Diário às 2h

===========================================
⚠️  MANTENHA ESTE ARQUIVO SEGURO!
===========================================
EOF

chmod 600 $CREDENTIALS_FILE

echo -e "${GREEN}✅ Credenciais salvas em: $CREDENTIALS_FILE${NC}"
echo -e "${YELLOW}⚠️  IMPORTANTE: Guarde as credenciais em local seguro!${NC}"

# Testar conexão
echo -e "${YELLOW}🧪 Testando conexão...${NC}"
PGPASSWORD=$DB_PASSWORD psql -h localhost -U $DB_USER -d $DB_NAME -c "SELECT version();" > /dev/null 2>&1

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Conexão testada com sucesso!${NC}"
else
    echo -e "${RED}❌ Erro ao testar conexão${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}===========================================${NC}"
echo -e "${GREEN}✅ INSTALAÇÃO CONCLUÍDA COM SUCESSO!${NC}"
echo -e "${GREEN}===========================================${NC}"
echo ""
echo -e "${YELLOW}📋 Próximos passos:${NC}"
echo "1. Copie as credenciais de: $CREDENTIALS_FILE"
echo "2. Configure as variáveis de ambiente na aplicação"
echo "3. Execute a migration SQL para criar a tabela de serviços"
echo ""
echo -e "${GREEN}📄 Credenciais salvas em: $CREDENTIALS_FILE${NC}"


