import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useActiveOrganization } from './useActiveOrganization';
import { Budget, BudgetFormData, BudgetProduct, BudgetService } from '@/types/budget';
import { useToast } from './use-toast';
import { broadcastRefreshEvent } from '@/utils/forceRefreshAfterMutation';
// Usar módulo antigo que estava funcionando
import { generateBudgetPDF } from '@/lib/budgetPdfGenerator';
import { SupabaseStorageService } from '@/services/contractStorage';
import { format, addDays } from 'date-fns';

interface BudgetFilters {
  lead_id?: string;
  search?: string;
  expired_only?: boolean;
  expiring_soon_only?: boolean;
  approved_only?: boolean;
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
      
      // Configurar subscription realtime para atualizações automáticas
      const channel = supabase
        .channel(`budgets-${activeOrgId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'budgets',
            // Sem filter: evita "mismatch between server and client bindings" em alguns projetos Realtime.
            // Filtramos por organização no callback (RLS já limita o que o usuário vê).
          },
          (payload) => {
            const orgFromNew = (payload.new as { organization_id?: string } | null)?.organization_id;
            const orgFromOld = (payload.old as { organization_id?: string } | null)?.organization_id;
            if (orgFromNew !== activeOrgId && orgFromOld !== activeOrgId) {
              return;
            }
            console.log('📡 Realtime: Mudança detectada em orçamentos', payload);
            // Atualizar lista imediatamente baseado no evento
            if (payload.eventType === 'INSERT' && payload.new) {
              // Novo orçamento criado - adicionar à lista
              setBudgets((prev) => {
                const newBudget = payload.new as Budget;
                const exists = prev.some(b => b.id === newBudget.id);
                if (exists) return prev;
                return [newBudget, ...prev];
              });
            } else if (payload.eventType === 'UPDATE' && payload.new) {
              // Orçamento atualizado - atualizar na lista
              setBudgets((prev) => {
                return prev.map(b => b.id === payload.new.id ? (payload.new as Budget) : b);
              });
            } else if (payload.eventType === 'DELETE' && payload.old) {
              // Orçamento deletado - remover da lista
              setBudgets((prev) => {
                return prev.filter(b => b.id !== payload.old.id);
              });
            } else {
              // Refetch completo se não conseguir determinar o tipo de mudança
              if (!loading) {
                fetchBudgets();
              }
            }
          }
        )
        .subscribe((status, err) => {
          if (status === 'SUBSCRIBED') {
            console.log('✅ Realtime: Inscrito em mudanças de orçamentos');
          } else if (status === 'CHANNEL_ERROR') {
            console.error('❌ Realtime: Erro ao se inscrever em orçamentos', err);
            // Não bloquear a aplicação - apenas logar o erro
            // A lista será atualizada via polling normal se Realtime falhar
          } else if (status === 'TIMED_OUT') {
            console.warn('⏱️ Realtime: Timeout ao se inscrever em orçamentos');
          } else if (status === 'CLOSED') {
            console.warn('⚠️ Realtime: Conexão fechada para orçamentos');
          }
        });

      return () => {
        supabase.removeChannel(channel);
      };
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
          lead:leads(id, name, phone, email, company),
          creator:profiles!budgets_created_by_fkey(id, email, full_name)
        `)
        .eq('organization_id', activeOrgId);

      // Por padrão, carregar apenas 25 orçamentos mais recentes do mês atual
      // A menos que haja filtros de data específicos
      if (!filters?.date_from && !filters?.date_to) {
        const now = new Date();
        const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        query = query.gte('created_at', firstDayOfMonth.toISOString());
      }

      if (filters?.lead_id) {
        query = query.eq('lead_id', filters.lead_id);
      }

      // Se houver busca, vamos buscar todos os orçamentos (com outros filtros aplicados)
      // e filtrar no cliente porque client_data é JSONB e não funciona bem com .or() do Supabase
      // A busca no client_data será feita no lado do cliente após buscar os resultados
      // Não aplicar filtro de busca no banco aqui - vamos buscar todos e filtrar no cliente

