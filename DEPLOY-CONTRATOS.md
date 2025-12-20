# 🚀 Deploy do Sistema de Contratos no Hetzner

## Passos para Fazer Deploy

### 1. No seu computador local (Cursor)

```bash
# Fazer commit das mudanças
git add .
git commit -m "feat: adiciona sistema de contratos completo"
git push
```

### 2. No servidor Hetzner (via SSH)

```bash
# Conectar ao servidor
ssh usuario@seu-ip-hetzner

# Ir para o diretório do projeto
cd /opt/app  # ou onde está seu projeto

# Atualizar código
git pull

# Executar rebuild
./rebuild-docker.sh
```

### 3. Se o script não estiver no servidor

Copie o script `rebuild-docker.sh` para o servidor:

```bash
# Do seu computador local
scp rebuild-docker.sh usuario@seu-ip-hetzner:/opt/app/
ssh usuario@seu-ip-hetzner
cd /opt/app
chmod +x rebuild-docker.sh
./rebuild-docker.sh
```

### 4. Verificar se funcionou

```bash
# Ver logs
docker-compose logs -f

# Verificar se container está rodando
docker ps | grep kanban-buzz-app

# Testar aplicação
curl http://localhost:3000
```

### 5. Limpar cache do navegador

- Pressione **Ctrl+Shift+Delete** (Windows/Linux) ou **Cmd+Shift+Delete** (Mac)
- Ou use **modo anônimo/privado**
- Ou force reload: **Ctrl+F5** (Windows/Linux) ou **Cmd+Shift+R** (Mac)

## ⚠️ Importante

- O rebuild pode levar alguns minutos
- Use `--no-cache` para garantir que tudo seja reconstruído
- Após o rebuild, aguarde alguns segundos antes de testar
- Verifique os logs se algo não funcionar

## ✅ Após o Deploy

O item **"Contratos"** deve aparecer no menu lateral entre "Criador de Formulários" e "Configurações".

Acesse: `https://seu-dominio.com/contracts`


