import { supabase } from '@/integrations/supabase/client';
import { useActiveOrganization } from '@/hooks/useActiveOrganization';

export interface StorageService {
  uploadPDF(pdf: Blob, contractId: string, type?: 'contract' | 'budget'): Promise<string>;
  getPDFUrl(contractId: string): Promise<string>;
  deletePDF(contractId: string): Promise<void>;
}

const BUCKET_ID = 'whatsapp-workflow-media'; // Usar o bucket existente ou criar um novo

export class SupabaseStorageService implements StorageService {
  private organizationId: string;

  constructor(organizationId: string) {
    this.organizationId = organizationId;
  }

  async uploadPDF(pdf: Blob, contractId: string, type: 'contract' | 'budget' = 'contract'): Promise<string> {
    const fileExt = 'pdf';
    const fileName = `${contractId}-${Date.now()}.${fileExt}`;
    const folder = type === 'budget' ? 'budgets' : 'contracts';
    const filePath = `${this.organizationId}/${folder}/${fileName}`;

    // Upload para Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from(BUCKET_ID)
      .upload(filePath, pdf, {
        upsert: false,
        cacheControl: '86400', // 24 horas
        contentType: 'application/pdf',
      });

    if (uploadError) {
      throw new Error(`Erro ao fazer upload do PDF: ${uploadError.message}`);
    }

    // Obter URL pública
    const { data: publicUrlData } = supabase.storage
      .from(BUCKET_ID)
      .getPublicUrl(filePath);

    return publicUrlData.publicUrl;
  }

  async getPDFUrl(contractId: string): Promise<string> {
    // Buscar arquivo no storage
    const { data: files, error } = await supabase.storage
      .from(BUCKET_ID)
      .list(`${this.organizationId}/contracts`, {
        search: contractId,
      });

    if (error || !files || files.length === 0) {
      throw new Error('PDF não encontrado no storage');
    }

    const file = files[0];
    const { data: publicUrlData } = supabase.storage
      .from(BUCKET_ID)
      .getPublicUrl(`${this.organizationId}/contracts/${file.name}`);

    return publicUrlData.publicUrl;
  }

  async deletePDF(contractId: string): Promise<void> {
    // Buscar arquivo no storage
    const { data: files, error } = await supabase.storage
      .from(BUCKET_ID)
      .list(`${this.organizationId}/contracts`, {
        search: contractId,
      });

    if (error || !files || files.length === 0) {
      return; // Arquivo não existe, considerar sucesso
    }

    // Deletar arquivo
    const filePaths = files.map((file) => `${this.organizationId}/contracts/${file.name}`);
    const { error: deleteError } = await supabase.storage
      .from(BUCKET_ID)
      .remove(filePaths);

    if (deleteError) {
      throw new Error(`Erro ao deletar PDF: ${deleteError.message}`);
    }
  }
}

// Factory para criar o service apropriado baseado na configuração
export async function createStorageService(organizationId: string): Promise<StorageService> {
  // Por enquanto, sempre usar Supabase
  // No futuro, buscar configuração de contract_storage_config
  return new SupabaseStorageService(organizationId);
}


