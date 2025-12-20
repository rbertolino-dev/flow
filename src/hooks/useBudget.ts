import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveOrganization } from "@/hooks/useActiveOrganization";
import { Budget } from "@/types/budget-module";

export function useBudget(budgetId: string | null) {
  const { activeOrgId } = useActiveOrganization();

  return useQuery({
    queryKey: ['budget', budgetId, activeOrgId],
    queryFn: async () => {
      if (!budgetId || !activeOrgId) return null;

      const { data, error } = await (supabase as any)
        .from('budgets')
        .select(`
          *,
          leads (
            id,
            name,
            phone,
            email,
            company
          )
        `)
        .eq('id', budgetId)
        .eq('organization_id', activeOrgId)
        .single();

      if (error) throw error;

      // Mapear dados
      const budget: Budget = {
        id: data.id,
        organization_id: data.organization_id,
        budget_number: data.budget_number,
        lead_id: data.lead_id,
        client_data: data.client_data,
        products: data.products || [],
        services: data.services || [],
        payment_methods: data.payment_methods || [],
        validity_days: data.validity_days,
        expires_at: data.expires_at,
        delivery_date: data.delivery_date,
        delivery_location: data.delivery_location,
        observations: data.observations,
        subtotal_products: data.subtotal_products,
        subtotal_services: data.subtotal_services,
        additions: data.additions,
        total: data.total,
        background_image_url: data.background_image_url,
        header_color: data.header_color,
        logo_url: data.logo_url,
        pdf_url: data.pdf_url,
        created_at: data.created_at,
        updated_at: data.updated_at,
        created_by: data.created_by,
        lead: data.leads ? {
          id: data.leads.id,
          name: data.leads.name,
          phone: data.leads.phone,
          email: data.leads.email,
          company: data.leads.company,
        } : undefined,
      };

      return budget;
    },
    enabled: !!budgetId && !!activeOrgId,
  });
}

