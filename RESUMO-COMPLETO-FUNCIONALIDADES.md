# 📋 Resumo Completo de Todas as Funcionalidades do Sistema

## 🎯 VISÃO GERAL
Sistema completo de CRM e automação de vendas com integrações múltiplas, gestão de leads, automações inteligentes e ferramentas de comunicação.

---

## 1. 🏢 CRM E GESTÃO DE LEADS

### 1.1 Funil de Vendas (Kanban)
- **Visualização Kanban** com cards arrastáveis entre etapas
- **Visualização em Lista** com tabela completa
- **Visualização em Calendário** para agendamentos
- **Criação rápida de leads** diretamente do funil
- **Edição inline** de informações dos leads
- **Filtros avançados:**
  - Por etapa do funil
  - Por tags
  - Por data de criação
  - Por data de retorno
  - Por instância de origem
  - Por status na fila de ligação
- **Busca inteligente** por nome, telefone, email
- **Seleção múltipla** de leads para ações em massa
- **Exportação** de leads filtrados
- **Importação em massa** de contatos (CSV)
- **Configuração de etapas** personalizáveis com cores
- **Estatísticas por etapa** (quantidade de leads)
- **Drag and drop** para mover leads entre etapas
- **Preview tooltip** ao passar mouse sobre leads
- **Bulk actions bar** para ações em massa

### 1.2 Gestão de Leads
- **Criação de leads** com formulário completo
- **Edição de leads** com todas as informações
- **Detalhes completos do lead:**
  - Informações de contato (nome, telefone, email, empresa)
  - Valor do negócio
  - Etapa atual no funil
  - Tags associadas
  - Histórico de conversas
  - Histórico de atividades
  - Agendamentos
  - Follow-ups programados
- **Histórico de conversas** integrado
- **Histórico de atividades** completo
- **Agendamento de mensagens** para envio futuro
- **Agendamento de ligações** na fila
- **Transferência de leads** entre etapas
- **Arquivamento de leads** inativos
- **Restauração de leads** arquivados
- **Conversão de LID** para lead completo
- **Conversão de ligação** para lead
- **Adição de leads a listas** de workflow

### 1.3 Lista Telefônica
- **Visualização em Grid** (cards)
- **Visualização em Lista** (tabela)
- **Busca avançada** por nome, telefone, email, empresa
- **Filtros múltiplos:**
  - Por etapa
  - Por tags
  - Por origem
- **Ordenação** por nome, data de criação, último contato, valor
- **Agrupamento** por etapa, origem, empresa, tag
- **Seleção múltipla** de contatos
- **Criação de listas** personalizadas
- **Exportação para CSV**
- **Ações rápidas:**
  - Ligar (abre discador)
  - WhatsApp (abre conversa)
  - Email (abre cliente de email)
  - Copiar telefone
- **Paginação inteligente** por grupo
- **Colapso/expansão** de grupos

### 1.4 Leads que Precisam Atenção
- **Identificação automática** de leads com retorno vencido
- **Leads sem contato** há muito tempo
- **Leads com oportunidades** de follow-up
- **Ações rápidas** para cada lead
- **Priorização visual** de leads críticos

### 1.5 Pipeline e Etapas
- **Gerenciamento de etapas** do funil
- **Criação de etapas** personalizadas
- **Edição de etapas** (nome, cor, ordem)
- **Exclusão de etapas**
- **Limpeza de etapas duplicadas**
- **Cores personalizáveis** para cada etapa
- **Ordem customizável** das etapas

### 1.6 Tags e Categorização
- **Criação de tags** personalizadas
- **Edição de tags** (nome, cor)
- **Exclusão de tags**
- **Aplicação de tags** a leads
- **Remoção de tags** de leads
- **Filtros por tags**
- **Cores personalizáveis** para tags

---

## 2. 📞 FILA DE LIGAÇÕES E AGENDAMENTOS

### 2.1 Fila de Ligações
- **Lista de contatos** agendados para ligação
- **Agendamento de ligações** com data/hora
- **Marcação de ligação** como concluída
- **Reagendamento** de ligações
- **Adição de notas** após ligação
- **Atribuição de ligações** a usuários específicos
- **Filtros** por data, status, usuário
- **Tags** para organização da fila
- **Estatísticas** da fila (total, pendentes, concluídas)
- **Histórico** de ligações realizadas
- **Gerenciamento de tags** da fila

