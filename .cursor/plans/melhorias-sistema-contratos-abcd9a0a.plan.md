<!-- abcd9a0a-bf77-4b62-9019-987a6a3a4c57 e79de736-1d80-431d-8e75-a1f7ccb0d4dc -->
# Melhorias para o Módulo de Contratos - Primeira Fase

## Categoria 1: Organização e Gestão

### 1.1 Sistema de Categorias/Tags

**Objetivo:** Organizar contratos por tipo, cliente, projeto ou qualquer critério customizado.

**Implementação:**

- Nova tabela `contract_categories` (id, organization_id, name, color, icon)
- Campo `category_id` em `contracts` (opcional)
- Filtros visuais por categoria na lista
- Badges coloridos na tabela
- Agrupamento por categoria na visualização

**Benefícios:**

- Organização visual clara
- Filtros rápidos
- Relatórios por categoria

**Arquivos afetados:**

- `supabase/migrations/` - Nova migration
- `src/types/contract.ts` - Adicionar `category_id`
- `src/components/contracts/ContractsList.tsx` - Filtros e badges
- `src/pages/Contracts.tsx` - Estado de filtros

---

### 1.2 Busca Avançada e Filtros Múltiplos

**Objetivo:** Encontrar contratos rapidamente com múltiplos critérios.

**Implementação:**

- Filtros combinados: status + categoria + período + cliente
- Busca por número, nome do cliente, conteúdo do contrato
- Filtros salvos (favoritos)
- Ordenação customizada (data, número, cliente, status)
- Exportação de resultados filtrados

**Benefícios:**

- Economia de tempo
- Encontrar contratos específicos rapidamente
- Análises mais precisas

**Arquivos afetados:**

- `src/components/contracts/ContractsList.tsx` - Componente de filtros
- `src/hooks/useContracts.ts` - Lógica de filtros
- `src/pages/Contracts.tsx` - UI de filtros avançados

---

### 1.3 Dashboard de Contratos

**Objetivo:** Visão geral com métricas e estatísticas.

**Implementação:**

- Cards com KPIs: Total, Assinados, Pendentes, Expirados, Taxa de Conversão
- Gráficos: Contratos por mês, Status, Categoria
- Lista de contratos próximos do vencimento
- Contratos aguardando assinatura há X dias
- Filtro por período

**Benefícios:**

- Visão executiva rápida
- Identificação de gargalos
- Acompanhamento de performance

**Arquivos afetados:**

- `src/components/contracts/ContractsDashboard.tsx` - Novo componente
- `src/hooks/useContracts.ts` - Funções de estatísticas
- `src/pages/Contracts.tsx` - Integração do dashboard

---

## Categoria 2: Funcionalidades e Valor

### 2.1 Assinatura Múltipla (Múltiplas Partes)

**Objetivo:** Permitir que várias pessoas assinem o mesmo contrato.

**Implementação:**

- Campo `required_signatures_count` em `contracts`
- Campo `signature_order` em `contract_signatures`
- Status intermediário: `partially_signed`
- Notificação quando todas as partes assinarem
- Visualização de quem já assinou e quem falta

**Benefícios:**

- Contratos com múltiplas partes
- Rastreamento de progresso
- Flexibilidade comercial

**Arquivos afetados:**

- `supabase/migrations/` - Migration para novos campos
- `src/types/contract.ts` - Atualizar tipos
- `src/pages/SignContract.tsx` - Lógica de múltiplas assinaturas
- `src/components/contracts/ContractViewer.tsx` - Exibir progresso

---

### 2.2 Lembretes Automáticos

**Objetivo:** Notificar sobre contratos pendentes de assinatura ou próximos do vencimento.

**Implementação:**

- Tabela `contract_reminders` (contract_id, reminder_type, scheduled_at, sent_at)
- Edge Function `send-contract-reminder` (cron job)
- Notificações: 3 dias antes do vencimento, 1 dia antes, no vencimento
- Lembrete para contratos não assinados há X dias
- Envio via WhatsApp e/ou email

**Benefícios:**

- Reduz contratos esquecidos
- Aumenta taxa de assinatura
- Melhora relacionamento com cliente

**Arquivos afetados:**

- `supabase/migrations/` - Nova tabela
- `supabase/functions/send-contract-reminder/` - Nova edge function
- `supabase/config.toml` - Configurar cron job
- `src/components/contracts/ContractViewer.tsx` - UI de lembretes

---

### 2.3 Histórico de Versões e Alterações

**Objetivo:** Rastrear todas as mudanças em contratos e templates.

**Implementação:**

