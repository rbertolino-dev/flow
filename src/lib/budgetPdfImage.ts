/**
 * Carrega imagens para PDF de orçamento (Supabase, GCS, URLs públicas).
 * Detecta formato pelo Content-Type do blob (URLs sem extensão funcionam).
 */

export type PdfImageFormat = 'PNG' | 'JPEG' | 'WEBP';

export function mimeToPdfImageFormat(mime: string): PdfImageFormat {
  const m = mime.toLowerCase();
  if (m.includes('png')) return 'PNG';
  if (m.includes('webp')) return 'WEBP';
  return 'JPEG';
}

function formatHintFromUrl(url: string): PdfImageFormat {
  const path = url.split('?')[0].toLowerCase();
  if (path.endsWith('.png')) return 'PNG';
  if (path.endsWith('.webp')) return 'WEBP';
  if (path.endsWith('.jpg') || path.endsWith('.jpeg')) return 'JPEG';
  return 'JPEG';
}

export function fitImageInBox(
  naturalW: number,
  naturalH: number,
  maxW: number,
  maxH: number
): { w: number; h: number } {
  if (naturalW <= 0 || naturalH <= 0) {
    return { w: maxW, h: maxH };
  }
  const scale = Math.min(maxW / naturalW, maxH / naturalH, 1);
  return { w: naturalW * scale, h: naturalH * scale };
}

export function measureImageFromDataUrl(dataUrl: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve) => {
    if (typeof Image === 'undefined') {
      resolve({ w: 100, h: 100 });
      return;
    }
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth || 100, h: img.naturalHeight || 100 });
    img.onerror = () => resolve({ w: 100, h: 100 });
    img.src = dataUrl;
  });
}

export interface LoadedPdfImage {
  dataUrl: string;
  format: PdfImageFormat;
  naturalW: number;
  naturalH: number;
}

/**
 * Reduz logo para cabeçalho de PDF (evita PDF gigante por PNG em alta resolução embutido em base64).
 */
async function downscaleDataUrlForPdf(
  dataUrl: string,
  maxSide = 384
): Promise<{ dataUrl: string; format: PdfImageFormat; naturalW: number; naturalH: number } | null> {
  if (typeof Image === 'undefined') {
    return null;
  }
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const w0 = img.naturalWidth;
      const h0 = img.naturalHeight;
      if (w0 <= 0 || h0 <= 0) {
        resolve(null);
        return;
      }
      const scale = Math.min(maxSide / w0, maxSide / h0, 1);
      const cw = Math.max(1, Math.round(w0 * scale));
      const ch = Math.max(1, Math.round(h0 * scale));
      const canvas =
        typeof document !== 'undefined' ? document.createElement('canvas') : (null as HTMLCanvasElement | null);
      if (!canvas) {
        resolve(null);
        return;
      }
      canvas.width = cw;
      canvas.height = ch;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(null);
        return;
      }
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, cw, ch);
      ctx.drawImage(img, 0, 0, cw, ch);
      const jpeg = canvas.toDataURL('image/jpeg', 0.82);
      resolve({ dataUrl: jpeg, format: 'JPEG', naturalW: cw, naturalH: ch });
    };
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

export async function loadImageForBudgetPdf(url: string): Promise<LoadedPdfImage | null> {
  try {
    const response = await fetch(url, {
      mode: 'cors',
      credentials: 'omit',
      cache: 'no-cache',
    });

    if (!response.ok) {
      console.warn('Erro ao carregar imagem para PDF:', response.statusText, url);
      return null;
    }

    const blob = await response.blob();
    if (!blob || blob.size === 0) {
      console.warn('Imagem vazia ou inválida para PDF:', url);
      return null;
    }

    const mime = blob.type || response.headers.get('content-type') || '';
    const format = mime ? mimeToPdfImageFormat(mime) : formatHintFromUrl(url);

    const dataUrl = await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });

    if (!dataUrl) return null;

    const { w, h } = await measureImageFromDataUrl(dataUrl);
    const largeEnoughToCompress = w > 400 || h > 400 || blob.size > 200_000;
    if (largeEnoughToCompress) {
      const small = await downscaleDataUrlForPdf(dataUrl, 384);
      if (small) {
        return small;
      }
    }
    return { dataUrl, format, naturalW: w, naturalH: h };
  } catch (e: unknown) {
    const err = e as { message?: string; name?: string };
    if (
      err?.message?.includes('CORS') ||
      err?.message?.includes('Failed to fetch') ||
      err?.name === 'TypeError'
    ) {
      console.warn('CORS/rede ao carregar logo para PDF:', url);
    } else {
      console.warn('Erro ao carregar logo para PDF:', err?.message || e);
    }
    return null;
  }
}
