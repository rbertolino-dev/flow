import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useActiveOrganization } from './useActiveOrganization';
import { Budget, BudgetFinanceChoice, BudgetFormData, BudgetProduct, BudgetService } from '@/types/budget';
import { formatParcelDescription } from '@/lib/finance';
import { useToast } from './use-toast';
import { broadcastRefreshEvent } from '@/utils/forceRefreshAfterMutation';
// Usar módulo antigo que estava funcionando
import { generateBudgetPDF } from '@/lib/budgetPdfGenerator';
import { SupabaseStorageService } from '@/services/contractStorage';
import { format, addDays } from 'date-fns';
import { buildBudgetPosSalePayload, createPosSaleFromBudget } from '@/lib/budgetPosSale';

export const BUDGETS_PAGE_SIZE = 20;

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
  /** Página 1-based; padrão 1 */
  page?: number;
  page_size?: number;
}

async function callBudgetStock(activeOrgId: string, body: Record<string, unknown>) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Não autenticado');
  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/products/budget-stock`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
      'X-Organization-Id': activeOrgId,
    },
    body: JSON.stringify(body),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(result.error || 'Não foi possível atualizar o estoque do orçamento');
  }
  return result as { posted?: boolean; already?: boolean; reversed?: boolean };
}

type FinanceRpc = {
  rpc: (
    fn: string,
    args: Record<string, unknown>
  ) => Promise<{ data: string | null; error: { message: string } | null }>;
  from: (table: string) => {
    update: (values: Record<string, unknown>) => {
      eq: (column: string, value: string) => {
        eq: (column: string, value: string) => Promise<{ error: { message: string } | null }>;
      };
    };
  };
};

async function cancelFinanceSource(client: FinanceRpc, organizationId: string, sourceType: string, sourceId: string) {
  await client.rpc('cancel_financial_by_source', {
    p_organization_id: organizationId,
    p_source_type: sourceType,
    p_source_id: sourceId,
  });
}

async function syncBudgetFinancialEntry(
  organizationId: string,
  budgetId: string,
  choice: BudgetFinanceChoice,
  budget: {
    total?: number;
    lead_id?: string | null;
    client_data?: { name?: string; company?: string } | null;
    budget_number?: string | null;
  } | null
): Promise<{ message: string } | null> {
  const client = supabase as unknown as FinanceRpc;
  await Promise.all([
    cancelFinanceSource(client, organizationId, 'orcamento', budgetId),
    cancelFinanceSource(client, organizationId, 'comissao', `orcamento:${budgetId}`),
    ...Array.from({ length: 24 }, (_, index) =>
      cancelFinanceSource(client, organizationId, 'orcamento', `${budgetId}:${index}`)
    ),
  ]);

  if (!choice.generateFinancial && !choice.addCommission) return null;

  const { data: userData } = await supabase.auth.getUser();
  const contact = budget?.client_data?.name || budget?.client_data?.company || 'Cliente';
  const description = choice.saleDescription || `Orçamento ${budget?.budget_number || ''}`.trim();
  const notes = [choice.receiptDescription, choice.paymentNotes].filter(Boolean).join('\n') || null;
  const total = Number(budget?.total) || 0;
  const lines = choice.financeLines.length
    ? choice.financeLines
    : [{ amount: total, due_date: choice.dueDate, method: choice.paymentMethod }];
  const groupId = lines.length > 1 ? crypto.randomUUID() : null;

  if (choice.generateFinancial) {
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      if (line.amount <= 0.009) continue;
      const created = await client.rpc('upsert_financial_entry', {
        p_organization_id: organizationId,
        p_direction: 'receber',
        p_amount: line.amount,
        p_due_date: line.due_date || choice.dueDate,
        p_source_type: 'orcamento',
        p_source_id: lines.length > 1 ? `${budgetId}:${index}` : budgetId,
        p_status: 'open',
        p_settlement_status: 'confirmado',
        p_lead_id: budget?.lead_id || null,
        p_budget_id: budgetId,
        p_description: lines.length > 1
          ? formatParcelDescription(index + 1, lines.length, description)
          : description,
        p_contact_name: contact,
        p_billing_name: contact,
        p_category: choice.category || 'Vendas',
        p_account: choice.account,
        p_origin_label: choice.isRecurring || lines.length > 1 ? 'Recorrente' : 'Orçamento',
        p_paid_at: null,
        p_created_by: userData.user?.id || null,
        p_competence_date: choice.saleDate || choice.dueDate,
        p_payment_method: line.method || choice.paymentMethod || null,
        p_is_recurring: choice.isRecurring,
      });
      if (created.error) return created.error;
      const createdId = typeof created.data === 'string' ? created.data : null;
      if (!createdId) continue;
      const patched = await client
        .from('financial_entries')
        .update({
          notes,
          ...(groupId
            ? { recurrence_group_id: groupId, recurrence_index: index + 1, recurrence_total: lines.length }
            : {}),
        })
        .eq('id', createdId)
        .eq('organization_id', organizationId);
      if (patched.error) return patched.error;
    }
  }

  if (choice.addCommission && choice.commissionAmount > 0.009) {
    const commission = await client.rpc('upsert_financial_entry', {
      p_organization_id: organizationId,
      p_direction: 'pagar',
      p_amount: choice.commissionAmount,
      p_due_date: choice.dueDate || choice.saleDate,
      p_source_type: 'comissao',
      p_source_id: `orcamento:${budgetId}`,
      p_status: 'open',
      p_settlement_status: 'confirmado',
      p_lead_id: budget?.lead_id || null,
      p_budget_id: budgetId,
      p_description: `Comissão orçamento ${budget?.budget_number || ''}`.trim(),
      p_contact_name: choice.commissionUserName || 'Vendedor',
      p_billing_name: choice.commissionUserName || 'Vendedor',
      p_category: 'Comissão',
      p_account: choice.account || null,
      p_origin_label: 'Comissão',
      p_created_by: userData.user?.id || null,
      p_competence_date: choice.saleDate || choice.dueDate,
    });
    if (commission.error) return commission.error;
  }

  return null;
}

export function useBudgets(filters?: BudgetFilters) {
  const { activeOrgId } = useActiveOrganization();
  const { toast } = useToast();
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);

  const pageSize = filters?.page_size ?? BUDGETS_PAGE_SIZE;
  const page = Math.max(1, filters?.page ?? 1);

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
            // Refetch para manter contagem e página corretas
            fetchBudgets();
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
      setTotalCount(0);
      setLoading(false);
    }
  }, [
    activeOrgId,
    filters?.lead_id,
    filters?.search,
    filters?.expired_only,
    filters?.expiring_soon_only,
    filters?.approved_only,
    filters?.date_from,
    filters?.date_to,
    filters?.expires_from,
    filters?.expires_to,
    page,
    pageSize,
  ]);

  const fetchBudgets = async () => {
    if (!activeOrgId) return;

    try {
      setLoading(true);
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      // @ts-ignore - Tabela budgets existe
      let query = supabase
        .from('budgets')
        .select(
          `
          *,
          lead:leads(id, name, phone, email, company),
          creator:profiles!budgets_created_by_fkey(id, email, full_name)
        `,
          { count: 'exact' }
        )
        .eq('organization_id', activeOrgId);

      if (filters?.lead_id) {
        query = query.eq('lead_id', filters.lead_id);
      }

      // Busca textual em client_data (JSONB) é feita no cliente após o fetch da página

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

      // Todos os orçamentos (sem filtro de mês), paginados de pageSize em pageSize
      query = query.order('created_at', { ascending: false }).range(from, to);

      const { data, error, count } = await query;

      if (error) throw error;

      setTotalCount(count ?? 0);
      
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

  const approveBudget = async (budgetId: string, choice: BudgetFinanceChoice) => {
    if (!activeOrgId) throw new Error('Organização não encontrada');
    if (choice.generateFinancial && !choice.dueDate) throw new Error('Informe o vencimento do lançamento');
    if (choice.generateFinancial && !choice.account) throw new Error('Selecione a conta financeira');

    let stockApplied = false;
    try {
      const { data: budgetRow, error: loadError } = await supabase
        .from('budgets')
        .select('products, services, additions, total, lead_id, client_data, budget_number')
        .eq('id', budgetId)
        .eq('organization_id', activeOrgId)
        .single();
      if (loadError) throw loadError;
      const loaded = budgetRow as {
        products?: BudgetProduct[];
        services?: BudgetService[];
        additions?: number | null;
        total?: number;
        lead_id?: string | null;
        client_data?: { name?: string; company?: string; phone?: string } | null;
        budget_number?: string | null;
      } | null;
      const stockItems = Array.isArray(loaded?.products) ? loaded.products : [];
      if (choice.applyStock) {
        await callBudgetStock(activeOrgId, { action: 'apply', budget_id: budgetId, items: stockItems });
        stockApplied = true;
      }

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

      const financeError = await syncBudgetFinancialEntry(activeOrgId, budgetId, choice, loaded);
      if (financeError) {
        console.error('Erro ao lançar orçamento no financeiro:', financeError);
      }

      let posSaleError: string | null = null;
      try {
        const posPayload = buildBudgetPosSalePayload({
          budgetId,
          budgetNumber: loaded?.budget_number,
          total: loaded?.total,
          additions: loaded?.additions,
          leadId: loaded?.lead_id,
          clientName: loaded?.client_data?.name || loaded?.client_data?.company || null,
          clientPhone: loaded?.client_data?.phone || null,
          products: loaded?.products,
          services: loaded?.services,
          choice,
        });
        if (posPayload) {
          await createPosSaleFromBudget(activeOrgId, posPayload);
        } else {
          console.warn('Orçamento aprovado sem itens para espelhar em pos_sales:', budgetId);
        }
      } catch (saleErr) {
        console.error('Erro ao criar venda PDV do orçamento:', saleErr);
        posSaleError = saleErr instanceof Error ? saleErr.message : 'Falha ao registrar venda nas margens';
      }

      // Atualizar na lista local
      setBudgets((prev) =>
        prev.map((b) => (b.id === budgetId ? { ...b, approved: true, rejected: false } : b))
      );

      broadcastRefreshEvent('update', 'budget');

      const hasIssue = Boolean(financeError || posSaleError);
      toast({
        title: hasIssue ? 'Orçamento aprovado com avisos' : 'Orçamento aprovado',
        description: [
          financeError
            ? `Financeiro: ${financeError.message}`
            : choice.generateFinancial
              ? 'Lançamento financeiro criado'
              : 'Sem lançamento no financeiro',
          posSaleError
            ? `Margens/PDV: ${posSaleError}`
            : 'Venda registrada para margens (origem orçamento)',
        ].join(' · '),
        variant: hasIssue ? 'destructive' : 'default',
      });
    } catch (error: any) {
      if (stockApplied) {
        try {
          await callBudgetStock(activeOrgId, { action: 'reverse', budget_id: budgetId });
        } catch (reverseError) {
          console.error('Erro ao devolver estoque do orçamento:', reverseError);
        }
      }
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
      await callBudgetStock(activeOrgId, { action: 'reverse', budget_id: budgetId });

      // @ts-ignore - Tabela budgets existe
      const { error } = await supabase
        .from('budgets')
        .update({ rejected: true, approved: false })
        .eq('id', budgetId)
        .eq('organization_id', activeOrgId);

      if (error) throw error;

      const { error: financeError } = await (supabase as unknown as {
        rpc: (fn: string, args: Record<string, string>) => Promise<{ error: { message: string } | null }>;
      }).rpc('sync_budget_receivable', {
        p_organization_id: activeOrgId,
        p_budget_id: budgetId,
      });
      if (financeError) {
        console.error('Erro ao cancelar previsto do orçamento:', financeError);
      }

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
      if (budgetData.products !== undefined) {
        const stockStatus = await callBudgetStock(activeOrgId, { action: 'status', budget_id: budgetId });
        if (stockStatus.posted) {
          throw new Error('O estoque deste orçamento já foi lançado. Recuse o orçamento para devolver o saldo antes de alterar os produtos.');
        }
      }

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

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return {
    budgets,
    loading,
    totalCount,
    page,
    pageSize,
    totalPages,
    createBudget,
    regenerateBudgetPDF,
    deleteBudget,
    approveBudget,
    rejectBudget,
    updateBudget,
    refetch: fetchBudgets,
  };
}