- Tabela `contract_versions` (contract_id, version_number, content, changed_by, changed_at)
- Tabela `contract_audit_log` (contract_id, action, old_value, new_value, user_id, timestamp)
- Visualização de histórico no viewer
- Comparação entre versões
- Restauração de versão anterior

**Benefícios:**

- Auditoria completa
- Compliance (LGPD)
- Recuperação de erros
- Transparência

**Arquivos afetados:**

- `supabase/migrations/` - Novas tabelas
- `src/components/contracts/ContractHistory.tsx` - Novo componente
- `src/hooks/useContracts.ts` - Funções de versionamento

---

### 2.4 Comentários e Notas Internas

**Objetivo:** Adicionar observações e contexto aos contratos.

**Implementação:**

- Tabela `contract_notes` (contract_id, user_id, note, is_internal, created_at)
- Campo `is_internal` para notas não visíveis ao cliente
- Thread de comentários
- Menções de usuários (@nome)
- Notificações de novos comentários

**Benefícios:**

- Comunicação interna
- Contexto histórico
- Colaboração em equipe

**Arquivos afetados:**

- `supabase/migrations/` - Nova tabela
- `src/components/contracts/ContractNotes.tsx` - Novo componente
- `src/components/contracts/ContractViewer.tsx` - Integração

---

### 2.5 Anexos e Documentos Adicionais

**Objetivo:** Anexar documentos complementares aos contratos.

**Implementação:**

- Tabela `contract_attachments` (contract_id, file_name, file_url, file_type, uploaded_by, uploaded_at)
- Upload de múltiplos arquivos
- Preview de PDFs e imagens
- Download em lote
- Armazenamento no Supabase Storage

**Benefícios:**

- Documentação completa
- Referências anexadas
- Organização de arquivos

**Arquivos afetados:**

- `supabase/migrations/` - Nova tabela
- `src/components/contracts/ContractAttachments.tsx` - Novo componente
- `src/services/contractStorage.ts` - Funções de upload

---

### 2.6 Exportação em Lote e Relatórios

**Objetivo:** Exportar múltiplos contratos e gerar relatórios.

**Implementação:**

- Seleção múltipla na lista
- Exportação: PDF, Excel, CSV
- Relatório: Contratos por período, status, categoria
- Gráficos e estatísticas
- Agendamento de relatórios

**Benefícios:**

- Análises gerenciais
- Backup de documentos
- Compartilhamento com stakeholders

**Arquivos afetados:**

- `src/components/contracts/ContractsList.tsx` - Seleção múltipla
- `src/lib/contractExporter.ts` - Nova lib
- `src/components/contracts/ReportsDialog.tsx` - Novo componente

---

### 2.7 Validação de CPF/CNPJ

**Objetivo:** Validar documentos do cliente antes de assinar.

**Implementação:**

- Campo `client_document` em `contracts` (CPF ou CNPJ)
- Validação de formato e dígitos verificadores
- Exibição no PDF e na página de assinatura
- Confirmação obrigatória na assinatura

**Benefícios:**

- Segurança jurídica
- Validação de identidade
- Compliance

**Arquivos afetados:**

- `supabase/migrations/` - Novo campo
- `src/lib/documentValidator.ts` - Nova lib
- `src/pages/SignContract.tsx` - Validação na assinatura

---

### 2.8 QR Code de Validação no PDF

**Objetivo:** Validar autenticidade do contrato via QR Code.

**Implementação:**

- Gerar QR Code único por contrato (hash + URL de validação)
- Inserir QR Code no PDF assinado
- Página pública de validação: `/validate-contract/:hash`
- Exibir dados do contrato e status de validação

**Benefícios:**

- Autenticidade verificável
- Confiança do cliente
- Prevenção de fraudes

**Arquivos afetados:**

- `src/lib/contractPdfGenerator.ts` - Adicionar QR Code
- `src/pages/ValidateContract.tsx` - Nova página
- `supabase/migrations/` - Campo `validation_hash`

---

## Categoria 3: Segurança e Compliance

### 3.1 Auditoria Completa (Log de Ações)

**Objetivo:** Registrar todas as ações realizadas nos contratos.

**Implementação:**

- Tabela `contract_audit_log` (contract_id, user_id, action, details, ip_address, user_agent, timestamp)
- Registrar: criação, edição, envio, assinatura, cancelamento, download, visualização
- Filtros por usuário, ação, período
- Exportação de logs

**Benefícios:**

- Rastreabilidade completa
- Compliance (LGPD)
- Investigação de problemas
- Segurança

