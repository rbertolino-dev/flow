import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Camera,
  CheckCircle2,
  ClipboardList,
  Clock3,
  ImagePlus,
  Loader2,
  PenLine,
  Upload,
  X,
} from 'lucide-react';
import { ServiceOrder, ServiceOrderCloseData } from '@/types/serviceOrder';
import { SignaturePad, SignaturePadHandle } from './SignaturePad';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import {
  formatLeadAttachmentUploadError,
  resolveLeadAttachmentContentType,
  sanitizeAttachmentFilename,
} from '@/lib/leadAttachments';
import { osDialogContentClass } from './osResponsive';

const BUCKET = 'whatsapp-workflow-media';
const MAX_BYTES = 8 * 1024 * 1024;

interface ServiceOrderCloseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: ServiceOrder;
  organizationId: string;
  onClosed: (data: ServiceOrderCloseData) => Promise<boolean>;
}

function guessExt(mime: string, fallback: string): string {
  if (mime.includes('png')) return 'png';
  if (mime.includes('webp')) return 'webp';
  if (mime.includes('pdf')) return 'pdf';
  if (mime.includes('jpeg') || mime.includes('jpg')) return 'jpg';
  return fallback;
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Falha ao ler arquivo'));
    reader.readAsDataURL(blob);
  });
}

