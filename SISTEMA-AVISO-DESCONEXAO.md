# 🔔 Sistema de Aviso de Desconexão de Instâncias WhatsApp

## 📋 Visão Geral

Sistema automatizado que detecta quando uma instância WhatsApp é desconectada e:
- ✅ Exibe um aviso visual no sistema com QR code para reconexão
- ✅ Envia notificação no sistema (toast)
- ✅ Envia mensagem no WhatsApp (opcional) usando outra instância conectada
- ✅ Permite atualizar o QR code manualmente
- ✅ Marca automaticamente como resolvido quando a instância reconecta

---

## 🚀 Como Funciona

### 1. **Detecção de Desconexão**

O sistema detecta desconexões de duas formas:

#### **Via Webhook da Evolution API** (Tempo Real)
- Quando a Evolution API detecta desconexão, envia um webhook
- O webhook `evolution-webhook` processa o evento
- Cria automaticamente uma notificação no banco de dados
- Busca o QR code da API se disponível

#### **Via Monitoramento Periódico** (Frontend)
- O hook `useInstanceDisconnectionAlert` monitora mudanças de status
- Compara o status anterior com o atual
- Quando detecta mudança de conectado → desconectado, cria alerta

### 2. **Busca do QR Code**

Quando uma desconexão é detectada:
1. Tenta obter o QR code do payload do webhook
2. Se não estiver disponível, busca da Evolution API: `GET /instance/qrcode/{instanceName}`
3. Salva o QR code no banco de dados

### 3. **Exibição do Aviso**

- Componente `InstanceDisconnectionAlerts` exibe alertas ativos
- Cada alerta mostra:
  - Nome da instância desconectada
  - Botão para ver QR code
  - Botão para atualizar QR code
  - Botão para fechar o alerta

### 4. **Notificação WhatsApp** (Opcional)

Se configurado um telefone para notificação:
- **Busca outra instância conectada** da mesma organização para enviar a mensagem
- **Envia mensagem via** `send-whatsapp-message` edge function
- **Mensagem inclui:**
  - Nome da instância desconectada
  - **Link direto para página de reconexão** com QR code
  - Instruções alternativas

**Exemplo de mensagem:**
```
⚠️ ALERTA DE DESCONEXÃO

A instância MinhaInstancia foi desconectada.

🔗 Acesse o link abaixo para reconectar escaneando o QR Code:
https://seu-dominio.com/reconnect/abc-123-def

Ou acesse o sistema e vá em Configurações → Instâncias WhatsApp.
```

### 5. **Reconexão Automática**

Quando a instância reconecta:
- Webhook detecta mudança de status
- Marca todas as notificações pendentes como resolvidas
- Remove alertas do frontend
- Exibe toast de sucesso

---

## 📁 Arquivos Criados

### **Frontend**

1. **`src/hooks/useInstanceDisconnectionAlert.ts`**
   - Hook que monitora desconexões
   - Busca QR code da Evolution API
   - Cria notificações no banco
   - Gerencia alertas ativos

2. **`src/components/crm/InstanceDisconnectionAlert.tsx`**
   - Componente de alerta individual
   - Exibe QR code em dialog
   - Permite atualizar QR code

3. **`src/components/crm/InstanceDisconnectionAlerts.tsx`**
   - Componente wrapper que gerencia múltiplos alertas
   - Integra com o hook de monitoramento

### **Backend**

4. **`supabase/migrations/20250122000000_create_instance_disconnection_notifications.sql`**
   - Cria tabela de notificações
   - Define policies RLS
   - Cria triggers

5. **`supabase/functions/notify-instance-disconnection/index.ts`**
   - Edge function para processar notificações
   - Envia WhatsApp se configurado
   - Inclui link de reconexão na mensagem

### **Páginas**

6. **`src/pages/ReconnectInstance.tsx`**
   - Página dedicada para reconexão
   - Exibe QR code em tela cheia
   - Verifica status automaticamente
   - Atualiza QR code quando necessário

### **Integrações**

6. **`supabase/functions/evolution-webhook/index.ts`** (modificado)
   - Detecta desconexões via webhook
   - Cria notificações automaticamente
   - Marca como resolvido quando reconecta

---

## 🔧 Como Usar

### **1. Aplicar Migração**

Execute o script SQL no Supabase Dashboard:

```sql
-- Ver arquivo: APLICAR-MIGRACAO-DESCONEXAO.sql
```

### **2. Configurar Notificação WhatsApp (Opcional)**

