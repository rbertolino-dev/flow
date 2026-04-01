import { supabase } from '@/integrations/supabase/client';
import { StorageService } from './StorageService';

const BUCKET_CONTRACTS = 'whatsapp-workflow-media';
/** Bucket dedicado a PDFs de orçamento (limite maior que o bucket de mídia do WhatsApp). */
const BUCKET_BUDGET_PDFS = 'budget-pdfs';

export class SupabaseStorageService implements StorageService {
  private organizationId: string;

  constructor(organizationId: string) {
    this.organizationId = organizationId;
  }

  async uploadPDF(pdf: Blob, contractId: string, type: 'contract' | 'budget' = 'contract'): Promise<string> {
    const bucketId = type === 'budget' ? BUCKET_BUDGET_PDFS : BUCKET_CONTRACTS;
    const fileExt = 'pdf';
    const fileName = `${contractId}-${Date.now()}.${fileExt}`;
    const folder = type === 'budget' ? 'budgets' : 'contracts';
    const filePath = `${this.organizationId}/${folder}/${fileName}`;

    // Upload para Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from(bucketId)
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
      .from(bucketId)
      .getPublicUrl(filePath);

    return publicUrlData.publicUrl;
  }

  async getPDFUrl(contractId: string): Promise<string> {
    // Buscar arquivo no storage
    const { data: files, error } = await supabase.storage
      .from(BUCKET_CONTRACTS)
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
      .from(BUCKET_CONTRACTS)
      .list(`${this.organizationId}/contracts`, {
        search: contractId,
      });

    if (error || !files || files.length === 0) {
      return; // Arquivo não existe, considerar sucesso
    }

    // Deletar arquivo
    const filePaths = files.map((file) => `${this.organizationId}/contracts/${file.name}`);
    const { error: deleteError } = await supabase.storage
      .from(BUCKET_CONTRACTS)
      .remove(filePaths);

    if (deleteError) {
      throw new Error(`Erro ao deletar PDF: ${deleteError.message}`);
    }
  }

  async getFileSize(contractId: string): Promise<number> {
    const { data: files, error } = await supabase.storage
      .from(BUCKET_CONTRACTS)
      .list(`${this.organizationId}/contracts`, {
        search: contractId,
      });

    if (error || !files || files.length === 0) {
      throw new Error('PDF não encontrado no storage');
    }

    return files[0].metadata?.size || 0;
  }

  async listFiles(organizationId: string): Promise<Array<{ contractId: string; url: string; size: number; createdAt: string }>> {
    const { data: files, error } = await supabase.storage
      .from(BUCKET_CONTRACTS)
      .list(`${organizationId}/contracts`);

    if (error) {
      throw new Error(`Erro ao listar arquivos: ${error.message}`);
    }

    if (!files || files.length === 0) {
      return [];
    }

    return files.map((file) => {
      const { data: publicUrlData } = supabase.storage
        .from(BUCKET_ID)
        .getPublicUrl(`${organizationId}/contracts/${file.name}`);

      // Extrair contractId do nome do arquivo (formato: contractId-timestamp.pdf)
      const contractId = file.name.split('-')[0];

      return {
        contractId,
        url: publicUrlData.publicUrl,
        size: file.metadata?.size || 0,
        createdAt: file.created_at || new Date().toISOString(),
      };
    });
  }
}

