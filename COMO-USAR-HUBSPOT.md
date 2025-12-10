# 📍 Como Acessar e Usar a Integração HubSpot

## 🎯 Onde Está a Integração?

### **Localização:**
A integração HubSpot está disponível na página de **Configurações** do sistema.

### **Rota:**
```
/settings
```

### **Navegação:**
1. Acesse o sistema
2. No menu lateral ou superior, clique em **"Configurações"** (ícone de engrenagem ⚙️)
3. Na página de Configurações, clique na aba **"Integrações"**
4. Role a página até encontrar o card **"HubSpot"** (com ícone laranja)

### **Localização Visual:**
```
Configurações
  └── Aba: Integrações
      └── Seção: Integrações de Sistemas
          └── Card: HubSpot (junto com Google Calendar, Gmail, Mercado Pago, etc.)
```

---

## 🚀 Como Configurar e Puxar Contatos

### **Passo 1: Configurar a Integração**

1. **Acesse a página de Configurações:**
   - URL: `/settings`
   - Ou clique em "Configurações" no menu

2. **Vá para a aba "Integrações":**
   - Clique na aba "Integrações" no topo da página

3. **Localize o card HubSpot:**
   - Procure pelo card com ícone laranja e título "HubSpot"
   - Está na seção "Integrações de Sistemas"

4. **Clique em "Configurar HubSpot":**
   - Se ainda não configurou, verá um botão "Configurar HubSpot"
   - Clique nele para abrir o diálogo de configuração

5. **Preencha os dados:**
   - **Access Token:** Cole o token obtido do HubSpot Developer Portal
   - **Portal ID:** (Opcional) ID do portal HubSpot
   - **Ativar integração:** Deixe marcado

6. **Salve a configuração:**
   - Clique em "Configurar"
   - Aguarde a confirmação

### **Passo 2: Obter Access Token do HubSpot**

