import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveOrganization } from "@/hooks/useActiveOrganization";
import { BudgetFormData, Budget } from "@/types/budget-module";
import { useToast } from "@/hooks/use-toast";
import { generateBudgetPDF } from '@/lib/budgetPdfGenerator';
import { SupabaseStorageService } from '@/services/contractStorage';

export function useCreateBudget() {
  const { activeOrgId } = useActiveOrganization();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (formData: BudgetFormData): Promise<Budget> => {
      if (!activeOrgId) throw new Error('Organização não encontrada');

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      // Buscar dados do lead
      const { data: lead, error: leadError } = await supabase
        .from('leads')
        .select('id, name, phone, email, company')
        .eq('id', formData.leadId)
        .eq('organization_id', activeOrgId)
        .single();

      if (leadError || !lead) throw new Error('Lead não encontrado');

      // Calcular totais
      const subtotalProducts = formData.products.reduce((sum, p) => sum + p.subtotal, 0);
      const subtotalServices = formData.services.reduce((sum, s) => sum + s.subtotal, 0);
      const additions = formData.additions || 0;
      const total = subtotalProducts + subtotalServices + additions;

      // Calcular data de expiração
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + formData.validityDays);

      // Gerar número do orçamento
      const { data: budgetNumber, error: numberError } = await (supabase as any).rpc('generate_budget_number', {
        org_id: activeOrgId,
      });

      if (numberError) throw numberError;

      // Criar orçamento
      const { data, error } = await (supabase as any)
        .from('budgets')
        .insert({
          organization_id: activeOrgId,
          budget_number: budgetNumber,
          lead_id: formData.leadId,
          client_data: {
            id: lead.id,
            name: lead.name,
            phone: lead.phone,
            email: lead.email,
            company: lead.company,
          },
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
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      // Gerar PDF automaticamente após criar o orçamento
      try {
        // Garantir que os dados de personalização sejam usados (do formulário ou do banco)
        const headerColor = formData.headerColor || (data as any).header_color || '#3b82f6';
        const logoUrl = formData.logoUrl || (data as any).logo_url || undefined;
        const backgroundImageUrl = formData.backgroundImageUrl || (data as any).background_image_url || undefined;

        console.log('Gerando PDF automaticamente após criar orçamento:', { 
          headerColor, 
          logoUrl, 
          backgroundImageUrl,
          fromForm: { headerColor: formData.headerColor, logoUrl: formData.logoUrl },
          fromDB: { header_color: (data as any).header_color, logo_url: (data as any).logo_url }
        });

        // Gerar PDF
        const pdfBlob = await generateBudgetPDF({
          budget: data as Budget,
          backgroundImageUrl,
          headerColor,
          logoUrl,
        });

        // Upload do PDF
        const storageService = new SupabaseStorageService(activeOrgId);
        const pdfUrl = await storageService.uploadPDF(pdfBlob, data.id, 'budget');

        // Atualizar orçamento com URL do PDF
        const { error: updateError } = await (supabase as any)
          .from('budgets')
          .update({ pdf_url: pdfUrl })
          .eq('id', data.id);

        if (updateError) {
          console.error('Erro ao atualizar PDF URL:', updateError);
          // Não lançar erro aqui - orçamento já foi criado, apenas logar o erro
        } else {
          // PDF gerado e atualizado com sucesso
          console.log('PDF gerado automaticamente com sucesso:', pdfUrl);
        }

        // Mapear resposta com PDF URL
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
          pdf_url: pdfUrl, // Usar URL gerada
          created_at: data.created_at,
          updated_at: data.updated_at,
          created_by: data.created_by,
          lead: {
            id: lead.id,
            name: lead.name,
            phone: lead.phone || undefined,
            email: lead.email || undefined,
            company: lead.company || undefined,
          },
        };

        // Toast de sucesso será exibido no onSuccess
        return budget;
      } catch (pdfError: any) {
        console.error('Erro ao gerar PDF automaticamente:', pdfError);
        // Se falhar a geração do PDF, ainda retornar o orçamento criado
        // O usuário pode regenerar depois
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
          pdf_url: data.pdf_url || null, // Pode ser null se falhar
          created_at: data.created_at,
          updated_at: data.updated_at,
          created_by: data.created_by,
          lead: {
            id: lead.id,
            name: lead.name,
            phone: lead.phone || undefined,
            email: lead.email || undefined,
            company: lead.company || undefined,
          },
        };

        // Avisar usuário mas não falhar a criação
        toast({
          title: 'Orçamento criado',
          description: 'Orçamento criado, mas houve um erro ao gerar o PDF. Você pode regenerar depois.',
          variant: 'default',
        });

        return budget;
      }
    },
    onSuccess: (budget) => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      // Exibir toast de sucesso apenas se PDF foi gerado
      if (budget.pdf_url) {
        toast({
          title: "Orçamento criado",
          description: "Orçamento criado e PDF gerado com sucesso. Você já pode baixar o PDF.",
        });
      } else {
        toast({
          title: "Orçamento criado",
          description: "Orçamento criado com sucesso.",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao criar orçamento",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