/** Comprime imagem para JPEG (reduz falhas de tamanho no storage). */
async function compressImageBlob(blob: Blob, maxSide = 1600, quality = 0.82): Promise<Blob> {
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

async function uploadOrDataUrl(
  orgId: string,
  orderId: string,
  blob: Blob,
  filename: string
): Promise<string> {
  if (!orgId) throw new Error('Organização não encontrada. Recarregue a página.');
  if (blob.size > MAX_BYTES) {
    throw new Error('Arquivo muito grande. Máximo 8 MB.');
  }

  const safeName = sanitizeAttachmentFilename(filename);
  const contentType =
    blob.type ||
    resolveLeadAttachmentContentType(
      new File([blob], safeName, { type: blob.type || '' })
    );
  const path = `${orgId}/service-orders/${orderId}/${Date.now()}-${safeName}`;

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
  // Fallback: embute no banco/PDF (assinaturas e fotos pequenas)
  if (blob.size <= 1.5 * 1024 * 1024 && contentType.startsWith('image/')) {
    return blobToDataUrl(blob);
  }
  throw new Error(formatLeadAttachmentUploadError(error));
}

export function ServiceOrderCloseDialog({
  open,
  onOpenChange,
  order,
  organizationId,
  onClosed,
}: ServiceOrderCloseDialogProps) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const signatureRef = useRef<SignaturePadHandle>(null);

  const [summary, setSummary] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [attachments, setAttachments] = useState<string[]>([]);
  const [signaturePreview, setSignaturePreview] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      stopCamera();
      return;
    }
    setSummary(order.execution_summary || '');
    setStartDate(
      order.execution_starts_at
        ? format(new Date(order.execution_starts_at), "yyyy-MM-dd'T'HH:mm")
        : order.starts_at
          ? format(new Date(order.starts_at), "yyyy-MM-dd'T'HH:mm")
          : ''
    );
    setEndDate(
      order.execution_ends_at
        ? format(new Date(order.execution_ends_at), "yyyy-MM-dd'T'HH:mm")
        : order.ends_at
          ? format(new Date(order.ends_at), "yyyy-MM-dd'T'HH:mm")
          : ''
    );
    setAttachments(order.close_attachments || []);
    setSignaturePreview(order.signature_url || '');
  }, [open, order]);

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraOpen(false);
  };

  const openCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
      streamRef.current = stream;
      setCameraOpen(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play();
        }
      }, 50);
    } catch (err) {
      console.error(err);
      toast({
        title: 'Câmera indisponível',
        description: 'Permita o acesso à câmera ou use o upload de arquivos.',
        variant: 'destructive',
      });
    }
  };

  const attachBlob = async (blob: Blob, filename: string) => {
    const prepared = await compressImageBlob(blob);
    const ext = guessExt(prepared.type || blob.type, 'jpg');
    const name = filename.includes('.') ? filename : `${filename}.${ext}`;
    return uploadOrDataUrl(organizationId, order.id, prepared, name);
  };

  const capturePhoto = async () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    setUploading(true);
    try {
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/jpeg', 0.85)
      );
      if (!blob) throw new Error('Falha ao capturar foto');
      const url = await attachBlob(blob, 'camera.jpg');
      setAttachments((prev) => [...prev, url]);
      stopCamera();
      toast({ title: 'Foto anexada' });
    } catch (err) {
      toast({
        title: 'Erro ao anexar foto',
        description: err instanceof Error ? err.message : 'Não foi possível anexar a foto',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    if (!organizationId) {
      toast({
        title: 'Erro no upload',
        description: 'Organização não encontrada. Recarregue a página.',
        variant: 'destructive',
      });
      return;
    }
    setUploading(true);
    try {
      const urls: string[] = [];
      for (const file of Array.from(files)) {
        const typed = new File([file], file.name, {
          type: resolveLeadAttachmentContentType(file),
        });
        const url = await attachBlob(typed, typed.name.replace(/\s+/g, '_'));
        urls.push(url);
      }
      setAttachments((prev) => [...prev, ...urls]);
      toast({ title: `${urls.length} arquivo(s) anexado(s)` });
    } catch (err) {
      toast({
        title: 'Erro no upload',
        description: formatLeadAttachmentUploadError(err),
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const resolveSignatureUrl = async (): Promise<string> => {
    const fromPad = signatureRef.current?.getDataUrl();
    const raw = fromPad || signaturePreview;
    if (!raw) {
      throw new Error('Assine no campo de assinatura antes de finalizar.');
    }
    if (raw.startsWith('http://') || raw.startsWith('https://')) {
      return raw;
    }
    // data URL → blob → upload (com fallback data URL)
    const res = await fetch(raw);
    const blob = await res.blob();
    return uploadOrDataUrl(organizationId, order.id, blob, 'assinatura.png');
  };

  const handleFinalize = async () => {
    if (!summary.trim()) {
      toast({
        title: 'Preencha a execução',
        description: 'Descreva como foi a execução da ordem.',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      const signature_url = await resolveSignatureUrl();
      const ok = await onClosed({
        execution_summary: summary.trim(),
        execution_starts_at: startDate ? new Date(startDate).toISOString() : undefined,
        execution_ends_at: endDate ? new Date(endDate).toISOString() : undefined,
        close_attachments: attachments,
        signature_url,
      });
      if (ok) onOpenChange(false);
    } catch (err) {
      toast({
        title: 'Não foi possível finalizar',
        description: err instanceof Error ? err.message : 'Tente novamente',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) stopCamera();
        onOpenChange(v);
      }}
    >
      <DialogContent
        className={`${osDialogContentClass} sm:max-w-lg pb-[max(1rem,env(safe-area-inset-bottom))]`}
        data-testid="os-close-dialog"
      >
        <DialogHeader>
          <DialogTitle className="text-center tracking-wide text-base sm:text-lg pr-6">
            ENCERRAR ORDEM DE SERVIÇO
          </DialogTitle>
          <p className="text-center text-sm text-muted-foreground">
            Ao encerrar, a etapa passa para Finalizado.
          </p>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1">
            <Label>Como foi a execução da ordem?</Label>
            <Input
              placeholder="Digite"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              data-testid="os-close-summary"
            />
          </div>

          <div className="space-y-1">
            <Label>Confirmar duração da execução:</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Input
                type="datetime-local"
                className="w-full min-w-0 text-base sm:text-sm"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
              <Input
                type="datetime-local"
                className="w-full min-w-0 text-base sm:text-sm"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Anexar arquivos ou fotos:</Label>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                type="button"
                variant="secondary"
                className="flex-1 rounded-full min-h-11"
                disabled={uploading || saving}
                onClick={() => fileRef.current?.click()}
              >
                {uploading ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4 mr-1" />
                )}
                Subir os arquivos
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="flex-1 rounded-full min-h-11"
                disabled={uploading || saving}
                onClick={openCamera}
              >
                <Camera className="h-4 w-4 mr-1" />
                Abrir Câmera
              </Button>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*,.pdf,image/jpeg,image/png,image/webp"
              multiple
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />

            {cameraOpen && (
              <div className="space-y-2 border rounded-lg p-2">
                <video
                  ref={videoRef}
                  className="w-full rounded-md bg-black aspect-video"
                  playsInline
                  muted
                />
                <div className="flex gap-2">
                  <Button
                    type="button"
                    className="flex-1"
                    onClick={capturePhoto}
                    disabled={uploading}
                  >
                    Capturar
                  </Button>
                  <Button type="button" variant="outline" onClick={stopCamera}>
                    Cancelar
                  </Button>
                </div>
              </div>
            )}

            {attachments.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {attachments.map((url) => (
                  <div key={url.slice(0, 64)} className="relative group">
                    {url.startsWith('data:application/pdf') || url.toLowerCase().endsWith('.pdf') ? (
                      <div className="h-20 flex items-center justify-center border rounded-md text-xs bg-muted">
                        PDF
                      </div>
                    ) : (
                      <img
                        src={url}
                        alt="Anexo"
                        className="h-20 w-full object-cover rounded-md border"
                      />
                    )}
                    <button
                      type="button"
                      className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100"
                      onClick={() => setAttachments((prev) => prev.filter((u) => u !== url))}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-lg bg-muted px-4 py-3 text-center font-semibold">
            Valor da O.S.:{' '}
            R${' '}
            {(order.total || 0).toLocaleString('pt-BR', {
              minimumFractionDigits: 2,
            })}
          </div>

          <div className="space-y-1">
            <Label>Assinatura:</Label>
            <SignaturePad
              ref={signatureRef}
              height={150}
              onChange={(dataUrl) => setSignaturePreview(dataUrl)}
            />
            {signaturePreview && (
              <img
                src={signaturePreview}
                alt="Assinatura"
                className="mt-2 h-16 object-contain border rounded bg-white"
              />
            )}
          </div>

          <Button
            className="w-full rounded-full min-h-12 sticky bottom-0"
            size="lg"
            onClick={handleFinalize}
            disabled={saving || uploading}
            data-testid="os-close-finalize"
          >
            {(saving || uploading) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Finalizar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
