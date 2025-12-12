# Descrição Resumida das Funcionalidades do Sistema

## 1. CRM (Customer Relationship Management)
**Descrição:** Sistema completo de gestão de relacionamento com clientes e leads.
- Visualização de leads em formato Kanban, Lista ou Calendário
- Gerenciamento de pipeline de vendas com etapas personalizáveis
- Criação e edição de leads com informações completas
- Filtros avançados por etapa, tags, data, instância e origem
- Busca por nome, telefone ou outros campos
- Importação em massa de contatos
- Histórico de conversas e interações
- Agendamento de mensagens
- Gestão de follow-ups automáticos
- Relatórios de vendas

## 2. Funil de Vendas (Kanban)
**Descrição:** Visualização em formato Kanban para gerenciar leads através do pipeline.
- Cards arrastáveis entre etapas
- Visualização por colunas (etapas do funil)
- Filtros por etapa, tags, data e instância
- Busca rápida de leads
- Criação rápida de novos contatos
- Edição inline de informações
- Indicadores visuais de status

## 3. Fila de Ligações
**Descrição:** Sistema de gerenciamento de fila de retorno e agendamento de ligações.
- Lista de contatos agendados para ligação
- Marcação de ligação como concluída
- Reagendamento de ligações
- Adição de notas após ligação
- Atribuição de ligações a usuários
- Filtros por data e status
- Tags para organização

## 4. Leads que Precisam Atenção
**Descrição:** Painel especializado para identificar leads que requerem ação imediata.
- Identificação automática de leads com retorno vencido
- Leads sem contato há muito tempo
- Leads com oportunidades de follow-up
- Ações rápidas para cada lead

## 5. Lista Telefônica
**Descrição:** Diretório completo de contatos com funcionalidades avançadas de busca e organização.
- Visualização em grid ou lista
- Busca por nome, telefone, email ou empresa
- Filtros por etapa, tags e origem
- Ordenação por nome, data, valor ou último contato
- Agrupamento por etapa, origem, empresa ou tag
- Seleção múltipla de contatos
- Criação de listas personalizadas
- Exportação para CSV
- Ações rápidas: ligar, WhatsApp, email
- Paginação inteligente

## 6. Agendamento (Calendar)
**Descrição:** Sistema de agendamento integrado com Google Calendar.
- Visualização de eventos em calendário
- Integração com Google Calendar
- Sincronização bidirecional
- Criação e edição de eventos
- Visualização de compromissos dos leads

## 7. Agilizechat (Chatwoot)
**Descrição:** Integração completa com Chatwoot para gerenciamento de conversas.
- Visualização unificada de todas as inboxes
- Modo por inbox individual
- Lista de conversas com busca
- Janela de chat integrada
- Indicadores de lead no funil
- Gerenciamento de etiquetas (labels)
- Respostas prontas (canned responses)
- Notas privadas
- Macros para ações em massa
- Mesclagem de contatos
- Configuração de webhooks
- Atribuição de conversas a agentes
- Status de conversas (aberta, resolvida, pendente)

## 8. Todas as Conversas (Unified Messages)
**Descrição:** Visualização unificada de conversas de Evolution e Chatwoot.
- Lista única de todas as conversas
- Filtro por fonte (Evolution, Chatwoot ou todas)
- Busca unificada
- Indicador de lead no funil
- Visualização de mensagens de ambas as plataformas
- Informações de instância/origem

## 9. Disparo em Massa (Broadcast)
**Descrição:** Sistema para envio de mensagens em massa via WhatsApp.
- Criação de campanhas de disparo
- Seleção de destinatários
- Templates de mensagens
- Agendamento de envios
- Controle de horários permitidos
- Relatórios de entrega
- Status de envio por mensagem

## 10. Fluxo Automatizado (Workflows)
**Descrição:** Sistema de automação de workflows periódicos para cobrança e lembretes.
- Criação de workflows de cobrança
- Workflows de lembrete
- Agendamento automático
- Listas de destinatários
- Templates de mensagens
- Anexos em mensagens
- Fila de aprovação de workflows
- Gestão de boletos Asaas
- Integração com Asaas (configuração de API)
- Integração com Mercado Pago
- Histórico de execuções
- Ativação/desativação de workflows

## 11. Agentes IA
**Descrição:** Sistema de criação e gerenciamento de agentes de IA para atendimento automático.
- Criação de agentes com OpenAI
- Configuração de instruções e guardrails
- Exemplos few-shot para treinamento
- Seleção de modelos OpenAI
- Configuração de temperatura
- Modo de teste
- Fallback automático para operador humano
- Sincronização com Evolution (WhatsApp)
- Upload de arquivos de conhecimento
- Configuração de triggers (palavras-chave)
- Configuração de tempo de expiração
- Gerenciamento de status (rascunho, ativo, pausado)

## 12. Integração Gmail
**Descrição:** Portal de integração com Gmail.
- Visualização de emails
- Sincronização com conta Gmail
- Gestão de emails relacionados a leads

## 13. Integração Bubble.io
**Descrição:** Sistema de consulta e integração com Bubble.io.
- Configuração de API do Bubble
- Consultas a tabelas do Bubble
- Filtros avançados por campo
- Filtros por data
- Cache inteligente (24h)
- Histórico de consultas
- Exportação para CSV e JSON
- Relatórios de uso
- Análise de clientes
- Validação de filtros relacionados

## 14. Configurações
**Descrição:** Painel central de configurações do sistema.
- Configuração de instâncias Evolution (WhatsApp)
- Configuração de Chatwoot
- Gerenciamento de usuários
- Configurações de organização
- Configurações de tags
- Configurações de etapas do pipeline
- Configurações de templates de mensagens
- Integrações de pagamento (Asaas, Mercado Pago)

## 15. Usuários
**Descrição:** Gerenciamento de usuários e permissões.
- Criação e edição de usuários
- Atribuição de permissões
- Gerenciamento de roles (admin, usuário)
- Vinculação a organizações

## 16. Super Admin
**Descrição:** Painel administrativo para gestão de múltiplas organizações.
- Visualização de todas as organizações
- Estatísticas gerais
- Gerenciamento de custos
- Relatórios administrativos

## 17. Autenticação e Segurança
**Descrição:** Sistema de autenticação e controle de acesso.
- Login e logout
- Proteção de rotas (AuthGuard)
- Multi-tenancy (isolamento por organização)
- RLS (Row Level Security) policies
- Logs de autenticação

## 18. Sincronização Automática
**Descrição:** Sistema de sincronização automática de dados.
- Sincronização periódica (a cada 5 minutos)
- Health check de instâncias (a cada 30 segundos)
- Indicadores de status de sincronização
- Última sincronização e próxima sincronização

## 19. Relatórios e Analytics
**Descrição:** Sistema de relatórios e análises.
- Relatórios de vendas
- Relatórios de uso de APIs
- Análise de clientes
- Estatísticas de workflows
- Relatórios de broadcast
- Análise de conversas

## 20. Notificações e Alertas
**Descrição:** Sistema de notificações e feedback ao usuário.
- Toasts para ações
- Alertas de status
- Indicadores visuais de estado
- Mensagens de erro e sucesso

## 21. Diagnósticos
**Descrição:** Ferramentas de diagnóstico e troubleshooting.
- Diagnósticos de RLS
- Verificação de saúde de instâncias
- Logs de sistema
- Ferramentas de debug

## 22. Organização
**Descrição:** Gerenciamento de organizações e multi-tenancy.
- Criação de organizações
- Troca de organização ativa
- Configurações por organização
- Isolamento de dados





