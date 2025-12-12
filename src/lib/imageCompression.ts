import imageCompression from 'browser-image-compression';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_WIDTH_OR_HEIGHT = 1920;
const COMPRESSION_QUALITY = 0.85;

/**
 * Comprime uma imagem antes do upload
 * Reduz tamanho em 70-80% mantendo qualidade aceitável
 */
export async function compressImage(file: File): Promise<File> {
  // Se já for menor que 5MB e não precisar redimensionar, retorna original
  if (file.size <= MAX_FILE_SIZE) {
    // Verificar dimensões da imagem
    const image = await createImageBitmap(file);
    if (image.width <= MAX_WIDTH_OR_HEIGHT && image.height <= MAX_WIDTH_OR_HEIGHT) {
      image.close();
      return file;
    }
    image.close();
  }

  const options = {
    maxSizeMB: MAX_FILE_SIZE / (1024 * 1024), // 5MB
    maxWidthOrHeight: MAX_WIDTH_OR_HEIGHT,
    useWebWorker: true,
    fileType: 'image/webp', // Converter para WebP quando possível
    initialQuality: COMPRESSION_QUALITY,
  };

  try {
    const compressedFile = await imageCompression(file, options);
    console.log(`✅ Imagem comprimida: ${(file.size / 1024 / 1024).toFixed(2)}MB → ${(compressedFile.size / 1024 / 1024).toFixed(2)}MB`);
    return compressedFile;
  } catch (error) {
    console.error('Erro ao comprimir imagem:', error);
    // Em caso de erro, retorna arquivo original
    return file;
  }
}

/**
 * Valida se o arquivo é uma imagem e se está dentro dos limites
 */
export function validateImageFile(file: File): { valid: boolean; error?: string } {
  const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: 'Tipo de arquivo inválido. Apenas imagens (JPG, PNG, WEBP) são permitidas',
    };
  }

  if (file.size > 16 * 1024 * 1024) {
    return {
      valid: false,
      error: 'Arquivo muito grande. O arquivo deve ter no máximo 16MB antes da compressão',
    };
  }

  return { valid: true };
}


