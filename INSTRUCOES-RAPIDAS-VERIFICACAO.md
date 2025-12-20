# 🚀 Instruções Rápidas: Verificação do Servidor Hetzner

## ⚡ Método Mais Rápido (Recomendado)

### 1. Copiar script para o servidor:
```bash
cd /root/kanban-buzz-95241
scp scripts/executar-no-hetzner-verificacao.sh root@95.217.2.116:/tmp/
```

### 2. Conectar e executar:
```bash
ssh root@95.217.2.116
bash /tmp/executar-no-hetzner-verificacao.sh
```

### 3. Copiar relatório de volta:
```bash
# Ainda no servidor, anote o caminho do relatório que aparece no final
# Depois, na sua máquina local:
scp root@95.217.2.116:/tmp/relatorios/relatorio_completo_*.txt ./backups/relatorios/
```

---

## 📋 O Que o Script Verifica

✅ **Estrutura de diretórios** (`/opt/app`)  
✅ **Arquivos de configuração** (package.json, docker-compose.yml, etc.)  
✅ **Diretórios principais** (src/, supabase/, public/, scripts/)  
✅ **Edge Functions** (quantidade e lista)  
✅ **Migrations** (quantidade e lista)  
✅ **Containers Docker** (status e volumes)  
✅ **Configuração Nginx**  
✅ **Espaço em disco**  
✅ **Processos relacionados**  

---

## 🔍 Comparar com Arquivos Locais

Após obter o relatório do servidor, compare com o relatório local:

```bash
# Ver relatório local
cat backups/relatorios/relatorio_arquivos_*.txt | less

# Ver relatório do servidor
cat backups/relatorios/relatorio_completo_*.txt | less
```

**O que verificar:**
- ✅ Mesma quantidade de Edge Functions? (Local: 86)
- ✅ Mesma quantidade de Migrations? (Local: 220)
- ✅ Todos os arquivos de configuração presentes?
- ✅ Diretórios src/, supabase/, public/, scripts/ existem?

---

## ⚠️ Se Faltar Arquivos no Servidor

Fazer deploy:
```bash
./scripts/hetzner/deploy-app.sh
```

Ou copiar manualmente:
```bash
rsync -avz --exclude 'node_modules' --exclude '.git' \
  /root/kanban-buzz-95241/ root@95.217.2.116:/opt/app/
```

---

## 💾 Fazer Backup do Servidor

Se quiser fazer backup completo:
```bash
# No servidor
cd /opt/app
tar -czf /tmp/backup_app_$(date +%Y%m%d_%H%M%S).tar.gz .

# Na sua máquina
scp root@95.217.2.116:/tmp/backup_app_*.tar.gz ./backups/hetzner/
```

---

**Última atualização**: 15/12/2025



