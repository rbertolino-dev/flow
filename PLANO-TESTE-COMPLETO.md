# 📋 PLANO DE TESTE COMPLETO - Sistema CRM AgilizeFLOW

**Data de Criação:** Janeiro 2025  
**Versão do Sistema:** 1.0.0  
**Objetivo:** Teste manual completo de todas as funcionalidades do sistema para identificar erros de uso, bugs e problemas de UX

---

## 📌 INSTRUÇÕES GERAIS

### Antes de Começar:
1. ✅ Fazer login com usuário de teste
2. ✅ Verificar se organização está selecionada
3. ✅ Verificar permissões do usuário (admin, usuário, etc.)
4. ✅ Ter dados de teste prontos (leads, contatos, etc.)

### Durante os Testes:
- ✅ Anotar TODOS os erros encontrados
- ✅ Tirar screenshots de problemas
- ✅ Testar em diferentes navegadores (Chrome, Firefox, Edge)
- ✅ Testar em mobile e desktop
- ✅ Verificar mensagens de erro e validações
- ✅ Testar casos extremos (valores muito grandes, caracteres especiais, etc.)

### Critérios de Sucesso:
- ✅ Funcionalidade executa sem erros
- ✅ Feedback visual adequado (toasts, loading, etc.)
- ✅ Dados são salvos corretamente
- ✅ Validações funcionam
- ✅ Interface responsiva

---

## 🎯 MÓDULO 1: AUTENTICAÇÃO E ACESSO

### 1.1 Login
**Rota:** `/login`

#### Ações para Testar:
- [ ] **Login válido:**
  - [ ] Preencher email e senha corretos
  - [ ] Clicar em "Entrar"
  - [ ] Verificar redirecionamento para dashboard
  - [ ] Verificar se sessão persiste após refresh

- [ ] **Login inválido:**
  - [ ] Tentar login com email incorreto
  - [ ] Tentar login com senha incorreta
  - [ ] Tentar login com campos vazios
  - [ ] Verificar mensagens de erro apropriadas

- [ ] **Recuperação de senha:**
  - [ ] Clicar em "Esqueci minha senha"
  - [ ] Preencher email
  - [ ] Verificar se email de recuperação é enviado

- [ ] **Validações:**
  - [ ] Testar email inválido (sem @, sem domínio)
  - [ ] Testar senha muito curta
  - [ ] Verificar feedback visual de campos inválidos

#### Erros Comuns a Verificar:
- ❌ Mensagens de erro genéricas
- ❌ Redirecionamento incorreto após login
- ❌ Sessão não persiste
- ❌ Campos não validam em tempo real

---

### 1.2 Cadastro (Se disponível)
**Rota:** `/cadastro`

#### Ações para Testar:
- [ ] **Cadastro válido:**
  - [ ] Preencher todos os campos obrigatórios
  - [ ] Verificar validação de email único
  - [ ] Verificar confirmação de senha
  - [ ] Submeter formulário
  - [ ] Verificar criação de conta

- [ ] **Validações:**
  - [ ] Campos obrigatórios
  - [ ] Formato de email
  - [ ] Força da senha
  - [ ] Confirmação de senha

---

### 1.3 Onboarding
**Rota:** `/onboarding`

#### Ações para Testar:
- [ ] **Fluxo de onboarding:**
  - [ ] Verificar se aparece para novos usuários
  - [ ] Navegar por todas as etapas
  - [ ] Preencher informações iniciais
  - [ ] Verificar se dados são salvos
  - [ ] Verificar se pode pular etapas

---

## 🏢 MÓDULO 2: CRM E GESTÃO DE LEADS

### 2.1 Funil de Vendas (Kanban)
**Rota:** `/` (view: kanban)

#### Ações para Testar:

- [ ] **Visualização Kanban:**
  - [ ] Verificar se colunas aparecem (etapas do funil)
  - [ ] Verificar se cards de leads aparecem nas colunas corretas
  - [ ] Verificar cores das etapas
  - [ ] Verificar contadores de leads por etapa
  - [ ] Testar scroll horizontal se houver muitas etapas

- [ ] **Drag and Drop:**
  - [ ] Arrastar lead de uma etapa para outra
  - [ ] Verificar se lead move corretamente
  - [ ] Verificar se dados são salvos automaticamente
  - [ ] Testar arrastar para etapa inválida
  - [ ] Testar com múltiplos leads selecionados

- [ ] **Criação de Lead:**
  - [ ] Clicar em "Novo Contato"
  - [ ] Preencher formulário completo:
    - [ ] Nome (obrigatório)
    - [ ] Telefone (obrigatório, validar formato)
    - [ ] Email (opcional, validar formato)
    - [ ] Empresa (opcional)
    - [ ] Valor do negócio
    - [ ] Etapa inicial
    - [ ] Tags
    - [ ] Observações
  - [ ] Salvar lead
  - [ ] Verificar se aparece no Kanban
  - [ ] Verificar se aparece na etapa correta

- [ ] **Edição de Lead:**
  - [ ] Clicar em card de lead
  - [ ] Abrir modal/detalhes
  - [ ] Editar informações
  - [ ] Salvar alterações
  - [ ] Verificar se atualiza no Kanban
  - [ ] Testar edição inline (se disponível)

- [ ] **Filtros:**
  - [ ] Filtrar por etapa
  - [ ] Filtrar por tags (múltiplas)
  - [ ] Filtrar por data de criação
  - [ ] Filtrar por data de retorno
  - [ ] Filtrar por instância de origem
  - [ ] Filtrar por status na fila
  - [ ] Combinar múltiplos filtros
  - [ ] Limpar filtros
  - [ ] Verificar se contadores atualizam

- [ ] **Busca:**
  - [ ] Buscar por nome
  - [ ] Buscar por telefone
  - [ ] Buscar por email
  - [ ] Buscar por empresa
  - [ ] Testar busca com caracteres especiais
  - [ ] Verificar resultados em tempo real
  - [ ] Limpar busca

- [ ] **Seleção Múltipla:**
  - [ ] Selecionar múltiplos leads
  - [ ] Verificar barra de ações em massa
  - [ ] Mover múltiplos leads para outra etapa
  - [ ] Adicionar tag a múltiplos leads
  - [ ] Remover tag de múltiplos leads
  - [ ] Exportar leads selecionados
  - [ ] Desmarcar seleção

- [ ] **Importação:**
  - [ ] Clicar em "Importar"
  - [ ] Selecionar arquivo CSV
  - [ ] Verificar preview dos dados
  - [ ] Mapear colunas
  - [ ] Confirmar importação
  - [ ] Verificar se leads aparecem no Kanban
  - [ ] Testar CSV com erros (validações)