**Arquivos afetados:**

- `supabase/migrations/` - Nova tabela
- `src/lib/contractAudit.ts` - Nova lib
- `src/components/contracts/AuditLogViewer.tsx` - Novo componente

---

### 3.2 Permissões Granulares por Usuário

**Objetivo:** Controlar quem pode fazer o quê com contratos.

**Implementação:**

- Tabela `contract_permissions` (user_id, contract_id, can_view, can_edit, can_delete, can_send, can_sign)
- Permissões por organização (role-based)
- Permissões por contrato específico
- UI de gerenciamento de permissões

**Benefícios:**

- Segurança de dados
- Controle de acesso
- Compliance

**Arquivos afetados:**

- `supabase/migrations/` - Nova tabela e RLS policies
- `src/components/contracts/PermissionsDialog.tsx` - Novo componente
- `src/hooks/useContractPermissions.ts` - Novo hook

---

### 3.3 Watermark nos PDFs

**Objetivo:** Marcar PDFs com informações de segurança.

**Implementação:**

- Watermark: "CONFIDENCIAL", "RASCUNHO", "ASSINADO"
- Incluir: data, número do contrato, organização
- Opacidade configurável
- Aplicar apenas em PDFs não assinados (opcional)

**Benefícios:**

- Prevenção de uso indevido
- Identificação visual
- Segurança

**Arquivos afetados:**

- `src/lib/contractPdfGenerator.ts` - Adicionar watermark
- `src/types/contract.ts` - Configurações de watermark

---

### 3.4 Controle de Expiração Avançado

**Objetivo:** Gerenciar vencimentos de forma inteligente.

**Implementação:**

- Renovação automática (opcional)
- Extensão de prazo (com aprovação)
- Notificações escalonadas (7 dias, 3 dias, 1 dia, vencido)
- Auto-cancelamento após vencimento
- Histórico de renovações

**Benefícios:**

- Gestão proativa
- Reduz contratos esquecidos
- Automação

**Arquivos afetados:**

- `src/components/contracts/ExpirationManager.tsx` - Novo componente
- `supabase/functions/process-contract-expiration/` - Nova edge function
- `src/hooks/useContracts.ts` - Lógica de expiração

---

### 3.5 Backup Automático de PDFs

**Objetivo:** Garantir que PDFs nunca sejam perdidos.

**Implementação:**

- Backup automático ao gerar/assinar
- Armazenamento em bucket separado
- Versionamento de backups
- Restauração de backup
- Limpeza automática de backups antigos (configurável)

**Benefícios:**

- Segurança de dados
- Recuperação de desastres
- Compliance

**Arquivos afetados:**

- `src/services/contractStorage.ts` - Funções de backup
- `supabase/functions/backup-contracts/` - Nova edge function (cron)

---

## Priorização Sugerida para Primeira Fase

### Alta Prioridade (Impacto Alto, Complexidade Média)

1. **Sistema de Categorias/Tags** (1.1)
2. **Busca Avançada e Filtros** (1.2)
3. **Lembretes Automáticos** (2.2)
4. **Auditoria Completa** (3.1)

### Média Prioridade (Impacto Alto, Complexidade Alta)

5. **Assinatura Múltipla** (2.1)
6. **Histórico de Versões** (2.3)
7. **Dashboard de Contratos** (1.3)

### Baixa Prioridade (Impacto Médio, Complexidade Variável)

8. **Comentários e Notas** (2.4)
9. **Anexos e Documentos** (2.5)
10. **QR Code de Validação** (2.8)
11. **Watermark nos PDFs** (3.3)

---

## Arquitetura Técnica

### Novas Tabelas Necessárias

```sql
- contract_categories
- contract_reminders
- contract_versions
- contract_audit_log
- contract_notes
- contract_attachments
- contract_permissions
```

### Novas Edge Functions

```typescript
- send-contract-reminder (cron)
- process-contract-expiration (cron)
- backup-contracts (cron)
```

### Novos Componentes React

```typescript
- ContractsDashboard.tsx
- ContractCategories.tsx
- ContractReminders.tsx
- ContractHistory.tsx
- ContractNotes.tsx
- ContractAttachments.tsx
- AuditLogViewer.tsx
- PermissionsDialog.tsx
```

---

## Próximos Passos

1. **Escolher funcionalidades** da primeira fase (4-6 itens recomendados)
2. **Definir ordem de implementação** (dependências)
3. **Criar migrations SQL** para novas tabelas
4. **Implementar componentes** frontend
5. **Configurar edge functions** e cron jobs
6. **Testes e validação**