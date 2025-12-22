import { StorageService } from './StorageService';

interface GoogleDriveConfig {
  accessToken: string;
  refreshToken: string;
  tokenExpiresAt: string;
  folderId?: string;
}

export class GoogleDriveStorageService implements StorageService {
  private config: GoogleDriveConfig;
  private organizationId: string;

  constructor(organizationId: string, config: GoogleDriveConfig) {
    this.organizationId = organizationId;
    this.config = config;
  }

  private async getAccessToken(): Promise<string> {
    // Verificar se token expirou
    const expiresAt = new Date(this.config.tokenExpiresAt);
    const now = new Date();
    
    if (now >= expiresAt) {
      // Token expirado, precisa renovar
      // Isso será feito via edge function
      throw new Error('Token expirado. Renove o token via OAuth.');
    }

    return this.config.accessToken;
  }

  private async refreshAccessToken(): Promise<string> {
    // Chamar edge function para renovar token
    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-drive-refresh-token`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          refresh_token: this.config.refreshToken,
        }),
      }
    );

    if (!response.ok) {
      throw new Error('Erro ao renovar token do Google Drive');
    }

    const data = await response.json();
    return data.access_token;
  }

  async uploadPDF(pdf: Blob, contractId: string, type: 'contract' | 'budget' = 'contract'): Promise<string> {
    try {
      let accessToken = await this.getAccessToken();
      
      // Se token expirou, tentar renovar
      if (!accessToken) {
        accessToken = await this.refreshAccessToken();
      }

      // Nome do arquivo
      const fileName = `${type}-${contractId}.pdf`;
      
      // Criar FormData para upload
      const formData = new FormData();
      formData.append('metadata', JSON.stringify({
        name: fileName,
        parents: this.config.folderId ? [this.config.folderId] : [],
      }));
      formData.append('file', pdf, fileName);

      // Upload para Google Drive
      const response = await fetch(
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
          body: formData,
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Erro desconhecido' }));
        throw new Error(error.error?.message || 'Erro ao fazer upload para Google Drive');
      }

      const fileData = await response.json();
      
      // Retornar URL pública do arquivo
      return `https://drive.google.com/file/d/${fileData.id}/view`;
    } catch (error: any) {
      console.error('Erro ao fazer upload para Google Drive:', error);
      throw error;
    }
  }

  async getPDFUrl(contractId: string): Promise<string> {
    // Buscar arquivo no Google Drive pelo nome
    try {
      let accessToken = await this.getAccessToken();
      
      if (!accessToken) {
        accessToken = await this.refreshAccessToken();
      }

      // Buscar arquivo
      const fileName = `contract-${contractId}.pdf`;
      const query = `name='${fileName}' and trashed=false`;
      const folderQuery = this.config.folderId ? ` and '${this.config.folderId}' in parents` : '';
      
      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query + folderQuery)}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Erro ao buscar arquivo no Google Drive');
      }

      const data = await response.json();
      
      if (data.files && data.files.length > 0) {
        return `https://drive.google.com/file/d/${data.files[0].id}/view`;
      }

      throw new Error('Arquivo não encontrado no Google Drive');
    } catch (error: any) {
      console.error('Erro ao buscar PDF no Google Drive:', error);
      throw error;
    }
  }

  async deletePDF(contractId: string): Promise<void> {
    try {
      let accessToken = await this.getAccessToken();
      
      if (!accessToken) {
        accessToken = await this.refreshAccessToken();
      }

      // Buscar arquivo
      const fileName = `contract-${contractId}.pdf`;
      const query = `name='${fileName}' and trashed=false`;
      const folderQuery = this.config.folderId ? ` and '${this.config.folderId}' in parents` : '';
      
      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query + folderQuery)}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Erro ao buscar arquivo no Google Drive');
      }

      const data = await response.json();
      
      if (data.files && data.files.length > 0) {
        // Deletar arquivo
        const deleteResponse = await fetch(
          `https://www.googleapis.com/drive/v3/files/${data.files[0].id}`,
          {
            method: 'DELETE',
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );

        if (!deleteResponse.ok) {
          throw new Error('Erro ao deletar arquivo no Google Drive');
        }
      }
    } catch (error: any) {
      console.error('Erro ao deletar PDF no Google Drive:', error);
      throw error;
    }
  }

  async getFileSize(contractId: string): Promise<number> {
    try {
      let accessToken = await this.getAccessToken();
      
      if (!accessToken) {
        accessToken = await this.refreshAccessToken();
      }

      // Buscar arquivo
      const fileName = `contract-${contractId}.pdf`;
      const query = `name='${fileName}' and trashed=false`;
      const folderQuery = this.config.folderId ? ` and '${this.config.folderId}' in parents` : '';
      
      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query + folderQuery)}&fields=files(size)`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Erro ao buscar arquivo no Google Drive');
      }

      const data = await response.json();
      
      if (data.files && data.files.length > 0) {
        return parseInt(data.files[0].size || '0', 10);
      }

      return 0;
    } catch (error: any) {
      console.error('Erro ao buscar tamanho do arquivo no Google Drive:', error);
      return 0;
    }
  }

  async listFiles(organizationId: string): Promise<Array<{ contractId: string; url: string; size: number; createdAt: string }>> {
    try {
      let accessToken = await this.getAccessToken();
      
      if (!accessToken) {
        accessToken = await this.refreshAccessToken();
      }

      // Buscar todos os arquivos PDF na pasta
      const query = `mimeType='application/pdf' and trashed=false`;
      const folderQuery = this.config.folderId ? ` and '${this.config.folderId}' in parents` : '';
      
      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query + folderQuery)}&fields=files(id,name,size,createdTime)`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Erro ao listar arquivos no Google Drive');
      }

      const data = await response.json();
      
      return (data.files || []).map((file: any) => {
        // Extrair contractId do nome do arquivo (contract-{id}.pdf)
        const match = file.name.match(/contract-([^.]+)\.pdf/);
        const contractId = match ? match[1] : file.id;
        
        return {
          contractId,
          url: `https://drive.google.com/file/d/${file.id}/view`,
          size: parseInt(file.size || '0', 10),
          createdAt: file.createdTime || new Date().toISOString(),
        };
      });
    } catch (error: any) {
      console.error('Erro ao listar arquivos no Google Drive:', error);
      return [];
    }
  }
}

