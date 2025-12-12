# 📋 Importar Listas do HubSpot - Guia Completo

## 🎯 Funcionalidade

Agora é possível importar **listas de contatos prontas** do HubSpot diretamente para:
- ✅ **CRM** (criar/atualizar leads)
- ✅ **Listas de Campanhas** (para disparos)
- ✅ **Ambos** (CRM + Campanhas simultaneamente)

Com **mapeamento personalizado de campos** para alinhar os dados do HubSpot com o sistema.

---

## 📍 Onde Está?

### **Localização:**
- Página: **Configurações** (`/settings`)
- Aba: **"Integrações"**
- Seção: **"Sincronização de Dados"**
- Card: **"Importar Listas do HubSpot"**

### **Como Acessar:**
1. Acesse `/settings`
2. Clique na aba **"Integrações"**
3. Role até a seção **"Sincronização de Dados"**
4. Encontre o card **"Importar Listas do HubSpot"**

---

## 🚀 Como Usar

### **Passo 1: Buscar Listas do HubSpot**

1. Clique no botão **"Buscar Listas"**
2. Aguarde o carregamento
3. As listas do HubSpot aparecerão no dropdown

### **Passo 2: Selecionar uma Lista**

1. No dropdown **"Lista do HubSpot"**, selecione a lista desejada
2. Você verá informações:
   - Nome da lista
   - Quantidade de contatos
   - Se é lista dinâmica ou estática

### **Passo 3: Mapear Campos**

**O que é mapeamento?**
- Alinhar campos do HubSpot com campos do sistema
- Exemplo: `firstname` do HubSpot → `name` do sistema

**Como mapear:**
1. Para cada campo que deseja importar:
   - **Campo HubSpot:** Selecione o campo no HubSpot (ex: `firstname`, `email`, `phone`)
   - **Campo Sistema:** Selecione onde salvar no sistema (ex: `name`, `email`, `phone`)

2. **Campos obrigatórios:**
   - ✅ **Nome** (pode ser `firstname` + `lastname` ou apenas `firstname`)
   - ✅ **Telefone OU E-mail** (pelo menos um)

3. **Adicionar mais campos:**
   - Clique em **"Adicionar Campo"** para mapear campos adicionais
   - Exemplos: `company` → `company`, `lifecyclestage` → `status`

**Campos Disponíveis no HubSpot:**
- `firstname` - Primeiro Nome
- `lastname` - Sobrenome
- `email` - E-mail
- `phone` - Telefone
- `company` - Empresa
- `lifecyclestage` - Lifecycle Stage
- `jobtitle` - Cargo
- `website` - Website
- `city` - Cidade
- `state` - Estado
- `country` - País

**Campos Disponíveis no Sistema:**
- `name` - Nome
- `phone` - Telefone
- `email` - E-mail
- `company` - Empresa
- `status` - Status
- `value` - Valor
- `notes` - Observações

### **Passo 4: Escolher Onde Importar**

Você tem 3 opções:

#### **Opção 1: Apenas CRM**
- ✅ Cria/atualiza leads no CRM
- ❌ Não adiciona em listas de campanha

#### **Opção 2: Apenas Lista de Campanha**
- ❌ Não cria leads no CRM
- ✅ Adiciona contatos em lista de campanha

#### **Opção 3: CRM + Lista de Campanha** (Recomendado)
- ✅ Cria/atualiza leads no CRM
- ✅ Adiciona contatos em lista de campanha
- ✅ Melhor para uso completo

### **Passo 5: Configurar Lista de Campanha** (se necessário)

Se escolheu "Apenas Lista de Campanha" ou "CRM + Lista de Campanha":

#### **Usar Lista Existente:**
1. Aba **"Lista Existente"**
2. Selecione uma lista já criada
3. Contatos serão adicionados à lista

#### **Criar Nova Lista:**
1. Aba **"Nova Lista"**
2. Digite o nome da nova lista
3. A lista será criada automaticamente

### **Passo 6: Importar**

1. Clique em **"Importar Lista"**
2. Aguarde o processamento
3. Veja o resultado:
   - Quantos contatos foram criados
   - Quantos foram atualizados
   - Quantos foram adicionados à lista

---

## 📊 Exemplo Prático

### **Cenário:**
Você tem uma lista no HubSpot chamada "Clientes VIP" com 500 contatos e quer:
- Importar para o CRM
- Adicionar em uma campanha de WhatsApp

### **Passos:**
1. **Buscar Listas** → Encontra "Clientes VIP (500 contatos)"
2. **Selecionar** → "Clientes VIP"
3. **Mapear Campos:**
   - `firstname` → `name`
   - `phone` → `phone`
   - `email` → `email`
   - `company` → `company`
   - `lifecyclestage` → `status`
