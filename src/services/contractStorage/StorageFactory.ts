import { supabase } from '@/integrations/supabase/client';
import { StorageService } from './StorageService';
import { SupabaseStorageService } from './SupabaseStorageService';
import { FirebaseStorageService } from './FirebaseStorageService';
import { S3StorageService } from './S3StorageService';
import { StorageType } from '@/types/contract';

/**
 * Factory para criar o serviço de storage PRINCIPAL
 * IMPORTANTE: O storage principal SEMPRE é Supabase (não muda)
 * Esta função sempre retorna SupabaseStorageService
 */
export async function createStorageService(organizationId: string): Promise<StorageService> {
  // Storage principal sempre é Supabase (não usa configuração)
  return new SupabaseStorageService(organizationId);
}

/**
 * Factory para criar o serviço de storage de BACKUP
 * Usa a configuração de backup storage definida pelo Super Admin
 * Se não houver configuração de backup, retorna null (backup desabilitado)
 */
export async function createBackupStorageService(organizationId: string): Promise<StorageService | null> {
  try {
    // Buscar configuração global de backup (organization_id = null)
    const { data: config, error } = await supabase
      .from('contract_storage_config')
      .select('backup_storage_type, backup_config, backup_is_active')
      .is('organization_id', null)
      .eq('backup_is_active', true)
      .maybeSingle();

    if (error) {
      console.error('Erro ao buscar configuração de backup storage:', error);
      return null; // Backup desabilitado se houver erro
    }

    // Se não houver configuração de backup ou estiver desativado, retornar null
    if (!config || !config.backup_is_active || !config.backup_storage_type) {
      return null; // Backup desabilitado
    }

    const backupStorageType = config.backup_storage_type as StorageType;
    const backupConfig = config.backup_config || {};

    // Criar serviço de backup baseado no tipo configurado
    switch (backupStorageType) {
      case 'supabase':
        return new SupabaseStorageService(organizationId);

      case 'firebase':
        if (!backupConfig.project_id || !backupConfig.bucket || !backupConfig.credentials) {
          console.error('Configuração do Firebase incompleta para backup. Verifique project_id, bucket e credentials.');
          return null;
        }
        return new FirebaseStorageService(organizationId, backupConfig);

      case 's3':
        if (!backupConfig.bucket || !backupConfig.region || !backupConfig.access_key_id || !backupConfig.secret_access_key) {
          console.error('Configuração do S3 incompleta para backup. Verifique bucket, region, access_key_id e secret_access_key.');
          return null;
        }
        return new S3StorageService(organizationId, backupConfig);

      case 'custom':
        console.warn('Storage customizado para backup ainda não implementado');
        return null;

      default:
        console.warn(`Tipo de backup storage desconhecido: ${backupStorageType}`);
        return null;
    }
  } catch (error: any) {
    console.error('Erro ao criar serviço de backup storage:', error);
    return null; // Backup desabilitado em caso de erro
  }
}

