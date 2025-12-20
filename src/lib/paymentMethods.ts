// Formas de pagamento disponíveis para orçamentos

export type PaymentMethod = 
  | 'dinheiro'
  | 'pix'
  | 'cartao_credito'
  | 'cartao_debito'
  | 'boleto'
  | 'transferencia_bancaria'
  | 'parcelado';

export interface PaymentMethodOption {
  value: PaymentMethod;
  label: string;
  icon?: string;
}

export const PAYMENT_METHODS: PaymentMethodOption[] = [
  {
    value: 'dinheiro',
    label: 'Dinheiro',
  },
  {
    value: 'pix',
    label: 'PIX',
  },
  {
    value: 'cartao_credito',
    label: 'Cartão de Crédito',
  },
  {
    value: 'cartao_debito',
    label: 'Cartão de Débito',
  },
  {
    value: 'boleto',
    label: 'Boleto',
  },
  {
    value: 'transferencia_bancaria',
    label: 'Transferência Bancária',
  },
  {
    value: 'parcelado',
    label: 'Parcelado',
  },
];

export function getPaymentMethodLabel(value: PaymentMethod): string {
  return PAYMENT_METHODS.find(m => m.value === value)?.label || value;
}

export function formatPaymentMethods(methods: PaymentMethod[]): string {
  return methods.map(getPaymentMethodLabel).join(', ');
}


