# 🔄 Plano de Migração Alternativo

## ⚠️ Situação Atual

- ✅ **Projeto NOVO criado**: `ogeljmbhqxpfjbpnbwog` (flow)
- ❌ **Projeto ANTIGO inacessível**: `orcbxgajfhgmjobsjlix` (sem acesso via CLI)
- ✅ **Código completo disponível**: 215 migrations + 86 Edge Functions

## 🎯 Estratégia Alternativa

Como não temos acesso direto ao projeto antigo via CLI, vamos usar o que temos:

### ✅ O Que Já Temos

1. **215 Migrations SQL** - Toda a estrutura do banco
2. **86 Edge Functions** - Todo o código das funções
3. **Config.toml** - Configurações do projeto
4. **Código fonte completo** - Frontend e integrações

### ⚠️ O Que Precisamos Fazer

1. **Aplicar migrations no novo projeto**
2. **Deploy das Edge Functions no novo projeto**
3. **Configurar variáveis de ambiente**
4. **Migrar dados** (se houver dados importantes no projeto antigo)

---

## 📋 Plano de Ação

### FASE 1: Preparar Novo Projeto ✅

- [x] Projeto criado: `ogeljmbhqxpfjbpnbwog`
- [x] CLI instalado e logado
- [ ] Linkar projeto novo
- [ ] Verificar status

### FASE 2: Aplicar Migrations

- [ ] Linkar ao novo projeto
- [ ] Aplicar todas as 215 migrations
- [ ] Verificar se todas foram aplicadas
- [ ] Validar estrutura do banco

### FASE 3: Deploy Edge Functions

- [ ] Deploy de todas as 86 funções
- [ ] Configurar secrets/variáveis de ambiente
- [ ] Testar funções principais

### FASE 4: Migrar Dados (Se Necessário)

- [ ] Verificar se há dados importantes no projeto antigo
- [ ] Se sim, exportar via Dashboard SQL Editor
- [ ] Importar no novo projeto

### FASE 5: Atualizar Frontend

- [ ] Atualizar variáveis de ambiente
- [ ] Atualizar URLs
- [ ] Regenerar types TypeScript

---

## 🔑 Credenciais do Novo Projeto

- **Project ID**: `ogeljmbhqxpfjbpnbwog`
- **URL**: `https://ogeljmbhqxpfjbpnbwog.supabase.co`
- **Publishable Key**: `sb_publishable_7vsOSU_x3SOWheInFDj6yA_o6LG8Jdm`
- **CLI Token**: `sbp_3c4c0840440fb94a32052c9523dd46949af8af19`

---

## ❓ Perguntas Importantes

1. **Há dados importantes no projeto antigo que precisam ser migrados?**
   - Se sim, precisamos acessar o Dashboard do projeto antigo
   - Se não, podemos começar do zero

2. **Você tem acesso ao Dashboard do projeto antigo?**
   - Se sim, podemos exportar dados via SQL Editor
   - Se não, começamos do zero

3. **Service Role Key do projeto antigo?**
   - Necessário se quisermos fazer backup programático

---

**Próximo passo**: Linkar ao novo projeto e começar a aplicar migrations!