1. Acesse [HubSpot Developer Portal](https://developers.hubspot.com/)
2. Faça login na sua conta HubSpot
3. Vá em **Account Setup** > **Private Apps**
4. Clique em **Create a private app**
5. Dê um nome ao app (ex: "Agilize CRM Integration")
6. Configure os escopos necessários:
   - `crm.objects.contacts.read` - Para ler contatos
   - `crm.objects.contacts.write` - (Opcional) Para escrever contatos
7. Clique em **Create**
8. Copie o **Access Token** gerado
9. Cole no campo "Access Token" da configuração

### **Passo 3: Testar a Conexão**

1. Após configurar, você verá o card HubSpot com a configuração ativa
2. Clique no botão **"Testar Conexão"**
3. Aguarde a validação
4. Se tudo estiver correto, verá uma mensagem de sucesso

### **Passo 4: Sincronizar Contatos**

Após configurar e testar, você tem **2 opções** para puxar contatos:

#### **Opção 1: Sincronizar Todos os Contatos**
- Clique no botão **"Sincronizar Todos"**
- Isso vai buscar **todos os contatos** do HubSpot
- Útil para primeira sincronização
- Pode levar mais tempo dependendo da quantidade

#### **Opção 2: Sincronizar Apenas Novos/Atualizados**
- Clique no botão **"Sincronizar Novos"**
- Isso busca apenas contatos **modificados desde a última sincronização**
- Mais rápido e eficiente
- Ideal para sincronizações periódicas

### **Passo 5: Verificar Contatos Sincronizados**

1. Após sincronizar, os contatos aparecerão no **CRM** do sistema
2. Acesse a página do CRM (rota `/crm` ou menu "CRM")
3. Os contatos do HubSpot terão:
   - **Fonte:** "hubspot"
   - **Nome:** Primeiro nome + Sobrenome do HubSpot
   - **Email:** Email do contato
   - **Telefone:** Telefone normalizado
   - **Empresa:** Empresa do contato
   - **Status:** Mapeado do lifecycle stage do HubSpot

---

## 📋 Interface da Integração

### **Card HubSpot (Não Configurado):**
```
┌─────────────────────────────────┐
│ 🟠 HubSpot                      │
│ Sincronize contatos do HubSpot  │
│                                 │
│ [Configurar HubSpot]            │
└─────────────────────────────────┘
```

### **Card HubSpot (Configurado):**
```
┌─────────────────────────────────┐
│ 🟠 HubSpot              [Ativa] │
│ Portal ID: 123456               │
│ Última sincronização: ...      │
│                                 │
│ [Editar] [Desativar] [🗑️]      │
│                                 │
│ [Testar Conexão]                │
│ [Sincronizar Todos]             │
│ [Sincronizar Novos]             │
└─────────────────────────────────┘
```

---

## 🔄 Funcionalidades Disponíveis

### **1. Testar Conexão**
- Valida se o Access Token está correto
- Verifica se a API está acessível
- Retorna informações do portal (se disponível)

### **2. Sincronizar Todos**
- Busca todos os contatos do HubSpot
- Processa em lotes (paginação automática)
- Cria novos leads ou atualiza existentes
- Limite: 100 contatos por página (máximo 50 páginas = 5000 contatos)

### **3. Sincronizar Novos**
- Busca apenas contatos modificados desde última sincronização
- Mais rápido e eficiente
- Filtra por `lastmodifieddate`

### **4. Editar Configuração**
- Permite atualizar Access Token
- Alterar Portal ID
- Ativar/Desativar integração

### **5. Desativar/Ativar**
- Desativa a integração sem deletar
- Útil para manutenção temporária

### **6. Remover Configuração**
- Remove completamente a configuração
- Requer confirmação

---

## 📊 O que Acontece na Sincronização?

### **Processo Automático:**
1. Sistema busca contatos do HubSpot via API
2. Para cada contato:
   - Verifica se já existe (por email ou telefone)
   - Se existe: **Atualiza** os dados
   - Se não existe: **Cria** novo lead
3. Mapeia campos automaticamente:
   - `firstname + lastname` → `name`
   - `email` → `email`
   - `phone` → `phone` (normalizado)
   - `company` → `company`
   - `lifecyclestage` → `status` (mapeado)
4. Salva timestamp da última sincronização

### **Mapeamento de Status:**
- `subscriber`, `lead`, `marketingqualifiedlead` → `new`
- `salesqualifiedlead` → `contacted`
- `opportunity` → `qualified`
- `customer`, `evangelist` → `won`

---

## ⚠️ Observações Importantes

### **Limites:**
- Máximo 100 contatos por requisição
- Máximo 50 páginas (5000 contatos) por sincronização
- Rate limit do HubSpot: 100 requests/10 segundos

### **Requisitos:**
- Contato precisa ter **email OU telefone** para ser sincronizado
- Se não tiver nenhum dos dois, será ignorado

### **Duplicatas:**
- Sistema verifica duplicatas por email ou telefone
- Se encontrar, **atualiza** o lead existente
- Não cria duplicatas

### **Performance:**
- Sincronização completa pode levar alguns minutos
- Sincronização incremental é mais rápida
- Aguarde a conclusão antes de sincronizar novamente

---

## 🐛 Troubleshooting

### **Erro: "Configuração HubSpot não encontrada"**
- Verifique se configurou a integração
- Verifique se está ativa (`is_active = true`)

### **Erro: "Erro HubSpot API: 401"**
- Token inválido ou expirado
- Gere um novo Access Token no HubSpot
- Atualize na configuração

### **Erro: "Erro HubSpot API: 429"**
- Rate limit excedido
- Aguarde alguns minutos
- Tente novamente

### **Contatos não aparecem:**
- Verifique se têm email ou telefone
- Verifique logs da Edge Function
- Teste a conexão primeiro

---

## 📍 Resumo Rápido

**Onde:** `/settings` → Aba "Integrações" → Card "HubSpot"

**Como puxar contatos:**
1. Configure o Access Token
2. Teste a conexão
3. Clique em "Sincronizar Todos" ou "Sincronizar Novos"
4. Aguarde processamento
5. Contatos aparecem no CRM

**Status:** ✅ Pronto para uso!

