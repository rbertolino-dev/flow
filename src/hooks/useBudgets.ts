import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useActiveOrganization } from './useActiveOrganization';
import { Budget, BudgetFormData, BudgetProduct, BudgetService } from '@/types/budget';
import { useToast } from './use-toast';
// Usar módulo antigo que estava funcionando
import { generateBudgetPDF } from '@/lib/budgetPdfGenerator';
import { SupabaseStorageService } from '@/services/contractStorage';
import { format, addDays } from 'date-fns';

interface BudgetFilters {
  lead_id?: string;
  search?: string;
  expired_only?: boolean;
  date_from?: string;
  date_to?: string;
  expires_from?: string;
  expires_to?: string;
}

export function useBudgets(filters?: BudgetFilters) {
  const { activeOrgId } = useActiveOrganization();
  const { toast } = useToast();
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (activeOrgId) {
      fetchBudgets();
    } else {
      setBudgets([]);
      setLoading(false);
    }
  }, [activeOrgId, filters?.lead_id, filters?.search, filters?.expired_only, filters?.date_from, filters?.date_to, filters?.expires_from, filters?.expires_to]);

  const fetchBudgets = async () => {
    if (!activeOrgId) return;

    try {
      setLoading(true);
      // @ts-ignore - Tabela budgets existe
      let query = supabase
        .from('budgets')
        .select(`
          *,
          lead:leads(id, name, phone, email, company)
        `)
        .eq('organization_id', activeOrgId)
        .order('created_at', { ascending: false });

      if (filters?.lead_id) {
        query = query.eq('lead_id', filters.lead_id);
      }

      if (filters?.search) {
        query = query.or(`budget_number.ilike.%${filters.search}%,observations.ilike.%${filters.search}%`);
      }

      if (filters?.expired_only) {
        query = query.lt('expires_at', new Date().toISOString().split('T')[0]);
      }

      if (filters?.date_from) {
        query = query.gte('created_at', filters.date_from);
      }

      if (filters?.date_to) {
        query = query.lte('created_at', filters.date_to);
      }

      if (filters?.expires_from) {
        query = query.gte('expires_at', filters.expires_from);
      }

      if (filters?.expires_to) {
        query = query.lte('expires_at', filters.expires_to);
      }

      const { data, error } = await query;

      if (error) throw error;
      setBudgets((data || []) as Budget[]);
    } catch (error: any) {
      console.error('Erro ao carregar orçamentos:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao carregar orçamentos',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const createBudget = async (budgetData: BudgetFormData) => {
    if (!activeOrgId) throw new Error('Organização não encontrada');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      // Buscar dados do lead
      const { data: lead, error: leadError } = await supabase
        .from('leads')
        .select('id, name, phone, email, company')
        .eq('id', budgetData.leadId)
        .single();

      if (leadError || !lead) throw new Error('Lead não encontrado');

      // Calcular totais
      const subtotalProducts = budgetData.products.reduce((sum, p) => sum + (p.subtotal || p.price * (p.quantity || 1)), 0);
      const subtotalServices = budgetData.services.reduce((sum, s) => sum + (s.subtotal || s.price * (s.quantity || 1)), 0);
      const additions = budgetData.additions || 0;
      const total = subtotalProducts + subtotalServices + additions;

      // Calcular data de expiração
      const expiresAt = addDays(new Date(), budgetData.validityDays || 30);

      // Gerar número do orçamento
      // @ts-ignore - Função existe
      const { data: budgetNumber, error: numberError } = await supabase.rpc(
        'generate_budget_number',
        { org_id: activeOrgId }
      );

      if (numberError) throw numberError;

      // Criar orçamento
      // @ts-ignore - Tabela budgets existe
      const { data, error } = await supabase
        .from('budgets')
        .insert({
          organization_id: activeOrgId,
          budget_number: budgetNumber,
          lead_id: budgetData.leadId,
          client_data: {
            id: lead.id,
            name: lead.name,
            phone: lead.phone,
            email: lead.email,
            company: lead.company,
          },
          products: budgetData.products,
          services: budgetData.services,
          payment_methods: budgetData.paymentMethods,
          validity_days: budgetData.validityDays || 30,
          expires_at: format(expiresAt, 'yyyy-MM-dd'),
          delivery_date: budgetData.deliveryDate ? format(budgetData.deliveryDate, 'yyyy-MM-dd') : null,
          delivery_location: budgetData.deliveryLocation || null,
          observations: budgetData.observations || null,
          subtotal_products: subtotalProducts,
          subtotal_services: subtotalServices,
          additions: additions,
          total: total,
          background_image_url: budgetData.backgroundImageUrl || null,
          header_color: budgetData.headerColor || null,
          logo_url: budgetData.logoUrl || null,
          created_by: user.id,
        })
        .select(`
          *,
          lead:leads(id, name, phone, email, company)
        `)
        .single();

      if (error) throw error;

      // Garantir que os dados de personalização sejam usados (do formulário ou do banco)
      const headerColor = budgetData.headerColor || (data as any).header_color || '#3b82f6';
      const logoUrl = budgetData.logoUrl || (data as any).logo_url || undefined;
      const backgroundImageUrl = budgetData.backgroundImageUrl || (data as any).background_image_url || undefined;

      console.log('Gerando PDF com personalização:', { 
        headerColor, 
        logoUrl, 
        backgroundImageUrl,
        fromForm: { headerColor: budgetData.headerColor, logoUrl: budgetData.logoUrl },
        fromDB: { header_color: (data as any).header_color, logo_url: (data as any).logo_url }
      });

      // Gerar PDF usando módulo antigo
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
      // @ts-ignore - Tabela budgets existe
      const { error: updateError } = await supabase
        .from('budgets')
        .update({ pdf_url: pdfUrl })
        .eq('id', data.id);

      if (updateError) throw updateError;

      await fetchBudgets();

      toast({
        title: 'Orçamento criado',
        description: 'Orçamento criado e PDF gerado com sucesso',
      });

      return { ...data, pdf_url: pdfUrl } as Budget;
    } catch (error: any) {
      console.error('Erro ao criar orçamento:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao criar orçamento',
        variant: 'destructive',
      });
      throw error;
    }
  };

  const regenerateBudgetPDF = async (budgetId: string): Promise<string> => {
    if (!activeOrgId) throw new Error('Organização não encontrada');

    try {
      // Buscar orçamento completo
      // @ts-ignore - Tabela budgets existe
      const { data: budget, error: budgetError } = await supabase
        .from('budgets')
        .select(`
          *,
          lead:leads(id, name, phone, email, company)
        `)
        .eq('id', budgetId)
        .single();

      if (budgetError || !budget) throw new Error('Orçamento não encontrado');

      // Gerar PDF usando módulo antigo
      const pdfBlob = await generateBudgetPDF({
        budget: budget as Budget,
        backgroundImageUrl: budget.background_image_url || undefined,
        headerColor: budget.header_color || undefined,
        logoUrl: budget.logo_url || undefined,
      });

      // Upload do PDF
      const storageService = new SupabaseStorageService(activeOrgId);
      const pdfUrl = await storageService.uploadPDF(pdfBlob, budgetId, 'budget');

      // Atualizar orçamento com URL do PDF
      // @ts-ignore - Tabela budgets existe
      const { error: updateError } = await supabase
        .from('budgets')
        .update({ pdf_url: pdfUrl })
        .eq('id', budgetId);

      if (updateError) throw updateError;

      toast({
        title: 'PDF regenerado',
        description: 'PDF do orçamento foi gerado com sucesso',
      });

      await fetchBudgets();
      return pdfUrl;
    } catch (error: any) {
      console.error('Erro ao regenerar PDF:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao regenerar PDF do orçamento',
        variant: 'destructive',
      });
      throw error;
    }
  };

  const deleteBudget = async (budgetId: string) => {
    if (!activeOrgId) throw new Error('Organização não encontrada');

    try {
      // @ts-ignore - Tabela budgets existe
      const { error } = await supabase
        .from('budgets')
        .delete()
        .eq('id', budgetId)
        .eq('organization_id', activeOrgId);

      if (error) throw error;

      await fetchBudgets();
      toast({
        title: 'Orçamento excluído',
        description: 'Orçamento excluído com sucesso',
      });
    } catch (error: any) {
      console.error('Erro ao excluir orçamento:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao excluir orçamento',
        variant: 'destructive',
      });
      throw error;
    }
  };

  return {
    budgets,
    loading,
    createBudget,
    regenerateBudgetPDF,
    deleteBudget,
    refetch: fetchBudgets,
  };
}