- [ ] **Exportação:**
  - [ ] Aplicar filtros
  - [ ] Clicar em exportar
  - [ ] Verificar se arquivo é gerado
  - [ ] Verificar se dados estão corretos
  - [ ] Testar exportação de todos os leads

- [ ] **Preview Tooltip:**
  - [ ] Passar mouse sobre lead
  - [ ] Verificar se tooltip aparece
  - [ ] Verificar informações exibidas
  - [ ] Verificar se fecha ao sair

#### Erros Comuns a Verificar:
- ❌ Leads não aparecem após criação
- ❌ Drag and drop não salva
- ❌ Filtros não funcionam corretamente
- ❌ Busca muito lenta
- ❌ Cards não atualizam em tempo real
- ❌ Validações de telefone/email falham

---

### 2.2 Visualização em Lista
**Rota:** `/` (view: lista)

#### Ações para Testar:
- [ ] **Alternar para Lista:**
  - [ ] Clicar em botão de visualização lista
  - [ ] Verificar se tabela aparece
  - [ ] Verificar colunas exibidas

- [ ] **Funcionalidades da Lista:**
  - [ ] Ordenar por coluna (nome, data, valor)
  - [ ] Verificar ordenação ascendente/descendente
  - [ ] Selecionar múltiplas linhas
  - [ ] Editar lead diretamente na linha
  - [ ] Clicar em lead para ver detalhes
  - [ ] Paginação (se houver)
  - [ ] Filtros (mesmos do Kanban)

- [ ] **Ações Rápidas:**
  - [ ] Ligar (abre discador)
  - [ ] WhatsApp (abre conversa)
  - [ ] Email (abre cliente de email)
  - [ ] Copiar telefone

#### Erros Comuns a Verificar:
- ❌ Ordenação não funciona
- ❌ Edição inline não salva
- ❌ Paginação quebra

---

### 2.3 Visualização em Calendário
**Rota:** `/` (view: calendar) ou `/calendar`

#### Ações para Testar:
- [ ] **Alternar para Calendário:**
  - [ ] Clicar em visualização calendário
  - [ ] Verificar se calendário aparece

- [ ] **Navegação:**
  - [ ] Mudar para visualização mensal
  - [ ] Mudar para visualização semanal
  - [ ] Mudar para visualização diária
  - [ ] Navegar entre meses/semanas

- [ ] **Eventos:**
  - [ ] Verificar se leads com retorno aparecem
  - [ ] Verificar se eventos aparecem nas datas corretas
  - [ ] Clicar em evento para ver detalhes
  - [ ] Criar novo evento
  - [ ] Editar evento existente
  - [ ] Excluir evento

#### Erros Comuns a Verificar:
- ❌ Eventos não aparecem
- ❌ Datas incorretas
- ❌ Navegação quebra

---

### 2.4 Lista Telefônica
**Rota:** `/lista-telefonica`

#### Ações para Testar:
- [ ] **Visualização:**
  - [ ] Alternar entre Grid e Lista
  - [ ] Verificar se contatos aparecem
  - [ ] Verificar informações exibidas

- [ ] **Busca:**
  - [ ] Buscar por nome
  - [ ] Buscar por telefone
  - [ ] Buscar por email
  - [ ] Buscar por empresa

- [ ] **Filtros:**
  - [ ] Filtrar por etapa
  - [ ] Filtrar por tags
  - [ ] Filtrar por origem

- [ ] **Ordenação:**
  - [ ] Ordenar por nome
  - [ ] Ordenar por data de criação
  - [ ] Ordenar por último contato
  - [ ] Ordenar por valor

- [ ] **Agrupamento:**
  - [ ] Agrupar por etapa
  - [ ] Agrupar por origem
  - [ ] Agrupar por empresa
  - [ ] Agrupar por tag
  - [ ] Colapsar/expandir grupos

- [ ] **Ações:**
  - [ ] Selecionar múltiplos contatos
  - [ ] Exportar para CSV
  - [ ] Criar lista personalizada
  - [ ] Adicionar a lista existente

#### Erros Comuns a Verificar:
- ❌ Busca não funciona
- ❌ Agrupamento quebra
- ❌ Exportação com dados incorretos

---

### 2.5 Leads que Precisam Atenção
**Rota:** `/` (view: attention)

#### Ações para Testar:
- [ ] **Identificação:**
  - [ ] Verificar se leads com retorno vencido aparecem
  - [ ] Verificar se leads sem contato aparecem
  - [ ] Verificar priorização visual

- [ ] **Ações:**
  - [ ] Clicar em lead para ver detalhes
  - [ ] Agendar retorno
  - [ ] Enviar mensagem
  - [ ] Marcar como resolvido

#### Erros Comuns a Verificar:
- ❌ Leads não são identificados corretamente
- ❌ Priorização incorreta

---

### 2.6 Gestão de Etapas do Funil
**Rota:** Configurações do Kanban

#### Ações para Testar:
- [ ] **Criar Etapa:**
  - [ ] Abrir gerenciador de etapas
  - [ ] Criar nova etapa
  - [ ] Definir nome
  - [ ] Escolher cor
  - [ ] Definir ordem
  - [ ] Salvar
  - [ ] Verificar se aparece no Kanban

- [ ] **Editar Etapa:**
  - [ ] Editar nome
  - [ ] Mudar cor
  - [ ] Reordenar etapas
  - [ ] Salvar alterações

- [ ] **Excluir Etapa:**
  - [ ] Excluir etapa vazia
  - [ ] Tentar excluir etapa com leads (deve avisar)
  - [ ] Mover leads antes de excluir
  - [ ] Confirmar exclusão

- [ ] **Limpeza:**
  - [ ] Verificar etapas duplicadas
  - [ ] Limpar etapas duplicadas

#### Erros Comuns a Verificar:
- ❌ Etapa não aparece após criar
- ❌ Ordem não salva
- ❌ Exclusão quebra funil

---

### 2.7 Gestão de Tags
**Rota:** Configurações do Kanban

#### Ações para Testar:
- [ ] **Criar Tag:**
  - [ ] Abrir gerenciador de tags
  - [ ] Criar nova tag
  - [ ] Definir nome
  - [ ] Escolher cor
  - [ ] Salvar

- [ ] **Editar Tag:**
  - [ ] Editar nome
  - [ ] Mudar cor
  - [ ] Salvar

- [ ] **Excluir Tag:**
  - [ ] Excluir tag
  - [ ] Verificar se é removida de leads

- [ ] **Aplicar Tags:**
  - [ ] Adicionar tag a lead
  - [ ] Remover tag de lead
  - [ ] Adicionar múltiplas tags
  - [ ] Filtrar por tag

