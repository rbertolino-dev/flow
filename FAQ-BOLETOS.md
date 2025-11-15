# ❓ FAQ - Perguntas Frequentes sobre Geração de Boletos

## Instalação & Deploy

### P: Como aplico a migração do banco?
**R:**
1. Abra Supabase Dashboard
2. SQL Editor > New query
3. Copie todo o conteúdo de `supabase/migrations/20251115020000_add_boleto_tracking.sql`
4. Cole no editor
5. Clique em RUN
6. Pronto! A tabela `whatsapp_boletos` foi criada

### P: Onde coloco os arquivos do componente?
**R:**
- `src/hooks/useAsaasBoletos.ts` → Crie este arquivo
- `src/components/whatsapp/workflows/AsaasBoletoForm.tsx` → Crie este arquivo
- `src/components/whatsapp/workflows/BoletosList.tsx` → Crie este arquivo

### P: Preciso fazer npm install?
**R:**
Sim! Após copiar os arquivos:
```bash
npm install
npm run build
```

Isso verifica se todos os imports estão corretos.

### P: Como faço deploy da Edge Function?
**R:**

**Via CLI:**
```bash
supabase functions deploy asaas-create-boleto
```

**Via Dashboard:**
1. Supabase > Edge Functions
2. Create a new function
3. Nome: `asaas-create-boleto`
4. Cole conteúdo de `supabase/functions/asaas-create-boleto/index.ts`
5. Deploy

---

## Uso & Funcionalidade

### P: Como gero um boleto?
**R:**

**Opção 1 - Manual:**
1. Fluxo Automatizado → Workflows
2. Novo Workflow (tipo: Cobrança)
3. Clique no botão "Gerar Boleto"
4. Preencha valor, data de vencimento
5. Clique em "Gerar Boleto"
6. Download PDF ou compartilhe o link

**Opção 2 - Automático (se integrado):**
1. Criar workflow de cobrança
2. Salvar
3. Sistema gera boletos automaticamente para cada lead

### P: O boleto é criado no Asaas automaticamente?
**R:**
Sim! Quando você clica em "Gerar Boleto":
1. Sistema cria cliente no Asaas (se não existir)
2. Cria o boleto com tipo "BOLETO"
3. Gera PDF automaticamente
4. Salva tudo no banco de dados local

### P: Posso gerar múltiplos boletos para o mesmo lead?
**R:**
Sim! Você pode gerar vários boletos para o mesmo lead:
- Diferentes valores
- Diferentes vencimentos
- Diferentes descrições

Cada um terá seu próprio ID no Asaas e será rastreado separadamente.

### P: Onde vejo os boletos já gerados?
**R:**
Na aba "Boletos Gerados" do workflow ou na página do lead:
- `<BoletosList leadId={lead.id} />`

Mostra:
- Status (Pendente, Aberto, Pago, Vencido, etc)
- Valor e vencimento
- Links para download
- Botão para deletar

### P: Posso baixar o PDF do boleto?
**R:**
Sim! Clique no ícone de download na lista de boletos.
O PDF é gerado e armazenado no Asaas.

### P: E se não conseguir gerar o PDF?
**R:**
O sistema tenta gerar, mas não falha se não conseguir.
Você ainda pode:
- Acessar o boleto pelo link do Asaas
- Compartilhar o link com o cliente
- Consultar o código de barras manualmente

---

## Configuração Asaas

### P: Onde coloco a API Key do Asaas?
**R:**
1. Fluxo Automatizado → Integração Asaas
2. Preencha:
   - Ambiente: Sandbox (teste) ou Produção
   - API Key: Sua chave do Asaas
   - Base URL: Deixe o padrão
3. Clique em "Salvar configuração"
4. Clique em "Testar conexão"

### P: Como consigo a API Key?
**R:**
1. Acesse asaas.com
2. Faça login
3. Configurações > Integrações > API
4. Copie a API Key
5. Cole na configuração do sistema

### P: Devo usar Sandbox ou Produção?
**R:**
- **Sandbox:** Para testes (boletos de mentira)
- **Produção:** Quando estiver pronto (boletos reais)

Comece sempre com Sandbox!

### P: Como faço a conexão em Sandbox?
**R:**
1. Crie conta em asaas.com (free)
2. Dashboard tem modo Sandbox
3. Copie a API Key de Sandbox
4. Configure como "Sandbox" no sistema
5. Teste criando boletos