### 2.2 Agendamento (Calendar)
- **Visualização mensal** de eventos
- **Visualização semanal** de eventos
- **Visualização diária** de eventos
- **Criação de eventos** no calendário
- **Edição de eventos** existentes
- **Exclusão de eventos**
- **Marcação de eventos** como concluídos
- **Integração com Google Calendar:**
  - Sincronização bidirecional
  - OAuth para autenticação
  - Sincronização automática
  - Sincronização manual
- **Agendamento de mensagens** via calendário
- **Agendamento de eventos** do Google
- **Relatório de eventos** do calendário
- **Filtros** por tipo de evento

---

## 3. 💬 COMUNICAÇÃO E MENSAGENS

### 3.1 WhatsApp (Evolution API)
- **Chat integrado** com Evolution API
- **Envio de mensagens** de texto
- **Envio de mídia** (imagens, vídeos, documentos, áudio)
- **Recebimento de mensagens** em tempo real
- **Status de mensagens** (enviada, entregue, lida)
- **Lista de conversas** com busca
- **Histórico completo** de conversas
- **Upload de status** (imagens/vídeos)
- **Agendamento de status** para publicação
- **Cancelamento de status** agendados
- **Republicação de status**
- **Validação de números** WhatsApp
- **Diagnóstico de API** Evolution
- **Logs de Evolution** para debug
- **Scanner de status** das instâncias
- **Painel de status** das instâncias
- **Dashboard de saúde** das instâncias
- **Alertas de desconexão** de instâncias
- **Gerenciamento de grupos** de instâncias

### 3.2 Agilizechat (Chatwoot)
- **Visualização unificada** de todas as inboxes
- **Modo por inbox** individual
- **Lista de conversas** com busca avançada
- **Janela de chat** integrada
- **Indicadores de lead** no funil
- **Gerenciamento de etiquetas** (labels)
- **Respostas prontas** (canned responses)
- **Notas privadas** em conversas
- **Macros** para ações em massa
- **Mesclagem de contatos**
- **Configuração de webhooks**
- **Atribuição de conversas** a agentes
- **Status de conversas** (aberta, resolvida, pendente, adiada)
- **Relatórios de labels** e analytics
- **Painel de configuração** do Chatwoot
- **Teste de webhook**
- **Logs de webhook**

### 3.3 Todas as Conversas (Unified Messages)
- **Lista unificada** de conversas Evolution e Chatwoot
- **Filtro por fonte** (Evolution, Chatwoot, todas)
- **Busca unificada** em todas as conversas
- **Indicador de lead** no funil
- **Visualização de mensagens** de ambas as plataformas
- **Informações de instância/origem**
- **Estatísticas** de conversas

### 3.4 Disparo em Massa (Broadcast)
- **Criação de campanhas** de disparo
- **Seleção de destinatários:**
  - Por lista de contatos
  - Por filtros de leads
  - Importação de CSV
- **Templates de mensagens** personalizáveis
- **Variações de mensagens** para evitar bloqueio
- **Agendamento de envios** com data/hora
- **Controle de horários** permitidos (janelas de tempo)
- **Gerenciamento de janelas** de tempo
- **Detecção de conflitos** de janelas
- **Delays configuráveis** entre mensagens
- **Anexos** em mensagens (imagens, documentos)
- **Status de envio** por mensagem
- **Relatórios de performance:**
  - Taxa de entrega
  - Taxa de leitura
  - Taxa de erro
- **Exportação de relatórios** (CSV, PDF)
- **Templates de campanhas** reutilizáveis
- **Pausar/retomar** campanhas
- **Cancelar campanhas**
- **Validação de contatos** antes do envio
- **Estatísticas em tempo real**

### 3.5 Mensagens Agendadas
- **Agendamento de mensagens** individuais
- **Agendamento de mensagens** em massa
- **Edição de mensagens** agendadas
- **Cancelamento de mensagens** agendadas
- **Histórico** de mensagens agendadas
- **Notificações** de envio

### 3.6 Templates de Mensagens
- **Criação de templates** personalizados
- **Edição de templates**
- **Exclusão de templates**
- **Categorização** de templates
- **Variáveis dinâmicas** nos templates
- **Preview** de templates
- **Uso rápido** de templates no chat

---

## 4. 🤖 AUTOMAÇÕES E WORKFLOWS

