# 🚀 DEPLOY AGORA - Guia Rápido

**Data:** 2025-01-31  
**Status:** Código publicado no repositório remoto ✅  
**Próximo passo:** Aplicar no Lovable Cloud

---

## ✅ O QUE JÁ FOI FEITO

- ✅ Código commitado e publicado no GitHub
- ✅ Todas as mudanças sincronizadas com `origin/main`
- ✅ 115 arquivos atualizados incluindo:
  - Migrations do banco de dados
  - Edge Functions atualizadas
  - Componentes React
  - Hooks e utilitários

---

## 🎯 O QUE PRECISA SER FEITO NO LOVABLE CLOUD

### 1️⃣ MIGRATIONS DO BANCO DE DADOS

**📍 Acesse:** Supabase Dashboard → SQL Editor  
**URL:** https://supabase.com/dashboard/project/orcbxgajfhgmjobsjlix/sql/new

#### ⚠️ Migrations Novas/Atualizadas (Aplicar na ordem):

1. **`20250131000005_create_evolution_providers.sql`** ⭐ NOVA
   - Cria tabela de provedores Evolution
   - Aplicar primeiro

2. **`20250131000006_secure_evolution_providers.sql`** ⭐ NOVA
   - Adiciona RLS e segurança
   - Aplicar após a anterior

3. **`20250131000004_create_onboarding_progress.sql`** ⭐ NOVA
   - Sistema de progresso de onboarding

4. **`20250131000003_add_onboarding_fields.sql`** ⭐ NOVA
   - Campos de onboarding nas organizações

5. **`20250131000002_create_assistant_config.sql`** ⭐ NOVA
   - Configurações do assistente IA

6. **`20250131000001_create_assistant_tables.sql`** ⭐ NOVA
   - Tabelas do assistente IA

7. **`20250130000005_add_integration_features.sql`** (Atualizada)
   - Features de integração

8. **`20250130000002_create_plans_system.sql`** (Atualizada)
   - Sistema de planos

9. **`20250130000001_add_limit_validations.sql`** (Atualizada)
   - Validações de limites

10. **`20250130000000_create_organization_limits.sql`** (Atualizada)
    - Limites de organizações

11. **`20250122000000_create_instance_disconnection_notifications.sql`** (Atualizada)
    - Notificações de desconexão

12. **`20250121000000_create_calendar_message_templates.sql`** (Atualizada)
    - Templates de mensagens do calendário

13. **`20250121000000_create_gmail_configs.sql`** (Atualizada)
    - Configurações Gmail

#### 📝 Como Aplicar:

1. Abra cada arquivo SQL na ordem acima
2. Copie **TODO o conteúdo**
3. Cole no SQL Editor do Supabase
4. Clique em **RUN**
5. Verifique se não houve erros
6. Repita para o próximo

#### ✅ Verificar Migrations Aplicadas:

```sql
SELECT version, name, inserted_at
FROM supabase_migrations.schema_migrations
WHERE version LIKE '20250131%' OR version LIKE '20250130%'
ORDER BY inserted_at DESC;
```

---

### 2️⃣ EDGE FUNCTIONS ATUALIZADAS

**📍 Acesse:** Supabase Dashboard → Edge Functions  
**URL:** https://supabase.com/dashboard/project/orcbxgajfhgmjobsjlix/functions

#### ⚠️ Funções que Precisam de Deploy/Atualização:

1. **`notify-instance-disconnection`** ⭐ ATUALIZADA
   - Sistema de notificações de desconexão
   - Arquivo: `supabase/functions/notify-instance-disconnection/index.ts`

2. **`deepseek-assistant`** ⭐ NOVA
   - Assistente IA com DeepSeek
   - Arquivo: `supabase/functions/deepseek-assistant/index.ts`

3. **`gmail-oauth-init`** (Atualizada)
   - Arquivo: `supabase/functions/gmail-oauth-init/index.ts`

4. **`gmail-oauth-callback`** (Atualizada)
   - Arquivo: `supabase/functions/gmail-oauth-callback/index.ts`

5. **`hubspot-get-list-contacts`** (Atualizada)
   - Arquivo: `supabase/functions/hubspot-get-list-contacts/index.ts`

6. **`hubspot-import-list`** (Atualizada)
   - Arquivo: `supabase/functions/hubspot-import-list/index.ts`

7. **`hubspot-list-lists`** (Atualizada)
   - Arquivo: `supabase/functions/hubspot-list-lists/index.ts`

8. **`process-status-schedule`** (Atualizada)
   - Arquivo: `supabase/functions/process-status-schedule/index.ts`

#### 📝 Como Fazer Deploy:

1. No Dashboard, encontre a função (ou crie se não existir)
2. Abra o arquivo correspondente em `supabase/functions/[nome]/index.ts`
3. Copie **TODO o conteúdo**
4. Cole no editor da função no Dashboard
5. Clique em **Deploy** ou **Save**
6. Verifique status "Active"
7. Repita para todas as funções

---

### 3️⃣ VERIFICAÇÕES RÁPIDAS

#### ✅ Verificar Tabelas Criadas:

```sql
-- Tabelas novas que devem existir
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
  'evolution_providers',
  'onboarding_progress',
  'assistant_config',
  'assistant_conversations',
  'assistant_messages'
)
ORDER BY table_name;
```

#### ✅ Verificar Edge Functions:

- [ ] `notify-instance-disconnection` está "Active"
- [ ] `deepseek-assistant` está "Active"
- [ ] Todas as funções atualizadas estão deployadas

---

## 🧪 TESTES PÓS-DEPLOY

### Testes Básicos:

1. **Login:**
   - [ ] Fazer login funciona
   - [ ] Sessão persiste

2. **Assistente IA:**
   - [ ] Acessar página do Assistente
   - [ ] Enviar mensagem funciona
   - [ ] Resposta é recebida

3. **Notificações de Desconexão:**
   - [ ] Alertas aparecem quando instância desconecta
   - [ ] Link de reconexão funciona

4. **Calendário:**
   - [ ] Templates de mensagem funcionam
   - [ ] Eventos são criados corretamente

5. **Onboarding:**
   - [ ] Fluxo de onboarding funciona
   - [ ] Progresso é salvo

---

## 📋 RESUMO EXECUTIVO

### ⏱️ Tempo Estimado: 30-45 minutos

### ✅ Checklist Rápido:

- [ ] Aplicar 13 migrations na ordem listada
- [ ] Fazer deploy de 8 Edge Functions atualizadas
- [ ] Verificar tabelas criadas
- [ ] Testar funcionalidades principais
- [ ] Verificar logs de erros

### 🆘 Se Algo Der Errado:

1. **Erro na Migration:**
   - Verificar se dependências foram aplicadas
   - Verificar ordem de aplicação
   - Consultar logs do Supabase

2. **Erro na Edge Function:**
   - Verificar variáveis de ambiente
   - Verificar logs da função
   - Verificar código copiado corretamente

3. **Erro no Frontend:**
   - Verificar console do navegador
   - Verificar se migrations foram aplicadas
   - Verificar se Edge Functions estão ativas

---

## 📞 PRÓXIMOS PASSOS

Após completar o deploy:

1. Monitorar logs por 24h
2. Testar todas as funcionalidades
3. Documentar qualquer problema encontrado
4. Atualizar este documento com status

---

**✅ Deploy iniciado em:** 2025-01-31  
**📝 Última atualização:** 2025-01-31  
**🔄 Versão:** 1.0