#### Erros Comuns a Verificar:
- ❌ Tag não aparece após criar
- ❌ Tag não é aplicada corretamente
- ❌ Filtro por tag não funciona

---

## 📞 MÓDULO 3: FILA DE LIGAÇÕES

### 3.1 Fila de Ligações
**Rota:** `/` (view: calls)

#### Ações para Testar:
- [ ] **Visualização:**
  - [ ] Verificar se fila aparece
  - [ ] Verificar se contatos agendados aparecem
  - [ ] Verificar informações exibidas (nome, telefone, data/hora)

- [ ] **Agendamento:**
  - [ ] Agendar nova ligação
  - [ ] Selecionar contato
  - [ ] Definir data e hora
  - [ ] Adicionar observações
  - [ ] Atribuir a usuário específico
  - [ ] Adicionar tags
  - [ ] Salvar agendamento
  - [ ] Verificar se aparece na fila

- [ ] **Gerenciamento:**
  - [ ] Marcar ligação como concluída
  - [ ] Reagendar ligação
  - [ ] Adicionar notas após ligação
  - [ ] Excluir agendamento
  - [ ] Atribuir a outro usuário

- [ ] **Filtros:**
  - [ ] Filtrar por data
  - [ ] Filtrar por status (pendente, concluída)
  - [ ] Filtrar por usuário
  - [ ] Filtrar por tags

- [ ] **Estatísticas:**
  - [ ] Verificar contadores (total, pendentes, concluídas)
  - [ ] Verificar se atualizam em tempo real

- [ ] **Histórico:**
  - [ ] Ver histórico de ligações realizadas
  - [ ] Ver notas de ligações anteriores

#### Erros Comuns a Verificar:
- ❌ Agendamento não aparece
- ❌ Data/hora incorretas
- ❌ Notificações não funcionam
- ❌ Filtros não aplicam corretamente

---

## 📅 MÓDULO 4: AGENDAMENTO (CALENDÁRIO)

### 4.1 Calendário
**Rota:** `/calendar`

#### Ações para Testar:
- [ ] **Visualização:**
  - [ ] Verificar visualização mensal
  - [ ] Verificar visualização semanal
  - [ ] Verificar visualização diária
  - [ ] Navegar entre períodos

- [ ] **Eventos:**
  - [ ] Criar novo evento
  - [ ] Preencher informações (título, data, hora, descrição)
  - [ ] Salvar evento
  - [ ] Verificar se aparece no calendário
  - [ ] Editar evento existente
  - [ ] Excluir evento
  - [ ] Marcar evento como concluído

- [ ] **Integração Google Calendar:**
  - [ ] Conectar conta Google
  - [ ] Autorizar acesso
  - [ ] Sincronizar eventos
  - [ ] Verificar se eventos do Google aparecem
  - [ ] Criar evento no Google via sistema
  - [ ] Editar evento do Google
  - [ ] Sincronização manual
  - [ ] Sincronização automática

- [ ] **Agendamento de Mensagens:**
  - [ ] Agendar mensagem via calendário
  - [ ] Verificar se aparece como evento
  - [ ] Verificar se mensagem é enviada no horário

- [ ] **Filtros:**
  - [ ] Filtrar por tipo de evento
  - [ ] Filtrar por usuário

#### Erros Comuns a Verificar:
- ❌ Eventos não aparecem
- ❌ Sincronização Google não funciona
- ❌ Datas/horas incorretas
- ❌ Criação de evento falha

---

## 💬 MÓDULO 5: COMUNICAÇÃO E MENSAGENS

### 5.1 WhatsApp (Evolution API)
**Rota:** `/settings` (seção Evolution)

#### Ações para Testar:
- [ ] **Configuração de Instância:**
  - [ ] Criar nova instância
  - [ ] Preencher nome
  - [ ] Configurar webhook
  - [ ] Ativar/desativar webhook
  - [ ] Testar conexão
  - [ ] Verificar status da conexão
  - [ ] Editar instância
  - [ ] Excluir instância

- [ ] **QR Code e Conexão:**
  - [ ] Gerar QR Code
  - [ ] Escanear QR Code
  - [ ] Verificar se conecta
  - [ ] Reconectar instância desconectada
  - [ ] Verificar alertas de desconexão

- [ ] **Envio de Mensagens:**
  - [ ] Enviar mensagem de texto
  - [ ] Enviar imagem
  - [ ] Enviar vídeo
  - [ ] Enviar documento
  - [ ] Enviar áudio
  - [ ] Verificar status (enviada, entregue, lida)
  - [ ] Verificar se aparece no histórico

- [ ] **Recebimento de Mensagens:**
  - [ ] Receber mensagem de texto
  - [ ] Receber mídia
  - [ ] Verificar se aparece em tempo real
  - [ ] Responder mensagem

- [ ] **Status (Stories):**
  - [ ] Fazer upload de status (imagem/vídeo)
  - [ ] Agendar status para publicação
  - [ ] Cancelar status agendado
  - [ ] Republicar status
  - [ ] Verificar publicação

- [ ] **Validação:**
  - [ ] Validar número WhatsApp
  - [ ] Verificar se número existe
  - [ ] Verificar formato correto

- [ ] **Diagnóstico:**
  - [ ] Ver logs de Evolution
  - [ ] Ver diagnóstico de API
  - [ ] Ver scanner de status
  - [ ] Ver painel de status
  - [ ] Ver dashboard de saúde

#### Erros Comuns a Verificar:
- ❌ Instância não conecta
- ❌ QR Code não gera
- ❌ Mensagens não enviam
- ❌ Mensagens não recebem em tempo real
- ❌ Status não publica
- ❌ Webhook não funciona

---

### 5.2 Disparo em Massa (Broadcast)
**Rota:** `/broadcast`

#### Ações para Testar:
- [ ] **Criação de Campanha:**
  - [ ] Criar nova campanha
  - [ ] Definir nome
  - [ ] Selecionar destinatários:
    - [ ] Por lista de contatos
    - [ ] Por filtros de leads
    - [ ] Importar CSV
  - [ ] Criar template de mensagem
  - [ ] Adicionar variáveis dinâmicas
  - [ ] Criar variações de mensagem
  - [ ] Adicionar anexos (imagens, documentos)
  - [ ] Agendar envio
  - [ ] Definir janelas de tempo
  - [ ] Configurar delays entre mensagens
  - [ ] Salvar campanha

- [ ] **Gerenciamento:**
  - [ ] Pausar campanha
  - [ ] Retomar campanha
  - [ ] Cancelar campanha
  - [ ] Editar campanha
  - [ ] Duplicar campanha

