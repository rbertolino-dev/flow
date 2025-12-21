import { StorageService } from './StorageService';

export class FirebaseStorageService implements StorageService {
  private organizationId: string;
  private bucketName: string;
  private config: Record<string, any>;

  constructor(organizationId: string, config: Record<string, any>) {
    this.organizationId = organizationId;
    this.bucketName = config.bucket;
    this.config = config;
  }

  private async getFirebaseStorage() {
    try {
      // Importação dinâmica do Firebase Admin SDK (usando string para evitar erro de build)
      const firebaseAdminApp = await import(/* @vite-ignore */ 'firebase-admin/app');
      const firebaseAdminStorage = await import(/* @vite-ignore */ 'firebase-admin/storage');
      const { initializeApp, getApps, cert } = firebaseAdminApp;
      const { getStorage } = firebaseAdminStorage;

      let app;
      const apps = getApps();

      if (apps.length === 0) {
        // Parse das credenciais
        let credentials;
        try {
          credentials = typeof this.config.credentials === 'string' 
            ? JSON.parse(this.config.credentials) 
            : this.config.credentials;
        } catch (error) {
          throw new Error('Erro ao parsear credenciais do Firebase. Verifique se o JSON está correto.');
        }

        app = initializeApp({
          credential: cert(credentials),
          storageBucket: this.bucketName,
        });
      } else {
        app = apps[0];
      }

      return getStorage(app);
    } catch (error: any) {
      if (error.code === 'MODULE_NOT_FOUND') {
        throw new Error('Firebase Admin SDK não está instalado. Execute: npm install firebase-admin');
      }
      throw error;
    }
  }

  async uploadPDF(pdf: Blob, contractId: string, type: 'contract' | 'budget' = 'contract'): Promise<string> {
    const storage = await this.getFirebaseStorage();
    const fileExt = 'pdf';
    const fileName = `${contractId}-${Date.now()}.${fileExt}`;
    const folder = type === 'budget' ? 'budgets' : 'contracts';
    const filePath = `${this.organizationId}/${folder}/${fileName}`;

    const bucket = storage.bucket(this.bucketName);
    const file = bucket.file(filePath);

    // Converter Blob para Buffer
    const arrayBuffer = await pdf.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload do arquivo
    await file.save(buffer, {
      metadata: {
        contentType: 'application/pdf',
        cacheControl: 'public, max-age=86400',
      },
      public: true, // Tornar arquivo público
    });

    // Obter URL pública
    const [url] = await file.getSignedUrl({
      action: 'read',
      expires: '03-09-2491', // Data muito futura para URLs permanentes
    });

    return url;
  }

  async getPDFUrl(contractId: string): Promise<string> {
    const storage = await this.getFirebaseStorage();
    const bucket = storage.bucket(this.bucketName);
    const [files] = await bucket.getFiles({
      prefix: `${this.organizationId}/contracts/${contractId}`,
    });

    if (files.length === 0) {
      throw new Error('PDF não encontrado no storage');
    }

    const file = files[0];
    const [url] = await file.getSignedUrl({
      action: 'read',
      expires: '03-09-2491',
    });

    return url;
  }

  async deletePDF(contractId: string): Promise<void> {
    const storage = await this.getFirebaseStorage();
    const bucket = storage.bucket(this.bucketName);
    const [files] = await bucket.getFiles({
      prefix: `${this.organizationId}/contracts/${contractId}`,
    });

    if (files.length === 0) {
      return; // Arquivo não existe, considerar sucesso
    }

    await Promise.all(files.map((file) => file.delete()));
  }

  async getFileSize(contractId: string): Promise<number> {
    const storage = await this.getFirebaseStorage();
    const bucket = storage.bucket(this.bucketName);
    const [files] = await bucket.getFiles({
      prefix: `${this.organizationId}/contracts/${contractId}`,
    });

    if (files.length === 0) {
      throw new Error('PDF não encontrado no storage');
    }

    const [metadata] = await files[0].getMetadata();
    return parseInt(metadata.size || '0', 10);
  }

  async listFiles(organizationId: string): Promise<Array<{ contractId: string; url: string; size: number; createdAt: string }>> {
    const storage = await this.getFirebaseStorage();
    const bucket = storage.bucket(this.bucketName);
    const [files] = await bucket.getFiles({
      prefix: `${organizationId}/contracts/`,
    });

    return Promise.all(
      files.map(async (file) => {
        const [metadata] = await file.getMetadata();
        const [url] = await file.getSignedUrl({
          action: 'read',
          expires: '03-09-2491',
        });

        // Extrair contractId do nome do arquivo
        const fileName = file.name.split('/').pop() || '';
        const contractId = fileName.split('-')[0];

        return {
          contractId,
          url,
          size: parseInt(metadata.size || '0', 10),
          createdAt: metadata.timeCreated || new Date().toISOString(),
        };
      })
    );
  }
}

