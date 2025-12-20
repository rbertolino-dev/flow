# 📜 Scripts de Migração do Supabase

Este diretório contém scripts úteis para facilitar a migração do projeto Supabase.

## 📋 Scripts Disponíveis

### 1. `backup-completo.sh`
Faz backup completo do projeto atual antes da migração.

**Uso:**
```bash
./scripts/backup-completo.sh
```

**O que faz:**
- ✅ Backup do banco de dados completo
- ✅ Backup do schema (estrutura)
- ✅ Backup dos dados
- ✅ Lista todas as Edge Functions
- ✅ Backup do config.toml
- ✅ Cria arquivo de informações

**Requisitos:**
- Supabase CLI instalado
- Autenticado no Supabase (`supabase login`)
- Projeto linkado (`supabase link`)

---

### 2. `listar-variaveis-ambiente.sh`
Lista todas as variáveis de ambiente necessárias para as Edge Functions.

**Uso:**
```bash
./scripts/listar-variaveis-ambiente.sh
```

**O que faz:**
- ✅ Analisa todas as Edge Functions
- ✅ Identifica variáveis usadas
- ✅ Lista variáveis documentadas
- ✅ Fornece referência completa

---

### 3. `verificar-edge-functions.sh`
Verifica status e configurações de todas as Edge Functions.

**Uso:**
```bash
./scripts/verificar-edge-functions.sh
```

**O que faz:**
- ✅ Lista todas as funções
- ✅ Identifica funções com verify_jwt = false (webhooks)
- ✅ Identifica funções com verify_jwt = true (autenticadas)
- ✅ Fornece estatísticas

---

### 4. `deploy-todas-funcoes.sh`
Faz deploy de todas as Edge Functions para o projeto linkado.

**⚠️ ATENÇÃO:** Use apenas após criar novo projeto e fazer link!

**Uso:**
```bash
# Primeiro, linkar ao novo projeto
supabase link --project-ref [NOVO_PROJECT_ID]

# Depois, fazer deploy
./scripts/deploy-todas-funcoes.sh
```

**O que faz:**
- ✅ Verifica se projeto está linkado
- ✅ Faz deploy de cada função individualmente
- ✅ Mostra progresso e estatísticas
- ✅ Lista funções que falharam (se houver)

---

### 5. `checklist-migracao.sh`
Checklist interativo passo a passo para migração segura.

**Uso:**
```bash
./scripts/checklist-migracao.sh
```

**O que faz:**
- ✅ Guia passo a passo completo
- ✅ Checklist de todas as fases
- ✅ Ajuda a não esquecer nenhum passo
- ✅ Organizado por fases

---

## 🚀 Ordem Recomendada de Execução

### Antes da Migração
1. `backup-completo.sh` - Fazer backup de tudo
2. `listar-variaveis-ambiente.sh` - Documentar variáveis
3. `verificar-edge-functions.sh` - Verificar funções

### Durante a Migração
1. Criar novo projeto Supabase
2. Linkar: `supabase link --project-ref [NOVO_ID]`
3. Aplicar migrations: `supabase db push`
4. `deploy-todas-funcoes.sh` - Deploy das funções
5. Configurar secrets no Dashboard
6. Atualizar frontend
7. Atualizar integrações externas

### Validação
1. `checklist-migracao.sh` - Seguir checklist completo
2. Testar tudo
3. Monitorar logs

---

## ⚠️ Importante

- ✅ Todos os scripts são **somente leitura** (exceto deploy)
- ✅ Nenhum script modifica o projeto original
- ✅ Sempre fazer backup antes de qualquer operação
- ✅ Testar em ambiente de staging primeiro

---

## 📞 Suporte

Se encontrar problemas:
1. Verificar se Supabase CLI está instalado: `supabase --version`
2. Verificar se está autenticado: `supabase login`
3. Verificar se projeto está linkado: `supabase link --project-ref [ID]`
4. Consultar documentação: `PLANO-MIGRACAO-SUPABASE-COMPLETO.md`
