# 🚀 Como Fazer Deploy Corretamente - Zero-Downtime

## ⚠️ IMPORTANTE: Use SEMPRE o Script Zero-Downtime

### ❌ NÃO FAÇA ISSO (Método Antigo - Causa Downtime)

```bash
# ❌ ERRADO - Isso derruba o sistema!
docker compose down
docker compose build --no-cache
docker compose up -d
```

**Problema**: O sistema cai durante o deploy porque:
1. `docker compose down` → Para tudo
2. Build → Demora alguns minutos
3. `docker compose up` → Só depois sobe novamente
4. **Resultado**: Downtime de 3-5 minutos! 😞

---

### ✅ FAÇA ISSO (Método Zero-Downtime)

```bash
# ✅ CORRETO - Zero downtime garantido!
cd /root/kanban-buzz-95241
./scripts/deploy-zero-downtime.sh
```

**Vantagem**: Sistema continua funcionando durante todo o deploy! 😊

---

## 📋 Passo a Passo Correto

### 1. Ir para o diretório do projeto
```bash
cd /root/kanban-buzz-95241
```

### 2. Executar script zero-downtime
```bash
./scripts/deploy-zero-downtime.sh
```

### 3. Aguardar (3-6 minutos)
O script faz tudo automaticamente:
- ✅ Build da nova versão
- ✅ Sobe em paralelo (sem derrubar atual)
- ✅ Testa se está OK
- ✅ Alterna tráfego (1 segundo)
- ✅ Para versão antiga
- ✅ Limpa imagens antigas

### 4. Pronto!
Sistema atualizado sem downtime! 🎉

---

## 🔍 Como Saber Qual Método Está Sendo Usado

### Verificar Containers

```bash
# Zero-downtime (CORRETO):
docker ps | grep kanban-buzz-app-blue
# ou
docker ps | grep kanban-buzz-app-green

# Método antigo (ERRADO):
docker ps | grep kanban-buzz-app
# (sem -blue ou -green)
```

### Verificar Status

```bash
# Ver qual está rodando
docker compose -f docker-compose.blue.yml ps
# ou
docker compose -f docker-compose.green.yml ps
```

---

## 🆘 O Que Fazer Se o Sistema Cair

### Situação: Sistema caiu durante deploy

**Solução Rápida**:

```bash
cd /root/kanban-buzz-95241

# 1. Parar tudo
docker compose down

# 2. Restaurar Blue
docker compose -f docker-compose.blue.yml up -d

# 3. Verificar
./scripts/health-check.sh blue
```

**Ou use o script de migração novamente**:

```bash
./scripts/migrar-para-zero-downtime.sh
```

---

## 📝 Checklist Antes de Fazer Deploy

- [ ] Estou no diretório correto: `/root/kanban-buzz-95241`
- [ ] Vou usar o script zero-downtime: `./scripts/deploy-zero-downtime.sh`
- [ ] NÃO vou usar `docker compose down` diretamente
- [ ] Sistema está funcionando antes de começar
- [ ] Se alteraste domínio público ou URLs de auth: rever [ALINHAMENTO-SUPABASE-PRODUCAO.md](./ALINHAMENTO-SUPABASE-PRODUCAO.md) (checklist Supabase Dashboard + `VITE_SUPABASE_URL`)

---

## 🎯 Resumo Rápido

| Ação | Comando |
|------|---------|
| **Deploy (sempre use este)** | `./scripts/deploy-zero-downtime.sh` |
| **Ver status** | `docker compose -f docker-compose.blue.yml ps` |
| **Ver logs** | `docker compose -f docker-compose.blue.yml logs -f` |
| **Health check** | `./scripts/health-check.sh blue` |
| **Restaurar se cair** | `./scripts/migrar-para-zero-downtime.sh` |

---

## ⚠️ Lembrete Importante

**SEMPRE use o script zero-downtime para deploys!**

```bash
./scripts/deploy-zero-downtime.sh
```

**NUNCA use o método antigo:**
```bash
# ❌ NÃO FAÇA ISSO!
docker compose down && docker compose build --no-cache && docker compose up -d
```

---

## 🔄 Fluxo Correto de Deploy

```
1. cd /root/kanban-buzz-95241
   ↓
2. ./scripts/deploy-zero-downtime.sh
   ↓
3. Aguardar (3-6 minutos)
   ↓
4. ✅ Pronto! Sistema atualizado sem downtime
```

**Simples assim!** 🚀

---

## Ver também

- [ALINHAMENTO-SUPABASE-PRODUCAO.md](./ALINHAMENTO-SUPABASE-PRODUCAO.md) — contexto incidente/rede Supabase, alinhamento **Site URL** / redirects **sem** mudar código à toa.