---

## Dados & Segurança

### P: Meus dados estão seguros?
**R:**
Sim! Segurança em múltiplas camadas:
- ✅ RLS Policies: Apenas você vê seus boletos
- ✅ Multi-org: Cada organização isolada
- ✅ API Key: Nunca exposta ao frontend
- ✅ Encriptação: Dados em trânsito via HTTPS
- ✅ Auditoria: Registro de quem criou cada boleto

### P: Quem vê meus boletos?
**R:**
- Membros da sua organização
- Admins da sua organização
- Ninguém mais (graças ao RLS)

### P: E se minha API Key do Asaas vazar?
**R:**
1. Vá no Asaas
2. Regenere a API Key imediatamente
3. Cole a nova no sistema
4. Pronto! A chave antiga não funciona mais

### P: Meus dados persistem?
**R:**
Sim! Tudo fica salvo em `whatsapp_boletos`:
- ID do boleto
- Valor e vencimento
- URLs para download
- Status e histórico
- Quando foi criado

Você pode consultar a qualquer momento.

### P: Posso exportar os boletos?
**R:**
Não há função de export pronta, mas você pode:
1. Conectar via API do Supabase
2. Executar query SQL:
   ```sql
   SELECT * FROM whatsapp_boletos 
   WHERE organization_id = ?
   ```
3. Exportar os dados

---

## Erros & Troubleshooting

### P: "Configuração Asaas não encontrada"
**R:**
Significa que você não configurou a API Key.

Solução:
1. Fluxo Automatizado → Integração Asaas
2. Preencha a API Key
3. Clique em "Salvar configuração"
4. Tente novamente

### P: "Cliente não encontrado no Asaas"
**R:**
Significa que os dados do cliente estão inválidos.

Solução:
1. Forneça um CPF/CNPJ válido
2. Ou forneça um email válido
3. Verifique se o formato está correto
4. Se continuar, verifique a API Key

### P: "PDF não gera"
**R:**
Pode ser falta de permissão na API Key.

Solução:
1. No Asaas, verifique permissões da chave
2. Regenere a chave com permissões completas
3. Cole a nova chave no sistema
4. Tente novamente

### P: "Erro ao criar boleto"
**R:**
Pode ser vários motivos:
- API Key inválida
- Quota do Asaas excedida
- Dados inválidos
- Serviço do Asaas offline

Solução:
1. Verifique logs no Supabase > Edge Functions
2. Verifique status do Asaas
3. Teste a conexão (Integração Asaas > Testar)
4. Tente de novo em alguns minutos

### P: "Boleto não aparece na lista"
**R:**
Pode ser:
- Boleto criado em outra organização
- Filtro de lead ativo
- Cache desatualizado

Solução:
1. Verifique qual organização está ativa
2. Se filtrou por lead, remova o filtro
3. Recarregue a página (F5)
4. Limpe cache do navegador (Ctrl+Shift+Delete)

### P: Botão "Gerar Boleto" não aparece
**R:**
Provavelmente o componente não foi importado/integrado.

Solução:
1. Verifique se importou `AsaasBoletoForm`
2. Verifique se adicionou `<AsaasBoletoForm />` ao JSX
3. Compile o projeto: `npm run build`
4. Verifique se há erros de lint

---

## Performance & Limite

### P: Posso gerar quantos boletos quiser?
**R:**
Teoricamente sim, mas:
- Asaas tem limites de requisições (geralmente generosos)
- Banco de dados tem capacidade (temos índices otimizados)
- Seu plano Asaas pode ter limite

Solução:
1. Comece com poucos boletos
2. Monitore performance
3. Se precisar escalar, contate Asaas

### P: Quanto tempo leva para gerar um boleto?
**R:**
Geralmente < 2 segundos:
- 0.5s: Buscar config
- 0.5s: Criar/buscar cliente
- 0.5s: Criar boleto
- 0.5s: Gerar PDF
- 0.2s: Salvar no banco

Total: ~2 segundos

Se demorar mais:
1. Verifique internet
2. Verifique status do Asaas
3. Verifique logs

### P: Boletos vão aparecer em tempo real?
**R:**
Sim! Graças ao React Query:
- Ao gerar boleto, lista atualiza automaticamente
- Cache é invalidado
- Nova query é feita
- UI atualiza em tempo real

---

## Integração

