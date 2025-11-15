# 🎨 Melhores Práticas: UX & Implementação de Boletos

## 🎯 Princípios de Design

### 1. Simplicidade
- ✅ Botão claro "Gerar Boleto"
- ✅ Formulário minimalista (apenas campos obrigatórios)
- ✅ Confirmação instantânea
- ✅ Downloads em um clique

### 2. Visibilidade
- ✅ Status colorido (verde=pago, amarelo=pendente, etc)
- ✅ Histórico completo visível
- ✅ Dados essenciais em destaque
- ✅ Mensagens de erro claras

### 3. Confiabilidade
- ✅ Validações antes de enviar
- ✅ Tratamento robusto de erros
- ✅ Feedback de carregamento
- ✅ Confirmações antes de deletar

### 4. Eficiência
- ✅ Geração em < 2 segundos
- ✅ Cache de dados
- ✅ Sem recarregamento necessário
- ✅ Atalhos de teclado (futuro)

---

## 📋 Checklist de UX

### Componente AsaasBoletoForm

```javascript
// ✅ BOM: Usuário amigável
<AsaasBoletoForm
  leadId={lead.id}
  leadName={lead.name}              // Nome legível
  leadEmail={lead.email}            // Pré-preenchido
  leadPhone={lead.phone}            // Facilita criação
  onSuccess={(boleto) => {          // Callback claro
    toast("Boleto criado com sucesso!");
  }}
/>

// ❌ RUIM: Confuso
<AsaasBoletoForm leadId={lead.id} />
// Usuário não sabe se dados estão corretos
```

### Valores Padrão

```typescript
// ✅ BOM: Valores lógicos
const defaultData = {
  valor: "",                              // Não assumir valor
  dataVencimento: format(                 // Próximos 30 dias
    addDays(new Date(), 30), 
    "yyyy-MM-dd"
  ),
  descricao: "",                         // Deixar para usuário
};

// ❌ RUIM: Valores mágicos
const defaultData = {
  valor: 0,                              // Confunde
  dataVencimento: "2099-12-31",         // Muito longe
  descricao: "Cobrança",               // Genérico
};
```

### Validações

```typescript
// ✅ BOM: Validar tudo
function validateForm(data) {
  if (!data.valor || data.valor <= 0) {
    return "Valor deve ser maior que 0";
  }
  if (!data.dataVencimento) {
    return "Selecione uma data de vencimento";
  }
  if (new Date(data.dataVencimento) < new Date()) {
    return "Data não pode ser no passado";
  }
  return null;
}

// ❌ RUIM: Validar pouco
if (!data.valor) return "Erro";  // Mensagem vaga
```

### Mensagens de Erro

```typescript
// ✅ BOM: Específico
toast({
  title: "Erro ao criar boleto",
  description: "CPF inválido. Verifique e tente novamente.",
  variant: "destructive",
});

// ❌ RUIM: Genérico
toast({
  title: "Erro",
  description: "Algo deu errado",
  variant: "destructive",
});
```

### Estados de Carregamento

```tsx
// ✅ BOM: Feedback visual
<Button disabled={isCreatingBoleto}>
  {isCreatingBoleto ? (
    <>
      <Loader2 className="h-4 w-4 animate-spin mr-2" />
      Gerando...
    </>
  ) : (
    "Gerar Boleto"
  )}
</Button>

// ❌ RUIM: Sem feedback
<Button disabled={isCreatingBoleto}>
  Gerar Boleto
</Button>
// Usuário não sabe o que está acontecendo
```

---

## 🏗️ Padrões de Integração

### Padrão 1: Em Modal (Recomendado)

```tsx
// ✅ BOM: Não interrompe fluxo principal
<Dialog open={showDialog} onOpenChange={setShowDialog}>
  <DialogContent>
    <AsaasBoletoForm />
  </DialogContent>
</Dialog>

// Usuário pode:
// - Gerar boleto sem sair do lead
// - Fechar e voltar ao fluxo anterior
// - Tentar de novo se errar
```

### Padrão 2: Em Abas

```tsx
// ✅ BOM: Organizado e fácil de achar
<Tabs>
  <TabsList>
    <TabsTrigger value="info">Informações</TabsTrigger>
    <TabsTrigger value="boletos">Boletos</TabsTrigger>
    <TabsTrigger value="workflow">Workflows</TabsTrigger>
  </TabsList>

  <TabsContent value="boletos">
    <AsaasBoletoForm />
    <BoletosList />
  </TabsContent>
</Tabs>
```

### Padrão 3: Inline (Para Listas)

