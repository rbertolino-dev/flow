# ✅ Checklist: Deployment de Boletos

## Fase 1: Preparação (Antes do Deploy)

- [ ] Revisar documentação:
  - [ ] `RESUMO-BOLETOS.md`
  - [ ] `GERAR-BOLETOS.md`
  - [ ] `INTEGRACAO-BOLETOS-WORKFLOW.md`

- [ ] Verificar integridade dos arquivos:
  - [ ] `supabase/migrations/20251115020000_add_boleto_tracking.sql`
  - [ ] `supabase/functions/asaas-create-boleto/index.ts`
  - [ ] `src/hooks/useAsaasBoletos.ts`
  - [ ] `src/components/whatsapp/workflows/AsaasBoletoForm.tsx`
  - [ ] `src/components/whatsapp/workflows/BoletosList.tsx`

- [ ] Backup do banco de dados:
  ```bash
  # No Supabase Dashboard, vá em Settings > Backups
  # Faça um backup manual antes de aplicar migrações
  ```

---

## Fase 2: Banco de Dados

- [ ] **Aplicar Migração**
  1. Abra Supabase Dashboard
  2. Vá em SQL Editor
  3. Clique em "New query"
  4. Copie todo o conteúdo de `supabase/migrations/20251115020000_add_boleto_tracking.sql`
  5. Cole no editor
  6. Clique em "RUN"
  7. Verifique resultado: deve aparecer "Query executed successfully"

- [ ] **Verificar Criação da Tabela**
  1. Vá em Table Editor
  2. Procure por `whatsapp_boletos`
  3. Verifique se tem todas as colunas:
     - [ ] `id` (uuid)
     - [ ] `organization_id` (uuid)
     - [ ] `lead_id` (uuid)
     - [ ] `asaas_payment_id` (text, unique)
     - [ ] `valor` (decimal)
     - [ ] `data_vencimento` (date)
     - [ ] `boleto_pdf_url` (text)
     - [ ] `status` (text)

- [ ] **Verificar RLS**
  1. Clique em `whatsapp_boletos`
  2. Vá na aba "Authentication"
  3. Verifique se RLS está **habilitado**
  4. Verifique se há policies:
     - [ ] "Boletos: members can select"
     - [ ] "Boletos: members can insert"
     - [ ] "Boletos: members can update"

- [ ] **Verificar Índices**
  1. Vá em SQL Editor
  2. Execute:
     ```sql
     SELECT * FROM pg_indexes WHERE tablename = 'whatsapp_boletos';
     ```
  3. Deve listar 4 índices

---

## Fase 3: Edge Functions

- [ ] **Deploy da Função**
  
  **Opção A - Via CLI:**
  ```bash
  cd C:\Users\Rubens\lovable\agilize
  supabase functions deploy asaas-create-boleto
  ```

  **Opção B - Via Dashboard:**
  1. Supabase Dashboard > Edge Functions
  2. Clique em "Create a new function"
  3. Nome: `asaas-create-boleto`
  4. Copie conteúdo de `supabase/functions/asaas-create-boleto/index.ts`
  5. Cole no editor
  6. Clique em "Deploy"

- [ ] **Verificar Deploy**
  1. Edge Functions > procure por `asaas-create-boleto`
  2. Status deve estar "Deployed"
  3. Verifique os logs (não deve ter erros)

- [ ] **Testar Função**
  1. Clique na função
  2. Vá na aba "Invoke"
  3. Cole este JSON no body:
     ```json
     {
       "organizationId": "seu-org-id",
       "leadId": "seu-lead-id",
       "customer": {
         "name": "Teste",
         "cpfCnpj": "12345678901"
       },
       "boleto": {
         "valor": 10.00,
         "dataVencimento": "2025-12-31"
       }
     }
     ```
  4. Clique em "Invoke"
  5. Resultado deve ter `success: true`

---

## Fase 4: Frontend

- [ ] **Copiar Arquivos**
  - [ ] `src/hooks/useAsaasBoletos.ts`
  - [ ] `src/components/whatsapp/workflows/AsaasBoletoForm.tsx`
  - [ ] `src/components/whatsapp/workflows/BoletosList.tsx`

- [ ] **Instalar Dependências**
  ```bash
  npm install
  ```

- [ ] **Verificar Imports**
  - Abra `src/components/whatsapp/workflows/AsaasBoletoForm.tsx`
  - Verifique se todos os imports estão corretos:
    - [ ] `@/components/ui/button`
    - [ ] `@/components/ui/input`
    - [ ] `@/hooks/useAsaasBoletos`
    - [ ] `date-fns` e `date-fns/locale`

