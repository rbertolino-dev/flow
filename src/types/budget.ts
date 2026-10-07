// Tipos para o sistema de orçamentos

export interface BudgetProduct {
  id: string;
  name: string;
  description?: string;
  price: number;
  quantity: number;
  subtotal: number;
  image_url?: string;
  /** Desconto em reais nesta linha (reduz o subtotal do item). */
  line_discount?: number;
  /** Texto só deste orçamento. Não altera a descrição do produto no estoque. */
  internal_notes?: string;
  /** catalog = PDF usa a descrição do estoque. custom = PDF usa internal_notes. */
  description_source?: 'catalog' | 'custom';
  // Se foi adicionado manualmente (não do banco)
  isManual?: boolean;
}

export interface BudgetService {
  id: string;
  name: string;
  description?: string;
  price: number;
  quantity: number;
  subtotal: number;
  image_url?: string;
  /** Desconto em reais nesta linha (reduz o subtotal do item). */
  line_discount?: number;
  // Se foi adicionado manualmente (não do banco)
  isManual?: boolean;
}

export interface BudgetClient {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  company?: string;
}

export interface BudgetPdfDisplayOptions {
  show_product_subtotals: boolean;
  show_service_subtotals: boolean;
  show_additions: boolean;
  show_signature: boolean;
}

export const DEFAULT_BUDGET_PDF_DISPLAY_OPTIONS: BudgetPdfDisplayOptions = {
  show_product_subtotals: true,
  show_service_subtotals: true,
  show_additions: true,
  show_signature: false,
};

export interface BudgetFormData {
  leadId: string;
  products: BudgetProduct[];
  services: BudgetService[];
  paymentMethods: string[];
  validityDays: number;
  deliveryDate?: Date;
  deliveryLocation?: string;
  observations?: string;
  backgroundImageUrl?: string;
  headerColor?: string; // Cor da barra superior (hex)
  logoUrl?: string; // URL do logo/imagem no cabeçalho
  additions?: number; // Acréscimos/descontos
  pdfDisplayOptions?: BudgetPdfDisplayOptions;
  /** Se preenchido, usa este número em vez do gerado automaticamente. */
  budgetNumber?: string;
}

export interface Budget {
  id: string;
  organization_id: string;
  budget_number: string;
  lead_id?: string;
  client_data?: BudgetClient;
  products: BudgetProduct[];
  services: BudgetService[];
  payment_methods: string[];
  validity_days: number;
  expires_at?: string;
  delivery_date?: string;
  delivery_location?: string;
  observations?: string;
  subtotal_products: number;
  subtotal_services: number;
  additions: number;
  total: number;
  background_image_url?: string;
  header_color?: string; // Cor da barra superior (hex)
  logo_url?: string; // URL do logo/imagem no cabeçalho
  pdf_url?: string;
  pdf_display_options?: BudgetPdfDisplayOptions;
  created_at: string;
  updated_at: string;
  created_by?: string;
  approved?: boolean; // Indica se o orçamento foi aprovado
  rejected?: boolean; // Indica se o orçamento foi recusado
  creator?: {
    id: string;
    email?: string;
    full_name?: string;
  };
  lead?: {
    id: string;
    name: string;
    phone?: string;
    email?: string;
    company?: string;
  };
}

export interface BudgetFinanceLine {
  amount: number;
  due_date: string;
  method: string;
}

export interface BudgetFinanceChoice {
  saleDate: string;
  saleTime: string;
  receiptDescription: string;
  saleDescription: string;
  applyStock: boolean;
  generateFinancial: boolean;
  dueDate: string;
  account: string;
  category: string;
  paymentNotes: string;
  paymentMethod: string;
  financeLines: BudgetFinanceLine[];
  isRecurring: boolean;
  addCommission: boolean;
  commissionUserId: string | null;
  commissionUserName: string | null;
  commissionAmount: number;
}

export interface BudgetPdfOptions {
  budget: Budget;
  backgroundImageUrl?: string;
  headerColor?: string; // Cor da barra superior (hex)
  logoUrl?: string; // URL do logo/imagem no cabeçalho
  fileName?: string;
  organizationData?: {
    name?: string;
    logo_url?: string;
    address?: string;
    company_profile?: string;
    city?: string;
    state?: string;
    cnpj?: string;
    phone?: string;
    contact_email?: string;
  };
}

export interface Service {
  id: string;
  organization_id: string;
  name: string;
  description?: string;
  price: number;
  category?: string;
  image_url?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

