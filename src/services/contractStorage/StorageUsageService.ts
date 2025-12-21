import { supabase } from '@/integrations/supabase/client';
import { createStorageService } from './StorageFactory';

/**
 * Serviço para monitorar uso de armazenamento por organização
 */
export class StorageUsageService {
  /**
   * Calcula e atualiza o uso de armazenamento de uma organização
   */
  static async updateUsage(organizationId: string): Promise<{ success: boolean; totalGB?: number; error?: string }> {
    try {
      // Buscar configuração de storage
      const { data: storageConfig } = await supabase
        .from('contract_storage_config')
        .select('storage_type')
        .is('organization_id', null)
        .eq('is_active', true)
        .maybeSingle();

      const storageType = storageConfig?.storage_type || 'supabase';

      // Obter serviço de storage
      const storageService = await createStorageService(organizationId);

      // Listar todos os arquivos da organização
      const files = await storageService.listFiles(organizationId);

      // Calcular total em bytes
      const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
      const totalGB = totalBytes / (1024 * 1024 * 1024); // Converter para GB

      // Obter período atual (mês atual)
      const now = new Date();
      const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

      // Atualizar ou criar registro de uso
      const { data: existingUsage } = await supabase
        .from('contract_storage_usage')
        .select('id')
        .eq('organization_id', organizationId)
        .eq('storage_type', storageType)
        .eq('period_type', 'monthly')
        .gte('period_start', periodStart.toISOString())
        .lte('period_end', periodEnd.toISOString())
        .maybeSingle();

      const usageData = {
        organization_id: organizationId,
        storage_type: storageType,
        total_bytes: totalBytes,
        total_files: files.length,
        period_start: periodStart.toISOString(),
        period_end: periodEnd.toISOString(),
        period_type: 'monthly' as const,
      };

      if (existingUsage) {
        // Atualizar registro existente
        const { error } = await supabase
          .from('contract_storage_usage')
          .update(usageData)
          .eq('id', existingUsage.id);

        if (error) {
          throw new Error(`Erro ao atualizar uso: ${error.message}`);
        }
      } else {
        // Criar novo registro
        const { error } = await supabase
          .from('contract_storage_usage')
          .insert(usageData);

        if (error) {
          throw new Error(`Erro ao criar registro de uso: ${error.message}`);
        }
      }

      return {
        success: true,
        totalGB: parseFloat(totalGB.toFixed(4)),
      };
    } catch (error: any) {
      console.error('Erro ao atualizar uso:', error);
      return {
        success: false,
        error: error.message || 'Erro desconhecido ao atualizar uso',
      };
    }
  }

  /**
   * Obtém o uso atual de uma organização
   */
  static async getUsage(organizationId: string, periodType: 'daily' | 'weekly' | 'monthly' | 'yearly' = 'monthly'): Promise<any> {
    const now = new Date();
    let periodStart: Date;
    let periodEnd: Date;

    switch (periodType) {
      case 'daily':
        periodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        periodEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
        break;
      case 'weekly':
        const dayOfWeek = now.getDay();
        periodStart = new Date(now);
        periodStart.setDate(now.getDate() - dayOfWeek);
        periodStart.setHours(0, 0, 0, 0);
        periodEnd = new Date(periodStart);
        periodEnd.setDate(periodStart.getDate() + 6);
        periodEnd.setHours(23, 59, 59, 999);
        break;
      case 'monthly':
        periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
        periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
        break;
      case 'yearly':
        periodStart = new Date(now.getFullYear(), 0, 1);
        periodEnd = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
        break;
    }

    const { data, error } = await supabase
      .from('contract_storage_usage')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('period_type', periodType)
      .gte('period_start', periodStart.toISOString())
      .lte('period_end', periodEnd.toISOString())
      .order('period_start', { ascending: false });

    if (error) {
      console.error('Erro ao buscar uso:', error);
      return [];
    }

    return (data || []).map((usage) => ({
      ...usage,
      totalGB: parseFloat((usage.total_bytes / (1024 * 1024 * 1024)).toFixed(4)),
    }));
  }

  /**
   * Obtém histórico de uso de uma organização
   */
  static async getUsageHistory(
    organizationId: string,
    periodType: 'daily' | 'weekly' | 'monthly' | 'yearly' = 'monthly',
    limit: number = 12
  ): Promise<any[]> {
    const { data, error } = await supabase
      .from('contract_storage_usage')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('period_type', periodType)
      .order('period_start', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Erro ao buscar histórico:', error);
      return [];
    }

    return (data || []).map((usage) => ({
      ...usage,
      totalGB: parseFloat((usage.total_bytes / (1024 * 1024 * 1024)).toFixed(4)),
    }));
  }

  /**
   * Atualiza uso de todas as organizações (para ser executado periodicamente)
   */
  static async updateAllOrganizations(): Promise<{ success: number; failed: number; errors: string[] }> {
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

      let success = 0;
      let failed = 0;
      const errors: string[] = [];

      for (const org of organizations) {
        const result = await this.updateUsage(org.id);
        if (result.success) {
          success++;
        } else {
          failed++;
          errors.push(`Org ${org.id}: ${result.error}`);
        }
      }

      return { success, failed, errors };
    } catch (error: any) {
      console.error('Erro ao atualizar uso de todas organizações:', error);
      return {
        success: 0,
        failed: 0,
        errors: [error.message || 'Erro desconhecido'],
      };
    }
  }
}