### 4.1 Fluxo Automatizado (Workflows)
- **Criação de workflows** de cobrança
- **Criação de workflows** de lembrete
- **Tipos de workflows:**
  - Cobrança
  - Lembrete
  - Follow-up
  - Boas-vindas
- **Agendamento automático** de execuções
- **Listas de destinatários** personalizáveis
- **Templates de mensagens** nos workflows
- **Anexos** em workflows:
  - Anexos fixos
  - Anexos mensais (por mês)
  - Anexos por contato
- **Fila de aprovação** de workflows
- **Aprovação/rejeição** de workflows
- **Ativação/desativação** de workflows
- **Histórico de execuções**
- **Logs de erros** de workflows
- **Estatísticas** de workflows
- **Dashboard** de performance
- **Grupos de workflows** para organização
- **Filtros** por status, tipo, lista
- **Busca** de workflows

### 4.2 Automações Visuais (Flow Editor)
- **Editor drag-and-drop** de automações
- **Blocos disponíveis:**
  - Triggers (gatilhos)
  - Ações
  - Condições
  - Esperas (delays)
- **Canvas visual** para criar fluxos
- **Teste de fluxos** antes de ativar
- **Modo de teste** para validação
- **Histórico de execuções** de fluxos
- **Métricas** de execução
- **Templates de automações** prontas
- **Playbooks** de automação
- **Configuração de triggers:**
  - Por evento (novo lead, mudança de etapa)
  - Por condição
  - Por agendamento
- **Configuração de ações:**
  - Enviar mensagem
  - Atualizar lead
  - Adicionar tag
  - Mover para etapa
  - Criar tarefa
- **Configuração de condições:**
  - IF/ELSE
  - Múltiplas condições
- **Configuração de esperas:**
  - Delay fixo
  - Delay variável
  - Espera até data/hora

### 4.3 Follow-ups Automáticos
- **Configuração de follow-ups** por etapa
- **Templates de follow-up** personalizáveis
- **Automações de follow-up:**
  - Envio automático após X dias
  - Baseado em ações do lead
  - Baseado em tags
- **Gerenciamento de templates** de follow-up

---

## 5. 🤖 AGENTES DE IA

### 5.1 Gerenciamento de Agentes
- **Criação de agentes** com OpenAI
- **Configuração de instruções** personalizadas
- **Guardrails** (regras obrigatórias)
- **Exemplos few-shot** para treinamento
- **Seleção de modelos** OpenAI (GPT-4, GPT-3.5, etc.)
- **Configuração de temperatura**
- **Modo de teste** (não envia mensagens reais)
- **Fallback automático** para operador humano
- **Sincronização com Evolution** (WhatsApp)
- **Sincronização com OpenAI** (criação de assistentes)
- **Upload de arquivos** de conhecimento
- **Configuração de triggers:**
  - Por palavra-chave
  - Por operador (contém, igual, etc.)
  - Por valor específico
