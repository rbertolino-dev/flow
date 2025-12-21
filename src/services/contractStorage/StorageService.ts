/**
 * Interface comum para serviços de armazenamento de contratos
 * Implementações: SupabaseStorageService, FirebaseStorageService, S3StorageService
 */
export interface StorageService {
  /**
   * Faz upload de um PDF de contrato
   * @param pdf - Blob do PDF
   * @param contractId - ID do contrato
   * @param type - Tipo de arquivo ('contract' ou 'budget')
   * @returns URL pública do arquivo
   */
  uploadPDF(pdf: Blob, contractId: string, type?: 'contract' | 'budget'): Promise<string>;

  /**
   * Obtém a URL pública de um PDF de contrato
   * @param contractId - ID do contrato
   * @returns URL pública do arquivo
   */
  getPDFUrl(contractId: string): Promise<string>;

  /**
   * Deleta um PDF de contrato
   * @param contractId - ID do contrato
   */
  deletePDF(contractId: string): Promise<void>;

  /**
   * Obtém o tamanho do arquivo em bytes
   * @param contractId - ID do contrato
   * @returns Tamanho do arquivo em bytes
   */
  getFileSize(contractId: string): Promise<number>;

  /**
   * Lista todos os arquivos de contratos de uma organização
   * @param organizationId - ID da organização
   * @returns Lista de informações dos arquivos
   */
  listFiles(organizationId: string): Promise<Array<{ contractId: string; url: string; size: number; createdAt: string }>>;
}

