import { supabase } from '@/integrations/supabase/client';
import { createStorageService } from './StorageFactory';
import { StorageService } from './StorageService';

export interface MigrationResult {
  success: boolean;
  migrationId?: string;
  oldUrl?: string;
  newUrl?: string;
  error?: string;
}

/**
 * Serviço para migrar contratos entre storages
 */
export class MigrationService {
  /**
   * Migra um contrato de um storage para outro
   */
  static async migrateContract(
    contractId: string,
    organizationId: string,
    fromStorage: string,
    toStorage: string
  ): Promise<MigrationResult> {
    try {
      // Buscar contrato
      const { data: contract, error: contractError } = await supabase
        .from('contracts')
        .select('id, pdf_url, organization_id')
        .eq('id', contractId)
        .single();

      if (contractError || !contract) {
        throw new Error('Contrato não encontrado');
      }

      if (!contract.pdf_url) {
        throw new Error('Contrato não possui PDF para migrar');
      }

      const oldUrl = contract.pdf_url;

      // Criar registro de migração
      const { data: migration, error: migrationError } = await supabase
        .from('contract_storage_migrations')
        .insert({
          contract_id: contractId,
          from_storage: fromStorage,
          to_storage: toStorage,
          status: 'in_progress',
          old_url: oldUrl,
        })
        .select()
        .single();

      if (migrationError) {
        throw new Error(`Erro ao criar registro de migração: ${migrationError.message}`);
      }

      try {
        // Baixar PDF do storage antigo
        const response = await fetch(oldUrl);
        if (!response.ok) {
          throw new Error('Erro ao baixar PDF do storage antigo');
        }

        const pdfBlob = await response.blob();
        const fileSize = pdfBlob.size;

        // Obter serviço de storage de destino
        const storageService = await createStorageService(organizationId);
        const newUrl = await storageService.uploadPDF(pdfBlob, contractId, 'contract');

        // Atualizar contrato com nova URL
        const { error: updateError } = await supabase
          .from('contracts')
          .update({ pdf_url: newUrl })
          .eq('id', contractId);

        if (updateError) {
          throw new Error(`Erro ao atualizar contrato: ${updateError.message}`);
        }

        // Atualizar registro de migração como concluída
        const { error: updateMigrationError } = await supabase
          .from('contract_storage_migrations')
          .update({
            status: 'completed',
            new_url: newUrl,
            file_size: fileSize,
            completed_at: new Date().toISOString(),
          })
          .eq('id', migration.id);

        if (updateMigrationError) {
          console.error('Erro ao atualizar status de migração:', updateMigrationError);
        }

        return {
          success: true,
          migrationId: migration.id,
          oldUrl,
          newUrl,
        };
      } catch (error: any) {
        // Atualizar registro de migração como falhada
        await supabase
          .from('contract_storage_migrations')
          .update({
            status: 'failed',
            error_message: error.message || 'Erro desconhecido',
          })
          .eq('id', migration.id);

        throw error;
      }
    } catch (error: any) {
      console.error('Erro ao migrar contrato:', error);
      return {
        success: false,
        error: error.message || 'Erro desconhecido ao migrar contrato',
      };
    }
  }

  /**
   * Migra todos os contratos de uma organização
   */
  static async migrateAllContracts(organizationId: string): Promise<{
    success: number;
    failed: number;
    errors: string[];
  }> {
    try {
      // Buscar todos os contratos com PDF
      const { data: contracts, error } = await supabase
        .from('contracts')
        .select('id, pdf_url')
        .eq('organization_id', organizationId)
        .not('pdf_url', 'is', null);

      if (error) {
        throw error;
      }

      if (!contracts || contracts.length === 0) {
        return { success: 0, failed: 0, errors: [] };
      }

      // Buscar configuração de storage atual e anterior
      const { data: currentConfig } = await supabase
        .from('contract_storage_config')
        .select('storage_type')
        .is('organization_id', null)
        .eq('is_active', true)
        .maybeSingle();

      const toStorage = currentConfig?.storage_type || 'supabase';
      const fromStorage = 'supabase'; // Assumir que estava em Supabase antes

      let success = 0;
      let failed = 0;
      const errors: string[] = [];

      // Migrar cada contrato
      for (const contract of contracts) {
        const result = await this.migrateContract(contract.id, organizationId, fromStorage, toStorage);
        if (result.success) {
          success++;
        } else {
          failed++;
          errors.push(`Contrato ${contract.id}: ${result.error}`);
        }
      }

      return { success, failed, errors };
    } catch (error: any) {
      console.error('Erro ao migrar contratos:', error);
      return {
        success: 0,
        failed: 0,
        errors: [error.message || 'Erro desconhecido'],
      };
    }
  }

  /**
   * Lista migrações de uma organização
   */
  static async listMigrations(organizationId: string, limit: number = 50): Promise<any[]> {
    const { data, error } = await supabase
      .from('contract_storage_migrations')
      .select('*, contracts!inner(organization_id)')
      .eq('contracts.organization_id', organizationId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Erro ao listar migrações:', error);
      return [];
    }

    return data || [];
  }
}