- [ ] **Build Local**
  ```bash
  npm run build
  ```
  - Deve completar sem erros
  - Se houver erro, corrija antes de prosseguir

- [ ] **Testar Localmente**
  ```bash
  npm run dev
  ```
  - Abra http://localhost:5173
  - Navegue até Fluxo Automatizado
  - Verifique se aparecem as abas
  - Tente gerar um boleto (sandbox)

---

## Fase 5: Integração (Opcional)

- [ ] **Adicionar ao Workflow**
  1. Abra `src/components/whatsapp/workflows/WorkflowFormDrawer.tsx`
  2. Adicione imports:
     ```typescript
     import { AsaasBoletoForm } from "./AsaasBoletoForm";
     import { BoletosList } from "./BoletosList";
     ```
  3. Adicione componentes onde desejado (veja guia de integração)
  4. Teste criação de workflow com boleto

- [ ] **Integração Automática (Opcional)**
  1. Abra `src/hooks/useWhatsAppWorkflows.ts`
  2. Adicione lógica de criação automática (veja guia)
  3. Teste se boletos são criados automaticamente

---

## Fase 6: Testes

- [ ] **Teste 1: Criar Boleto**
  - [ ] Gere um boleto manualmente
  - [ ] Verifique se aparece na tabela
  - [ ] Verifique status: deve ser "pending" ou "open"

- [ ] **Teste 2: Download**
  - [ ] Clique em "Download PDF"
  - [ ] Arquivo deve baixar
  - [ ] Verifique se é um PDF válido

- [ ] **Teste 3: Link do Boleto**
  - [ ] Clique em "Link do Boleto"
  - [ ] Deve abrir no Asaas (sandbox)
  - [ ] Verifique dados do boleto

- [ ] **Teste 4: Integração Workflow**
  - [ ] Crie workflow de cobrança
  - [ ] Verifique se boleto é criado automaticamente
  - [ ] Verifique se aparece na lista

- [ ] **Teste 5: Multi-Org**
  - [ ] Mude para outra organização
  - [ ] Gere boleto
  - [ ] Volte para primeira org
  - [ ] Verifique que boletos estão isolados

- [ ] **Teste 6: Validações**
  - [ ] Tente criar boleto sem valor → erro
  - [ ] Tente com data anterior → erro
  - [ ] Tente sem lead → erro

---

## Fase 7: Produção

- [ ] **Antes de Deploy**
  - [ ] Todos os testes locais passaram
  - [ ] Código sem erros de lint
  - [ ] Documentação atualizada
  - [ ] Backup feito

- [ ] **Deploy**
  ```bash
  git add .
  git commit -m "feat: Adiciona geração de boletos Asaas"
  git push
  ```

- [ ] **Pós-Deploy**
  - [ ] Verifique se Edge Function está deployada
  - [ ] Teste criação de boleto em produção (sandbox)
  - [ ] Verifique logs do Supabase
  - [ ] Monitore para erros

- [ ] **Comunicar**
  - [ ] Notifique o time sobre nova funcionalidade
  - [ ] Compartilhe documentação
  - [ ] Treine usuários
  - [ ] Configure FAQ

---

## Fase 8: Monitoramento

- [ ] **Primeira Semana**
  - [ ] Monitore logs de erros
  - [ ] Verifique performance
  - [ ] Recolha feedback de usuários

- [ ] **Andamento**
  - [ ] Verifique uso (quantos boletos/dia)
  - [ ] Performance do banco de dados
  - [ ] Erros recorrentes

- [ ] **Métricas**
  - [ ] Boletos criados com sucesso
  - [ ] Taxa de erro
  - [ ] Tempo médio de criação

---

## Rollback (Se Necessário)

- [ ] **Reverter Migração**
  ```sql
  DROP TABLE public.whatsapp_boletos CASCADE;
  ```

- [ ] **Desabilitar Componentes**
  - Remova imports de `AsaasBoletoForm` e `BoletosList`
  - Comentarize a seção do workflow

- [ ] **Rollback de Código**
  ```bash
  git revert <commit-id>
  npm install
  npm run build
  ```

---

## Status Final

- [ ] Migração aplicada: ✅ / ❌ / 🔄
- [ ] Edge Function deployada: ✅ / ❌ / 🔄
- [ ] Frontend integrado: ✅ / ❌ / 🔄
- [ ] Testes passando: ✅ / ❌ / 🔄
- [ ] Em produção: ✅ / ❌ / 🔄

**Data de Conclusão:** _______________

**Responsável:** _______________

**Observações:**
```
[espaço para notas]
```

---

**Documento de Checklist - Última atualização: Janeiro 2025**