- [ ] **Validação:**
  - [ ] Validar contatos antes do envio
  - [ ] Verificar números válidos
  - [ ] Verificar conflitos de janelas

- [ ] **Relatórios:**
  - [ ] Ver status de envio por mensagem
  - [ ] Ver taxa de entrega
  - [ ] Ver taxa de leitura
  - [ ] Ver taxa de erro
  - [ ] Exportar relatório (CSV, PDF)
  - [ ] Ver estatísticas em tempo real

- [ ] **Templates:**
  - [ ] Criar template reutilizável
  - [ ] Usar template em campanha
  - [ ] Editar template
  - [ ] Excluir template

#### Erros Comuns a Verificar:
- ❌ Campanha não envia
- ❌ Mensagens duplicadas
- ❌ Janelas de tempo não respeitadas
- ❌ Relatórios incorretos
- ❌ Validação falha

---

### 5.3 Fluxo Automatizado (Workflows)
**Rota:** `/workflows`

#### Ações para Testar:
- [ ] **Criação de Workflow:**
  - [ ] Criar novo workflow
  - [ ] Selecionar tipo (cobrança, lembrete, follow-up, boas-vindas)
  - [ ] Definir nome
  - [ ] Selecionar lista de destinatários
  - [ ] Criar template de mensagem
  - [ ] Adicionar anexos:
    - [ ] Anexo fixo
    - [ ] Anexo mensal (por mês)
    - [ ] Anexo por contato
  - [ ] Agendar execuções
  - [ ] Configurar condições
  - [ ] Salvar workflow

- [ ] **Aprovação:**
  - [ ] Enviar workflow para aprovação
  - [ ] Verificar se aparece na fila de aprovação
  - [ ] Aprovar workflow
  - [ ] Rejeitar workflow
  - [ ] Adicionar comentários

- [ ] **Ativação:**
  - [ ] Ativar workflow
  - [ ] Desativar workflow
  - [ ] Verificar status

- [ ] **Execução:**
  - [ ] Verificar execuções automáticas
  - [ ] Executar manualmente
  - [ ] Ver histórico de execuções
  - [ ] Ver logs de erros

- [ ] **Estatísticas:**
  - [ ] Ver dashboard de performance
  - [ ] Ver estatísticas de execução
  - [ ] Ver taxa de sucesso

- [ ] **Gerenciamento:**
  - [ ] Editar workflow
  - [ ] Duplicar workflow
  - [ ] Excluir workflow
  - [ ] Agrupar workflows
  - [ ] Filtrar por status, tipo, lista
  - [ ] Buscar workflows

#### Erros Comuns a Verificar:
- ❌ Workflow não executa
- ❌ Anexos não enviam
- ❌ Aprovação não funciona
- ❌ Logs de erro não aparecem
- ❌ Estatísticas incorretas

---

### 5.4 Automações Visuais (Flow Editor)
**Rota:** `/automation-flows`

#### Ações para Testar:
- [ ] **Criação de Fluxo:**
  - [ ] Criar novo fluxo
  - [ ] Arrastar blocos no canvas:
    - [ ] Triggers (gatilhos)
    - [ ] Ações
    - [ ] Condições
    - [ ] Esperas (delays)
  - [ ] Conectar blocos
  - [ ] Configurar cada bloco
  - [ ] Salvar fluxo

- [ ] **Configuração de Triggers:**
  - [ ] Por evento (novo lead, mudança de etapa)
  - [ ] Por condição
  - [ ] Por agendamento

- [ ] **Configuração de Ações:**
  - [ ] Enviar mensagem
  - [ ] Atualizar lead
  - [ ] Adicionar tag
  - [ ] Mover para etapa
  - [ ] Criar tarefa

- [ ] **Configuração de Condições:**
  - [ ] IF/ELSE
  - [ ] Múltiplas condições

- [ ] **Configuração de Esperas:**
  - [ ] Delay fixo
  - [ ] Delay variável
  - [ ] Espera até data/hora

- [ ] **Teste:**
  - [ ] Ativar modo de teste
  - [ ] Testar fluxo
  - [ ] Verificar execução
  - [ ] Ver logs de teste

- [ ] **Ativação:**
  - [ ] Ativar fluxo
  - [ ] Desativar fluxo
  - [ ] Verificar execuções reais

- [ ] **Métricas:**
  - [ ] Ver histórico de execuções
  - [ ] Ver métricas de execução
  - [ ] Ver performance

- [ ] **Templates:**
  - [ ] Usar template pronto
  - [ ] Salvar como template
  - [ ] Compartilhar template

#### Erros Comuns a Verificar:
- ❌ Blocos não conectam
- ❌ Fluxo não executa
- ❌ Condições não funcionam
- ❌ Delays não respeitados
- ❌ Teste não funciona

---

## 🤖 MÓDULO 6: AGENTES DE IA

### 6.1 Gerenciamento de Agentes
**Rota:** `/agents`

#### Ações para Testar:
- [ ] **Criação de Agente:**
  - [ ] Criar novo agente
  - [ ] Configurar nome
  - [ ] Configurar instruções personalizadas
  - [ ] Adicionar guardrails (regras obrigatórias)
  - [ ] Adicionar exemplos few-shot
  - [ ] Selecionar modelo OpenAI (GPT-4, GPT-3.5)
  - [ ] Configurar temperatura
  - [ ] Ativar modo de teste
  - [ ] Configurar fallback para operador humano
  - [ ] Salvar agente

- [ ] **Sincronização:**
  - [ ] Sincronizar com Evolution (WhatsApp)
  - [ ] Sincronizar com OpenAI
  - [ ] Verificar se agente é criado na OpenAI
  - [ ] Verificar se sincroniza corretamente

- [ ] **Configuração de Triggers:**
  - [ ] Por palavra-chave
  - [ ] Por operador (contém, igual, etc.)
  - [ ] Por valor específico

- [ ] **Configurações Avançadas:**
  - [ ] Escutar mensagens próprias
  - [ ] Parar bot de mensagens próprias
  - [ ] Manter conversa aberta
  - [ ] Tempo de debounce
  - [ ] JIDs ignorados
  - [ ] Formato de resposta (text/json)
  - [ ] Divisão de mensagens
  - [ ] URL de função customizada

- [ ] **Upload de Arquivos:**
  - [ ] Upload de arquivos de conhecimento
  - [ ] Verificar se arquivos são processados