```tsx
// ✅ BOM: Rápido e direto
export function LeadRow({ lead }) {
  return (
    <tr>
      <td>{lead.name}</td>
      <td>{lead.email}</td>
      <td>
        <AsaasBoletoForm
          leadId={lead.id}
          leadName={lead.name}
          leadEmail={lead.email}
        />
      </td>
    </tr>
  );
}
```

---

## 🎯 Workflow Recomendado

### Passo 1: Seleção de Lead
```
┌─────────────────┐
│ Buscar Lead     │
│ └─ Encontrado   │
└────────┬────────┘
         ▼
```

### Passo 2: Confirmação de Dados
```
┌──────────────────────────┐
│ Nome: João da Silva      │
│ Email: joao@email.com    │
│ Telefone: 11 99999-9999 │
│ CPF: 123.456.789-00      │
└────────┬─────────────────┘
         ▼
```

### Passo 3: Preencher Dados do Boleto
```
┌──────────────────────────┐
│ Valor: 500.00            │
│ Vencimento: 28/02/2025   │
│ Descrição: Fatura #001   │
└────────┬─────────────────┘
         ▼
```

### Passo 4: Gerar
```
┌──────────────────────────┐
│ [Gerar Boleto...]        │
│ ░░░░░░░░░░░░░░░░ 50%    │
└────────┬─────────────────┘
         ▼
```

### Passo 5: Sucesso
```
┌──────────────────────────┐
│ ✓ Boleto criado!        │
│ Código de barras: 12345...│
│ Vencimento: 28/02/2025   │
│                          │
│ [Download PDF]           │
│ [Abrir Link]             │
│ [Copiar Código]          │
└──────────────────────────┘
```

---

## 💾 Persistência de Dados

### ✅ BOM: Salvar progresso

```typescript
// Se usuário sair sem gerar, salvar dados
const [formData, setFormData] = useState(() => {
  const saved = localStorage.getItem('boleto_draft');
  return saved ? JSON.parse(saved) : defaultData;
});

// Salvar a cada mudança
useEffect(() => {
  localStorage.setItem('boleto_draft', JSON.stringify(formData));
}, [formData]);

// Limpar após sucesso
onSuccess(() => {
  localStorage.removeItem('boleto_draft');
});
```

### ❌ RUIM: Perder dados

```typescript
// Usuário perde dados se fechar accidentalmente
const [formData, setFormData] = useState(defaultData);
// Sem salvar em localStorage
```

---

## 🔔 Notificações

### Tipos de Feedback

```typescript
// ✅ Sucesso
toast({
  title: "Boleto criado",
  description: "Código: 123456789",
  variant: "default",
  duration: 3000,  // Desaparece em 3s
});

// ⚠️ Aviso
toast({
  title: "Atenção",
  description: "PDF pode demorar alguns segundos",
  variant: "warning",
  duration: 5000,
});

// ❌ Erro
toast({
  title: "Erro",
  description: "Verifique a API Key",
  variant: "destructive",
  action: <Button>Tentar novamente</Button>,
});

// ℹ️ Info
toast({
  title: "Dica",
  description: "Clique para compartilhar o boleto",
  variant: "info",
  duration: 4000,
});
```

---

## 🎨 Design System

### Cores Recomendadas

```css
/* Status do Boleto */
--status-pending: #FCD34D    /* Amarelo - Pendente */
--status-open: #3B82F6      /* Azul - Aberto */
--status-paid: #10B981      /* Verde - Pago */
--status-overdue: #F97316   /* Laranja - Vencido */
--status-cancelled: #EF4444 /* Vermelho - Cancelado */
--status-refunded: #A78BFA  /* Roxo - Reembolsado */
```

### Ícones Recomendados

```typescript
import {
  FileText,      // Para boleto
  Download,      // Para download PDF
  DollarSign,    // Para valor
  Calendar,      // Para vencimento
  Barcode,       // Para código de barras
  CheckCircle,   // Para sucesso
  AlertCircle,   // Para aviso
  XCircle,       // Para erro
  Loader,        // Para carregando
} from "lucide-react";
```

---

## 📱 Responsividade

### Mobile First

```tsx
// ✅ BOM: Responsivo desde o começo
<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
  <AsaasBoletoForm />     {/* Full width em mobile */}
  <BoletosList />          {/* Full width em mobile */}
</div>

// ❌ RUIM: Desktop-only
<div className="flex gap-4">
  <div style={{ width: "50%" }}>
    <AsaasBoletoForm />
  </div>
</div>
// Quebra em mobile!
```

### Touch-Friendly

