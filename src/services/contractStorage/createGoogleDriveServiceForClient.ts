import { supabase } from '@/integrations/supabase/client';
import { GoogleDriveStorageService } from './GoogleDriveStorageService';

/**
 * Cria um GoogleDriveStorageService para um cliente específico
 * Busca a configuração do Google Drive do cliente na tabela client_google_drive_configs
 */
export async function createGoogleDriveServiceForClient(
  leadId: string,
  organizationId: string
): Promise<GoogleDriveStorageService | null> {
  try {
    // Buscar configuração do Google Drive do cliente
    const { data: config, error } = await supabase
      .from('client_google_drive_configs')
      .select('*')
      .eq('lead_id', leadId)
      .eq('organization_id', organizationId)
      .eq('is_active', true)
      .maybeSingle();

    if (error) {
      console.error('Erro ao buscar configuração do Google Drive do cliente:', error);
      return null;
    }

    if (!config) {
      return null; // Cliente não tem Google Drive configurado
    }

    return new GoogleDriveStorageService(organizationId, {
      accessToken: config.access_token,
      refreshToken: config.refresh_token,
      tokenExpiresAt: config.token_expires_at,
      folderId: config.google_drive_folder_id || undefined,
    });
  } catch (error: any) {
    console.error('Erro ao criar GoogleDriveStorageService para cliente:', error);
    return null;
  }
}