- [ ] **Configuração de Expiração:**
  - [ ] Definir tempo de conversa
  - [ ] Palavra-chave de saída (#SAIR)
  - [ ] Delay entre mensagens
  - [ ] Mensagem para desconhecido

- [ ] **Status:**
  - [ ] Ativar agente
  - [ ] Pausar agente
  - [ ] Arquivar agente
  - [ ] Verificar status

- [ ] **Estatísticas:**
  - [ ] Ver estatísticas de agentes
  - [ ] Ver conversas atendidas
  - [ ] Ver taxa de sucesso

- [ ] **Configuração de API:**
  - [ ] Configurar API key OpenAI
  - [ ] Testar conexão

#### Erros Comuns a Verificar:
- ❌ Agente não cria na OpenAI
- ❌ Sincronização falha
- ❌ Triggers não funcionam
- ❌ Agente não responde
- ❌ Fallback não funciona

---

### 6.2 Assistente IA (DeepSeek)
**Rota:** `/assistant`

#### Ações para Testar:
- [ ] **Interface de Chat:**
  - [ ] Abrir assistente
  - [ ] Verificar se chat aparece
  - [ ] Enviar mensagem
  - [ ] Verificar resposta
  - [ ] Verificar histórico de conversas

- [ ] **Widget Flutuante:**
  - [ ] Verificar se widget aparece
  - [ ] Minimizar/maximizar widget
  - [ ] Enviar mensagem pelo widget
  - [ ] Verificar resposta

- [ ] **Reconhecimento de Voz:**
  - [ ] Ativar reconhecimento de voz
  - [ ] Falar comando
  - [ ] Verificar se transcreve corretamente
  - [ ] Verificar se executa comando

- [ ] **Comandos em Linguagem Natural:**
  - [ ] "Criar lead João Silva, telefone 11999999999"
  - [ ] "Buscar lead João"
  - [ ] "Atualizar lead João, adicionar email joao@email.com"
  - [ ] "Agendar ligação para João amanhã às 14h"
  - [ ] "Enviar mensagem WhatsApp para João: Olá!"
  - [ ] "Listar etapas do funil"
  - [ ] "Listar tags"
  - [ ] "Consultar estatísticas de leads"
  - [ ] "Gerar relatório de vendas"

- [ ] **Ações Rápidas:**
  - [ ] Usar ações pré-configuradas
  - [ ] Verificar se executa corretamente

- [ ] **Histórico:**
  - [ ] Ver histórico de conversas
  - [ ] Limpar conversa
  - [ ] Ver conversas anteriores

#### Erros Comuns a Verificar:
- ❌ Assistente não responde
- ❌ Comandos não executam
- ❌ Reconhecimento de voz falha
- ❌ Histórico não salva

---

## 📝 MÓDULO 7: FORMULÁRIOS

### 7.1 Form Builder
**Rota:** `/form-builder`

#### Ações para Testar:
- [ ] **Criação de Formulário:**
  - [ ] Criar novo formulário
  - [ ] Definir nome
  - [ ] Adicionar campos:
    - [ ] Texto
    - [ ] Email
    - [ ] Telefone
    - [ ] Data
    - [ ] Seleção
    - [ ] Textarea
  - [ ] Configurar campos (obrigatório, placeholder, validação)
  - [ ] Reordenar campos (drag and drop)
  - [ ] Salvar formulário

- [ ] **Preview:**
  - [ ] Ver preview do formulário
  - [ ] Testar preenchimento
  - [ ] Verificar validações

- [ ] **Publicação:**
  - [ ] Gerar código de embed
  - [ ] Copiar código
  - [ ] Publicar formulário
  - [ ] Verificar URL pública

- [ ] **Teste de Submissão:**
  - [ ] Preencher formulário público
  - [ ] Submeter
  - [ ] Verificar se lead é criado
  - [ ] Verificar se dados estão corretos

- [ ] **Gerenciamento:**
  - [ ] Editar formulário
  - [ ] Duplicar formulário
  - [ ] Excluir formulário
  - [ ] Ver estatísticas de submissões

#### Erros Comuns a Verificar:
- ❌ Campos não salvam
- ❌ Preview não funciona
- ❌ Código embed não funciona
- ❌ Submissão não cria lead
- ❌ Validações não funcionam

---

## 📄 MÓDULO 8: CONTRATOS E ORÇAMENTOS

### 8.1 Contratos
**Rota:** `/contracts`

#### Ações para Testar:
- [ ] **Criação de Contrato:**
  - [ ] Criar novo contrato
  - [ ] Preencher informações:
    - [ ] Cliente
    - [ ] Descrição
    - [ ] Valor
    - [ ] Data de início
    - [ ] Data de término
    - [ ] Termos e condições
  - [ ] Adicionar anexos
  - [ ] Salvar contrato

- [ ] **Assinatura:**
  - [ ] Enviar para assinatura
  - [ ] Verificar link de assinatura
  - [ ] Assinar contrato (como cliente)
  - [ ] Verificar status de assinatura
  - [ ] Baixar contrato assinado

- [ ] **Gerenciamento:**
  - [ ] Editar contrato
  - [ ] Excluir contrato
  - [ ] Ver histórico de alterações
  - [ ] Filtrar contratos
  - [ ] Buscar contratos

#### Erros Comuns a Verificar:
- ❌ Contrato não salva
- ❌ Assinatura não funciona
- ❌ Link de assinatura inválido
- ❌ PDF não gera

---

### 8.2 Orçamentos
**Rota:** `/budgets`

#### Ações para Testar:
- [ ] **Criação de Orçamento:**
  - [ ] Criar novo orçamento
  - [ ] Selecionar cliente
  - [ ] Adicionar produtos/serviços
  - [ ] Definir quantidades e valores
  - [ ] Aplicar descontos
  - [ ] Calcular total
  - [ ] Adicionar observações
  - [ ] Salvar orçamento

- [ ] **Geração de PDF:**
  - [ ] Gerar PDF do orçamento
  - [ ] Verificar se PDF é gerado corretamente
  - [ ] Verificar formatação
  - [ ] Baixar PDF

- [ ] **Envio:**
  - [ ] Enviar orçamento por WhatsApp
  - [ ] Enviar orçamento por email
  - [ ] Verificar se cliente recebe

- [ ] **Aprovação:**
  - [ ] Aprovar orçamento
  - [ ] Rejeitar orçamento
  - [ ] Verificar status

- [ ] **Gerenciamento:**
  - [ ] Editar orçamento
  - [ ] Duplicar orçamento
  - [ ] Excluir orçamento
  - [ ] Filtrar orçamentos
  - [ ] Buscar orçamentos

#### Erros Comuns a Verificar:
- ❌ Cálculos incorretos
- ❌ PDF não gera
- ❌ Envio falha
- ❌ Aprovação não funciona

---

## 🛍️ MÓDULO 9: PÓS-VENDA

### 9.1 Funil de Pós-Venda
**Rota:** `/post-sale`

#### Ações para Testar:
- [ ] **Visualização:**
  - [ ] Verificar se funil de pós-venda aparece
  - [ ] Verificar se é separado do funil principal
  - [ ] Verificar etapas de pós-venda

- [ ] **Transferência:**
  - [ ] Transferir lead do funil principal para pós-venda
  - [ ] Verificar se aparece no funil de pós-venda
  - [ ] Verificar se sai do funil principal

- [ ] **Gerenciamento:**
  - [ ] Mover lead entre etapas de pós-venda
  - [ ] Editar lead no pós-venda
  - [ ] Adicionar atividades
  - [ ] Agendar follow-ups

- [ ] **Etapas:**
  - [ ] Configurar etapas de pós-venda
  - [ ] Personalizar etapas
  - [ ] Definir cores

#### Erros Comuns a Verificar:
- ❌ Funil não aparece
- ❌ Transferência não funciona
- ❌ Etapas não configuram

---

## 👥 MÓDULO 10: GESTÃO DE USUÁRIOS

### 10.1 Usuários
**Rota:** `/users`

#### Ações para Testar:
- [ ] **Criação de Usuário:**
  - [ ] Criar novo usuário
  - [ ] Preencher informações (nome, email, senha)
  - [ ] Atribuir permissões
  - [ ] Atribuir role (admin, usuário)
  - [ ] Vincular a organização
  - [ ] Salvar usuário

- [ ] **Edição:**
  - [ ] Editar usuário existente
  - [ ] Alterar permissões
  - [ ] Alterar role
  - [ ] Salvar alterações

- [ ] **Exclusão:**
  - [ ] Excluir usuário
  - [ ] Confirmar exclusão
  - [ ] Verificar se é removido

- [ ] **Permissões:**
  - [ ] Ver diálogo de permissões
  - [ ] Atribuir permissões específicas
  - [ ] Verificar se permissões são aplicadas

#### Erros Comuns a Verificar:
- ❌ Usuário não cria
- ❌ Permissões não funcionam
- ❌ Role não aplica

---

### 10.2 Organizações
**Rota:** `/organization` ou seletor no menu

#### Ações para Testar:
- [ ] **Troca de Organização:**
  - [ ] Abrir seletor de organização
  - [ ] Selecionar outra organização
  - [ ] Verificar se dados mudam
  - [ ] Verificar isolamento de dados

- [ ] **Edição:**
  - [ ] Editar nome da organização
  - [ ] Salvar alterações
  - [ ] Verificar se atualiza no menu

#### Erros Comuns a Verificar:
- ❌ Troca não funciona
- ❌ Dados não isolam
- ❌ Edição não salva

---

## ⚙️ MÓDULO 11: CONFIGURAÇÕES

### 11.1 Configurações Gerais
**Rota:** `/settings`

#### Ações para Testar:
- [ ] **Perfil:**
  - [ ] Editar informações pessoais
  - [ ] Alterar senha
  - [ ] Upload de foto
  - [ ] Salvar alterações

- [ ] **Preferências:**
  - [ ] Configurar preferências de visualização
  - [ ] Configurar notificações
  - [ ] Salvar preferências

- [ ] **Integrações:**
  - [ ] Ver integrações disponíveis
  - [ ] Configurar integrações
  - [ ] Testar conexões

#### Erros Comuns a Verificar:
- ❌ Alterações não salvam
- ❌ Integrações não conectam

---

### 11.2 Configuração de Instâncias Evolution
**Rota:** `/settings` (seção Evolution)

#### Ações para Testar:
- [ ] **Criar Instância:**
  - [ ] Criar nova instância
  - [ ] Configurar nome
  - [ ] Configurar webhook
  - [ ] Salvar

- [ ] **Gerenciamento:**
  - [ ] Editar instância
  - [ ] Excluir instância
  - [ ] Ativar/desativar webhook
  - [ ] Testar conexão

- [ ] **Status:**
  - [ ] Ver status da conexão
  - [ ] Ver detalhes da instância
  - [ ] Ver logs

#### Erros Comuns a Verificar:
- ❌ Instância não cria
- ❌ Webhook não funciona
- ❌ Status incorreto

---

## 🔍 MÓDULO 12: SUPER ADMIN

### 12.1 Dashboard Super Admin
**Rota:** `/superadmin`

#### Ações para Testar:
- [ ] **Visualização:**
  - [ ] Ver todas as organizações
  - [ ] Ver estatísticas gerais
  - [ ] Ver gráficos

- [ ] **Gerenciamento de Organizações:**
  - [ ] Criar organização
  - [ ] Editar organização
  - [ ] Excluir organização
  - [ ] Ver detalhes da organização

#### Erros Comuns a Verificar:
- ❌ Organizações não aparecem
- ❌ Estatísticas incorretas

---

### 12.2 Gerenciamento de Custos
**Rota:** `/superadmin/costs`

#### Ações para Testar:
- [ ] **Dashboard de Custos:**
  - [ ] Ver custos por organização
  - [ ] Ver breakdown por funcionalidade
  - [ ] Ver comparação de organizações
  - [ ] Ver gráfico de custos diários

- [ ] **Alertas:**
  - [ ] Configurar alertas de custos
  - [ ] Verificar se alertas são enviados
  - [ ] Configurar limites

#### Erros Comuns a Verificar:
- ❌ Custos não aparecem
- ❌ Cálculos incorretos
- ❌ Alertas não funcionam

---

### 12.3 Gerenciamento de Planos
**Rota:** `/superadmin` (seção Planos)

#### Ações para Testar:
- [ ] **Criação de Plano:**
  - [ ] Criar novo plano
  - [ ] Definir nome
  - [ ] Atribuir features
  - [ ] Definir limites
  - [ ] Salvar plano

- [ ] **Gerenciamento:**
  - [ ] Editar plano
  - [ ] Excluir plano
  - [ ] Atribuir plano a organização

- [ ] **Limites:**
  - [ ] Gerenciar limites por organização
  - [ ] Verificar se limites são aplicados

#### Erros Comuns a Verificar:
- ❌ Plano não cria
- ❌ Features não atribuem
- ❌ Limites não aplicam

---

## 🔗 MÓDULO 13: INTEGRAÇÕES

### 13.1 Google Calendar
**Rota:** `/calendar` (configuração)

#### Ações para Testar:
- [ ] **Conexão:**
  - [ ] Conectar conta Google
  - [ ] Autorizar acesso
  - [ ] Verificar se conecta

- [ ] **Sincronização:**
  - [ ] Sincronizar eventos
  - [ ] Verificar se eventos aparecem
  - [ ] Criar evento no Google via sistema
  - [ ] Editar evento do Google
  - [ ] Sincronização manual
  - [ ] Sincronização automática

#### Erros Comuns a Verificar:
- ❌ Conexão falha
- ❌ Sincronização não funciona
- ❌ Eventos não aparecem

---

### 13.2 Gmail
**Rota:** `/gmail`

#### Ações para Testar:
- [ ] **Conexão:**
  - [ ] Conectar conta Gmail
  - [ ] Autorizar acesso
  - [ ] Verificar se conecta

- [ ] **Funcionalidades:**
  - [ ] Ver emails
  - [ ] Enviar email
  - [ ] Responder email
  - [ ] Sincronizar emails

#### Erros Comuns a Verificar:
- ❌ Conexão falha
- ❌ Emails não aparecem
- ❌ Envio falha

---

### 13.3 Bubble.io
**Rota:** `/bubble`

#### Ações para Testar:
- [ ] **Configuração:**
  - [ ] Configurar API Bubble
  - [ ] Testar conexão

- [ ] **Consultas:**
  - [ ] Consultar tabelas do Bubble
  - [ ] Aplicar filtros
  - [ ] Filtrar por data
  - [ ] Ver histórico de consultas

- [ ] **Exportação:**
  - [ ] Exportar para CSV
  - [ ] Exportar para JSON

- [ ] **Sincronização:**
  - [ ] Sincronizar leads com Bubble
  - [ ] Verificar se leads aparecem

#### Erros Comuns a Verificar:
- ❌ Conexão falha
- ❌ Consultas não funcionam
- ❌ Filtros não aplicam

---

### 13.4 N8n
**Rota:** `/n8n`

#### Ações para Testar:
- [ ] **Configuração:**
  - [ ] Configurar API N8n
  - [ ] Testar conexão

- [ ] **Workflows:**
  - [ ] Listar workflows N8n
  - [ ] Criar workflow
  - [ ] Ativar/desativar workflow
  - [ ] Executar workflow manualmente
  - [ ] Ver histórico de execuções

#### Erros Comuns a Verificar:
- ❌ Conexão falha
- ❌ Workflows não listam
- ❌ Execução falha

---

### 13.5 Asaas (Pagamentos)
**Rota:** `/settings` (seção Asaas)

#### Ações para Testar:
- [ ] **Configuração:**
  - [ ] Configurar API Asaas
  - [ ] Selecionar ambiente (sandbox/produção)
  - [ ] Testar conexão

- [ ] **Geração de Boletos:**
  - [ ] Gerar boleto para lead
  - [ ] Verificar se boleto é gerado
  - [ ] Baixar PDF do boleto
  - [ ] Ver código de barras
  - [ ] Ver linha digitável

- [ ] **Rastreamento:**
  - [ ] Ver histórico de boletos
  - [ ] Rastrear status do boleto
  - [ ] Ver boletos pagos

- [ ] **Integração com Workflows:**
  - [ ] Usar em workflow de cobrança
  - [ ] Verificar se gera automaticamente

#### Erros Comuns a Verificar:
- ❌ Conexão falha
- ❌ Boleto não gera
- ❌ PDF não baixa
- ❌ Status não atualiza

---

### 13.6 Google Business
**Rota:** `/google-business-posts`

#### Ações para Testar:
- [ ] **Conexão:**
  - [ ] Conectar conta Google Business
  - [ ] Autorizar acesso

- [ ] **Posts:**
  - [ ] Criar post no Google Business
  - [ ] Adicionar imagem
  - [ ] Publicar post
  - [ ] Ver posts publicados

#### Erros Comuns a Verificar:
- ❌ Conexão falha
- ❌ Post não publica

---

## 📊 MÓDULO 14: RELATÓRIOS E ANALYTICS

### 14.1 Relatórios de Vendas
**Rota:** Dashboard ou seção de relatórios

#### Ações para Testar:
- [ ] **Geração de Relatório:**
  - [ ] Selecionar período
  - [ ] Selecionar vendedor
  - [ ] Selecionar etapa
  - [ ] Gerar relatório

- [ ] **Métricas:**
  - [ ] Ver relatório por etapas
  - [ ] Ver taxa de conversão
  - [ ] Ver tempo médio no funil
  - [ ] Ver ticket médio
  - [ ] Ver gráficos interativos

- [ ] **Comparativo:**
  - [ ] Comparar com período anterior
  - [ ] Ver diferenças

- [ ] **Exportação:**
  - [ ] Exportar em PDF
  - [ ] Exportar em Excel
  - [ ] Verificar se arquivo é gerado

#### Erros Comuns a Verificar:
- ❌ Relatório não gera
- ❌ Métricas incorretas
- ❌ Gráficos não aparecem
- ❌ Exportação falha

---

### 14.2 Relatórios de Broadcast
**Rota:** `/broadcast` (seção relatórios)

#### Ações para Testar:
- [ ] **Performance:**
  - [ ] Ver performance de campanhas
  - [ ] Ver taxa de entrega
  - [ ] Ver taxa de leitura
  - [ ] Ver taxa de erro

- [ ] **Exportação:**
  - [ ] Exportar relatório
  - [ ] Verificar dados

#### Erros Comuns a Verificar:
- ❌ Métricas incorretas
- ❌ Exportação falha

---

## 🔔 MÓDULO 15: NOTIFICAÇÕES E ALERTAS

### 15.1 Notificações
**Rota:** Sistema (canto superior)

#### Ações para Testar:
- [ ] **Notificações:**
  - [ ] Verificar se notificações aparecem
  - [ ] Verificar notificações de desconexão de instâncias
  - [ ] Verificar notificações de leads que precisam atenção
  - [ ] Verificar notificações de mensagens não lidas
  - [ ] Abrir central de notificações
  - [ ] Marcar como lida
  - [ ] Limpar notificações

#### Erros Comuns a Verificar:
- ❌ Notificações não aparecem
- ❌ Notificações duplicadas
- ❌ Notificações não desaparecem

---

## 🛠️ MÓDULO 16: FERRAMENTAS E UTILITÁRIOS

### 16.1 Diagnósticos
**Rota:** `/diagnostics` ou `/rls-diagnostics`

#### Ações para Testar:
- [ ] **Diagnóstico de RLS:**
  - [ ] Executar diagnóstico
  - [ ] Verificar políticas RLS
  - [ ] Verificar permissões

- [ ] **Diagnóstico de API:**
  - [ ] Diagnosticar API Evolution
  - [ ] Ver logs
  - [ ] Ver erros

- [ ] **Logs:**
  - [ ] Ver logs de sistema
  - [ ] Filtrar logs
  - [ ] Exportar logs

#### Erros Comuns a Verificar:
- ❌ Diagnóstico não executa
- ❌ Logs não aparecem

---

### 16.2 Validações
**Rota:** Várias (validação de números, contatos, etc.)

#### Ações para Testar:
- [ ] **Validação de Números:**
  - [ ] Validar número WhatsApp
  - [ ] Verificar se número existe
  - [ ] Verificar formato

- [ ] **Validação de Contatos:**
  - [ ] Validar contatos antes de broadcast
  - [ ] Verificar números válidos

#### Erros Comuns a Verificar:
- ❌ Validação falha
- ❌ Números inválidos passam

---

## 📱 MÓDULO 17: RESPONSIVIDADE E MOBILE

### 17.1 Responsividade
**Rota:** Todas (testar em diferentes tamanhos de tela)

#### Ações para Testar:
- [ ] **Desktop:**
  - [ ] Testar em 1920x1080
  - [ ] Testar em 1366x768
  - [ ] Verificar se layout funciona

- [ ] **Tablet:**
  - [ ] Testar em iPad (768x1024)
  - [ ] Verificar menu lateral
  - [ ] Verificar navegação

- [ ] **Mobile:**
  - [ ] Testar em iPhone (375x667)
  - [ ] Testar em Android (360x640)
  - [ ] Verificar menu mobile
  - [ ] Verificar formulários
  - [ ] Verificar tabelas
  - [ ] Verificar modais

#### Erros Comuns a Verificar:
- ❌ Layout quebra em mobile
- ❌ Menu não funciona
- ❌ Formulários não cabem
- ❌ Tabelas não scrollam

---

## 🔄 MÓDULO 18: SINCRONIZAÇÃO E TEMPO REAL

### 18.1 Sincronização Automática
**Rota:** Sistema (indicadores no topo)

#### Ações para Testar:
- [ ] **Indicadores:**
  - [ ] Verificar indicador de sincronização
  - [ ] Verificar última sincronização
  - [ ] Verificar próxima sincronização
  - [ ] Verificar status de sincronização

- [ ] **Sincronização:**
  - [ ] Aguardar sincronização automática
  - [ ] Verificar se dados atualizam
  - [ ] Forçar sincronização manual

#### Erros Comuns a Verificar:
- ❌ Sincronização não acontece
- ❌ Indicadores incorretos
- ❌ Dados não atualizam

---

### 18.2 Tempo Real (Realtime)
**Rota:** Sistema (indicador no topo)

#### Ações para Testar:
- [ ] **Status:**
  - [ ] Verificar indicador de tempo real
  - [ ] Verificar se está conectado
  - [ ] Verificar reconexão automática

- [ ] **Atualizações:**
  - [ ] Criar lead em uma aba
  - [ ] Verificar se aparece em outra aba
  - [ ] Editar lead em uma aba
  - [ ] Verificar se atualiza em outra aba

#### Erros Comuns a Verificar:
- ❌ Tempo real não funciona
- ❌ Atualizações não aparecem
- ❌ Reconexão não funciona

---

## ✅ CHECKLIST FINAL DE VALIDAÇÃO

### Antes de Finalizar Testes:

- [ ] **Todos os módulos testados:**
  - [ ] Autenticação
  - [ ] CRM e Leads
  - [ ] Fila de Ligações
  - [ ] Calendário
  - [ ] Comunicação
  - [ ] Automações
  - [ ] Agentes de IA
  - [ ] Formulários
  - [ ] Contratos e Orçamentos
  - [ ] Pós-Venda
  - [ ] Usuários
  - [ ] Configurações
  - [ ] Super Admin
  - [ ] Integrações
  - [ ] Relatórios
  - [ ] Notificações
  - [ ] Ferramentas
  - [ ] Responsividade
  - [ ] Sincronização

- [ ] **Navegadores testados:**
  - [ ] Chrome
  - [ ] Firefox
  - [ ] Edge
  - [ ] Safari (se possível)

- [ ] **Dispositivos testados:**
  - [ ] Desktop
  - [ ] Tablet
  - [ ] Mobile

- [ ] **Casos extremos testados:**
  - [ ] Valores muito grandes
  - [ ] Caracteres especiais
  - [ ] Campos vazios
  - [ ] Múltiplas ações simultâneas
  - [ ] Conexão lenta
  - [ ] Sem conexão

- [ ] **Documentação de erros:**
  - [ ] Todos os erros anotados
  - [ ] Screenshots tirados
  - [ ] Passos para reproduzir documentados
  - [ ] Severidade definida (crítico, alto, médio, baixo)

---

## 📝 TEMPLATE DE RELATÓRIO DE ERRO

Para cada erro encontrado, documentar:

```
**Módulo:** [Nome do módulo]
**Funcionalidade:** [Nome da funcionalidade]
**Severidade:** [Crítico/Alto/Médio/Baixo]
**Navegador:** [Chrome/Firefox/Edge]
**Dispositivo:** [Desktop/Tablet/Mobile]

**Descrição:**
[Descrever o problema encontrado]

**Passos para Reproduzir:**
1. [Passo 1]
2. [Passo 2]
3. [Passo 3]

**Comportamento Esperado:**
[O que deveria acontecer]

**Comportamento Atual:**
[O que está acontecendo]

**Screenshot:**
[Inserir screenshot se disponível]

**Logs/Erros no Console:**
[Copiar erros do console se houver]
```

---

## 🎯 PRIORIZAÇÃO DE TESTES

### Prioridade 1 (Crítico - Testar Primeiro):
1. ✅ Autenticação e Login
2. ✅ Criação e Edição de Leads
3. ✅ Funil de Vendas (Kanban)
4. ✅ Envio de Mensagens WhatsApp
5. ✅ Criação de Workflows

### Prioridade 2 (Alto - Testar em Segunda):
1. ✅ Fila de Ligações
2. ✅ Broadcast
3. ✅ Agentes de IA
4. ✅ Integrações principais
5. ✅ Super Admin

### Prioridade 3 (Médio - Testar Depois):
1. ✅ Formulários
2. ✅ Contratos e Orçamentos
3. ✅ Relatórios
4. ✅ Configurações avançadas

### Prioridade 4 (Baixo - Testar Por Último):
1. ✅ Ferramentas de diagnóstico
2. ✅ Integrações secundárias
3. ✅ Responsividade em dispositivos específicos

---

**Boa sorte com os testes! 🚀**

**Última atualização:** Janeiro 2025