No componente `InstanceDisconnectionAlerts`, passe o telefone:

```tsx
<InstanceDisconnectionAlerts 
  instances={configs} 
  enabled={true}
  whatsappNotificationPhone="5511999999999" // Opcional
/>
```

### **3. Página de Reconexão**

Uma página dedicada foi criada para facilitar a reconexão:
- **Rota:** `/reconnect/:notificationId` ou `/reconnect-instance/:instanceId`
- **Funcionalidades:**
  - Exibe QR code em tela cheia
  - Verifica status automaticamente a cada 5 segundos
  - Botão para atualizar QR code
  - Botão para verificar conexão manualmente
  - Redireciona automaticamente quando reconecta

### **4. Onde os Alertas Aparecem**

Os alertas são exibidos automaticamente em:
- **Página WhatsApp** (`/whatsapp`)
- **Página Settings** (`/settings`)

Para adicionar em outras páginas:

```tsx
import { InstanceDisconnectionAlerts } from '@/components/crm/InstanceDisconnectionAlerts';
import { useEvolutionConfigs } from '@/hooks/useEvolutionConfigs';

// No componente:
const { configs } = useEvolutionConfigs();

// No JSX:
<InstanceDisconnectionAlerts instances={configs} enabled={true} />
```

---

## 📊 Estrutura do Banco de Dados

### **Tabela: `instance_disconnection_notifications`**

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | UUID | ID único |
| `organization_id` | UUID | Organização da instância |
| `instance_id` | UUID | ID da instância desconectada |
| `instance_name` | TEXT | Nome da instância |
| `qr_code` | TEXT | QR code em base64 (opcional) |
| `qr_code_fetched_at` | TIMESTAMPTZ | Quando o QR code foi obtido |
| `notification_sent_at` | TIMESTAMPTZ | Quando a notificação foi criada |
| `whatsapp_notification_sent_at` | TIMESTAMPTZ | Quando WhatsApp foi enviado |
| `whatsapp_notification_to` | TEXT | Telefone que recebeu WhatsApp |
| `resolved_at` | TIMESTAMPTZ | Quando foi resolvido (reconectado) |
| `created_at` | TIMESTAMPTZ | Data de criação |
| `updated_at` | TIMESTAMPTZ | Última atualização |

---

## 🔍 Fluxo Completo

```
1. Instância desconecta
   ↓
2. Evolution API envia webhook (ou monitoramento detecta)
   ↓
3. Sistema busca QR code da API
   ↓
4. Cria notificação no banco
   ↓
5. Envia WhatsApp (se configurado)
   ↓
6. Frontend exibe alerta com QR code
   ↓
7. Usuário escaneia QR code
   ↓
8. Instância reconecta
   ↓
9. Webhook detecta reconexão
   ↓
10. Marca notificação como resolvida
   ↓
11. Alerta desaparece do frontend
```

---

## ⚙️ Configurações Avançadas

### **Desabilitar Monitoramento**

```tsx
<InstanceDisconnectionAlerts 
  instances={configs} 
  enabled={false} // Desabilita monitoramento
/>
```

### **Callback Personalizado**

```tsx
const handleDisconnection = (alert) => {
  console.log('Instância desconectada:', alert);
  // Sua lógica personalizada
};

<InstanceDisconnectionAlerts 
  instances={configs}
  onDisconnectionDetected={handleDisconnection}
/>
```

---

## 🐛 Troubleshooting

### **QR Code não aparece**
- Verifique se a Evolution API está acessível
- Confirme que a API key está correta
- Verifique logs do webhook

### **Notificação WhatsApp não envia**
- Verifique se há outra instância conectada na mesma organização
- Confirme que o telefone está no formato correto (com código do país)
- Verifique logs da edge function `send-whatsapp-message`

### **Alertas não aparecem no frontend**
- Verifique se o hook está habilitado (`enabled={true}`)
- Confirme que as instâncias estão sendo passadas corretamente
- Verifique console do navegador para erros

---

## ✅ Checklist de Implementação

- [x] Tabela de notificações criada
- [x] Hook de monitoramento implementado
- [x] Componente de alerta criado
- [x] Integração com webhook da Evolution
- [x] Busca automática de QR code
- [x] Notificação WhatsApp opcional
- [x] Marcação automática como resolvido
- [x] Integração nas páginas WhatsApp e Settings
- [x] Documentação completa

---

**Data de Criação:** 2025-01-22  
**Última Atualização:** 2025-01-22

