# 📋 Plano: Formulários e Pesquisas com Relatórios

## 🎯 Objetivo
Expandir a página de formulários para incluir:
1. **Formulários** (já existente) - coleta dados e cria leads
2. **Pesquisas** (novo) - coleta respostas para análise e relatórios
3. **Pesquisas Rápidas** - criação simplificada de pesquisas
4. **Relatórios Individuais** - gráficos e análises por pesquisa

---

## 📊 Estrutura de Dados

### 1. Tabela `surveys` (Pesquisas)
```sql
CREATE TABLE public.surveys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  type text NOT NULL DEFAULT 'standard', -- 'standard' | 'quick'
  fields jsonb NOT NULL DEFAULT '[]'::jsonb, -- Mesma estrutura de FormField
  style jsonb NOT NULL DEFAULT '{}'::jsonb, -- Mesma estrutura de FormStyle
  success_message text DEFAULT 'Obrigado por participar da pesquisa!',
  redirect_url text,
  is_active boolean NOT NULL DEFAULT true,
  allow_multiple_responses boolean DEFAULT false,
  collect_respondent_info boolean DEFAULT true, -- Nome, email opcional
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id)
);
```

### 2. Tabela `survey_responses` (Respostas de Pesquisas)
```sql
CREATE TABLE public.survey_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id uuid NOT NULL REFERENCES public.surveys(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  respondent_name text,
  respondent_email text,
  responses jsonb NOT NULL, -- { field_id: value, field_id: value }
  metadata jsonb, -- IP, user_agent, referrer, etc
  created_at timestamptz NOT NULL DEFAULT now()
);
```

### 3. Índices e RLS
- Índices em `organization_id`, `survey_id`, `created_at`
- RLS policies similares às de `form_builders`

---

## 🎨 Interface da Página

