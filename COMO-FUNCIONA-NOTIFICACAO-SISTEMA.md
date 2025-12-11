# 🔔 Como Funciona a Notificação no Sistema

## 📋 Visão Geral

O sistema de notificações visuais funciona em **2 camadas**:

1. **Toast Notifications** - Notificações temporárias (aparecem e desaparecem)
2. **Alert Cards** - Alertas persistentes (ficam até serem resolvidos ou fechados)

---

## 🎯 1. Toast Notifications (Notificações Temporárias)

### **O que são:**
Notificações que aparecem no **canto superior direito** da tela, desaparecem automaticamente após alguns segundos.

### **Quando aparecem:**
- ✅ Quando uma instância **desconecta** (toast vermelho)
- ✅ Quando uma instância **reconecta** (toast verde)
- ✅ Quando o QR code é **atualizado** (toast informativo)

### **Como funcionam:**

```typescript
// Quando detecta desconexão
toast({
  title: '⚠️ Instância Desconectada',
  description: `${instance.instance_name} foi desconectada. Verifique o QR Code para reconectar.`,
  variant: 'destructive', // Vermelho
  duration: 10000, // 10 segundos
});

// Quando detecta reconexão
toast({
  title: '✅ Instância Reconectada',
  description: `${instance.instance_name} foi reconectada com sucesso!`,
  variant: 'default', // Verde
});
```

### **Características:**
- ⏱️ **Duração:** 10 segundos (desconexão) ou padrão (reconexão)
- 🎨 **Cores:** Vermelho (destrutivo) ou Verde (sucesso)
- 📍 **Posição:** Canto superior direito
- ❌ **Fechamento:** Automático ou manual (botão X)

---

## 🚨 2. Alert Cards (Alertas Persistentes)

### **O que são:**
Alertas visuais que aparecem **no topo das páginas** e ficam visíveis até serem resolvidos ou fechados manualmente.

### **Onde aparecem:**
- 📱 **Página WhatsApp** (`/whatsapp`) - No topo, antes do conteúdo
- ⚙️ **Página Settings** (`/settings`) - No topo, antes do conteúdo

### **Como são exibidos:**

```tsx
<Alert variant="destructive" className="mb-4">
  <AlertTriangle className="h-4 w-4" />
  <AlertTitle>
    Instância Desconectada: {instanceName}
    <Button onClick={onDismiss}>X</Button>
  </AlertTitle>
  <AlertDescription>
    <p>A instância WhatsApp foi desconectada. Escaneie o QR Code para reconectar.</p>
    <div className="flex gap-2">
      <Button onClick={() => setShowDialog(true)}>
        <QrCode /> Ver QR Code
      </Button>
      <Button onClick={handleRefreshQrCode}>
        <RefreshCw /> Atualizar QR Code
      </Button>
    </div>
  </AlertDescription>
</Alert>
```

### **Funcionalidades do Alert:**
1. **Ver QR Code** - Abre dialog com QR code em tela cheia
2. **Atualizar QR Code** - Busca novo QR code da API
3. **Fechar (X)** - Remove o alerta (mas não resolve a desconexão)

### **Características:**
- 🔴 **Cor:** Vermelho (destrutivo)
- 📌 **Persistência:** Fica até ser fechado ou instância reconectar
- 🔄 **Atualização:** Pode atualizar QR code sem recarregar página
- 📱 **Responsivo:** Adapta-se a diferentes tamanhos de tela

---

## 🔍 3. Como são Detectadas

### **Método 1: Monitoramento no Frontend**

O hook `useInstanceDisconnectionAlert` monitora mudanças de status:

```typescript
// Compara status anterior com atual
instances.forEach(instance => {
  const previousStatus = previousStatusRef.current.get(instance.id) ?? false;
  const currentStatus = instance.is_connected ?? false;

  // Detectou desconexão (estava conectado e agora não está)
  if (previousStatus && !currentStatus) {
    handleDisconnection(instance); // Cria alerta
  }

  // Detectou reconexão (estava desconectado e agora está conectado)
  if (!previousStatus && currentStatus) {
    handleReconnection(instance); // Remove alerta
  }
});
```

### **Método 2: Webhook da Evolution API**

Quando a Evolution API detecta desconexão, envia webhook:
- Webhook cria notificação no banco
- Frontend detecta mudança via Realtime ou refetch
- Alerta é exibido automaticamente

---

## 📊 4. Fluxo Completo de Notificação

```
1. Instância desconecta
   ↓
2. Sistema detecta (webhook ou monitoramento)
   ↓
3. Cria notificação no banco de dados
   ↓
4. Hook detecta mudança de status
   ↓
5. Exibe TOAST (notificação temporária)
   ↓
6. Cria ALERT CARD (alerta persistente)
   ↓
7. Usuário vê:
   - Toast no canto superior direito (10s)
   - Alert card no topo da página (persistente)
   ↓
8. Usuário pode:
   - Clicar em "Ver QR Code" → Abre dialog
   - Clicar em "Atualizar QR Code" → Busca novo QR
   - Clicar em "X" → Fecha alerta (mas não resolve)
   ↓
9. Quando instância reconecta:
   - Toast de sucesso aparece
   - Alert card desaparece automaticamente
   - Notificação marcada como resolvida no banco
```

