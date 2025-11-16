# Guia de Boas Práticas - Agentes IA

Este guia contém as melhores práticas para criar, configurar e otimizar seus agentes de IA no sistema.

## 📋 Índice

1. [Criando Instruções Eficazes](#criando-instruções-eficazes)
2. [Guardrails (Regras Obrigatórias)](#guardrails-regras-obrigatórias)
3. [Few-Shot Examples (Exemplos)](#few-shot-examples-exemplos)
4. [Configurações de Temperatura](#configurações-de-temperatura)
5. [Escolhendo o Modelo Certo](#escolhendo-o-modelo-certo)
6. [Detecção de Problemas](#detecção-de-problemas)
7. [Quando Escalar para Humano](#quando-escalar-para-humano)
8. [Testes e Iteração](#testes-e-iteração)

---

## Criando Instruções Eficazes

### ✅ O QUE FAZER

**Seja específico sobre o papel:**
```
Você é um assistente especializado em vendas de equipamentos médicos. 
Seu público são médicos e gestores de clínicas.
```

**Defina o tom de voz:**
```
Mantenha sempre um tom profissional, técnico mas acessível.
Evite gírias e seja formal.
```

**Dê contexto do negócio:**
```
Trabalhamos com equipamentos de alta precisão, com preços entre R$50.000 e R$500.000.
O processo de venda geralmente leva 30-60 dias.
```

**Explique o objetivo:**
```
Seu objetivo é qualificar leads, entender as necessidades 
e agendar uma demonstração com a equipe técnica.
```

### ❌ O QUE EVITAR

- ❌ Instruções genéricas: "Você é um assistente útil"
- ❌ Instruções muito longas (> 1000 palavras)
- ❌ Informações desatualizadas
- ❌ Contradições nas instruções

---

## Guardrails (Regras Obrigatórias)

Guardrails são regras que o agente **DEVE** seguir sempre. Use para evitar erros críticos.

### Estrutura Recomendada

Use palavras fortes como **NUNCA**, **SEMPRE**, **OBRIGATÓRIO**:

```
GUARDRAILS CRÍTICOS:

1. NUNCA invente preços, estoques ou prazos
2. SEMPRE confirme informações no sistema antes de informar
3. NUNCA processe pagamentos ou dados financeiros
4. Se não souber algo, diga "Não tenho essa informação"
5. Se cliente usar palavras como "cancelar", "reclamação", "processo", escale IMEDIATAMENTE
```

### Guardrails por Segmento

**E-commerce:**
```
- NUNCA prometa prazos sem confirmar no sistema
- NUNCA aplique descontos sem autorização
- SEMPRE verifique estoque antes de confirmar disponibilidade
- Se pedido for > R$5000, escale para gerente
```

**Suporte Técnico:**
```
- NUNCA instrua procedimentos que possam causar danos
- SEMPRE peça backup antes de ações irreversíveis
- NUNCA peça senhas ou acesso remoto
- Se problema persistir após 3 tentativas, escale
```

**Vendas B2B:**
```
- NUNCA dê preços sem confirmar com comercial
- SEMPRE qualifique (cargo, empresa, necessidade)
- NUNCA prometa funcionalidades em desenvolvimento
- Valores > R$50k = escalar obrigatório
```

**Atendimento Médico/Saúde:**
```
- NUNCA dê diagnósticos ou orientações médicas
- SEMPRE oriente a procurar profissional de saúde
- NUNCA recomende medicamentos
- Emergências = escalar IMEDIATAMENTE
```

---

## Few-Shot Examples (Exemplos)

Exemplos ensinam o agente **como** responder. São muito poderosos!

### Anatomia de um Bom Exemplo

```
Cliente: [pergunta real do seu negócio]
Agente: [resposta ideal - como você gostaria que respondesse]

[contexto adicional se necessário]
```

### Exemplos Práticos

**Exemplo 1: Lidar com Preço**
```
Cliente: Quanto custa?
Agente: Temos planos a partir de R$199/mês, mas o valor ideal 
depende do tamanho da sua equipe. Quantos usuários vocês são?

[Observação: Sempre qualifica antes de dar preço final]
```

**Exemplo 2: Não Sabe a Resposta**
```
Cliente: Vocês integram com o sistema X?
Agente: Essa é uma ótima pergunta! Não tenho essa informação 
técnica agora, mas posso pedir para nossa equipe de integração 
te responder em até 1 hora. Pode ser?

[Observação: Admite quando não sabe + oferece solução]
```

**Exemplo 3: Cliente Insatisfeito**
```
Cliente: Isso é um absurdo! Já reclamei 3 vezes!
Agente: Peço sinceras desculpas pela situação. Vou encaminhar 
você imediatamente para nosso supervisor que tem autonomia 
para resolver isso agora. Um momento.

[Observação: Empatia + ação imediata + escalação]
```

**Exemplo 4: Qualificação de Lead**
```
Cliente: Quero saber mais sobre o produto
Agente: Ótimo! Para te mostrar os benefícios mais relevantes, 
me conta: qual o principal desafio que você busca resolver?

[Observação: Pergunta aberta para entender necessidade]
```

### Quantos Exemplos Usar?

- **Mínimo:** 3-5 exemplos
- **Ideal:** 10-15 exemplos
- **Máximo:** 30 exemplos (mais que isso não melhora muito)

### Dica de Ouro 💡

Use conversas REAIS do seu histórico! São os melhores exemplos.

---

## Configurações de Temperatura

A temperatura controla a "criatividade" do agente (0 = robótico, 1 = criativo).

### Guia de Temperatura

| Temperatura | Comportamento | Quando Usar |
|-------------|---------------|-------------|
| **0.0 - 0.3** | Muito consistente e previsível | Atendimento técnico, dados precisos |
| **0.4 - 0.6** | Equilibrado (RECOMENDADO) | Atendimento geral, vendas |
| **0.7 - 0.9** | Criativo e variado | Marketing, conteúdo, brainstorming |
| **1.0** | Muito criativo (pode errar) | Raramente recomendado |

### Recomendações por Caso de Uso

```
Suporte Técnico:     0.2 - 0.3  (precisa ser preciso)
Vendas B2B:          0.4 - 0.5  (profissional mas humano)
Vendas B2C:          0.5 - 0.6  (mais casual e amigável)
Qualificação:        0.4 - 0.5  (estruturado mas adaptável)
Atendimento Geral:   0.5 - 0.6  (natural e conversacional)
```

---

## Escolhendo o Modelo Certo

### Modelos Disponíveis

| Modelo | Velocidade | Qualidade | Custo | Quando Usar |
|--------|-----------|-----------|-------|-------------|
| **gpt-4o-mini** | ⚡⚡⚡ Rápido | ⭐⭐⭐ Bom | 💰 Baixo | Atendimento geral (RECOMENDADO) |
| **gpt-4o** | ⚡⚡ Médio | ⭐⭐⭐⭐ Ótimo | 💰💰 Médio | Casos complexos |
| **gpt-4-turbo** | ⚡ Lento | ⭐⭐⭐⭐⭐ Excelente | 💰💰💰 Alto | Análises profundas |
| **gpt-3.5-turbo** | ⚡⚡⚡⚡ Muito rápido | ⭐⭐ OK | 💰 Muito baixo | Tarefas simples |

### Recomendação Geral

Para **95% dos casos**, use **gpt-4o-mini**:
- Boa qualidade
- Resposta rápida (1-2 segundos)
- Custo baixo (R$0,01 por conversa)
- Suporta JSON mode

---

## Detecção de Problemas

O sistema valida automaticamente as respostas do agente. Entenda os alertas:

### Tipos de Problemas

**🚫 Bloqueadores (Resposta não é enviada):**
- CPF/CNPJ inválido
- Preço absurdo (>R$50.000)
- URL malformada

**⚠️ Avisos (Resposta é enviada, mas com log):**
- Palavras de incerteza ("acho que", "talvez")
- Telefone com formatação estranha
- Email suspeito

### Como Ver os Logs

1. Acesse o **Dashboard de Agentes**
2. Clique no agente
3. Aba **"Logs de Conversas"**
4. Filtre por "Com problemas"

---

## Quando Escalar para Humano

O agente deve saber quando **não** tentar resolver sozinho.

### Critérios de Escalação Automática

O sistema escala automaticamente quando:

1. **Confiança baixa** (< 70%)
2. **Resposta bloqueada** por validação
3. **Agente pede escalação** (`precisa_escalacao: true`)

### Ensine o Agente a Escalar

No campo "Guardrails", adicione:

```
QUANDO ESCALAR PARA HUMANO:

1. Cliente usa palavras: "processo", "advogado", "PROCON", "reclamação grave"
2. Cliente repete a mesma pergunta 2+ vezes (não entendeu)
3. Problema técnico complexo ou erro no sistema
4. Valor envolvido > R$10.000
5. Cliente explicitamente pede para falar com humano
6. Você não tem certeza absoluta da resposta

COMO ESCALAR:
- Responda com precisa_escalacao: true
- Seja honesto: "Vou transferir você para [pessoa/setor]"
- NUNCA invente desculpas
```

---

## Testes e Iteração

### Checklist de Lançamento

Antes de ativar seu agente:

- [ ] Testei pelo menos 10 conversas reais
- [ ] Adicionei guardrails para casos críticos
- [ ] Inclui 5+ exemplos de respostas
- [ ] Configurei temperature apropriada
- [ ] Testei escalação (ela funciona?)
- [ ] Revisei logs de erros
- [ ] Modo de teste ativado inicialmente

### Como Testar

1. **Ative "Modo de Testes"** no agente
2. Envie mensagens reais pelo WhatsApp
3. Revise as respostas
4. Ajuste guardrails/examples conforme necessário
5. Repita até satisfeito
6. **Desative "Modo de Testes"** para produção

### Métricas de Sucesso

Monitore:

- **Taxa de escalação:** Ideal = 15-25%
  - Muito baixa (<10%) = agente tenta resolver demais
  - Muito alta (>40%) = agente inseguro demais
  
- **Confiança média:** Ideal = 75-85%
  - Baixa (<70%) = precisa mais exemplos
  - Alta (>90%) = ótimo!
  
- **Erros bloqueados:** Ideal = 0
  - Se houver, revise guardrails

---

## Exemplos Completos

### Exemplo 1: Agente de E-commerce

```yaml
Nome: Assistente de Vendas - Loja XYZ

Instruções:
Você é o assistente de vendas da Loja XYZ, especializada em 
eletrônicos. Seu público são consumidores finais (B2C).
Mantenha tom amigável mas profissional. Seu objetivo é ajudar
o cliente a encontrar o produto ideal e finalizar a compra.

Guardrails:
- NUNCA invente preços ou prazos
- SEMPRE confirme estoque antes de prometer
- Se cliente quer cancelar pedido, escale IMEDIATAMENTE
- NUNCA processe pagamentos (só oriente onde pagar)
- Pedidos >R$5000 = escalar para vendedor

Few-Shot Examples:
Cliente: Quanto custa o iPhone 15?
Agente: Vou consultar o preço atualizado do iPhone 15 para você. 
Qual modelo de interesse? 128GB, 256GB ou 512GB?

Cliente: Tem em estoque?
Agente: Deixe eu verificar a disponibilidade para você. 
Qual produto e sua cidade?

Cliente: Meu pedido não chegou!
Agente: Sinto muito pelo transtorno! Vou encaminhar você 
imediatamente para nossa equipe de entregas que vai resolver isso.

Temperatura: 0.6
Modelo: gpt-4o-mini
```

### Exemplo 2: Agente de Suporte B2B

```yaml
Nome: Suporte Técnico - Software Empresarial

Instruções:
Você é o assistente técnico do [Nome do Software], uma 
plataforma SaaS B2B. Seu público são gestores e usuários técnicos.
Mantenha tom profissional e técnico. Priorize resolver o problema
rapidamente, mas escale quando necessário.

Guardrails:
- NUNCA instrua procedimentos que possam causar perda de dados
- SEMPRE peça backup antes de alterações críticas
- NUNCA peça senha ou acesso remoto
- Se problema persiste após 2 tentativas, escale
- Bugs confirmados = criar ticket e escalar

Few-Shot Examples:
Cliente: O sistema está lento
Agente: Vou te ajudar a resolver isso. Primeiro, pode me informar:
1. Quantos usuários estão conectados agora?
2. Qual módulo está lento (vendas, estoque, etc)?
3. Isso começou hoje ou já faz alguns dias?

Cliente: Erro ao gerar relatório
Agente: Entendi. Esse erro pode ter algumas causas. Vamos tentar:
1. Limpe o cache do navegador (Ctrl+Shift+Delete)
2. Tente novamente
Se persistir, vou abrir um ticket para o time técnico investigar.

Cliente: Preciso recuperar dados deletados
Agente: Para recuperação de dados, preciso encaminhar para nossa 
equipe especializada que tem acesso aos backups. Vou criar um 
ticket prioritário. Pode me informar:
- Que dados foram deletados?
- Quando isso aconteceu (data/hora)?
- Era uma exclusão acidental?

Temperatura: 0.3
Modelo: gpt-4o-mini
```

---

## Recursos Adicionais

### Ferramentas de Validação

O sistema inclui validação automática de:
- ✅ CPF/CNPJ
- ✅ URLs
- ✅ Preços
- ✅ Telefones
- ✅ Emails
- ✅ Detecção de incerteza

Não precisa fazer nada, é automático!

### Formato JSON das Respostas

Todas as respostas do agente seguem este formato:

```json
{
  "resposta": "Texto que será enviado ao cliente",
  "confianca": 85,
  "precisa_escalacao": false
}
```

### Atualizações Contínuas

**Dica:** Revise e atualize seu agente mensalmente:
1. Leia conversas reais
2. Identifique padrões de erro
3. Adicione novos exemplos
4. Refine guardrails

---

## Precisa de Ajuda?

- **Dúvidas técnicas:** Consulte a documentação técnica em `/AGENTES-IA-README.md`
- **Exemplos de integração:** Veja `/src/lib/agents/validatorIntegrationExample.ts`
- **Problemas:** Abra um chamado ou contate o suporte

---

**Última atualização:** Novembro 2024  
**Versão:** 1.0