### P: Como integro boletos ao meu workflow?
**R:**
Veja arquivo `INTEGRACAO-BOLETOS-WORKFLOW.md` com passo a passo completo.

Resumo:
1. Importe `AsaasBoletoForm`
2. Importe `BoletosList`
3. Adicione ao JSX onde deseja
4. Pronto!

### P: Devo gerar boletos automaticamente?
**R:**
Depende do caso de uso:

**Automático (recomendado para lote):**
```typescript
if (workflow.type === "cobranca") {
  for (lead in leads) {
    await createBoleto(lead);
  }
}
```

**Manual (recomendado para individual):**
```tsx
<AsaasBoletoForm leadId={lead.id} />
```

### P: E se o workflow tiver múltiplos leads?
**R:**
Você pode:

**Opção 1:** Gerar um boleto para cada lead
- Loop: `for (lead in leads) { createBoleto(lead) }`

**Opção 2:** Gerar boleto quando clicar (manual)
- Mostrar componente para cada lead
- Usuário escolhe qual gerar

---

## Asaas & Pagamentos

### P: O cliente realmente paga o boleto?
**R:**
Sim! O boleto é real (em Produção):
- Cliente recebe via WhatsApp (seu link)
- Entra no Asaas
- Vê os dados do boleto
- Pode pagar via internet banking, caixa eletrônico, etc
- Pagamento é confirmado automáticamente

### P: Quando recebo a confirmação de pagamento?
**R:**
Geralmente em 1-2 dias úteis (instituições bancárias).

Você pode:
1. Consultar status no Asaas
2. Configurar webhook (futuro)
3. Sincronizar manualmente

### P: Posso reembolsar um boleto?
**R:**
Sim, no Asaas:
1. Acesse o boleto
2. Clique em "Reembolsar"
3. Selecione valor
4. Confirme

Sistema atualizará o status automaticamente (futuro).

### P: E se o boleto vencer?
**R:**
Status muda para "OVERDUE":
1. Boleto ainda funciona
2. Pode ser pago mesmo vencido
3. Mas acumula juros (Asaas controla)

---

## Suporte Técnico

### P: Quem contar se der erro?
**R:**
1. Verifique logs no Supabase > Edge Functions
2. Leia `GERAR-BOLETOS.md` (troubleshooting)
3. Verifique `FAQ-BOLETOS.md` (este arquivo)
4. Entre em contato com suporte

### P: Como reporto um bug?
**R:**
1. Descreva o problema
2. Anexe prints/logs
3. Diga o que você estava fazendo
4. Mencione versão do navegador
5. Envie para suporte

### P: Onde vejo os logs?
**R:**
Supabase Dashboard:
1. Edge Functions
2. Clique em `asaas-create-boleto`
3. Aba "Logs"
4. Procure pelo horário do erro

---

## Dúvidas Gerais

### P: Por que usar Asaas?
**R:**
- API robusta e confiável
- Suporta múltiplas formas de pagamento
- Boleto é a mais comum no Brasil
- Integrações fáceis
- Preços competitivos

### P: Qual é a taxa do Asaas?
**R:**
Varia conforme plano. Consulte asaas.com para detalhes atuais.

### P: Posso usar outro provedor?
**R:**
Sim! Mas precisaria adaptar o código.

A função `asaas-create-boleto` é específica para Asaas.

Você poderia criar versão para outro provedor (MercadoPago, Stripe, etc).

### P: Será que é fácil integrar outro provedor?
**R:**
Depende da API do provedor, mas o padrão seria:

1. Nova tabela para config
2. Nova Edge Function
3. Nova UI para setup
4. Mesmos componentes React (reutilizáveis)

---

## Roadmap Futuro

### Coisas que podem ser adicionadas

- [ ] Webhook do Asaas para sincronização automática de status
- [ ] Dashboard com gráficos de cobranças
- [ ] Lembretes automáticos para boletos vencendo
- [ ] Suporte a outros provedores de pagamento
- [ ] Integração com SMS + WhatsApp
- [ ] Recorrência automática de boletos
- [ ] Geração em lote com relatório

---

**Documento FAQ - Última atualização: Janeiro 2025**

Não encontrou sua pergunta? Verifique também:
- `GERAR-BOLETOS.md` - Documentação técnica
- `INTEGRACAO-BOLETOS-WORKFLOW.md` - Guia de integração
- `ARQUITETURA-BOLETOS.md` - Diagrama da arquitetura

