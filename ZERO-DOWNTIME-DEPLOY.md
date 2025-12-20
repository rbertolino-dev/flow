# 🚀 Deploy Zero-Downtime - Blue-Green Deployment

## 📋 Visão Geral

Este sistema implementa **Blue-Green Deployment** para atualizações Docker sem downtime. Duas versões da aplicação rodam simultaneamente (blue e green), permitindo alternar entre elas sem interrupção do serviço.

## 🏗️ Arquitetura

```
┌─────────────────┐
│   Nginx Proxy   │  Porta 80 (pública)
│  (Reverse Proxy)│
└────────┬────────┘
         │
         ├───► Blue (porta 3000) - Versão atual
         │
         └───► Green (porta 3001) - Versão nova
```

### Como Funciona

1. **Blue (atual)** roda na porta 3000
2. **Green (nova)** sobe na porta 3001 em paralelo
3. Health check verifica se Green está pronto
4. Nginx alterna tráfego: 100% Blue → 100% Green
5. Aguarda estabilidade (30s)
6. Blue é desligado
7. Green assume porta 3000 (opcional)

## 📁 Arquivos Criados

- `docker-compose.blue.yml` - Configuração para versão Blue
- `docker-compose.green.yml` - Configuração para versão Green
- `nginx-reverse-proxy.conf` - Configuração do Nginx para balanceamento
- `scripts/health-check.sh` - Script de verificação de saúde
- `scripts/deploy-zero-downtime.sh` - Script principal de deploy
- `scripts/migrar-para-zero-downtime.sh` - Script de migração do deploy antigo
- `nginx.conf` - Atualizado com endpoint `/health`
- `Dockerfile` - Atualizado com wget para health checks

## 🚀 Como Usar

### Migração do Deploy Antigo (Primeira Vez)

Se você estava usando o deploy antigo (`docker compose down → build → up`), execute o script de migração:

```bash
cd /root/kanban-buzz-95241
./scripts/migrar-para-zero-downtime.sh
```

Este script automaticamente:
1. ✅ Instala Nginx (se necessário)
2. ✅ Para containers antigos
3. ✅ Inicia versão Blue
4. ✅ Configura Nginx como reverse proxy
5. ✅ Verifica se tudo está funcionando

### Primeira Configuração Manual (Alternativa)

Se preferir configurar manualmente:

1. **Instalar Nginx no servidor** (se ainda não estiver instalado):
```bash
sudo apt update
sudo apt install -y nginx
```

2. **Configurar Nginx**:
```bash
# Copiar configuração do reverse proxy
sudo cp nginx-reverse-proxy.conf /etc/nginx/sites-available/kanban-buzz

# Criar link simbólico
sudo ln -sf /etc/nginx/sites-available/kanban-buzz /etc/nginx/sites-enabled/

# Remover site padrão (se existir)
sudo rm -f /etc/nginx/sites-enabled/default

# Testar configuração
sudo nginx -t

# Recarregar Nginx
sudo systemctl reload nginx
```

3. **Tornar scripts executáveis**:
```bash
chmod +x scripts/health-check.sh
chmod +x scripts/deploy-zero-downtime.sh
chmod +x scripts/migrar-para-zero-downtime.sh
```

### Deploy Normal (Zero-Downtime)

```bash
cd /root/kanban-buzz-95241
./scripts/deploy-zero-downtime.sh
```

O script automaticamente:
1. ✅ Verifica qual versão está rodando (blue ou green)
2. ✅ Faz build da nova versão
3. ✅ Sobe nova versão na porta alternativa
4. ✅ Aguarda health check (máx 60s)
5. ✅ Alterna tráfego do Nginx
6. ✅ Aguarda estabilidade (30s)
7. ✅ Para versão antiga
8. ✅ Limpa imagens antigas

### Rollback Automático

Se algo der errado durante o deploy, o script **automaticamente** faz rollback:
- Volta tráfego para versão anterior
- Remove versão problemática
- Sistema continua funcionando

### Rollback Manual

Se precisar voltar manualmente:

```bash
./scripts/deploy-zero-downtime.sh --rollback
```

## 🏥 Health Check

### Verificar Saúde de uma Versão

```bash
# Verificar Blue
./scripts/health-check.sh blue

# Verificar Green
./scripts/health-check.sh green
```

### Endpoint de Health Check

A aplicação expõe endpoint `/health` que retorna `200 OK`:

```bash
# Health check direto
curl http://localhost:3000/health  # Blue
curl http://localhost:3001/health  # Green

# Via Nginx
curl http://localhost/health/blue
curl http://localhost/health/green
```

## 📊 Monitoramento

### Ver Status dos Containers

