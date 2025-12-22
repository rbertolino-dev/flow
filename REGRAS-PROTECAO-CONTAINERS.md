# 🛡️ Regras de Proteção de Containers Blue-Green

## 📋 Problema Identificado

**Erro recorrente:** Containers Green sendo removidos após deploy bem-sucedido, causando erro 502.

**Causa raiz:** 
- Script de deploy remove container antigo após alternar tráfego
- Nginx continua apontando para versão removida
- Não há verificação automática para garantir que sempre há um container rodando

## 🛡️ Regras de Proteção Implementadas

### REGRA 1: Sempre Deve Haver Um Container Rodando

**O QUE FAZ:**
- Verifica se Blue OU Green está rodando
- Se nenhum estiver rodando, restaura Blue automaticamente
- Garante que aplicação nunca fica sem container respondendo

**QUANDO EXECUTAR:**
- Após qualquer operação Docker (`docker compose down`, `docker rm`, etc.)
- Periodicamente via cron (a cada 5 minutos)
- Antes de fazer deploy
- Após fazer deploy

### REGRA 2: Nginx Deve Sempre Apontar para Container que Está Rodando

**O QUE FAZ:**
- Verifica configuração do Nginx (`kanban-buzz`)
- Se Nginx aponta para versão que não está rodando, corrige automaticamente
- Atualiza configuração e recarrega Nginx

**QUANDO EXECUTAR:**
- Após detectar que container foi removido
- Após fazer deploy
- Periodicamente para garantir consistência

### REGRA 3: agilizeflow.com.br Deve Apontar para Container Correto

**O QUE FAZ:**
- Verifica configuração do `agilizeflow.com.br`
- Se aponta para porta de container que não está rodando, corrige
- Atualiza `proxy_pass` para porta correta

**QUANDO EXECUTAR:**
- Após detectar inconsistência entre Nginx e containers
- Após fazer deploy
- Periodicamente

### REGRA 4: Não Interferir em Deploys em Andamento

**O QUE FAZ:**
- Se ambas versões estão rodando, não corrige Nginx automaticamente
- Permite que script de deploy gerencie alternância
- Só corrige se uma versão não está rodando

### REGRA 5: Reiniciar Containers Não Saudáveis

**O QUE FAZ:**
- Detecta containers rodando mas não saudáveis
- Reinicia container automaticamente
- Verifica se ficou saudável após reinício

**QUANDO EXECUTAR:**
- Periodicamente (a cada 5 minutos)
- Após detectar problema de saúde

## 🔧 Script de Proteção

**Arquivo:** `scripts/proteger-containers-blue-green.sh`

**Uso:**
```bash
# Executar manualmente
./scripts/proteger-containers-blue-green.sh

# Adicionar ao cron (executar a cada 5 minutos)
*/5 * * * * /root/kanban-buzz-95241/scripts/proteger-containers-blue-green.sh >> /var/log/kanban-buzz-protecao.log 2>&1
```

## 📋 Checklist de Verificação

Antes de fazer deploy, sempre verificar:

- [ ] Script de proteção está no cron (executando a cada 5 minutos)
- [ ] Pelo menos um container (Blue ou Green) está rodando
- [ ] Nginx está apontando para container que está rodando
- [ ] Health check está funcionando

Após fazer deploy, sempre verificar:

- [ ] Nova versão está rodando e saudável
- [ ] Nginx foi atualizado corretamente
- [ ] Versão antiga foi parada (mas não removida imediatamente)
- [ ] Script de proteção detecta estado correto

## 🚨 O Que NUNCA Fazer

1. ❌ **NUNCA** remover container sem verificar se outro está rodando
2. ❌ **NUNCA** atualizar Nginx sem verificar se container está rodando
3. ❌ **NUNCA** fazer `docker compose down` sem garantir que outra versão está pronta
4. ❌ **NUNCA** ignorar erros de health check
5. ❌ **NUNCA** fazer deploy sem executar script de proteção após

## ✅ O Que SEMPRE Fazer

1. ✅ **SEMPRE** executar script de proteção após deploy
2. ✅ **SEMPRE** verificar que pelo menos um container está rodando antes de parar outro
3. ✅ **SEMPRE** verificar health check antes de alternar tráfego
4. ✅ **SEMPRE** atualizar Nginx apenas após confirmar que container está saudável
5. ✅ **SEMPRE** manter script de proteção no cron

## 🔄 Integração com Script de Deploy

O script `deploy-zero-downtime.sh` deve:

1. Executar script de proteção ANTES de começar deploy
2. Executar script de proteção APÓS concluir deploy
3. Não remover container antigo imediatamente - aguardar alguns minutos
4. Verificar que nova versão está estável antes de remover antiga

## 📊 Monitoramento

**Logs do script de proteção:**
```bash
tail -f /var/log/kanban-buzz-protecao.log
```

**Verificar estado atual:**
```bash
./scripts/proteger-containers-blue-green.sh
```

**Verificar containers:**
```bash
docker ps | grep kanban-buzz-app
```

**Verificar Nginx:**
```bash
grep "default\|proxy_pass" /etc/nginx/sites-enabled/kanban-buzz
grep "proxy_pass" /etc/nginx/sites-enabled/agilizeflow.com.br
```

---

**Última atualização:** 20/12/2025  
**Status:** ✅ Implementado e ativo







