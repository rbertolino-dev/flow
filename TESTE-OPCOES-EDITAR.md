# 🧪 Como Testar se as Opções Estão Aparecendo

## ✅ Passos para Validar

### 1. Limpar Cache do Navegador
- **Windows/Linux**: `Ctrl + Shift + Delete`
- **Mac**: `Cmd + Shift + Delete`
- Ou use **Modo Anônimo/Privado**

### 2. Recarregar a Página
- **Windows/Linux**: `Ctrl + F5` (hard refresh)
- **Mac**: `Cmd + Shift + R`

### 3. Abrir Console do Navegador
- Pressione `F12`
- Vá na aba **Console**

### 4. Testar as Opções

#### A. No Dropdown de Ações (três pontos)
1. Clique nos **três pontos verticais** (⋮) de qualquer contrato na lista
2. Você DEVE ver:
   - 👁️ **Visualizar**
   - 💬 **Editar Mensagem WhatsApp** ← **DEVE APARECER**
   - 📄 **Editar Template** ← **DEVE APARECER** (se o contrato tiver template)
   - ──────────── (separador)
   - ⬇️ Baixar PDF
   - ✍️ Assinar
   - 📤 Enviar
   - ❌ Cancelar

#### B. Na Coluna Template
1. Olhe a coluna **"Template"** na tabela
2. Ao lado do nome do template, deve ter um **pequeno ícone de documento** (📄)
3. Clique nele para editar o template

### 5. Verificar Console
Quando clicar em "Editar Mensagem WhatsApp" ou "Editar Template", você deve ver no console:
```
🔵 Editando mensagem do contrato: [id do contrato]
🔵 Editando template do contrato: [id do contrato] [id do template]
```

## 🔍 Se NÃO Aparecer

### Verificar no Console do Navegador
1. Abra o Console (F12)
2. Procure por erros (em vermelho)
3. Procure por mensagens de debug (🔵)

### Verificar se as Funções Estão Sendo Passadas
No Console, digite:
```javascript
// Verificar se o componente está renderizado
document.querySelectorAll('[data-testid="contract-row"]')
```

### Verificar Network
1. Abra a aba **Network** (F12)
2. Recarregue a página
3. Verifique se o bundle JavaScript foi carregado:
   - Procure por `index-*.js`
   - Verifique se o hash mudou (deve ser diferente do anterior)

## 🐛 Debug Adicional

Se ainda não aparecer, adicione este código temporário no Console:

```javascript
// Verificar se os contratos têm template
const contracts = document.querySelectorAll('tbody tr');
contracts.forEach((row, index) => {
  console.log(`Contrato ${index}:`, row);
});
```

## ✅ Checklist

- [ ] Cache do navegador limpo
- [ ] Página recarregada com Ctrl+F5
- [ ] Console aberto (F12)
- [ ] Clicou nos três pontos de um contrato
- [ ] Viu "Editar Mensagem WhatsApp" no dropdown
- [ ] Viu "Editar Template" no dropdown (se contrato tiver template)
- [ ] Viu ícone de documento na coluna Template
- [ ] Console mostra logs quando clica nas opções

## 📝 Nota

As opções só aparecem se:
- ✅ O contrato tiver um template (para "Editar Template")
- ✅ As funções `onEditMessage` e `onEditTemplate` estiverem sendo passadas corretamente

Se o contrato não tiver template, apenas "Editar Mensagem WhatsApp" aparecerá.


