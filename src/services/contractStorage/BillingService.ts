import { supabase } from '@/integrations/supabase/client';
import { StorageUsageService } from './StorageUsageService';

/**
 * Serviço para calcular e gerenciar cobrança por armazenamento
 */
export class BillingService {
  /**
   * Calcula cobrança para uma organização em um período
   */
  static async calculateBilling(
    organizationId: string,
    periodStart: Date,
    periodEnd: Date
  ): Promise<{ success: boolean; billingId?: string; totalCost?: number; error?: string }> {
    try {
      // Buscar uso do período
      const usage = await StorageUsageService.getUsage(organizationId, 'monthly');

      if (!usage || usage.length === 0) {
        // Atualizar uso primeiro
        await StorageUsageService.updateUsage(organizationId);
        const updatedUsage = await StorageUsageService.getUsage(organizationId, 'monthly');
        if (!updatedUsage || updatedUsage.length === 0) {
          throw new Error('Nenhum uso encontrado para calcular cobrança');
        }
        usage.push(...updatedUsage);
      }

      const latestUsage = usage[0];
      if (!latestUsage) {
        throw new Error('Nenhum uso encontrado');
      }

      // Buscar preço por GB do storage type
      const { data: pricing, error: pricingError } = await supabase
        .from('contract_storage_pricing')
        .select('price_per_gb')
        .eq('storage_type', latestUsage.storage_type)
        .eq('is_active', true)
        .single();

      if (pricingError || !pricing) {
        throw new Error(`Preço não configurado para storage type: ${latestUsage.storage_type}`);
      }

      const pricePerGB = parseFloat(pricing.price_per_gb.toString());
      const totalGB = latestUsage.totalGB || 0;
      const totalCost = totalGB * pricePerGB;

      // Verificar se já existe cobrança para este período
      const { data: existingBilling } = await supabase
        .from('contract_storage_billing')
        .select('id')
        .eq('organization_id', organizationId)
        .eq('storage_type', latestUsage.storage_type)
        .gte('period_start', periodStart.toISOString())
        .lte('period_end', periodEnd.toISOString())
        .maybeSingle();

      const billingData = {
        organization_id: organizationId,
        storage_type: latestUsage.storage_type,
        period_start: periodStart.toISOString(),
        period_end: periodEnd.toISOString(),
        total_gb: totalGB,
        price_per_gb: pricePerGB,
        total_cost: parseFloat(totalCost.toFixed(2)),
        status: 'calculated' as const,
      };

      if (existingBilling) {
        // Atualizar cobrança existente
        const { data: updated, error: updateError } = await supabase
          .from('contract_storage_billing')
          .update(billingData)
          .eq('id', existingBilling.id)
          .select()
          .single();

        if (updateError) {
          throw new Error(`Erro ao atualizar cobrança: ${updateError.message}`);
        }

        return {
          success: true,
          billingId: updated.id,
          totalCost: updated.total_cost,
        };
      } else {
        // Criar nova cobrança
        const { data: created, error: createError } = await supabase
          .from('contract_storage_billing')
          .insert(billingData)
          .select()
          .single();

        if (createError) {
          throw new Error(`Erro ao criar cobrança: ${createError.message}`);
        }

        return {
          success: true,
          billingId: created.id,
          totalCost: created.total_cost,
        };
      }
    } catch (error: any) {
      console.error('Erro ao calcular cobrança:', error);
      return {
        success: false,
        error: error.message || 'Erro desconhecido ao calcular cobrança',
      };
    }
  }

  /**
   * Obtém cobranças de uma organização
   */
  static async getBillings(
    organizationId: string,
    limit: number = 12
  ): Promise<any[]> {
    const { data, error } = await supabase
      .from('contract_storage_billing')
      .select('*')
      .eq('organization_id', organizationId)
      .order('period_start', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Erro ao buscar cobranças:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Calcula cobrança para todas as organizações (para ser executado mensalmente)
   */
  static async calculateAllBillings(): Promise<{ success: number; failed: number; errors: string[] }> {
    try {
      const { data: organizations, error } = await supabase
        .from('organizations')
        .select('id')
        .eq('is_active', true);

      if (error) {
        throw error;
      }

      if (!organizations || organizations.length === 0) {
        return { success: 0, failed: 0, errors: [] };
      }

      // Período: mês atual
      const now = new Date();
      const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

      let success = 0;
      let failed = 0;
      const errors: string[] = [];

      for (const org of organizations) {
        const result = await this.calculateBilling(org.id, periodStart, periodEnd);
        if (result.success) {
          success++;
        } else {
          failed++;
          errors.push(`Org ${org.id}: ${result.error}`);
        }
      }

      return { success, failed, errors };
    } catch (error: any) {
      console.error('Erro ao calcular cobranças:', error);
      return {
        success: 0,
        failed: 0,
        errors: [error.message || 'Erro desconhecido'],
      };
    }
  }
}

