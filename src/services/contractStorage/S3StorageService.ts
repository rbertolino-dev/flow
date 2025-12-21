import { StorageService } from './StorageService';

export class S3StorageService implements StorageService {
  private organizationId: string;
  private bucketName: string;
  private config: Record<string, any>;
  private s3Client: any = null;

  constructor(organizationId: string, config: Record<string, any>) {
    this.organizationId = organizationId;
    this.bucketName = config.bucket;
    this.config = config;
  }

  private async getS3Client() {
    if (this.s3Client) {
      return this.s3Client;
    }

    try {
      // Importação dinâmica do AWS SDK (usando string para evitar erro de build)
      const s3Module = await import(/* @vite-ignore */ '@aws-sdk/client-s3');
      const { S3Client } = s3Module;
      
      this.s3Client = new S3Client({
        region: this.config.region,
        credentials: {
          accessKeyId: this.config.access_key_id,
          secretAccessKey: this.config.secret_access_key,
        },
      });

      return this.s3Client;
    } catch (error: any) {
      if (error.code === 'MODULE_NOT_FOUND') {
        throw new Error('AWS SDK não está instalado. Execute: npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner');
      }
      throw error;
    }
  }

  async uploadPDF(pdf: Blob, contractId: string, type: 'contract' | 'budget' = 'contract'): Promise<string> {
    const s3Client = await this.getS3Client();
    const s3ClientModule = await import(/* @vite-ignore */ '@aws-sdk/client-s3');
    const s3PresignerModule = await import(/* @vite-ignore */ '@aws-sdk/s3-request-presigner');
    const { PutObjectCommand, GetObjectCommand } = s3ClientModule;
    const { getSignedUrl } = s3PresignerModule;

    const fileExt = 'pdf';
    const fileName = `${contractId}-${Date.now()}.${fileExt}`;
    const folder = type === 'budget' ? 'budgets' : 'contracts';
    const key = `${this.organizationId}/${folder}/${fileName}`;

    // Converter Blob para Buffer
    const arrayBuffer = await pdf.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload do arquivo
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      Body: buffer,
      ContentType: 'application/pdf',
      CacheControl: 'public, max-age=86400',
    });

    await s3Client.send(command);

    // Obter URL pública (presigned URL válida por 1 ano)
    const getObjectCommand = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    const url = await getSignedUrl(s3Client, getObjectCommand, {
      expiresIn: 31536000, // 1 ano em segundos
    });

    return url;
  }

  async getPDFUrl(contractId: string): Promise<string> {
    const s3Client = await this.getS3Client();
    const s3ClientModule = await import(/* @vite-ignore */ '@aws-sdk/client-s3');
    const s3PresignerModule = await import(/* @vite-ignore */ '@aws-sdk/s3-request-presigner');
    const { ListObjectsV2Command, GetObjectCommand } = s3ClientModule;
    const { getSignedUrl } = s3PresignerModule;

    // Listar objetos com prefixo do contractId
    const listCommand = new ListObjectsV2Command({
      Bucket: this.bucketName,
      Prefix: `${this.organizationId}/contracts/${contractId}`,
    });

    const response = await s3Client.send(listCommand);

    if (!response.Contents || response.Contents.length === 0) {
      throw new Error('PDF não encontrado no storage');
    }

    const key = response.Contents[0].Key!;

    // Obter URL assinada
    const getObjectCommand = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    const url = await getSignedUrl(s3Client, getObjectCommand, {
      expiresIn: 31536000, // 1 ano
    });

    return url;
  }

  async deletePDF(contractId: string): Promise<void> {
    const s3Client = await this.getS3Client();
    const s3ClientModule = await import(/* @vite-ignore */ '@aws-sdk/client-s3');
    const { ListObjectsV2Command, DeleteObjectCommand } = s3ClientModule;

    // Listar objetos com prefixo do contractId
    const listCommand = new ListObjectsV2Command({
      Bucket: this.bucketName,
      Prefix: `${this.organizationId}/contracts/${contractId}`,
    });

    const response = await s3Client.send(listCommand);

    if (!response.Contents || response.Contents.length === 0) {
      return; // Arquivo não existe, considerar sucesso
    }

    // Deletar todos os arquivos encontrados
    await Promise.all(
      response.Contents.map((object) =>
        s3Client.send(
          new DeleteObjectCommand({
            Bucket: this.bucketName,
            Key: object.Key!,
          })
        )
      )
    );
  }

  async getFileSize(contractId: string): Promise<number> {
    const s3Client = await this.getS3Client();
    const s3ClientModule = await import(/* @vite-ignore */ '@aws-sdk/client-s3');
    const { ListObjectsV2Command } = s3ClientModule;

    const listCommand = new ListObjectsV2Command({
      Bucket: this.bucketName,
      Prefix: `${this.organizationId}/contracts/${contractId}`,
    });

    const response = await s3Client.send(listCommand);

    if (!response.Contents || response.Contents.length === 0) {
      throw new Error('PDF não encontrado no storage');
    }

    return response.Contents[0].Size || 0;
  }

  async listFiles(organizationId: string): Promise<Array<{ contractId: string; url: string; size: number; createdAt: string }>> {
    const s3Client = await this.getS3Client();
    const s3ClientModule = await import(/* @vite-ignore */ '@aws-sdk/client-s3');
    const s3PresignerModule = await import(/* @vite-ignore */ '@aws-sdk/s3-request-presigner');
    const { ListObjectsV2Command, GetObjectCommand } = s3ClientModule;
    const { getSignedUrl } = s3PresignerModule;

    const listCommand = new ListObjectsV2Command({
      Bucket: this.bucketName,
      Prefix: `${organizationId}/contracts/`,
    });

    const response = await s3Client.send(listCommand);

    if (!response.Contents || response.Contents.length === 0) {
      return [];
    }

    return Promise.all(
      response.Contents.map(async (object) => {
        const key = object.Key!;

        // Obter URL assinada
        const getObjectCommand = new GetObjectCommand({
          Bucket: this.bucketName,
          Key: key,
        });

        const url = await getSignedUrl(s3Client, getObjectCommand, {
          expiresIn: 31536000, // 1 ano
        });

        // Extrair contractId do nome do arquivo
        const fileName = key.split('/').pop() || '';
        const contractId = fileName.split('-')[0];

        return {
          contractId,
          url,
          size: object.Size || 0,
          createdAt: object.LastModified?.toISOString() || new Date().toISOString(),
        };
      })
    );
  }
}