```tsx
// ✅ BOM: Botões maiores para toque
<Button className="py-2 px-4 min-h-[44px]">
  Gerar Boleto
</Button>

// ❌ RUIM: Botões pequenos
<button style={{ padding: "4px 8px" }}>
  Gerar Boleto
</button>
// Difícil de clicar em mobile!
```

---

## ⚡ Performance

### Otimizações

```typescript
// ✅ BOM: Memoização
const FormComponent = memo(function FormComponent(props) {
  return <AsaasBoletoForm {...props} />;
});

// ✅ BOM: React Query
const { createBoleto } = useAsaasBoletos();
// Caching automático

// ✅ BOM: Lazy loading
const BoletosList = lazy(() => import('./BoletosList'));

// ❌ RUIM: Sem otimização
function Page() {
  return <AsaasBoletoForm />; // Re-renderiza sempre
}
```

### Animações

```typescript
// ✅ BOM: Smooth
<Button
  onClick={handleClick}
  className="transition-all duration-200 hover:scale-105"
>
  Gerar Boleto
</Button>

// ❌ RUIM: Jarring
<Button onClick={handleClick}>
  Gerar Boleto
</Button>
// Sem feedback visual suave
```

---

## 📊 Métricas a Acompanhar

### Comportamento do Usuário

```
1. Taxa de sucesso
   = (Boletos criados com sucesso) / (Tentativas)
   Target: > 95%

2. Tempo médio de criação
   = Soma de durações / Quantidade
   Target: < 3s

3. Taxa de abandono
   = (Começou a criar) - (Finalizou)
   Target: < 10%

4. Taxa de erro
   = (Erros) / (Tentativas)
   Target: < 5%
```

### Monitorar em Produção

```typescript
// Adicionar telemetria
import { analytics } from '@/lib/analytics';

const handleCreateBoleto = async () => {
  const startTime = Date.now();
  try {
    await createBoleto(data);
    analytics.track('boleto_created', {
      duration: Date.now() - startTime,
      valor: data.valor,
    });
  } catch (error) {
    analytics.track('boleto_error', {
      duration: Date.now() - startTime,
      error: error.message,
    });
  }
};
```

---

## 🧪 Testes Recomendados

### Testes de Componente

```typescript
describe('AsaasBoletoForm', () => {
  it('deve renderizar o formulário', () => {
    render(<AsaasBoletoForm leadId="123" leadName="João" />);
    expect(screen.getByText('Gerar Boleto')).toBeInTheDocument();
  });

  it('deve validar valor', async () => {
    render(<AsaasBoletoForm leadId="123" leadName="João" />);
    const btn = screen.getByText('Gerar Boleto');
    fireEvent.click(btn);
    // Deve mostrar erro de validação
  });

  it('deve desabilitar botão enquanto carregando', async () => {
    render(<AsaasBoletoForm leadId="123" leadName="João" />);
    // Preencher e submeter
    await waitFor(() => {
      expect(screen.getByText('Gerando...')).toBeDisabled();
    });
  });
});
```

### Testes de Integração

```typescript
describe('Boleto Flow', () => {
  it('deve criar boleto e listar', async () => {
    // Render componente
    // Gerar boleto
    // Verificar se aparece na lista
    // Verificar se pode baixar PDF
  });
});
```

---

## 📚 Documentação no Código

```typescript
/**
 * Componente para gerar boletos via Asaas
 * 
 * @example
 * <AsaasBoletoForm
 *   leadId="uuid-do-lead"
 *   leadName="João Silva"
 *   onSuccess={(boleto) => console.log(boleto)}
 * />
 * 
 * @param {string} leadId - ID do lead
 * @param {string} leadName - Nome do lead (obrigatório para Asaas)
 * @param {string} [leadEmail] - Email para contato
 * @param {function} [onSuccess] - Callback após sucesso
 */
export function AsaasBoletoForm({ 
  leadId, 
  leadName, 
  leadEmail,
  onSuccess 
}: AsaasBoletoFormProps)
```

---

## 🚀 Checklist de Boas Práticas

- [ ] Validações completas
- [ ] Mensagens de erro claras
- [ ] Feedback de carregamento
- [ ] Estados visuais para todos os estados
- [ ] Responsivo em mobile
- [ ] Testes unitários
- [ ] Documentação no código
- [ ] Tratamento de erros
- [ ] Telemetria/analytics
- [ ] Performance otimizada
- [ ] Acessibilidade (ARIA)
- [ ] Internacionalização (i18n)

---

## 📖 Referências

- [Principles of User Interface Design](https://www.interaction-design.org/literature/article/principles-of-user-interface-design)
- [Web Content Accessibility Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [React Best Practices](https://react.dev/learn)

---

**Última atualização:** Janeiro 2025