### Estrutura com Tabs
```
┌─────────────────────────────────────────────────┐
│  Formulários e Pesquisas                        │
├─────────────────────────────────────────────────┤
│  [Formulários] [Pesquisas] [Pesquisas Rápidas] │
├─────────────────────────────────────────────────┤
│                                                 │
│  Conteúdo da Tab Ativa                         │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Tab 1: Formulários (já existe)
- Lista de formulários
- Criar/Editar/Excluir
- Código de incorporação
- Visualizar submissões

### Tab 2: Pesquisas
- Lista de pesquisas
- Criar/Editar/Excluir pesquisa completa
- Código de incorporação
- **Botão "Ver Relatório"** → abre modal/drawer com relatórios

### Tab 3: Pesquisas Rápidas
- Interface simplificada
- Templates pré-configurados:
  - Satisfação do Cliente (NPS)
  - Feedback de Produto
  - Pesquisa de Mercado
  - Avaliação de Serviço
- Criação em 3 passos:
  1. Escolher template ou criar do zero
  2. Personalizar perguntas
  3. Publicar

---

## 📈 Relatórios Individuais por Pesquisa

### Modal/Drawer de Relatório
Ao clicar em "Ver Relatório" de uma pesquisa:

#### Aba 1: Visão Geral
- **Cards de Métricas:**
  - Total de Respostas
  - Taxa de Resposta (se houver público-alvo)
  - Taxa de Conclusão
  - Tempo médio de preenchimento

#### Aba 2: Análise por Pergunta
Para cada campo/pergunta:
- **Gráfico de distribuição:**
  - Barras (para select, radio)
  - Pizza (para opções múltiplas)
  - Linha temporal (respostas ao longo do tempo)
- **Estatísticas:**
  - Total de respostas
  - Percentual por opção
  - Respostas mais frequentes

#### Aba 3: Respostas Individuais
- Tabela com todas as respostas
- Filtros:
  - Por data
  - Por respondente (se coletado)
  - Por campo específico
- Exportar para CSV/Excel

#### Aba 4: Análise Temporal
- Gráfico de linha: Respostas ao longo do tempo
- Comparação de períodos
- Tendências

---

## 🔧 Componentes a Criar

### 1. `SurveysList.tsx`
- Lista de pesquisas
- Cards com informações básicas
- Ações: Editar, Excluir, Ver Relatório, Código

### 2. `SurveyBuilder.tsx`
- Editor de pesquisas (similar ao FormBuilderEditor)
- Opções específicas de pesquisa:
  - Permitir múltiplas respostas
  - Coletar informações do respondente
  - Anonimato

### 3. `QuickSurveyCreator.tsx`
- Interface simplificada
- Templates pré-configurados
- Wizard de 3 passos

### 4. `SurveyReport.tsx`
- Modal/Drawer com relatórios
- 4 abas: Visão Geral, Análise por Pergunta, Respostas, Temporal
- Gráficos usando recharts

### 5. `SurveyResponseChart.tsx`
- Componente reutilizável para gráficos de respostas
- Suporta: Barras, Pizza, Linha

### 6. `useSurveys.ts`
- Hook para gerenciar pesquisas
- CRUD completo
- Queries para relatórios

### 7. `useSurveyResponses.ts`
- Hook para buscar respostas
- Agregações para relatórios
- Filtros e paginação

---

## 📝 Funcionalidades Detalhadas

### Pesquisas vs Formulários

| Característica | Formulários | Pesquisas |
|---------------|-------------|-----------|
| Objetivo | Criar leads no funil | Coletar dados para análise |
| Integração | Cria lead no estágio | Não cria lead (opcional) |
| Relatórios | Básico (submissões) | Completo (gráficos, análises) |
| Múltiplas respostas | Não | Sim (configurável) |
| Anonimato | Não | Sim (opcional) |
| Coleta de info | Sempre (para lead) | Opcional |

### Pesquisas Rápidas
- Templates com perguntas pré-definidas
- Personalização rápida
- Publicação imediata
- Ideal para:
  - NPS rápido
  - Feedback de evento
  - Pesquisa de satisfação

### Relatórios
- **Gráficos automáticos** baseados no tipo de campo:
  - Select/Radio → Gráfico de barras ou pizza
  - Checkbox → Gráfico de barras (múltiplas seleções)
  - Text/Textarea → Nuvem de palavras ou análise de sentimento (futuro)
  - Number → Estatísticas (média, mediana, desvio padrão)
  - Date → Linha temporal

---

## 🗂️ Estrutura de Arquivos

```
src/
├── pages/
│   └── FormBuilder.tsx (modificar para incluir tabs)
├── components/
│   ├── surveys/
│   │   ├── SurveysList.tsx
│   │   ├── SurveyBuilder.tsx
│   │   ├── QuickSurveyCreator.tsx
│   │   ├── SurveyReport.tsx
│   │   ├── SurveyResponseChart.tsx
│   │   └── SurveyPreview.tsx
│   └── form-builder/ (já existe)
├── hooks/
│   ├── useSurveys.ts
│   └── useSurveyResponses.ts
├── types/
│   └── survey.ts
└── supabase/
    └── migrations/
        └── YYYYMMDD_create_surveys.sql
```

---

## 🚀 Implementação - Ordem de Execução

### Fase 1: Banco de Dados
1. ✅ Criar migration para tabela `surveys`
2. ✅ Criar migration para tabela `survey_responses`
3. ✅ Criar índices e RLS policies
4. ✅ Testar queries básicas

### Fase 2: Tipos e Hooks
1. ✅ Criar `types/survey.ts`
2. ✅ Criar `hooks/useSurveys.ts`
3. ✅ Criar `hooks/useSurveyResponses.ts`
4. ✅ Testar hooks

### Fase 3: Componentes Básicos
1. ✅ Criar `SurveysList.tsx`
2. ✅ Criar `SurveyBuilder.tsx` (baseado em FormBuilderEditor)
3. ✅ Criar `QuickSurveyCreator.tsx`
4. ✅ Integrar na página FormBuilder

### Fase 4: Relatórios
1. ✅ Criar `SurveyReport.tsx`
2. ✅ Criar `SurveyResponseChart.tsx`
3. ✅ Implementar gráficos por tipo de campo
4. ✅ Adicionar exportação CSV

### Fase 5: Edge Function (opcional)
1. ✅ Criar edge function para submissão de pesquisas
2. ✅ Similar à `submit-form`, mas sem criar lead

### Fase 6: Testes e Refinamentos
1. ✅ Testar fluxo completo
2. ✅ Ajustar UI/UX
3. ✅ Otimizar queries de relatórios
4. ✅ Adicionar loading states

---

## 📊 Exemplos de Gráficos

### Gráfico de Barras (Select/Radio)
```
Quantidade
    │
 50 │     ████
    │     ████
 40 │     ████
    │     ████
 30 │     ████  ████
    │     ████  ████
 20 │     ████  ████  ████
    │     ████  ████  ████
 10 │     ████  ████  ████  ████
    │     ████  ████  ████  ████
  0 └─────────────────────────────────
      Opção A  B  C  D  E
