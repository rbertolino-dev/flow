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

/** Link do Google Maps a partir de latitude/longitude do GPS. */
export function mapsCoordsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

/** Rótulo amigável do motivo do registro de presença. */
export function fieldCheckinEventLabel(event: string): string {
  switch (event) {
    case 'manual':
      return 'Confirmação no local';
    case 'stage_change':
      return 'Ao mudar etapa';
    case 'close':
      return 'Ao fechar a OS';
    default:
      return event || 'Presença';
  }
}

export function serviceOrderDeepLink(orderId: string): string {
  if (typeof window === 'undefined') return `/service-orders?os=${orderId}`;
  return `${window.location.origin}/service-orders?os=${orderId}`;
}

/** Precisão máxima aceita no check-in manual "Estou no local" (metros). */
export const MANUAL_CHECKIN_MAX_ACCURACY_M = 80;

type GeoPoint = { lat: number; lng: number; accuracy?: number };

const GEO_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  /** Sem cache: evita ponto antigo de outro lugar. */
  maximumAge: 0,
  timeout: 25_000,
};

/**
 * Captura GPS fresco. Amostra alguns segundos com watchPosition e fica
 * com a leitura de melhor precisão (navegador costuma melhorar após o 1º fix).
 */
export async function captureGeolocation(options?: {
  /** Se informado, rejeita se a melhor precisão for pior que isso (metros). */
  maxAccuracyMeters?: number;
  /** Tempo máximo amostrando o GPS (ms). */
  sampleMs?: number;
}): Promise<GeoPoint | null> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return null;

  const sampleMs = options?.sampleMs ?? 8_000;
  const maxAccuracyMeters = options?.maxAccuracyMeters;

  try {
    const best = await new Promise<GeoPoint>((resolve, reject) => {
      let settled = false;
      let bestSoFar: GeoPoint | null = null;
      let watchId: number | null = null;
      let sampleTimer: ReturnType<typeof setTimeout> | null = null;

      const finish = (point: GeoPoint | null, error?: GeolocationPositionError) => {
        if (settled) return;
        settled = true;
        if (watchId !== null) navigator.geolocation.clearWatch(watchId);
        if (sampleTimer) clearTimeout(sampleTimer);
        if (point) resolve(point);
        else reject(error || new Error('geolocation unavailable'));
      };

      const consider = (position: GeolocationPosition) => {
        const next: GeoPoint = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy:
            typeof position.coords.accuracy === 'number' ? position.coords.accuracy : undefined,
        };
        if (
          !bestSoFar ||
          (typeof next.accuracy === 'number' &&
            (typeof bestSoFar.accuracy !== 'number' || next.accuracy < bestSoFar.accuracy))
        ) {
          bestSoFar = next;
        }
        // Boa o suficiente: encerra antes do timeout
        if (typeof next.accuracy === 'number' && next.accuracy <= 25) {
          finish(bestSoFar);
        }
      };

      watchId = navigator.geolocation.watchPosition(consider, (err) => finish(bestSoFar, err), GEO_OPTIONS);

      // Fallback: uma leitura imediata sem cache
      navigator.geolocation.getCurrentPosition(consider, () => {}, GEO_OPTIONS);

      sampleTimer = setTimeout(() => finish(bestSoFar), sampleMs);
    });

    if (
      typeof maxAccuracyMeters === 'number' &&
      (typeof best.accuracy !== 'number' || best.accuracy > maxAccuracyMeters)
    ) {
      return null;
    }
    return best;
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
