import { supabase } from '@/integrations/supabase/client';
import { createStorageService, createBackupStorageService } from './StorageFactory';
import { StorageService } from './StorageService';

export type BackupType = 'daily' | 'replication' | 'version';

export interface BackupResult {
  success: boolean;
  backupId?: string;
  url?: string;
  error?: string;
}

/**
 * Serviço para gerenciar backups de contratos
 */
export class BackupService {
  /**
   * Cria um backup de um contrato
   * Usa o backup storage configurado no Super Admin
   * Se não houver backup storage configurado, retorna erro
   */
  static async createBackup(
    contractId: string,
    organizationId: string,
    backupType: BackupType,
    versionNumber?: number
  ): Promise<BackupResult> {
    try {
      // Obter serviço de backup storage configurado
      const backupStorageService = await createBackupStorageService(organizationId);
      
      if (!backupStorageService) {
        return {
          success: false,
          error: 'Backup storage não configurado ou desativado. Configure no Super Admin.',
        };
      }

      // Buscar contrato
      const { data: contract, error: contractError } = await supabase
        .from('contracts')
        .select('pdf_url, organization_id')
        .eq('id', contractId)
        .single();

      if (contractError || !contract) {
        throw new Error('Contrato não encontrado');
      }

      if (!contract.pdf_url) {
        throw new Error('Contrato não possui PDF para backup');
      }

      // Baixar PDF do storage principal (Supabase)
      const response = await fetch(contract.pdf_url);
      if (!response.ok) {
        throw new Error('Erro ao baixar PDF para backup');
      }

      const pdfBlob = await response.blob();
      const fileSize = pdfBlob.size;

      // Fazer upload para storage de backup
      const backupUrl = await backupStorageService.uploadPDF(
        pdfBlob,
        `${contractId}-backup-${backupType}${versionNumber ? `-v${versionNumber}` : ''}`,
        'contract'
      );

      // Calcular checksum (SHA-256)
      const arrayBuffer = await pdfBlob.arrayBuffer();
      const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const checksum = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

      // Obter tipo de backup storage configurado
      const { data: storageConfig } = await supabase
        .from('contract_storage_config')
        .select('backup_storage_type')
        .is('organization_id', null)
        .eq('backup_is_active', true)
        .maybeSingle();

      const backupStorageType = storageConfig?.backup_storage_type || 'supabase';

      // Salvar registro do backup
      const { data: backup, error: backupError } = await supabase
        .from('contract_backups')
        .insert({
          contract_id: contractId,
          storage_type: backupStorageType,
          backup_url: backupUrl,
          backup_type: backupType,
          version_number: versionNumber,
          file_size: fileSize,
          checksum,
        })
        .select()
        .single();

      if (backupError) {
        throw new Error(`Erro ao salvar registro de backup: ${backupError.message}`);
      }

      return {
        success: true,
        backupId: backup.id,
        url: backupUrl,
      };
    } catch (error: any) {
      console.error('Erro ao criar backup:', error);
      return {
        success: false,
        error: error.message || 'Erro desconhecido ao criar backup',
      };
    }
  }

  /**
   * Cria backup diário de todos os contratos de uma organização
   * Usa o backup storage configurado no Super Admin
   */
  static async createDailyBackup(organizationId: string): Promise<{ success: number; failed: number; errors: string[] }> {
    try {
      // Verificar se backup storage está configurado
      const backupStorageService = await createBackupStorageService(organizationId);
      if (!backupStorageService) {
        return {
          success: 0,
          failed: 0,
          errors: ['Backup storage não configurado ou desativado. Configure no Super Admin.'],
        };
      }

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

      let success = 0;
      let failed = 0;
      const errors: string[] = [];

      // Criar backup de cada contrato
      for (const contract of contracts) {
        const result = await this.createBackup(contract.id, organizationId, 'daily');
        if (result.success) {
          success++;
        } else {
          failed++;
          errors.push(`Contrato ${contract.id}: ${result.error}`);
        }
      }

      return { success, failed, errors };
    } catch (error: any) {
      console.error('Erro ao criar backup diário:', error);
      return {
        success: 0,
        failed: 0,
        errors: [error.message || 'Erro desconhecido'],
      };
    }
  }

  /**
   * Restaura um backup
   */
  static async restoreBackup(backupId: string, organizationId: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Buscar backup
      const { data: backup, error: backupError } = await supabase
        .from('contract_backups')
        .select('*, contracts!inner(id, organization_id)')
        .eq('id', backupId)
        .single();

      if (backupError || !backup) {
        throw new Error('Backup não encontrado');
      }

      // Verificar se o backup pertence à organização
      if (backup.contracts.organization_id !== organizationId) {
        throw new Error('Backup não pertence a esta organização');
      }

      // Baixar PDF do backup
      const response = await fetch(backup.backup_url);
      if (!response.ok) {
        throw new Error('Erro ao baixar PDF do backup');
      }

      const pdfBlob = await response.blob();

      // Validar checksum
      const arrayBuffer = await pdfBlob.arrayBuffer();
      const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const calculatedChecksum = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

      if (calculatedChecksum !== backup.checksum) {
        throw new Error('Checksum inválido - arquivo pode estar corrompido');
      }

      // Fazer upload para storage principal (Supabase)
      const storageService = await createStorageService(organizationId);
      const newUrl = await storageService.uploadPDF(pdfBlob, backup.contract_id, 'contract');

      // Atualizar contrato com URL restaurada
      const { error: updateError } = await supabase
        .from('contracts')
        .update({ pdf_url: newUrl })
        .eq('id', backup.contract_id);

      if (updateError) {
        throw new Error(`Erro ao atualizar contrato: ${updateError.message}`);
      }

      return { success: true };
    } catch (error: any) {
      console.error('Erro ao restaurar backup:', error);
      return {
        success: false,
        error: error.message || 'Erro desconhecido ao restaurar backup',
      };
    }
  }

  /**
   * Lista backups de um contrato
   */
  static async listBackups(contractId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('contract_backups')
      .select('*')
      .eq('contract_id', contractId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Erro ao listar backups:', error);
      return [];
    }

    return data || [];
  }
}

