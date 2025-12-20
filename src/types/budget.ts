// Tipos para o sistema de orçamentos

export interface BudgetProduct {
  id: string;
  name: string;
  description?: string;
  price: number;
  quantity: number;
  subtotal: number;
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
  created_at: string;
  updated_at: string;
  created_by?: string;
  lead?: {
    id: string;
    name: string;
    phone?: string;
    email?: string;
    company?: string;
  };
}

export interface BudgetPdfOptions {
  budget: Budget;
  backgroundImageUrl?: string;
  headerColor?: string; // Cor da barra superior (hex)
  logoUrl?: string; // URL do logo/imagem no cabeçalho
  fileName?: string;
}

export interface Service {
  id: string;
  organization_id: string;
  name: string;
  description?: string;
  price: number;
  category?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

