import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveOrganization } from "@/hooks/useActiveOrganization";
import { BudgetFormData, Budget } from "@/types/budget-module";
import { useToast } from "@/hooks/use-toast";

export function useUpdateBudget() {
  const { activeOrgId } = useActiveOrganization();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...formData }: BudgetFormData & { id: string }): Promise<Budget> => {
      if (!activeOrgId) throw new Error('Organização não encontrada');

      // Buscar dados do lead se leadId mudou
      let clientData = null;
      if (formData.leadId) {
        const { data: lead, error: leadError } = await supabase
          .from('leads')
          .select('id, name, phone, email, company')
          .eq('id', formData.leadId)
          .eq('organization_id', activeOrgId)
          .single();

        if (!leadError && lead) {
          clientData = {
            id: lead.id,
            name: lead.name,
            phone: lead.phone,
            email: lead.email,
            company: lead.company,
          };
        }
      }

      // Calcular totais
      const subtotalProducts = formData.products.reduce((sum, p) => sum + p.subtotal, 0);
      const subtotalServices = formData.services.reduce((sum, s) => sum + s.subtotal, 0);
      const additions = formData.additions || 0;
      const total = subtotalProducts + subtotalServices + additions;

      // Calcular data de expiração
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + formData.validityDays);

      // Atualizar orçamento
      const updateData: any = {
        lead_id: formData.leadId,
        products: formData.products,
        services: formData.services,
        payment_methods: formData.paymentMethods,
        validity_days: formData.validityDays,
        expires_at: expiresAt.toISOString().split('T')[0],
        delivery_date: formData.deliveryDate?.toISOString().split('T')[0] || null,
        delivery_location: formData.deliveryLocation || null,
        observations: formData.observations || null,
        subtotal_products: subtotalProducts,
        subtotal_services: subtotalServices,
        additions: additions,
        total: total,
        background_image_url: formData.backgroundImageUrl || null,
        header_color: formData.headerColor || null,
        logo_url: formData.logoUrl || null,
      };

      if (clientData) {
        updateData.client_data = clientData;
      }

      const { data, error } = await (supabase as any)
        .from('budgets')
        .update(updateData)
        .eq('id', id)
        .eq('organization_id', activeOrgId)
        .select()
        .single();

      if (error) throw error;

      // Mapear resposta
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
      };

      return budget;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      queryClient.invalidateQueries({ queryKey: ['budget', data.id] });
      toast({
        title: "Orçamento atualizado",
        description: "O orçamento foi atualizado com sucesso.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar orçamento",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

