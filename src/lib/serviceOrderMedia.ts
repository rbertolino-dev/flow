import { supabase } from '@/integrations/supabase/client';
import {
  formatLeadAttachmentUploadError,
  resolveLeadAttachmentContentType,
  sanitizeAttachmentFilename,
} from '@/lib/leadAttachments';

const BUCKET = 'whatsapp-workflow-media';
export const SERVICE_ORDER_MEDIA_MAX_BYTES = 8 * 1024 * 1024;

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Falha ao ler arquivo'));
    reader.readAsDataURL(blob);
  });
}

/** Comprime imagem para JPEG (reduz falhas de tamanho no storage). */
export async function compressServiceOrderImage(
  blob: Blob,
  maxSide = 1600,
  quality = 0.82
): Promise<Blob> {
  if (!blob.type.startsWith('image/') || blob.type === 'image/gif') {
    return blob;
  }
  if (typeof createImageBitmap === 'undefined' && typeof Image === 'undefined') {
    return blob;
  }

  try {
    const bitmap = await createImageBitmap(blob);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return blob;
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();
    const compressed = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', quality)
    );
    return compressed || blob;
  } catch {
    return blob;
  }
}

export async function uploadServiceOrderMedia(
  orgId: string,
  orderOrDraftId: string,
  blob: Blob,
  filename: string
): Promise<string> {
  if (!orgId) throw new Error('Organização não encontrada. Recarregue a página.');
  if (blob.size > SERVICE_ORDER_MEDIA_MAX_BYTES) {
    throw new Error('Arquivo muito grande. Máximo 8 MB.');
  }

  const safeName = sanitizeAttachmentFilename(filename);
  const contentType =
    blob.type ||
    resolveLeadAttachmentContentType(
      new File([blob], safeName, { type: blob.type || '' })
    );
  const path = `${orgId}/service-orders/${orderOrDraftId}/${Date.now()}-${safeName}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    upsert: false,
    cacheControl: '3600',
    contentType,
  });

  if (!error) {
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return data.publicUrl;
  }

  console.warn('Upload storage falhou, usando data URL:', error);
  if (blob.size <= 1.5 * 1024 * 1024 && contentType.startsWith('image/')) {
    return blobToDataUrl(blob);
  }
  throw new Error(formatLeadAttachmentUploadError(error));
}

export function mapsSearchUrl(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address.trim())}`;
}

export function serviceOrderDeepLink(orderId: string): string {
  if (typeof window === 'undefined') return `/service-orders?os=${orderId}`;
  return `${window.location.origin}/service-orders?os=${orderId}`;
}

export async function captureGeolocation(): Promise<{
  lat: number;
  lng: number;
  accuracy?: number;
} | null> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return null;
  try {
    const position = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 60_000,
      });
    });
    return {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
      accuracy: position.coords.accuracy,
    };
  } catch {
    return null;
  }
}

export function isChecklistIncomplete(
  checklist?: Array<{
    response_type?: string | null;
    is_done?: boolean | null;
    answer?: string | null;
  }> | null
): boolean {
  if (!checklist?.length) return false;
  return checklist.some((item) => {
    if (item.response_type === 'text') {
      return !(item.answer || '').trim();
    }
    return !item.is_done;
  });
}