      if (filters?.expired_only) {
        query = query.lt('expires_at', new Date().toISOString().split('T')[0]);
      }

      if (filters?.expiring_soon_only) {
        const now = new Date();
        const oneWeekFromNow = addDays(now, 7);
        query = query
          .gte('expires_at', now.toISOString().split('T')[0])
          .lte('expires_at', oneWeekFromNow.toISOString().split('T')[0]);
      }

      if (filters?.approved_only) {
        query = query.eq('approved', true);
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

      // Ordenar por data de criação (mais recente primeiro) e limitar a 25
      query = query.order('created_at', { ascending: false }).limit(25);

      const { data, error } = await query;

      if (error) throw error;
      
      // Filtrar por nome do cliente se houver busca (client_data JSONB)
      let filteredData = (data || []) as Budget[];
      if (filters?.search) {
        const searchLower = filters.search.toLowerCase();
        filteredData = filteredData.filter((budget) => {
          // Buscar no número do orçamento
          if (budget.budget_number?.toLowerCase().includes(searchLower)) return true;
          
          // Buscar nas observações
          if (budget.observations?.toLowerCase().includes(searchLower)) return true;
          
          // Buscar no nome do cliente (client_data JSONB)
          const clientData = budget.client_data as any;
          if (clientData?.name?.toLowerCase().includes(searchLower)) return true;
          
          // Buscar no telefone do cliente
          if (clientData?.phone?.toLowerCase().includes(searchLower)) return true;
          
          // Buscar no email do cliente
          if (clientData?.email?.toLowerCase().includes(searchLower)) return true;
          
          // Buscar na empresa do cliente
          if (clientData?.company?.toLowerCase().includes(searchLower)) return true;
          
          return false;
        });
      }
      
      setBudgets(filteredData);
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
      const backgroundImageUrl = budgetData.backgroundImageUrl || (data as any).background_image_url || undefined;
      
      // Logo: prioridade: formData > DB > Organization
      let logoUrl = budgetData.logoUrl || (data as any).logo_url || undefined;
      
      // Se não houver logo no orçamento, buscar da organização
      if (!logoUrl && activeOrgId) {
        const { data: orgData } = await supabase
          .from('organizations')
          .select('logo_url')
          .eq('id', activeOrgId)
          .single();
        
        if (orgData?.logo_url) {
          logoUrl = orgData.logo_url;
        }
      }

      // Dados da org do orçamento (sempre o mesmo organization_id gravado no registro)
      const orgIdForPdf = (data as { organization_id?: string }).organization_id || activeOrgId;
      let organizationData: any = null;
      if (orgIdForPdf) {
        const { data: orgData } = await supabase
          .from('organizations')
          .select('name, logo_url, address, company_profile, city, state, cnpj, phone, contact_email')
          .eq('id', orgIdForPdf)
          .single();

        if (orgData) {
          organizationData = {
            name: orgData.name,
            logo_url: orgData.logo_url,
            address: orgData.address,
            company_profile: orgData.company_profile,
            city: orgData.city,
            state: orgData.state,
            cnpj: orgData.cnpj,
            phone: orgData.phone,
            contact_email: orgData.contact_email,
          };
        }
      }

      console.log('Gerando PDF com personalização:', { 
        headerColor, 
        logoUrl, 
        backgroundImageUrl,
        organizationData,
        fromForm: { headerColor: budgetData.headerColor, logoUrl: budgetData.logoUrl },
        fromDB: { header_color: (data as any).header_color, logo_url: (data as any).logo_url }
      });

      // Gerar PDF usando módulo antigo
      const pdfBlob = await generateBudgetPDF({
        budget: data as Budget,
        backgroundImageUrl,
        headerColor,
        logoUrl,
        organizationData,
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

      // Atualizar lista imediatamente (realtime também vai atualizar, mas isso garante resposta rápida)
      setBudgets((prev) => {
        const newBudget = { ...data, pdf_url: pdfUrl } as Budget;
        // Verificar se já existe (evitar duplicatas)
        const exists = prev.some(b => b.id === newBudget.id);
        if (exists) {
          return prev.map(b => b.id === newBudget.id ? newBudget : b);
        }
        return [newBudget, ...prev];
      });

      toast({
        title: 'Orçamento criado',
        description: 'Orçamento criado e PDF gerado com sucesso',
      });

      broadcastRefreshEvent('create', 'budget');

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

      const budgetOrgId =
        (budget as { organization_id?: string }).organization_id || activeOrgId;

      // Logo: prioridade: orçamento > organização
      let logoUrl = budget.logo_url || undefined;
      
      // Sempre a organização dona do orçamento (nome atualizado em Editar Organização)
      let organizationData: any = null;
      if (budgetOrgId) {
        const { data: orgData } = await supabase
          .from('organizations')
          .select('name, logo_url, address, company_profile, city, state, cnpj, phone, contact_email')
          .eq('id', budgetOrgId)
          .single();
        
        if (orgData) {
          organizationData = {
            name: orgData.name,
            logo_url: orgData.logo_url,
            address: orgData.address,
            company_profile: orgData.company_profile,
            city: orgData.city,
            state: orgData.state,
            cnpj: orgData.cnpj,
            phone: orgData.phone,
            contact_email: orgData.contact_email,
          };
          
          // Se não houver logo no orçamento, usar da organização
          if (!logoUrl && orgData.logo_url) {
            logoUrl = orgData.logo_url;
          }
        }
      }

      // Gerar PDF usando módulo antigo
      const pdfBlob = await generateBudgetPDF({
        budget: budget as Budget,
        backgroundImageUrl: budget.background_image_url || undefined,
        headerColor: budget.header_color || undefined,
        logoUrl,
        organizationData,
      });

      const uploadOrgId = budgetOrgId || activeOrgId;
      if (!uploadOrgId) throw new Error('Organização do orçamento não encontrada');

      // Upload do PDF
      const storageService = new SupabaseStorageService(uploadOrgId);
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
        description: 'O PDF usa o nome e dados atuais da organização.',
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
      broadcastRefreshEvent('delete', 'budget');
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

  const approveBudget = async (budgetId: string) => {
    if (!activeOrgId) throw new Error('Organização não encontrada');

    try {
      // @ts-ignore - Tabela budgets existe
      let { error } = await supabase
        .from('budgets')
        .update({ approved: true, rejected: false })
        .eq('id', budgetId)
        .eq('organization_id', activeOrgId);

      // Sem coluna rejected no banco, update acima retorna 400 — fallback só approved
      if (error) {
        const { error: errFallback } = await supabase
          .from('budgets')
          .update({ approved: true })
          .eq('id', budgetId)
          .eq('organization_id', activeOrgId);
        error = errFallback;
      }

      if (error) throw error;

      // Atualizar na lista local
      setBudgets((prev) =>
        prev.map((b) => (b.id === budgetId ? { ...b, approved: true, rejected: false } : b))
      );

      broadcastRefreshEvent('update', 'budget');

      toast({
        title: 'Orçamento aprovado',
        description: 'Orçamento marcado como aprovado com sucesso',
      });
    } catch (error: any) {
      console.error('Erro ao aprovar orçamento:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao aprovar orçamento',
        variant: 'destructive',
      });
      throw error;
    }
  };

  const rejectBudget = async (budgetId: string) => {
    if (!activeOrgId) throw new Error('Organização não encontrada');

    try {
      // @ts-ignore - Tabela budgets existe
      const { error } = await supabase
        .from('budgets')
        .update({ rejected: true, approved: false })
        .eq('id', budgetId)
        .eq('organization_id', activeOrgId);

      if (error) throw error;

      setBudgets((prev) =>
        prev.map((b) => (b.id === budgetId ? { ...b, rejected: true, approved: false } : b))
      );

      broadcastRefreshEvent('update', 'budget');

      toast({
        title: 'Orçamento recusado',
        description: 'Orçamento marcado como recusado.',
      });
    } catch (error: any) {
      console.error('Erro ao recusar orçamento:', error);
      const msg = String(error?.message || '').toLowerCase();
      const code = String(error?.code || '');
      const likelyMissingRejected =
        code === '42703' ||
        code === 'PGRST204' ||
        msg.includes('rejected') ||
        msg.includes('schema cache') ||
        (msg.includes('column') && msg.includes('budgets'));
      toast({
        title: 'Erro',
        description: likelyMissingRejected
          ? 'Recusar orçamento exige a coluna rejected no Supabase. Aplique a migration 20260321120000_add_budget_rejected.sql (SQL Editor ou script de migrations).'
          : error.message || 'Erro ao recusar orçamento',
        variant: 'destructive',
      });
      throw error;
    }
  };

  const updateBudget = async (budgetId: string, budgetData: Partial<BudgetFormData>) => {
    if (!activeOrgId) throw new Error('Organização não encontrada');

    try {
      // Calcular novos totais se produtos/serviços foram alterados
      let updateData: any = {};

      if (budgetData.products !== undefined || budgetData.services !== undefined) {
        const products = budgetData.products || [];
        const services = budgetData.services || [];
        const subtotalProducts = products.reduce((sum, p) => sum + (p.subtotal || p.price * (p.quantity || 1)), 0);
        const subtotalServices = services.reduce((sum, s) => sum + (s.subtotal || s.price * (s.quantity || 1)), 0);
        const additions = budgetData.additions || 0;
        const total = subtotalProducts + subtotalServices + additions;

        updateData = {
          products: products,
          services: services,
          subtotal_products: subtotalProducts,
          subtotal_services: subtotalServices,
          additions: additions,
          total: total,
        };
      }

      if (budgetData.paymentMethods !== undefined) {
        updateData.payment_methods = budgetData.paymentMethods;
      }

      if (budgetData.validityDays !== undefined) {
        updateData.validity_days = budgetData.validityDays;
        const expiresAt = addDays(new Date(), budgetData.validityDays);
        updateData.expires_at = format(expiresAt, 'yyyy-MM-dd');
      }

      if (budgetData.deliveryDate !== undefined) {
        updateData.delivery_date = budgetData.deliveryDate ? format(budgetData.deliveryDate, 'yyyy-MM-dd') : null;
      }

      if (budgetData.deliveryLocation !== undefined) {
        updateData.delivery_location = budgetData.deliveryLocation || null;
      }

      if (budgetData.observations !== undefined) {
        updateData.observations = budgetData.observations || null;
      }

      if (budgetData.headerColor !== undefined) {
        updateData.header_color = budgetData.headerColor || null;
      }

      if (budgetData.logoUrl !== undefined) {
        updateData.logo_url = budgetData.logoUrl || null;
      }

      if (budgetData.backgroundImageUrl !== undefined) {
        updateData.background_image_url = budgetData.backgroundImageUrl || null;
      }

      // @ts-ignore - Tabela budgets existe
      const { data: updatedBudget, error } = await supabase
        .from('budgets')
        .update(updateData)
        .eq('id', budgetId)
        .eq('organization_id', activeOrgId)
        .select(`
          *,
          lead:leads(id, name, phone, email, company),
          creator:profiles!budgets_created_by_fkey(id, email, full_name)
        `)
        .single();

      if (error) throw error;

      // Regenerar PDF automaticamente após atualização
      await regenerateBudgetPDF(budgetId);

      toast({
        title: 'Orçamento atualizado',
        description: 'Orçamento atualizado e PDF regenerado com sucesso',
      });

      await fetchBudgets();
      broadcastRefreshEvent('update', 'budget');
      return updatedBudget as Budget;
    } catch (error: any) {
      console.error('Erro ao atualizar orçamento:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao atualizar orçamento',
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
    approveBudget,
    rejectBudget,
    updateBudget,
    refetch: fetchBudgets,
  };
}
