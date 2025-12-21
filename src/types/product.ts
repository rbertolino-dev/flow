export interface Product {
  id: string;
  organization_id: string;
  organization_name?: string; // Nome da organização (do PostgreSQL)
  name: string;
  description?: string | null;
  price: number;
  cost?: number | null;
  category: string;
  sku?: string | null;
  stock_quantity?: number | null;
  min_stock?: number | null;
  image_url?: string | null;
  is_active: boolean;
  commission_percentage?: number | null;
  commission_fixed?: number | null;
  created_at: string;
  updated_at: string;
  created_by?: string | null;
  created_by_name?: string | null; // Nome do usuário que criou (do PostgreSQL)
  updated_by?: string | null;
  updated_by_name?: string | null; // Nome do usuário que modificou (do PostgreSQL)
}

export interface ProductFormData {
  name: string;
  description?: string | null;
  price: number;
  cost?: number | null;
  category: string;
  sku?: string | null;
  stock_quantity?: number | null;
  min_stock?: number | null;
  unit?: string | null; // Unidade de medida (ex: un, kg, m, m², etc.)
  image_url?: string | null;
  is_active: boolean;
  commission_percentage?: number | null;
  commission_fixed?: number | null;
}

export interface SellerGoal {
  id: string;
  organization_id: string;
  user_id: string;
  period_type: 'monthly' | 'weekly' | 'quarterly' | 'yearly';
  period_start: string;
  period_end: string;
  target_leads: number;
  target_value: number;
  target_commission: number;
  created_at: string;
  updated_at: string;
  created_by?: string | null;
}

export interface SellerGoalFormData {
  user_id: string;
  period_type: 'monthly' | 'weekly' | 'quarterly' | 'yearly';
  period_start: string;
  period_end: string;
  target_leads: number;
  target_value: number;
  target_commission: number;
}

export interface SellerCommission {
  sellerId: string;
  sellerName: string;
  totalCommission: number;
  totalSales: number;
  totalLeads: number;
  commissionByProduct: Array<{
    productId: string;
    productName: string;
    sales: number;
    commission: number;
  }>;
}

export interface SellerPerformanceMetrics {
  sellerId: string;
  sellerName: string;
  currentGoal?: SellerGoal;
  actualLeads: number;
  actualValue: number;
  actualCommission: number;
  leadsProgress: number;
  valueProgress: number;
  commissionProgress: number;
  wonLeads: number;
  totalLeads: number;
  averageTicket: number;
  conversionRate: number;
}