---

## 🎨 5. Visualização

### **Toast Notification:**
```
┌─────────────────────────────────────┐
│ ⚠️ Instância Desconectada          │
│ MinhaInstancia foi desconectada... │
│                              [X]    │
└─────────────────────────────────────┘
     (Canto superior direito)
```

### **Alert Card:**
```
┌─────────────────────────────────────────────────────┐
│ ⚠️ Instância Desconectada: MinhaInstancia    [X]   │
│                                                      │
│ A instância WhatsApp foi desconectada. Escaneie... │
│                                                      │
│ [🔲 Ver QR Code]  [🔄 Atualizar QR Code]           │
└─────────────────────────────────────────────────────┘
     (Topo da página)
```

### **Dialog com QR Code:**
```
┌─────────────────────────────────────┐
│ ⚠️ Reconectar Instância: ...       │
│                                     │
│    ┌─────────────┐                 │
│    │             │                 │
│    │   QR CODE   │                 │
│    │             │                 │
│    └─────────────┘                 │
│                                     │
│ Abra o WhatsApp no celular...      │
│                                     │
│              [Fechar]              │
└─────────────────────────────────────┘
```

---

## 🔧 6. Gerenciamento de Estado

### **Estado dos Alertas:**

```typescript
// Map de alertas ativos (chave = instanceId)
const [activeAlerts, setActiveAlerts] = useState<Map<string, DisconnectionAlert>>(new Map());

// Estrutura de um alerta
interface DisconnectionAlert {
  instanceId: string;
  instanceName: string;
  qrCode: string | null;
  notificationId: string;
}
```

### **Como são Adicionados:**
```typescript
// Quando detecta desconexão
setActiveAlerts(prev => new Map(prev).set(instance.id, alert));
```

### **Como são Removidos:**
```typescript
// Quando reconecta ou usuário fecha
setActiveAlerts(prev => {
  const newMap = new Map(prev);
  newMap.delete(instanceId);
  return newMap;
});
```

---

## 📍 7. Onde Aparecem

### **Páginas com Alertas:**

1. **`/whatsapp`** - Página de mensagens WhatsApp
   ```tsx
   <div className="px-4 pt-4">
     <InstanceDisconnectionAlerts instances={configs} enabled={true} />
   </div>
   ```

2. **`/settings`** - Página de configurações
   ```tsx
   <div className="p-3 sm:p-4 lg:p-6">
     <InstanceDisconnectionAlerts instances={configs} enabled={true} />
   </div>
   ```

### **Como Adicionar em Outras Páginas:**

```tsx
import { InstanceDisconnectionAlerts } from '@/components/crm/InstanceDisconnectionAlerts';
import { useEvolutionConfigs } from '@/hooks/useEvolutionConfigs';

// No componente:
const { configs } = useEvolutionConfigs();

// No JSX:
<InstanceDisconnectionAlerts 
  instances={configs} 
  enabled={true} 
/>
```

---

## ⚙️ 8. Configurações

### **Habilitar/Desabilitar:**
```tsx
<InstanceDisconnectionAlerts 
  instances={configs}
  enabled={false} // Desabilita monitoramento
/>
```

### **Callback Personalizado:**
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

## 🔄 9. Sincronização com Banco de Dados

### **Quando Desconecta:**
1. Cria registro em `instance_disconnection_notifications`
2. Salva QR code (se disponível)
3. Marca `notification_sent_at`

### **Quando Reconecta:**
1. Marca `resolved_at` na notificação
2. Remove alerta do frontend
3. Atualiza `is_connected` na instância

### **Persistência:**
- Alertas persistem mesmo após recarregar página
- Sistema verifica notificações pendentes ao carregar
- Sincroniza com banco via Realtime ou refetch

---

## 🐛 10. Troubleshooting

### **Alertas não aparecem:**
- ✅ Verifique se `enabled={true}`
- ✅ Confirme que instâncias estão sendo passadas
- ✅ Verifique console do navegador para erros
- ✅ Confirme que hook está sendo chamado

### **Toast não aparece:**
- ✅ Verifique se `Toaster` está no `App.tsx`
- ✅ Confirme que `useToast` está sendo usado
- ✅ Verifique se não há erros no console

### **Alerta não desaparece:**
- ✅ Verifique se instância realmente reconectou
- ✅ Confirme que webhook está funcionando
- ✅ Verifique se `resolved_at` foi atualizado no banco

---

## 📝 Resumo

| Tipo | Duração | Posição | Ação |
|------|---------|---------|------|
| **Toast** | Temporária (10s) | Canto superior direito | Informa evento |
| **Alert Card** | Persistente | Topo da página | Permite ação |
| **Dialog** | Até fechar | Centro da tela | Exibe QR code |

---

**Última atualização:** 2025-01-22