```bash
# Blue
docker compose -f docker-compose.blue.yml ps

# Green
docker compose -f docker-compose.green.yml ps

# Ambos
docker ps | grep kanban-buzz-app
```

### Ver Logs

```bash
# Blue
docker compose -f docker-compose.blue.yml logs -f

# Green
docker compose -f docker-compose.green.yml logs -f
```

## 🔧 Configuração Avançada

### Ajustar Timeout de Health Check

Edite `scripts/deploy-zero-downtime.sh`:

```bash
# Linha ~30
TIMEOUT=60  # Segundos
```

### Ajustar Tempo de Estabilidade

Edite `scripts/deploy-zero-downtime.sh`:

```bash
# Linha ~31
STABILITY_WAIT=30  # Segundos
```

### Usar Portas Diferentes

Edite `docker-compose.blue.yml` e `docker-compose.green.yml`:

```yaml
ports:
  - "3000:80"  # Blue
  - "3001:80"  # Green
```

E atualize `nginx-reverse-proxy.conf`:

```nginx
upstream blue {
    server localhost:3000;
}

upstream green {
    server localhost:3001;
}
```

## ⚠️ Troubleshooting

### Nginx não está configurado

```bash
# Verificar se Nginx está instalado
which nginx || sudo apt install -y nginx

# Verificar configuração
sudo nginx -t

# Recarregar
sudo systemctl reload nginx
```

### Container não fica saudável

```bash
# Ver logs
docker compose -f docker-compose.green.yml logs

# Verificar health check manualmente
./scripts/health-check.sh green 120  # Timeout de 120s
```

### Porta já em uso

```bash
# Verificar qual processo está usando a porta
sudo lsof -i :3000
sudo lsof -i :3001

# Parar containers antigos
docker compose -f docker-compose.blue.yml down
docker compose -f docker-compose.green.yml down
```

### Rollback não funciona

```bash
# Parar ambas versões
docker compose -f docker-compose.blue.yml down
docker compose -f docker-compose.green.yml down

# Iniciar Blue manualmente
docker compose -f docker-compose.blue.yml up -d

# Verificar
./scripts/health-check.sh blue
```

## 🔄 Migração do Deploy Antigo

Se você estava usando o deploy antigo (`docker compose down → build → up`):

**Opção 1: Script Automático (Recomendado)**
```bash
./scripts/migrar-para-zero-downtime.sh
```

**Opção 2: Manual**
```bash
# Parar deploy antigo
docker compose down

# Iniciar Blue
docker compose -f docker-compose.blue.yml up -d

# Configurar Nginx (se ainda não configurou)
sudo cp nginx-reverse-proxy.conf /etc/nginx/sites-available/kanban-buzz
sudo ln -sf /etc/nginx/sites-available/kanban-buzz /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# Agora pode usar zero-downtime
./scripts/deploy-zero-downtime.sh
```

**A partir de agora**, sempre use:
```bash
./scripts/deploy-zero-downtime.sh
```

## 📝 Fluxo Completo de Deploy

```
1. Usuário executa: ./scripts/deploy-zero-downtime.sh
   ↓
2. Script verifica versão atual (ex: Blue na porta 3000)
   ↓
3. Build da nova versão (Green) em background
   ↓
4. Green sobe na porta 3001
   ↓
5. Health check aguarda Green ficar pronto (máx 60s)
   ↓
6. Nginx alterna tráfego: 100% Blue → 100% Green
   ↓
7. Aguarda estabilidade (30s)
   ↓
8. Se tudo OK:
   - Para Blue
   - Limpa imagens antigas
   - ✅ Deploy concluído sem downtime
   ↓
9. Se algo falhar:
   - Rollback automático
   - Volta tráfego para Blue
   - Remove Green
   - ❌ Sistema continua com Blue
```

## ✅ Vantagens

- ✅ **Zero Downtime**: Usuários não percebem atualização
- ✅ **Rollback Automático**: Se algo der errado, volta automaticamente
- ✅ **Teste Antes de Alternar**: Health check garante que nova versão está pronta
- ✅ **Rollback Instantâneo**: Pode voltar para versão anterior em segundos
- ✅ **Monitoramento**: Health checks contínuos

## 📚 Referências

- [Docker Health Checks](https://docs.docker.com/engine/reference/builder/#healthcheck)
- [Nginx Upstream](https://nginx.org/en/docs/http/ngx_http_upstream_module.html)
- [Blue-Green Deployment](https://martinfowler.com/bliki/BlueGreenDeployment.html)

---

**Última atualização**: Implementação completa de Blue-Green Deployment
**Status**: ✅ Pronto para uso em produção