- **Configuração de expiração** (tempo de conversa)
- **Palavra-chave de saída** (#SAIR)
- **Delay entre mensagens**
- **Mensagem para desconhecido**
- **Configurações avançadas:**
  - Escutar mensagens próprias
  - Parar bot de mensagens próprias
  - Manter conversa aberta
  - Tempo de debounce
  - JIDs ignorados
  - Formato de resposta (text/json)
  - Divisão de mensagens
  - URL de função customizada
- **Status de agentes** (rascunho, ativo, pausado, arquivado)
- **Estatísticas** de agentes
- **Configuração de API** OpenAI

### 5.2 Assistente IA (DeepSeek)
- **Chat interface** para conversação
- **Widget flutuante** de chat
- **Reconhecimento de voz** (speech-to-text)
- **Comandos em linguagem natural:**
  - Criar leads
  - Buscar leads
  - Atualizar informações
  - Agendar ligações
  - Enviar mensagens WhatsApp
  - Listar etapas do funil
  - Listar tags
  - Consultar estatísticas
  - Gerar relatórios
- **Ações rápidas** pré-configuradas
- **Histórico de conversas**
- **Limpeza de conversa**
- **Minimizar/maximizar** widget

---

## 6. 📅 INTEGRAÇÕES

### 6.1 Google Calendar
- **Integração OAuth** com Google
- **Sincronização bidirecional** de eventos
- **Criação de eventos** no Google Calendar
- **Edição de eventos** do Google Calendar
- **Visualização** de eventos no sistema
- **Agendamento de eventos** via sistema
- **Sincronização automática**
- **Sincronização manual**
- **Relatório de eventos**

### 6.2 Gmail
- **Integração OAuth** com Gmail
- **Portal de emails** integrado
- **Visualização de emails**
- **Envio de emails** via Gmail
- **Resposta a emails**
- **Sincronização** de emails

### 6.3 Facebook/Instagram
- **Configuração de integração** Facebook
- **OAuth** com Facebook
- **Publicação** de posts
- **Gerenciamento** de contas

### 6.4 Google Business
- **Integração** com Google Business
- **OAuth** com Google Business
- **Criação de posts** no Google Business
- **Gerenciamento** de posts

### 6.5 Bubble.io
- **Configuração de API** Bubble
- **Consultas a tabelas** do Bubble
- **Filtros avançados** por campo
- **Filtros por data**
- **Cache inteligente** (24h)
- **Histórico de consultas**
- **Exportação** para CSV e JSON
- **Relatórios de uso**
- **Análise de clientes**
- **Sincronização de leads** com Bubble
- **Validação de filtros** relacionados

### 6.6 HubSpot
- **Configuração de integração** HubSpot
- **Sincronização de leads** bidirecional
- **Importação de listas** do HubSpot
- **Mapeamento de campos** customizável
- **Sincronização de estágios/tags**

### 6.7 Asaas (Pagamentos)
- **Configuração de API** Asaas
- **Geração automática de boletos**
- **Download de PDFs** de boletos
- **Código de barras** e linha digitável
- **Rastreamento de boletos**
- **Histórico completo** de boletos
- **Integração com workflows** de cobrança
- **Ambiente sandbox/produção**
- **Teste de conexão**

### 6.8 Mercado Pago
- **Configuração de integração** Mercado Pago
- **Criação de cobranças**
- **Gestão de cobranças**
- **Formulário de pagamento**
- **Histórico de pagamentos**

### 6.9 N8n (Automações)
- **Configuração de API** N8n
- **Listagem de workflows** N8n
- **Criação de workflows** via interface
- **Ativação/desativação** de workflows
- **Execução manual** de workflows
- **Histórico de execuções**
- **Templates de workflows** N8n
- **Geração de workflows** por IA
- **Teste de workflows**
- **Busca e filtros** de workflows

---

## 7. 📊 RELATÓRIOS E ANALYTICS

### 7.1 Relatórios de Vendas
- **Relatório por etapas** do funil
- **Taxa de conversão** por etapa
- **Tempo médio** no funil
- **Ticket médio**
- **Gráficos interativos**
- **Filtros** por período, vendedor, etapa
- **Comparativo** período anterior
- **Exportação** em PDF/Excel

### 7.2 Relatórios de Broadcast
- **Performance de campanhas**
- **Taxa de entrega**
- **Taxa de leitura**
- **Taxa de erro**
- **Exportação** de relatórios

### 7.3 Relatórios de Workflows
- **Estatísticas de execução**
- **Taxa de sucesso**
- **Logs de erros**
- **Histórico de execuções**

### 7.4 Relatórios de Labels (Chatwoot)
- **Análise de labels** mais usadas
- **Estatísticas** por label
- **Relatórios** de performance

### 7.5 Relatórios de Calendário
- **Eventos por período**
- **Estatísticas** de agendamentos

### 7.6 Relatórios de Bubble
- **Uso de consultas**
- **Análise de clientes**
- **Métricas** de integração

---

## 8. 👥 GESTÃO DE USUÁRIOS E PERMISSÕES

### 8.1 Usuários
- **Criação de usuários**
- **Edição de usuários**
- **Exclusão de usuários**
- **Atribuição de permissões**
- **Gerenciamento de roles** (admin, usuário)
- **Vinculação a organizações**
- **Diálogo de permissões** detalhado

### 8.2 Organizações
- **Criação de organizações**
- **Edição de organizações**
- **Exclusão de organizações**
- **Troca de organização** ativa
- **Configurações por organização**
- **Isolamento de dados** (multi-tenancy)
- **Seletor de organização**

### 8.3 Super Admin
- **Dashboard administrativo**
- **Visualização de todas** as organizações
- **Estatísticas gerais**
- **Gerenciamento de custos:**
  - Dashboard de custos
  - Breakdown por organização
  - Breakdown por funcionalidade
  - Comparação de organizações
  - Gráfico de custos diários
  - Alertas de custos
  - Configuração de limites
- **Gerenciamento de planos:**
  - Criação de planos
  - Edição de planos
  - Exclusão de planos
  - Atribuição de features
  - Limites por plano
- **Gerenciamento de limites** por organização
- **Permissões** por organização
- **Configuração de assistente** IA
- **Configuração de custos** na nuvem

---

## 9. ⚙️ CONFIGURAÇÕES

### 9.1 Instâncias Evolution (WhatsApp)
- **Criação de instâncias**
- **Edição de instâncias**
- **Exclusão de instâncias**
- **Configuração de webhook**
- **Ativação/desativação** de webhook
- **Teste de conexão**
- **Status da conexão**
- **Detalhes da instância**
- **Gerenciamento de grupos** de instâncias
- **Validação de números** WhatsApp
- **Diagnóstico de API**
- **Logs de Evolution**
- **Scanner de status**
- **Painel de status**
- **Dashboard de saúde**
- **Alertas de desconexão**

### 9.2 Chatwoot
- **Configuração de conta** Chatwoot
- **Configuração de API** key
- **Teste de conexão**
- **Status da conexão**
- **Configuração de webhook**

### 9.3 Templates e Mensagens
- **Gerenciamento de templates** de mensagens
- **Templates de campanhas** de broadcast
- **Templates de follow-up**

### 9.4 Produtos
- **Gerenciamento de produtos**
- **Criação de produtos**
- **Edição de produtos**
- **Exclusão de produtos**

### 9.5 Onboarding de Integrações
- **Guia de integração** passo a passo
- **Configuração inicial** de integrações

---

## 10. 🎯 VENDAS E PERFORMANCE

### 10.1 Dashboard de Vendedor
- **Performance individual**
- **Métricas pessoais:**
  - Leads convertidos
  - Ticket médio
  - Taxa de conversão
  - Tempo médio no funil
- **Atividades recentes**
- **Leads atribuídos**

### 10.2 Relatórios de Performance
- **Performance por vendedor**
- **Ranking de vendedores**
- **Métricas comparativas**
- **Gráficos de performance**

### 10.3 Metas e Comissões
- **Gerenciamento de metas** por vendedor
- **Cálculo de comissões**
- **Dashboard de performance**
- **Alertas de meta** próxima

### 10.4 Pós-Venda
- **Funil de pós-venda** separado
- **Etapas de pós-venda** personalizáveis
- **Transferência de leads** para pós-venda
- **Gestão de leads** pós-venda
- **Kanban de pós-venda**

---

## 11. 📝 FORMULÁRIOS

### 11.1 Form Builder
- **Editor visual** de formulários
- **Criação de formulários** personalizados
- **Campos disponíveis:**
  - Texto
  - Email
  - Telefone
  - Data
  - Seleção
  - Textarea
- **Preview** de formulários
- **Geração de código** de embed
- **Publicação** de formulários

---

## 12. 🔍 BUSCA E FILTROS

### 12.1 Busca Avançada
- **Busca global** inteligente
- **Busca por múltiplos campos**
- **Filtros salvos** para reutilização
- **Gerenciamento de filtros** salvos

### 12.2 Filtros Inteligentes
- **Filtros combinados**
- **Filtros por data** (range)
- **Filtros por tags** múltiplas
- **Filtros por etapa** múltiplas
- **Filtros por origem**
- **Filtros por instância**

---

## 13. 🔔 NOTIFICAÇÕES E ALERTAS

### 13.1 Notificações
- **Notificações no sistema**
- **Alertas de desconexão** de instâncias
- **Notificações de leads** que precisam atenção
- **Notificações de mensagens** não lidas
- **Central de notificações**

### 13.2 Alertas
- **Alertas de custos** (Super Admin)
- **Alertas de saúde** de instâncias
- **Alertas de erros** em workflows

---

## 14. 🔄 SINCRONIZAÇÃO E STATUS

### 14.1 Sincronização Automática
- **Sincronização periódica** (a cada 5 minutos)
- **Health check** de instâncias (a cada 30 segundos)
- **Indicadores de status** de sincronização
- **Última sincronização** e próxima sincronização
- **Status em tempo real** (Realtime)

### 14.2 Status de Instâncias
- **Status de conexão** em tempo real
- **Health dashboard** de instâncias
- **Métricas de saúde**
- **Alertas de desconexão**

---

## 15. 🛠️ FERRAMENTAS E UTILITÁRIOS

### 15.1 Diagnósticos
- **Diagnósticos de RLS** (Row Level Security)
- **Diagnóstico de API** Evolution
- **Logs de sistema**
- **Ferramentas de debug**

### 15.2 Validações
- **Validação de números** WhatsApp
- **Validação de contatos** antes de broadcast
- **Validação de filtros** em consultas

### 15.3 Exportação e Importação
- **Exportação de leads** (CSV, Excel)
- **Importação de contatos** (CSV)
- **Exportação de relatórios** (PDF, Excel, CSV)
- **Exportação de consultas** Bubble (CSV, JSON)

### 15.4 Histórico e Logs
- **Histórico de atividades** de leads
- **Histórico de conversas**
- **Histórico de execuções** de workflows
- **Logs de webhooks**
- **Logs de Evolution**
- **Histórico de consultas** Bubble

---

## 16. 🎨 INTERFACE E UX

### 16.1 Visualizações
- **Modo Kanban**
- **Modo Lista**
- **Modo Calendário**
- **Modo Grid** (cards)
- **Alternância** entre modos
- **Preferências salvas** por usuário

### 16.2 Layout Responsivo
- **Design responsivo** para mobile
- **Menu lateral** colapsável
- **Navegação otimizada** para mobile

### 16.3 Componentes UI
- **Componentes reutilizáveis** (shadcn/ui)
- **Toasts** para feedback
- **Modais** e diálogos
- **Tabelas** interativas
- **Gráficos** (Chart.js)
- **Formulários** validados

---

## 17. 🔐 SEGURANÇA E AUTENTICAÇÃO

### 17.1 Autenticação
- **Login** com email/senha
- **Logout**
- **Proteção de rotas** (AuthGuard)
- **Sessão persistente**

### 17.2 Segurança
- **Multi-tenancy** (isolamento por organização)
- **RLS policies** (Row Level Security)
- **Criptografia** de dados sensíveis
- **Proteção de API keys**
- **Auditoria** de ações

---

## 18. 📱 RECURSOS ADICIONAIS

### 18.1 LIDs (Lista de IDs)
- **Lista de contatos** LID
- **Conversão de LID** para lead completo
- **Gerenciamento** de contatos LID

### 18.2 Atividades
- **Histórico completo** de atividades
- **Rastreamento** de ações
- **Timeline** de interações

### 18.3 Listas de Contatos
- **Criação de listas** personalizadas
- **Gerenciamento de listas**
- **Adição de leads** a listas
- **Remoção de leads** de listas
- **Uso em workflows** e broadcast

---

## 📊 RESUMO ESTATÍSTICO

### Total de Funcionalidades Principais: **18 categorias**
### Total de Sub-funcionalidades: **200+ recursos**

### Principais Módulos:
1. ✅ CRM e Gestão de Leads (30+ funcionalidades)
2. ✅ Comunicação e Mensagens (40+ funcionalidades)
3. ✅ Automações e Workflows (25+ funcionalidades)
4. ✅ Integrações (15+ integrações)
5. ✅ Relatórios e Analytics (15+ tipos)
6. ✅ Agentes de IA (20+ recursos)
7. ✅ Configurações (30+ opções)
8. ✅ Gestão de Usuários (15+ recursos)
9. ✅ Vendas e Performance (10+ recursos)
10. ✅ Ferramentas e Utilitários (20+ ferramentas)

---

## 🎯 DESTAQUES DO SISTEMA

### ✨ Funcionalidades Únicas:
- **Automações visuais** com editor drag-and-drop
- **Agentes de IA** integrados com OpenAI e Evolution
- **Multi-tenancy** completo com isolamento de dados
- **Integração unificada** de múltiplas plataformas (Evolution, Chatwoot)
- **Sistema de aprovação** de workflows
- **Geração de boletos** automática via Asaas
- **Assistente IA** com reconhecimento de voz
- **Form builder** visual
- **Dashboard de custos** para Super Admin
- **Sistema de planos** e limites por organização

---

**Última atualização:** Janeiro 2025  
**Versão do Sistema:** 1.0.0


