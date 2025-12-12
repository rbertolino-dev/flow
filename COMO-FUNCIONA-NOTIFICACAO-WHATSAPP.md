# 📱 Como Funciona a Notificação WhatsApp de Desconexão

## 🔍 Respostas às Perguntas

### **1. Por qual WhatsApp a mensagem é enviada?**

A mensagem é enviada por **outra instância WhatsApp conectada** da mesma organização.

**Fluxo:**
1. Instância A desconecta
2. Sistema busca outra instância conectada da mesma organização (ex: Instância B)
3. Usa a Instância B para enviar a mensagem de alerta
4. Se não houver outra instância conectada, a notificação WhatsApp não é enviada

**Código relevante:**
```typescript
// Buscar outra instância conectada da mesma organização
const { data: connectedInstances } = await supabase
  .from('evolution_config')
  .select('id')
  .eq('organization_id', instance.organization_id)
  .eq('is_connected', true)
  .neq('id', instance.id) // Excluir a instância desconectada
  .limit(1);

if (connectedInstances && connectedInstances.length > 0) {
  const notificationInstanceId = connectedInstances[0].id;
  // Usa esta instância para enviar a mensagem
}
```

---

### **2. Como ele envia o link para reconectar?**

O link é incluído diretamente na mensagem WhatsApp enviada.

**Formato da mensagem:**
```
⚠️ *ALERTA DE DESCONEXÃO*

A instância MinhaInstancia foi desconectada.

🔗 Acesse o link abaixo para reconectar escaneando o QR Code:
https://seu-dominio.com/reconnect/abc-123-def-456

Ou acesse o sistema e vá em Configurações → Instâncias WhatsApp.
```

**Como o link é gerado:**
1. Quando uma desconexão é detectada, uma notificação é criada no banco
2. O ID da notificação é usado para criar o link: `/reconnect/{notificationId}`
3. O link é incluído na mensagem WhatsApp

**Código relevante:**
```typescript
// Criar link de reconexão
const baseUrl = window.location.origin; // URL base do sistema
const reconnectUrl = `${baseUrl}/reconnect/${notification.id}`;

const message = `⚠️ *ALERTA DE DESCONEXÃO*\n\n` +
  `A instância *${instance.instance_name}* foi desconectada.\n\n` +
  `🔗 Acesse o link abaixo para reconectar escaneando o QR Code:\n` +
  `${reconnectUrl}\n\n` +
  `Ou acesse o sistema e vá em Configurações → Instâncias WhatsApp.`;
```

---

## 🔄 Fluxo Completo

```
1. Instância WhatsApp desconecta
   ↓
2. Sistema detecta desconexão (webhook ou monitoramento)
   ↓
3. Cria notificação no banco com ID único
   ↓
4. Busca QR code da Evolution API
   ↓
5. Se configurado telefone para notificação:
   ↓
6. Busca outra instância conectada da mesma organização
   ↓
7. Gera link: https://seu-dominio.com/reconnect/{notificationId}
   ↓
8. Envia mensagem WhatsApp usando a instância conectada
   ↓
9. Mensagem inclui:
   - Nome da instância desconectada
   - Link direto para reconexão
   - Instruções alternativas
   ↓
10. Usuário clica no link
   ↓
11. Abre página de reconexão com QR code
   ↓
12. Usuário escaneia QR code
   ↓
13. Sistema detecta reconexão automaticamente
   ↓
14. Marca notificação como resolvida
```

---

## 📋 Configuração

### **Habilitar Notificação WhatsApp**

No componente `InstanceDisconnectionAlerts`, passe o telefone:

```tsx
<InstanceDisconnectionAlerts 
  instances={configs} 
  enabled={true}
  whatsappNotificationPhone="5511999999999" // Com código do país (55 para Brasil)
/>
```

### **Configurar URL Base (Edge Functions)**

Para edge functions, configure a variável de ambiente:

```bash
# No Supabase Dashboard > Settings > Edge Functions > Environment Variables
APP_URL=https://seu-dominio.com
```

Ou o sistema tentará usar o `window.location.origin` no frontend.

---

## ⚠️ Requisitos

Para a notificação WhatsApp funcionar:

1. ✅ **Pelo menos 2 instâncias** na mesma organização
2. ✅ **Pelo menos 1 instância conectada** (para enviar a mensagem)
3. ✅ **Telefone configurado** no componente
4. ✅ **Telefone no formato correto** (com código do país, ex: 5511999999999)

---

## 🐛 Troubleshooting

### **Mensagem não é enviada**

**Possíveis causas:**
- Não há outra instância conectada na organização
- Telefone não está configurado
- Telefone está em formato incorreto
- Instância conectada não consegue enviar mensagens

**Solução:**
1. Verifique se há outra instância conectada
2. Confirme que o telefone está configurado
3. Verifique logs da edge function `send-whatsapp-message`

### **Link não funciona**

**Possíveis causas:**
- URL base não está configurada corretamente
- Notificação foi deletada
- Usuário não tem permissão para acessar

**Solução:**
1. Verifique a variável `APP_URL` nas edge functions
2. Confirme que a notificação ainda existe no banco
3. Verifique permissões RLS da tabela

---

## 📝 Exemplo Prático

**Cenário:**
- Organização tem 3 instâncias: A, B e C
- Instância A desconecta
- Instâncias B e C estão conectadas
- Telefone configurado: 5511999999999

**O que acontece:**
1. Sistema detecta que A desconectou
2. Busca instâncias conectadas (encontra B e C)
3. Usa a primeira encontrada (ex: B) para enviar
4. Envia mensagem para 5511999999999 usando instância B
5. Mensagem inclui link: `https://seu-dominio.com/reconnect/abc-123`
6. Usuário clica no link e vê QR code da instância A
7. Escaneia e reconecta
8. Sistema marca como resolvido

---

**Última atualização:** 2025-01-22


