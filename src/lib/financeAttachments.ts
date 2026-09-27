import imageCompression from 'browser-image-compression';
import { supabase } from '@/integrations/supabase/client';
import { guessMimeTypeFromFilename, sanitizeAttachmentFilename } from '@/lib/leadAttachments';

export const FINANCE_ATTACHMENTS_BUCKET = 'finance-attachments';
export const MAX_FINANCE_ATTACHMENT_BYTES = 10 * 1024 * 1024;
export const MAX_FINANCE_IMAGE_RAW_BYTES = 15 * 1024 * 1024;
export const MAX_FINANCE_IMAGE_PLAIN_BYTES = 8 * 1024 * 1024;

export function isFinanceImageFile(file: File): boolean {
  if ((file.type || '').startsWith('image/')) return true;
  return /\.(jpe?g|png|webp|gif)$/i.test(file.name);
}

export function formatAttachmentSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
}

export async function prepareFinanceAttachment(file: File, compress: boolean): Promise<File> {
  if (!isFinanceImageFile(file)) {
    if (file.size > MAX_FINANCE_ATTACHMENT_BYTES) {
      throw new Error('O anexo passa de 10 MB.');
    }
    return file;
  }
  if (file.size > MAX_FINANCE_IMAGE_RAW_BYTES) {
    throw new Error('A imagem passa de 15 MB. Escolha um arquivo menor.');
  }
  if (!compress) {
    if (file.size > MAX_FINANCE_IMAGE_PLAIN_BYTES) {
      throw new Error('Sem compressão, a imagem pode ter no máximo 8 MB. Ative Comprimir imagem ou escolha um arquivo menor.');
    }
    return file;
  }
  try {
    const compressed = await imageCompression(file, {
      maxSizeMB: 1.5,
      maxWidthOrHeight: 1920,
      useWebWorker: true,
      initialQuality: 0.8,
    });
    const compressedType = compressed.type || file.type;
    const prepared = compressed instanceof File && compressed.name && compressed.name !== 'blob'
      ? compressed
      : new File([compressed], file.name, { type: compressedType });
    if (prepared.size > MAX_FINANCE_ATTACHMENT_BYTES) {
      throw new Error('A imagem continua grande demais depois da compressão.');
    }
    return prepared.size < file.size ? prepared : file;
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('A imagem')) throw error;
    throw new Error('Não foi possível comprimir a imagem. Desative a compressão se ela tiver até 8 MB.');
  }
}

export function resolveFinanceAttachmentType(file: File): string {
  const fromFile = (file.type || '').trim();
  if (fromFile && fromFile !== 'application/octet-stream') return fromFile;
  return guessMimeTypeFromFilename(file.name) || 'application/octet-stream';
}

export async function uploadFinanceAttachment(
  organizationId: string,
  entryId: string,
  file: File
): Promise<{ path: string; name: string }> {
  if (file.size > MAX_FINANCE_ATTACHMENT_BYTES) {
    throw new Error('Arquivo muito grande. O limite é 10 MB.');
  }
  const safeName = sanitizeAttachmentFilename(file.name);
  const path = `${organizationId}/${entryId}/${crypto.randomUUID()}-${safeName}`;
  const { error } = await supabase.storage.from(FINANCE_ATTACHMENTS_BUCKET).upload(path, file, {
    upsert: false,
    cacheControl: '3600',
    contentType: resolveFinanceAttachmentType(file),
  });
  if (error) throw new Error(error.message || 'Não foi possível enviar o anexo');
  return { path, name: file.name };
}

export async function downloadFinanceAttachment(storagePath: string, filename: string): Promise<void> {
  const { data, error } = await supabase.storage.from(FINANCE_ATTACHMENTS_BUCKET).download(storagePath);
  if (error || !data) throw new Error(error?.message || 'Não foi possível baixar o anexo');
  const url = URL.createObjectURL(data);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename || 'anexo';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
