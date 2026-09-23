// Formas de pagamento disponíveis para orçamentos

export type PaymentMethod = 
  | 'dinheiro'
  | 'pix'
  | 'cartao_credito'
  | 'cartao_debito'
  | 'boleto'
  | 'transferencia_bancaria'
  | 'parcelado'
  | 'cheque'
  | 'permuta'
  | 'carne'
  | 'crediario';

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
    value: 'cheque',
    label: 'Cheque',
  },
  {
    value: 'transferencia_bancaria',
    label: 'Transferência Bancária',
  },
  {
    value: 'parcelado',
    label: 'Parcelado',
  },
  {
    value: 'permuta',
    label: 'Permuta',
  },
  {
    value: 'carne',
    label: 'Carnê',
  },
  {
    value: 'crediario',
    label: 'Crediário',
  },
];

/** Ordem e nomes usados no desconto por forma de pagamento. */
export const POS_DISCOUNT_PAYMENT_METHODS: PaymentMethodOption[] = [
  { value: 'pix', label: 'Pix' },
  { value: 'dinheiro', label: 'Dinheiro' },
  { value: 'boleto', label: 'Boleto' },
  { value: 'cartao_credito', label: 'Cartão de crédito' },
  { value: 'cartao_debito', label: 'Cartão de débito' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'permuta', label: 'Permuta' },
  { value: 'carne', label: 'Carnê' },
  { value: 'crediario', label: 'Crediário' },
  { value: 'transferencia_bancaria', label: 'Transferência Bancária' },
];

export function getPaymentMethodLabel(value: PaymentMethod): string {
  return PAYMENT_METHODS.find(m => m.value === value)?.label || value;
}

export function formatPaymentMethods(methods: PaymentMethod[]): string {
  return methods.map(getPaymentMethodLabel).join(', ');
}


