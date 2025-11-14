# Checklist de Regressão

Este guia documenta o conjunto mínimo de verificações que toda alteração importante deve passar antes de enviar para produção.

## Objetivo

- Garantir que a nova aba `/whatsapp/workflows` e o processamento de envios periódicos funcionem corretamente.
- Reaproveitar ao máximo os componentes e tabelas existentes (sem duplicar dados desnecessários).
- Manter requisitos de custo e isolamento entre organizações.

## Passos manuais (no ambiente local ou homologação)

1. **Preparar o ambiente**
   - `npm install`
   - `npm run build` (verifica que o frontend compila sem erros)
   - Opcionalmente `npm run dev` para abrir o app e testar interativamente.

2. **Fluxos principais**
   - Navegar para `/whatsapp/workflows`.
   - Criar uma **lista de destinatários** usando leads existentes.
   - Criar um **workflow periódico** (diário, semanal e personalizado) selecionando template/anexo.
   - Editar, pausar, reativar e excluir o workflow para garantir que as ações rápidas funcionam.
   - Tentar criar um workflow sem nome, sem destinatário, sem mensagem e confirmar os toasts de validação.

3. **Mídia/anexos**
   - Subir imagens ou PDFs no formulário de workflow e confirmar que os objetos são salvos em `whatsapp-workflow-media/{orgId}/{workflowId}/…`.
   - Confirmar que usuários da mesma organização conseguem acessar os anexos e usuários de outras organizações não veem os objetos (políticas de RLS do bucket).

4. **Processamento backend**
   - Aplicar as migrações (`supabase db push` ou equivalente) para criar as tabelas e bucket.
   - Deployar a função `process-whatsapp-workflows` e acioná-la manualmente (`curl` ou Supabase Studio) para processar workflows com `next_run_at <= agora`.
   - Verificar que apenas `scheduled_messages` (com `workflow_id`) recebem inserções e que não há duplicação de histórico extra.
   - Confirmar que o cron usa `America/Sao_Paulo` (horários devem bater com o que foi configurado no front).

5. **Filtros e listas**
   - Validar filtros de status, tipo e lista na página (`WorkflowFilters`) retornam apenas dados da organização ativa.
   - Criar lista individual `list_type = single` via `WorkflowListManager` e reutilizá-la automaticamente quando o workflow precisa de um cliente único.

## Execução automática antes do deploy (CI/CD)

A pipeline `ci-regression` (GitHub Actions) roda:

1. `npm install`
2. `npm run lint`
3. `npm run build`

Isso garante consistência do código e evita regressões antes de cada deploy.

## Observações

- Use os hooks `useWhatsAppWorkflows`, `useWorkflowLists` e `useLeadOptions` para garantir que os dados estão sempre filtrados por `organization_id`.
- A tabela `scheduled_messages` continua sendo usada como rastro único dos envios; não mantenha cópias adicionais para reduzir custo.
- Sempre atualize este checklist quando adicionar novos componentes críticos ou fluxos na área de WhatsApp.

