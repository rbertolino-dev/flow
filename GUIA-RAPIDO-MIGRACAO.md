# 🚀 Guia Rápido de Migração do Supabase

**Versão**: 1.0  
**Data**: 14/12/2025  
**Status**: ✅ Pronto para uso

---

## 📋 Pré-requisitos

- ✅ Supabase CLI instalado (`supabase --version`)
- ✅ Autenticado no Supabase (`supabase login`)
- ✅ Backup completo realizado
- ✅ Novo projeto Supabase criado

---

## ⚡ Migração Rápida (5 Passos)

### 1️⃣ Backup Completo
```bash
./scripts/backup-completo.sh
```

### 2️⃣ Linkar ao Novo Projeto
```bash
supabase link --project-ref [NOVO_PROJECT_ID]
```

### 3️⃣ Aplicar Migrations
```bash
supabase db push
```

### 4️⃣ Deploy das Edge Functions
```bash
./scripts/deploy-todas-funcoes.sh
```

### 5️⃣ Configurar Secrets
1. Acesse: Dashboard → Settings → Edge Functions → Secrets
2. Adicione todas as variáveis listadas em `VARIAVEIS-AMBIENTE-COMPLETAS.md`

---

## 📝 Checklist Completo

Execute o checklist interativo:
```bash
./scripts/checklist-migracao.sh
```

---

## 🔍 Scripts Úteis

### Verificar Edge Functions
```bash
./scripts/verificar-edge-functions.sh
```

### Listar Variáveis de Ambiente
```bash
./scripts/listar-variaveis-ambiente.sh
```

### Backup Completo
```bash
./scripts/backup-completo.sh
```

### Deploy de Todas as Funções
```bash
./scripts/deploy-todas-funcoes.sh
```

---

## 📚 Documentação Completa

- **Plano Detalhado**: `PLANO-MIGRACAO-SUPABASE-COMPLETO.md`
- **Variáveis de Ambiente**: `VARIAVEIS-AMBIENTE-COMPLETAS.md`
- **Verificação do Projeto**: `VERIFICACAO-PROJETO-ORIGINAL.md`
- **Scripts**: `scripts/README.md`

---

## ⚠️ Importante

1. **SEMPRE** fazer backup antes de qualquer operação
2. **TESTAR** em ambiente de staging primeiro
3. **MANTER** projeto antigo ativo por alguns dias
4. **DOCUMENTAR** todas as credenciais em local seguro
5. **ATUALIZAR** URLs de webhooks em todos os serviços externos

---

## 🆘 Troubleshooting

### Erro: "Projeto não está linkado"
```bash
supabase link --project-ref [PROJECT_ID]
```

### Erro: "Não autenticado"
```bash
supabase login
```

### Erro: "CLI não encontrado"
```bash
npm install -g supabase
# ou
brew install supabase/tap/supabase
```

---

## ✅ Após a Migração

1. Testar autenticação
2. Testar Edge Functions principais
3. Testar webhooks
4. Atualizar frontend
5. Atualizar integrações externas
6. Monitorar logs por 24-48h

---

**Boa sorte com a migração!** 🚀