```

### Gráfico de Pizza (Distribuição)
```
    ┌─────────┐
    │   35%   │
    │  Opção A│
    └─────────┘
         │
    ┌────┴────┐
    │  25%   │
    │ Opção B│
    └────────┘
```

### Gráfico de Linha Temporal
```
Respostas
    │
 20 │        ╱╲
    │       ╱  ╲
 15 │      ╱    ╲    ╱╲
    │     ╱      ╲  ╱  ╲
 10 │    ╱        ╲╱    ╲
    │   ╱                ╲
  5 │  ╱                  ╲
    │ ╱                    ╲
  0 └─────────────────────────
     Jan  Fev  Mar  Abr  Mai
```

---

## 🎨 UI/UX Considerations

### Cores e Estilo
- Usar tema consistente com o resto da aplicação
- Diferenciação visual entre Formulários e Pesquisas:
  - Formulários: Azul (criação de leads)
  - Pesquisas: Verde (coleta de dados)
  - Pesquisas Rápidas: Laranja (rápido)

### Responsividade
- Todos os componentes devem ser responsivos
- Gráficos adaptáveis (usar ResponsiveContainer do recharts)
- Tabelas com scroll horizontal em mobile

### Acessibilidade
- Labels descritivos
- Contraste adequado
- Navegação por teclado

---

## ✅ Checklist de Implementação

### Backend
- [ ] Migration `surveys` table
- [ ] Migration `survey_responses` table
- [ ] RLS policies
- [ ] Índices otimizados
- [ ] Edge function para submissão (opcional)

### Frontend - Core
- [ ] Types (`survey.ts`)
- [ ] Hook `useSurveys`
- [ ] Hook `useSurveyResponses`
- [ ] Modificar `FormBuilder.tsx` para incluir tabs

### Frontend - Componentes
- [ ] `SurveysList.tsx`
- [ ] `SurveyBuilder.tsx`
- [ ] `QuickSurveyCreator.tsx`
- [ ] `SurveyPreview.tsx`
- [ ] `SurveyReport.tsx`
- [ ] `SurveyResponseChart.tsx`

### Frontend - Relatórios
- [ ] Visão geral (métricas)
- [ ] Análise por pergunta (gráficos)
- [ ] Respostas individuais (tabela)
- [ ] Análise temporal
- [ ] Exportação CSV

### Testes
- [ ] Criar pesquisa
- [ ] Responder pesquisa
- [ ] Visualizar relatórios
- [ ] Exportar dados
- [ ] Testar RLS

---

## 🔮 Melhorias Futuras

1. **Análise de Sentimento** - Para campos de texto
2. **Nuvem de Palavras** - Para respostas abertas
3. **Comparação de Pesquisas** - Comparar resultados entre pesquisas
4. **Segmentação** - Filtrar respostas por características
5. **Notificações** - Alertas quando pesquisa atinge meta
6. **Integração com Leads** - Opcionalmente criar lead a partir de pesquisa
7. **Compartilhamento** - Links públicos para pesquisas
8. **Agendamento** - Publicar pesquisa em data específica

---

## 📝 Notas Técnicas

### Performance
- Paginar respostas (50 por vez)
- Cachear agregações de relatórios
- Lazy loading de gráficos

### Segurança
- RLS em todas as tabelas
- Validação de dados na submissão
- Rate limiting em edge functions

### Compatibilidade
- Reutilizar componentes existentes (FormBuilderEditor como base)
- Manter padrões de código existentes
- Seguir regras do projeto (organization_id, etc)

---

**Última atualização:** Janeiro 2025
**Status:** Planejamento

