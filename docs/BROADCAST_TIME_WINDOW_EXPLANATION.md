# Como Funciona o Ajuste Automático de Horários

## 📋 Visão Geral

Quando você cria uma campanha de disparo em massa e há uma **janela de horário ativa**, o sistema automaticamente ajusta o agendamento das mensagens para respeitar os horários permitidos.

## 🔄 Fluxo de Funcionamento

### 1. **Ao Iniciar uma Campanha**

Quando você clica em "Iniciar" em uma campanha:

```
┌─────────────────────────────────────┐
│ 1. Verifica se há janela ativa      │
│    └─> Se SIM: Valida horário atual │
│    └─> Se NÃO: Permite iniciar      │
└─────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│ 2. Se fora do horário:             │
│    └─> BLOQUEIA e informa próximo   │
│        horário disponível            │
└─────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│ 3. Se dentro do horário:            │
│    └─> Inicia agendamento           │
└─────────────────────────────────────┘
```

### 2. **Durante o Agendamento das Mensagens**

Para cada mensagem na fila, o sistema:

```
Mensagem 1: Horário calculado = 14:30
  └─> Está na janela? (09:00-18:00) ✅ SIM
  └─> Agenda para 14:30

Mensagem 2: Horário calculado = 14:35
  └─> Está na janela? ✅ SIM
  └─> Agenda para 14:35

Mensagem 3: Horário calculado = 18:15
  └─> Está na janela? ❌ NÃO (fora de 18:00)
  └─> Busca próximo horário permitido
  └─> Próximo: Amanhã 09:00
  └─> Agenda para 09:00 (próximo dia)

Mensagem 4: Horário calculado = 09:05
  └─> Está na janela? ✅ SIM
  └─> Agenda para 09:05
```

## 📊 Exemplo Prático

### Cenário:
- **Janela ativa**: Segunda a Sexta, 09:00 - 18:00
- **Campanha**: 100 mensagens
- **Delay**: 30-60 segundos entre mensagens
- **Início**: Sexta-feira, 17:30

### O que acontece:

```
Mensagens 1-20: 17:30 → 17:50 ✅ (dentro da janela)
Mensagens 21-30: 17:50 → 18:10 ❌ (fora da janela)
  └─> Ajustadas para Segunda-feira 09:00

Mensagens 31-100: Segunda 09:00 → 09:35 ✅ (dentro da janela)
```

**Resultado**: 
- 20 mensagens enviadas na sexta (17:30-17:50)
- 10 mensagens agendadas para segunda (09:00)
- 70 mensagens agendadas para segunda (09:00-09:35)

## 🔍 Funções Utilizadas

### `isTimeInWindow(window, time)`
Verifica se um horário específico está dentro da janela permitida.

```typescript
// Exemplo:
isTimeInWindow(window, new Date('2024-01-15 14:30')) 
// → true (dentro de 09:00-18:00)

isTimeInWindow(window, new Date('2024-01-15 20:00'))
// → false (fora de 09:00-18:00)
```

### `getNextWindowTime(window, fromTime)`
Busca o próximo horário permitido a partir de um horário.

```typescript
// Exemplo:
getNextWindowTime(window, new Date('2024-01-15 20:00'))
// → Date('2024-01-16 09:00') (próxima segunda-feira 09:00)
```

### `calculateEstimatedTimeWithWindow(...)`
Calcula estimativa de tempo considerando a janela.

```typescript
// Retorna:
{
  estimatedDuration: 3600, // segundos
  estimatedEndTime: Date,
  willExceedWindow: false,
  messagesInWindow: 100,
  messagesOutOfWindow: 0
}
```

## ⚙️ Código de Agendamento

O código que faz o ajuste automático está em `BroadcastCampaigns.tsx`:

```typescript
// Para cada mensagem na fila
queueItems.map((item, index) => {
  // Calcula horário baseado no delay
  let scheduledTime = new Date(currentTime + delay);
  
  // Se há janela ativa
  if (activeTimeWindow) {
    // Verifica se está na janela
    if (!isTimeInWindow(activeTimeWindow, scheduledTime)) {
      // Busca próximo horário permitido
      const nextWindowTime = getNextWindowTime(activeTimeWindow, scheduledTime);
      if (nextWindowTime) {
        scheduledTime = nextWindowTime; // ✅ AJUSTA AUTOMATICAMENTE
      }
    }
  }
  
  // Agenda a mensagem
  return updateQueueItem(item.id, scheduledTime);
});
```

## 🎯 Benefícios

1. **Respeita horários comerciais**: Não envia fora do horário configurado
2. **Automático**: Não precisa ajustar manualmente
3. **Inteligente**: Pula automaticamente para próximo horário válido
4. **Estimativa precisa**: Mostra tempo real considerando janela
5. **Seguro**: Bloqueia início de campanha fora do horário

## ⚠️ Observações Importantes

- Mensagens fora do horário são **automaticamente reagendadas** para o próximo período permitido
- Se não houver próximo horário configurado, a mensagem será agendada mas **bloqueada** no processamento
- A estimativa de tempo considera apenas horários dentro da janela
- O sistema verifica até 7 dias à frente para encontrar próximo horário

