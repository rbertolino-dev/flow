# 🔄 Guia: Sincronização de Leads do Agilize Total (Bubble)

## 📋 Visão Geral

Esta funcionalidade permite sincronizar automaticamente leads/clientes do seu ERP no Bubble (Agilize Total) para o sistema de CRM, integrando com os **Fluxos de Automação** para acionar jornadas personalizadas automaticamente.

---

## ✅ Pré-requisitos

1. **Configuração do Bubble.io** já realizada
   - Acesse: **Configurações → Integrações → Bubble.io**
   - Configure a **API URL** e **API Key** do seu app Bubble

2. **Tabela no Bubble** com os dados dos leads/clientes
   - Exemplo: `cliente`, `lead`, `contato`, `pessoa`

---

## 🚀 Como Usar

### 1️⃣ Acessar a Sincronização

1. Vá em **Configurações**
2. Na aba **Integrações**, role até a seção **"Sincronização de Dados"**
3. Você verá o painel **"Sincronização de Leads do Agilize Total (Bubble)"**

### 2️⃣ Configurar Mapeamento de Campos

1. **Informe o Endpoint/Tabela do Bubble:**
   - Exemplo: `cliente`, `lead`, `contato`
   - Este é o nome da tabela no Bubble que contém os leads

2. **Configure o Mapeamento de Campos:**
   - **Campo no Bubble**: Nome do campo na tabela do Bubble
   - **Campo no Sistema**: Campo correspondente no CRM
   
   **Campos Obrigatórios:**
   - ✅ **Nome** (name)
   - ✅ **Telefone** (phone)

   **Campos Opcionais:**
   - 📧 E-mail (email)
   - 🏢 Empresa (company)
   - 💰 Valor (value)
   - 📝 Observações (notes)

3. **Exemplo de Mapeamento:**
   ```
   Campo no Bubble    →  Campo no Sistema
   ----------------------------
   nome              →  Nome
   telefone          →  Telefone
   email             →  E-mail
   empresa           →  Empresa
   valor_total       →  Valor
   observacoes      →  Observações
   ```

### 3️⃣ Salvar Configuração

Clique em **"Salvar Configuração"** para salvar o mapeamento.

### 4️⃣ Testar Sincronização

1. Clique em **"Testar Sincronização"**
2. O sistema irá:
   - Buscar dados do Bubble
   - Mostrar quantos leads seriam criados/atualizados
   - **NÃO** criar/atualizar nada (modo teste)

### 5️⃣ Sincronizar Agora

1. Clique em **"Sincronizar Agora"**
2. O sistema irá:
   - Buscar todos os leads do Bubble
   - Criar novos leads no CRM
   - Atualizar leads existentes (por telefone)
   - **Acionar automaticamente os Fluxos de Automação** configurados com trigger "Lead Criado"

---

## 🔄 Integração com Fluxos de Automação

Quando um lead é sincronizado do Bubble:

1. ✅ O lead é criado/atualizado no CRM
2. ✅ O sistema detecta automaticamente a criação
3. ✅ **Fluxos de Automação** com trigger **"Lead Criado"** são acionados automaticamente
4. ✅ O lead entra na jornada configurada

**Exemplo:**
- Lead sincronizado do Bubble
- → Aciona fluxo "Boas-vindas para Leads do ERP"
- → Envia mensagem WhatsApp automática
- → Adiciona tag "Importado do ERP"
- → Move para estágio "Novo Lead"

---

## 📊 Detecção de Duplicatas

O sistema evita duplicatas:

- ✅ Verifica se já existe lead com o mesmo **telefone** na organização
- ✅ Se existir: **atualiza** os dados do lead existente
- ✅ Se não existir: **cria** novo lead

---

## ⚙️ Funcionalidades Técnicas

### Paginação Automática
- O sistema busca todos os registros do Bubble automaticamente
- Suporta até 5.000 registros por sincronização
- Usa paginação para evitar limites da API

### Normalização de Telefone
- Remove caracteres não numéricos automaticamente
- Garante consistência na detecção de duplicatas

### Cache e Performance
- Usa a mesma infraestrutura de cache do Bubble
- Consultas recentes (24h) são reutilizadas quando possível

---

## 🐛 Solução de Problemas

### Erro: "Configure a API Bubble.io primeiro"
- **Solução**: Configure a integração Bubble.io em **Configurações → Integrações → Bubble.io**

### Erro: "Endpoint obrigatório"
- **Solução**: Informe o nome da tabela do Bubble (ex: `cliente`, `lead`)

### Erro: "Mapeamento incompleto"
- **Solução**: Certifique-se de mapear pelo menos **Nome** e **Telefone**

### Nenhum lead encontrado
- Verifique se o nome da tabela está correto
- Verifique se há dados na tabela do Bubble
- Teste a consulta manualmente na página de Integração Bubble

### Leads não acionam Fluxos de Automação
- Verifique se há fluxos **ativos** com trigger "Lead Criado"
- Verifique se o Realtime está funcionando (recarregue a página)

---

## 💡 Dicas

1. **Teste primeiro**: Sempre use "Testar Sincronização" antes de sincronizar de verdade
2. **Mapeamento correto**: Certifique-se de que os nomes dos campos no Bubble estão corretos
3. **Fluxos preparados**: Configure os Fluxos de Automação antes de sincronizar para acionar jornadas automaticamente
4. **Sincronização periódica**: Você pode sincronizar manualmente sempre que necessário

---

## 🔮 Próximas Melhorias (Futuro)

- ⏰ Sincronização automática agendada
- 🔍 Filtros avançados (sincronizar apenas leads novos/modificados)
- 📊 Histórico de sincronizações
- 🔔 Notificações de sincronização concluída

---

## 📞 Suporte

Se tiver dúvidas ou problemas:
1. Verifique os logs no console do navegador (F12)
2. Teste a conexão com Bubble na página de Integração
3. Verifique se os campos mapeados existem na tabela do Bubble



