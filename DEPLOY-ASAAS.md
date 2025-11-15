# 🚀 Deploy da Integração Asaas

## 📋 Checklist de Deploy

### 1️⃣ Aplicar Migração no Banco de Dados

**Via Supabase Dashboard (Recomendado):**
1. Acesse: https://supabase.com/dashboard
2. Selecione seu projeto
3. Vá em **SQL Editor**
4. Abra o arquivo: `aplicar-migracao-asaas.sql`
5. Cole todo o conteúdo e clique em **RUN**

**Verificar se funcionou:**
- Dashboard > Table Editor > `asaas_configs` deve aparecer
- Verifique se as políticas RLS foram criadas

---

### 2️⃣ Deploy da Edge Function

No terminal (na pasta `agilize`):

```bash
supabase functions deploy asaas-create-charge
```

**Verificar se funcionou:**
- Dashboard > Edge Functions > `asaas-create-charge` deve aparecer
- Clique e teste manualmente (botão "Invoke")

---

### 3️⃣ Configurar a API Asaas na Interface

1. Inicie o app:
   ```bash
   npm run dev
   ```

2. Acesse: **Fluxo Automatizado** > Aba **Integração Asaas**

3. Preencha:
   - **Ambiente:** Sandbox (para testes) ou Produção
   - **API Key:** Cole sua chave do Asaas
   - **Base URL:** Deixe o padrão ou ajuste se necessário

4. Clique em **Salvar configuração**

5. Clique em **Testar conexão** para validar

---

## 🔑 Como Obter a API Key do Asaas

1. Acesse o painel do Asaas: https://www.asaas.com
2. Faça login na sua conta
3. Vá em **Configurações** > **Integrações** > **API**
4. Copie a **API Key**:
   - **Sandbox:** Para testes (não gera cobranças reais)
   - **Produção:** Para uso real (gera cobranças reais)

---

## ✅ Funcionalidades Implementadas

- ✅ Configuração por organização (multi-tenant)
- ✅ Suporte a ambiente Sandbox e Produção
- ✅ Criação automática de clientes no Asaas
- ✅ Geração de boletos via API
- ✅ Teste de conexão integrado
- ✅ Armazenamento seguro de credenciais (RLS)

---

## 🔧 Como Usar nos Fluxos de Cobrança

A Edge Function `asaas-create-charge` pode ser chamada de qualquer lugar do código:

```typescript
const response = await fetch(
  `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/asaas-create-charge`,
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({
      organizationId: "uuid-da-organizacao",
      customer: {
        name: "Nome do Cliente",
        cpfCnpj: "123.456.789-00", // Opcional
        email: "cliente@email.com", // Opcional
        phone: "11999999999", // Opcional
      },
      payment: {
        value: 100.50,
        dueDate: "2025-02-15", // Formato: yyyy-MM-dd
        description: "Descrição da cobrança",
        externalReference: "REF-123", // Opcional
      },
    }),
  }
);

const data = await response.json();
// data.payment contém os dados do boleto (link, código de barras, etc.)
```

---

## 🐛 Troubleshooting

**Erro: "Configuração Asaas não encontrada"**
- Verifique se a migração foi aplicada
- Verifique se você salvou a configuração na interface

**Erro: "Erro ao criar cliente no Asaas"**
- Verifique se a API Key está correta
- Verifique se está usando o ambiente correto (sandbox/produção)
- Verifique os logs da Edge Function no Dashboard

**Erro: "Erro ao criar cobrança no Asaas"**
- Verifique se o cliente foi criado corretamente
- Verifique se os dados da cobrança estão corretos (valor, data de vencimento)
- Verifique os logs da Edge Function

---

## 📚 Documentação da API Asaas

- Documentação oficial: https://docs.asaas.com
- Endpoint de clientes: `/api/v3/customers`
- Endpoint de pagamentos: `/api/v3/payments`

---

**Última atualização:** Janeiro 2025

