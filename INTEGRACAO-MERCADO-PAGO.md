# 💳 Integração Mercado Pago

Documentação completa da integração com Mercado Pago para geração de links de pagamento.

## 📋 Visão Geral

Esta integração permite:
- ✅ Gerar links de pagamento (Checkout Pro) via Mercado Pago
- ✅ Receber notificações automáticas de pagamento via webhook
- ✅ Rastrear status de pagamentos
- ✅ Integrar com workflows automatizados
- ✅ Suportar ambiente Sandbox e Produção

## 🚀 Configuração Inicial

### 1. Obter Credenciais do Mercado Pago

1. Acesse o [Painel do Mercado Pago](https://www.mercadopago.com.br/developers/panel)
2. Navegue até **Credenciais**
3. Copie o **Access Token** (Test ou Production)
4. Opcionalmente, copie a **Public Key** (para Checkout Transparente)

### 2. Configurar no Sistema

1. Acesse a página de configurações do sistema
2. Localize a seção **Integração Mercado Pago**
3. Preencha:
   - **Ambiente**: Sandbox (teste) ou Produção
   - **Access Token**: Token obtido no painel
   - **Public Key**: (Opcional)
   - **Webhook URL**: (Opcional - usa padrão se vazio)
4. Clique em **Salvar configuração**
5. Teste a conexão clicando em **Testar conexão**

### 3. Configurar Webhook no Mercado Pago

1. No painel do Mercado Pago, vá em **Webhooks**
2. Adicione a URL:
   ```
   https://[SEU-SUPABASE-URL]/functions/v1/mercado-pago-webhook
   ```
3. Selecione os eventos:
   - `payment`
   - `merchant_order` (opcional)

## 📦 Estrutura do Banco de Dados

### Tabela: `mercado_pago_configs`

Armazena as configurações por organização:
- `access_token`: Token de acesso do Mercado Pago
- `public_key`: Chave pública (opcional)
- `environment`: `sandbox` ou `production`
- `webhook_url`: URL personalizada (opcional)

### Tabela: `mercado_pago_payments`

Armazena todos os pagamentos gerados:
- `mercado_pago_preference_id`: ID da preferência criada
- `mercado_pago_payment_id`: ID do pagamento (preenchido quando confirmado)
- `payment_link`: Link para o cliente pagar
- `status`: Status do pagamento
- `valor_pago`: Valor pago (quando aprovado)
- `data_pagamento`: Data do pagamento

## 🔧 Como Usar

### No Frontend

#### 1. Gerar Link de Pagamento

```tsx
import { MercadoPagoPaymentForm } from "@/components/mercado-pago/MercadoPagoPaymentForm";

<MercadoPagoPaymentForm
  leadId={lead.id}
  leadName={lead.name}
  leadEmail={lead.email}
  leadPhone={lead.phone}
  leadCpfCnpj={lead.cpf_cnpj}
  onSuccess={(payment) => {
    console.log("Link gerado:", payment.payment_link);
  }}
/>
```

#### 2. Usar o Hook

```tsx
import { useMercadoPago } from "@/hooks/useMercadoPago";

const { 
  createPayment, 
  payments, 
  isLoadingPayments 
} = useMercadoPago();

// Criar pagamento
await createPayment({
  leadId: "uuid",
  payer: {
    name: "João Silva",
    email: "joao@exemplo.com",
    phone: "11999999999",
    cpfCnpj: "12345678900"
  },
  payment: {
    valor: 100.00,
    descricao: "Pagamento de serviço",
    referenciaExterna: "REF-123"
  }
});
```

#### 3. Painel de Configuração

```tsx
import { MercadoPagoIntegrationPanel } from "@/components/mercado-pago/MercadoPagoIntegrationPanel";

<MercadoPagoIntegrationPanel />
```

## 🔄 Fluxo de Pagamento

1. **Criação do Link**
   - Sistema cria uma preferência no Mercado Pago
   - Recebe o `init_point` (link de pagamento)
   - Registra no banco de dados

2. **Cliente Paga**
   - Cliente acessa o link
   - Realiza o pagamento no checkout do Mercado Pago
   - Mercado Pago processa o pagamento

3. **Notificação (Webhook)**
   - Mercado Pago envia notificação para o webhook
   - Sistema atualiza status do pagamento no banco
   - Se aprovado, pode atualizar estágio do lead

## 📊 Status de Pagamento

Os status possíveis são:
- `pending`: Aguardando pagamento
- `approved`: Pagamento aprovado
- `authorized`: Pagamento autorizado
- `in_process`: Em processamento
- `in_mediation`: Em mediação
- `rejected`: Pagamento rejeitado
- `cancelled`: Cancelado
- `refunded`: Reembolsado
- `charged_back`: Estornado

## 🔌 Edge Functions

### `mercado-pago-create-payment`

Cria uma preferência de pagamento no Mercado Pago.

**Endpoint:** `/functions/v1/mercado-pago-create-payment`

**Request:**
```json
{
  "organizationId": "uuid",
  "leadId": "uuid",
  "payer": {
    "name": "João Silva",
    "email": "joao@exemplo.com",
    "phone": "11999999999",
    "cpfCnpj": "12345678900"
  },
  "payment": {
    "valor": 100.00,
    "descricao": "Descrição do pagamento",
    "referenciaExterna": "REF-123"
  }
}
```

**Response:**
```json
{
  "success": true,
  "payment": {
    "id": "uuid",
    "payment_link": "https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=...",
    "mercado_pago_preference_id": "1234567890-abc-def-ghi"
  }
}
```

### `mercado-pago-webhook`

Recebe notificações do Mercado Pago sobre mudanças de status.

**Endpoint:** `/functions/v1/mercado-pago-webhook`

**Processa:**
- Notificações de pagamento
- Atualiza status no banco
- Registra dados do pagamento

## 🧪 Testes

### Ambiente Sandbox

1. Use credenciais de **Test** do Mercado Pago
2. Configure ambiente como `sandbox`
3. Use cartões de teste:
   - **Aprovado**: 5031 4332 1540 6351
   - **Rejeitado**: 5031 4332 1540 6351 (CVV: 123)

### Testar Webhook Localmente

Use o [ngrok](https://ngrok.com/) para expor seu webhook local:

```bash
ngrok http 54321
```

Configure a URL do ngrok no painel do Mercado Pago.

## 📝 Exemplo Completo

```tsx
import { MercadoPagoPaymentForm } from "@/components/mercado-pago/MercadoPagoPaymentForm";
import { useMercadoPago } from "@/hooks/useMercadoPago";

function LeadDetail({ lead }) {
  const { payments, getPaymentsByLead } = useMercadoPago();

  return (
    <div>
      <h2>{lead.name}</h2>
      
      {/* Gerar link de pagamento */}
      <MercadoPagoPaymentForm
        leadId={lead.id}
        leadName={lead.name}
        leadEmail={lead.email}
        leadPhone={lead.phone}
        leadCpfCnpj={lead.cpf_cnpj}
        onSuccess={(payment) => {
          // Enviar link via WhatsApp
          sendWhatsAppMessage(lead.phone, `Link de pagamento: ${payment.payment_link}`);
        }}
      />

      {/* Listar pagamentos */}
      <div>
        <h3>Pagamentos</h3>
        {payments
          .filter(p => p.lead_id === lead.id)
          .map(payment => (
            <div key={payment.id}>
              <p>Valor: R$ {payment.valor}</p>
              <p>Status: {payment.status}</p>
              {payment.payment_link && (
                <a href={payment.payment_link} target="_blank">
                  Ver link
                </a>
              )}
            </div>
          ))}
      </div>
    </div>
  );
}
```

## 🔒 Segurança

- ✅ Access Token armazenado de forma segura no banco
- ✅ RLS (Row Level Security) ativado
- ✅ Validação de dados antes de criar pagamento
- ✅ Webhook valida origem das notificações

## 📚 Recursos

- [Documentação Oficial Mercado Pago](https://www.mercadopago.com.br/developers/pt/docs)
- [API de Preferências](https://www.mercadopago.com.br/developers/pt/reference/preferences/_checkout_preferences/post)
- [API de Pagamentos](https://www.mercadopago.com.br/developers/pt/reference/payments/_payments_id/get)
- [Webhooks](https://www.mercadopago.com.br/developers/pt/docs/your-integrations/notifications/webhooks)

## ⚠️ Troubleshooting

### Erro: "Configuração não encontrada"
- Verifique se a configuração foi salva corretamente
- Confirme que está usando a organização correta

### Erro: "Access Token inválido"
- Verifique se o token está correto
- Confirme se está usando o ambiente correto (sandbox/production)

### Webhook não recebe notificações
- Verifique se a URL está configurada no painel do Mercado Pago
- Confirme que a URL está acessível publicamente
- Verifique os logs da Edge Function

### Link não funciona
- Verifique se está usando o link correto (sandbox vs production)
- Confirme que a preferência foi criada corretamente
- Verifique os logs da Edge Function

---

**Última atualização:** Janeiro 2025

