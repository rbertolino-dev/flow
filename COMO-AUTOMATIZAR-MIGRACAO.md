# 🤖 Como Automatizar a Migração Completa

**Versão**: 1.0  
**Data**: 14/12/2025

---

## 🎯 Objetivo

Automatizar completamente a migração usando o token de acesso do Supabase CLI.

---

## 🔐 Passo 1: Obter Token de Acesso

### Opção A: Via Dashboard (Recomendado)

1. Acesse: **https://supabase.com/dashboard/account/tokens**
2. Clique em **"Generate new token"**
3. Dê um nome (ex: "Migração Automática")
4. Clique em **"Generate token"**
5. **⚠️ COPIE O TOKEN AGORA** (você só verá uma vez!)

### Opção B: Via CLI (Se já estiver autenticado)

```bash
# Se já fez login antes, o token está em:
cat ~/.supabase/access-token
```

---

## 🚀 Passo 2: Executar Migração Automática

### Opção A: Via Variável de Ambiente

```bash
# Configurar token
export SUPABASE_ACCESS_TOKEN=[SEU_TOKEN_AQUI]

# Executar migração automática
cd /root/kanban-buzz-95241
./scripts/migracao-automatica.sh
```

### Opção B: Via Linha de Comando

```bash
cd /root/kanban-buzz-95241
SUPABASE_ACCESS_TOKEN=[SEU_TOKEN] ./scripts/migracao-automatica.sh
```

### Opção C: Criar Arquivo .env.local

```bash
# Criar arquivo
cat > .env.local << EOF
SUPABASE_ACCESS_TOKEN=[SEU_TOKEN_AQUI]
EOF

# Executar
source .env.local
./scripts/migracao-automatica.sh
```

---

## 📋 O Que o Script Faz Automaticamente

### ✅ Fase 1: Migrations
1. Verifica autenticação
2. Linka projeto (se necessário)
3. Aplica todas as 215 migrations
4. Verifica se todas foram aplicadas

### ✅ Fase 2: Edge Functions
1. Conta todas as funções (86)
2. Faz deploy de cada função
3. Mostra progresso e estatísticas
4. Lista funções que falharam (se houver)

---

## ⏱️ Tempo Estimado

- **Migrations**: 5-10 minutos
- **Edge Functions**: 10-15 minutos
- **Total**: 15-25 minutos

---

## 📊 Exemplo de Saída

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚀 MIGRAÇÃO AUTOMÁTICA DO SUPABASE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Token de acesso configurado
🔐 Verificando autenticação...
✅ Autenticação OK

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 FASE 1: APLICAR MIGRATIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📦 Aplicando migrations (215 arquivos)...
✅ Migrations aplicadas com sucesso!
✅ Todas as migrations foram aplicadas!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📦 FASE 2: DEPLOY DAS EDGE FUNCTIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 Total de funções: 86
📦 Deploying evolution-webhook...
✅ evolution-webhook deployado
...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 RESUMO DO DEPLOY:
   ✅ Sucesso: 86
   ❌ Falhas: 0
   📦 Total: 86

✅ MIGRAÇÃO AUTOMÁTICA CONCLUÍDA!
```

---

## ⚠️ O Que Ainda Precisa Ser Feito Manualmente

Após a migração automática, você ainda precisa:

### 1. Configurar Secrets
- Dashboard → Settings → Edge Functions → Secrets
- Adicionar variáveis de `VARIAVEIS-AMBIENTE-COMPLETAS.md`

### 2. Configurar Cron Jobs
- Dashboard → SQL Editor
- Executar `scripts/configurar-cron-jobs.sql`

### 3. Atualizar Frontend
- Atualizar `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`

### 4. Atualizar Webhooks Externos
- Facebook, Evolution, Chatwoot, etc.

---

## 🆘 Troubleshooting

### Erro: "Access token not provided"
```bash
# Verificar se token está configurado
echo $SUPABASE_ACCESS_TOKEN

# Se vazio, configurar:
export SUPABASE_ACCESS_TOKEN=[SEU_TOKEN]
```

### Erro: "Invalid token"
- Verificar se o token está correto
- Gerar novo token no Dashboard
- Verificar se token não expirou

### Erro ao aplicar migrations
```bash
# Ver logs detalhados
supabase db push --debug

# Verificar migrations pendentes
supabase migration list
```

### Erro ao fazer deploy de função
```bash
# Deploy manual da função específica
supabase functions deploy [nome-funcao] --debug
```

---

## 🔒 Segurança

- ✅ **NUNCA** commitar o token no código
- ✅ **NUNCA** compartilhar o token publicamente
- ✅ Usar variáveis de ambiente
- ✅ Rotacionar token após migração
- ✅ Remover token do histórico do shell

---

## 📚 Documentação Relacionada

- `scripts/migracao-automatica.sh` - Script de migração
- `COMANDOS-MIGRACAO.md` - Comandos manuais
- `STATUS-MIGRACAO.md` - Status atual
- `ANALISE-COMPLETA-MIGRACAO.md` - O que está faltando

---

**Pronto para automatizar! Configure o token e execute o script.** 🚀