4. **Onde Importar:** "CRM + Lista de Campanha"
5. **Lista de Campanha:** Criar nova "Clientes VIP - WhatsApp"
6. **Importar** → Processa 500 contatos
7. **Resultado:**
   - 450 novos leads criados no CRM
   - 50 leads atualizados (já existiam)
   - 500 contatos adicionados à lista de campanha

---

## 🔄 Como Funciona

### **Processo de Importação:**

1. **Busca Lista:**
   - Conecta com HubSpot API
   - Busca todos os contatos da lista (com paginação)

2. **Mapeia Campos:**
   - Para cada contato, aplica os mapeamentos configurados
   - Converte dados do formato HubSpot para formato do sistema

3. **Valida Dados:**
   - Verifica se tem nome
   - Verifica se tem telefone OU email
   - Ignora contatos sem dados mínimos

4. **Importa para CRM** (se selecionado):
   - Verifica se lead já existe (por email ou telefone)
   - Se existe: **Atualiza** dados
   - Se não existe: **Cria** novo lead

5. **Adiciona em Lista de Campanha** (se selecionado):
   - Cria nova lista OU atualiza lista existente
   - Adiciona contatos à lista
   - Evita duplicatas

---

## ⚙️ Mapeamento Inteligente

### **Mapeamento Automático de Status:**

O sistema mapeia automaticamente `lifecyclestage` do HubSpot para `status` do sistema:

| HubSpot | Sistema |
|---------|---------|
| `subscriber` | `new` |
| `lead` | `new` |
| `marketingqualifiedlead` | `new` |
| `salesqualifiedlead` | `contacted` |
| `opportunity` | `qualified` |
| `customer` | `won` |
| `evangelist` | `won` |

### **Normalização Automática:**

- **Telefone:** Remove caracteres não numéricos automaticamente
- **Email:** Converte para minúsculas e remove espaços
- **Nome:** Constrói nome completo se mapear `firstname` + `lastname`

---

## 📝 Exemplos de Mapeamento

### **Exemplo 1: Mapeamento Básico**
```
HubSpot          →  Sistema
─────────────────────────────
firstname        →  name
phone            →  phone
email            →  email
```

### **Exemplo 2: Mapeamento Completo**
```
HubSpot          →  Sistema
─────────────────────────────
firstname        →  name
phone            →  phone
email            →  email
company          →  company
lifecyclestage   →  status
jobtitle         →  notes (como observação)
```

### **Exemplo 3: Nome Completo**
```
HubSpot          →  Sistema
─────────────────────────────
firstname        →  name (será combinado)
lastname         →  name (será combinado)
phone            →  phone
email            →  email
```

---

## ⚠️ Observações Importantes

### **Limitações:**
- Máximo 100 contatos por requisição (paginação automática)
- Contatos sem telefone OU email são ignorados
- Listas muito grandes podem levar alguns minutos

### **Duplicatas:**
- Sistema verifica duplicatas por email ou telefone
- Se encontrar, **atualiza** o lead existente
- Não cria duplicatas

### **Listas Dinâmicas vs Estáticas:**
- **Listas Dinâmicas:** Atualizam automaticamente no HubSpot
- **Listas Estáticas:** Não mudam automaticamente
- Ambas podem ser importadas normalmente

---

## 🐛 Troubleshooting

### **Erro: "Configuração HubSpot não encontrada"**
- Configure o HubSpot primeiro em Configurações > Integrações

### **Erro: "Mapeamento incompleto"**
- Certifique-se de mapear pelo menos: Nome e Telefone ou E-mail

### **Erro: "Lista de campanha necessária"**
- Se escolheu importar para campanha, selecione uma lista ou crie uma nova

### **Nenhum contato importado:**
- Verifique se os contatos têm telefone OU email
- Verifique se os mapeamentos estão corretos
- Veja os logs para mais detalhes

---

## ✅ Checklist de Uso

- [ ] HubSpot configurado
- [ ] Lista selecionada do HubSpot
- [ ] Campos mapeados corretamente
- [ ] Escolhido onde importar (CRM/Campanha/Ambos)
- [ ] Lista de campanha configurada (se necessário)
- [ ] Importação concluída
- [ ] Verificado resultado

---

## 📚 Próximos Passos Após Importar

### **Se importou para CRM:**
1. Acesse o CRM (`/crm`)
2. Veja os novos leads
3. Organize por etapas do funil
4. Atribua para vendedores

### **Se importou para Campanha:**
1. Acesse **Campanhas** (`/broadcast` ou `/workflows`)
2. Use a lista importada em uma campanha
3. Configure mensagens
4. Dispare para os contatos

### **Se importou para Ambos:**
1. Leads aparecem no CRM
2. Lista disponível para campanhas
3. Pode usar em workflows automáticos
4. Sincronização completa!

---

**Status:** ✅ Funcionalidade Completa | Pronto para Uso

**Última Atualização:** 2024-01-31



