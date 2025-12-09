export interface Product {
  id: string;
  organization_id: string;
  name: string;
  description?: string;
  price: number;
  category: string;
  active: boolean;
  commission_percentage?: number;
  commission_fixed?: number;
  created_at: string;
  updated_at: string;
  created_by?: string;
  updated_by?: string;
}

export interface ProductFormData {
  name: string;
  description?: string;
  price: number;
  category: string;
  active: boolean;
  commission_percentage?: number;
  commission_fixed?: number;
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
  created_by?: string;
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
  // Metas
  currentGoal?: SellerGoal;
  // Realizado
  actualLeads: number;
  actualValue: number;
  actualCommission: number;
  // Progresso
  leadsProgress: number; // Percentual
  valueProgress: number; // Percentual
  commissionProgress: number; // Percentual
  // Detalhes
  wonLeads: number;
  totalLeads: number;
  averageTicket: number;
  conversionRate: number;
}

