import { BackupService } from './BackupService';
import { createStorageService } from './StorageFactory';

/**
 * Serviço para gerenciar versionamento de contratos
 */
export class VersioningService {
  /**
   * Cria uma nova versão de um contrato
   */
  static async createVersion(contractId: string, organizationId: string): Promise<{ success: boolean; versionNumber?: number; error?: string }> {
    try {
      // Buscar versões existentes
      const { data: existingVersions } = await supabase
        .from('contract_backups')
        .select('version_number')
        .eq('contract_id', contractId)
        .eq('backup_type', 'version')
        .order('version_number', { ascending: false })
        .limit(1);

      // Calcular próximo número de versão
      const nextVersion = existingVersions && existingVersions.length > 0
        ? (existingVersions[0].version_number || 0) + 1
        : 1;

      // Criar backup como versão
      const storageService = await createStorageService(organizationId);
      const result = await BackupService.createBackup(
        contractId,
        organizationId,
        'version',
        storageService,
        nextVersion
      );

      if (!result.success) {
        return { success: false, error: result.error };
      }

      return {
        success: true,
        versionNumber: nextVersion,
      };
    } catch (error: any) {
      console.error('Erro ao criar versão:', error);
      return {
        success: false,
        error: error.message || 'Erro desconhecido ao criar versão',
      };
    }
  }

  /**
   * Lista todas as versões de um contrato
   */
  static async listVersions(contractId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('contract_backups')
      .select('*')
      .eq('contract_id', contractId)
      .eq('backup_type', 'version')
      .order('version_number', { ascending: false });

    if (error) {
      console.error('Erro ao listar versões:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Restaura uma versão específica
   */
  static async restoreVersion(versionId: string, organizationId: string): Promise<{ success: boolean; error?: string }> {
    return BackupService.restoreBackup(versionId, organizationId);
  }
}

