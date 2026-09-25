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


function toDateTimeLocal(value?: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return format(date, "yyyy-MM-dd'T'HH:mm");
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
    setStartDate(toDateTimeLocal(order.execution_starts_at || order.starts_at));
    setEndDate(toDateTimeLocal(order.execution_ends_at || order.ends_at));
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
        className={`${osDialogContentClass} gap-0 p-0 sm:h-[min(44rem,92dvh)] sm:max-w-lg sm:p-0 [&>div]:flex [&>div]:h-full [&>div]:min-h-0 [&>div]:flex-col [&>div]:!overflow-hidden [&>div]:!pr-0`}
        data-testid="os-close-dialog"
      >
        <div className="flex h-full min-h-0 flex-col bg-background">
          <div className="shrink-0 border-b bg-background px-4 pb-3 pt-4 sm:px-6">
            <div className="flex items-start gap-3 pr-8">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-600">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div className="min-w-0 text-left">
                <DialogTitle className="text-left text-lg font-semibold tracking-tight">
                  Encerrar ordem
                </DialogTitle>
                <p className="truncate text-sm text-muted-foreground">
                  {order.code}
                  {order.client_name ? ` · ${order.client_name}` : ''}
                </p>
                <span className="mt-1.5 inline-flex items-center rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                  A etapa passa para Finalizado
                </span>
              </div>
            </div>
          </div>

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4 sm:px-6">
            <section className="space-y-3 rounded-2xl border bg-card p-3.5 shadow-sm">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <ClipboardList className="h-4 w-4" />
                </span>
                <div>
                  <Label className="text-sm font-medium">Como foi a execução</Label>
                  <p className="text-xs text-muted-foreground">Obrigatório</p>
                </div>
              </div>
              <Textarea
                placeholder="Descreva o que foi feito"
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                rows={4}
                className="min-h-[104px] resize-none rounded-xl text-base sm:text-sm"
                data-testid="os-close-summary"
              />
            </section>

            <section className="space-y-3 rounded-2xl border bg-card p-3.5 shadow-sm">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Clock3 className="h-4 w-4" />
                </span>
                <div>
                  <Label className="text-sm font-medium">Duração da execução</Label>
                  <p className="text-xs text-muted-foreground">Início e fim do serviço</p>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Início</Label>
                  <Input
                    type="datetime-local"
                    className="h-11 w-full min-w-0 rounded-xl text-base sm:text-sm"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    data-testid="os-close-start"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Fim</Label>
                  <Input
                    type="datetime-local"
                    className="h-11 w-full min-w-0 rounded-xl text-base sm:text-sm"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    data-testid="os-close-end"
                  />
                </div>
              </div>
            </section>

            <section className="space-y-3 rounded-2xl border bg-card p-3.5 shadow-sm">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <ImagePlus className="h-4 w-4" />
                </span>
                <div>
                  <Label className="text-sm font-medium">Fotos e arquivos</Label>
                  <p className="text-xs text-muted-foreground">Opcional · até 8 MB</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="h-auto min-h-16 flex-col gap-1 rounded-xl py-3"
                  disabled={uploading || saving}
                  onClick={() => fileRef.current?.click()}
                >
                  {uploading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Upload className="h-5 w-5" />
                  )}
                  <span className="text-xs font-medium">Enviar arquivo</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-auto min-h-16 flex-col gap-1 rounded-xl py-3"
                  disabled={uploading || saving}
                  onClick={openCamera}
                >
                  <Camera className="h-5 w-5" />
                  <span className="text-xs font-medium">Abrir câmera</span>
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
                <div className="space-y-3 overflow-hidden rounded-2xl border bg-black/5 p-2">
                  <video
                    ref={videoRef}
                    className="aspect-[4/3] w-full rounded-xl bg-black object-cover sm:aspect-video"
                    playsInline
                    muted
                  />
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      className="h-11 flex-1 rounded-xl"
                      onClick={capturePhoto}
                      disabled={uploading}
                    >
                      {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Capturar foto
                    </Button>
                    <Button type="button" variant="outline" className="h-11 rounded-xl" onClick={stopCamera}>
                      Cancelar
                    </Button>
                  </div>
                </div>
              )}

              {attachments.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {attachments.map((url) => (
                    <div key={url.slice(0, 80)} className="relative">
                      {url.startsWith('data:application/pdf') || url.toLowerCase().endsWith('.pdf') ? (
                        <div className="flex h-24 items-center justify-center rounded-xl border bg-muted text-xs font-medium">
                          PDF
                        </div>
                      ) : (
                        <img
                          src={url}
                          alt="Anexo"
                          className="h-24 w-full rounded-xl border object-cover"
                        />
                      )}
                      <button
                        type="button"
                        aria-label="Remover anexo"
                        className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-black/70 text-white"
                        onClick={() => setAttachments((prev) => prev.filter((u) => u !== url))}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <div className="flex items-center justify-between rounded-2xl bg-gradient-to-r from-emerald-600 to-emerald-500 px-4 py-3.5 text-white shadow-sm">
              <span className="text-sm font-medium text-emerald-50">Valor da ordem</span>
              <span className="text-lg font-semibold tabular-nums">
                {(order.total || 0).toLocaleString('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                })}
              </span>
            </div>

            <section className="space-y-3 rounded-2xl border bg-card p-3.5 shadow-sm">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <PenLine className="h-4 w-4" />
                </span>
                <div>
                  <Label className="text-sm font-medium">Assinatura</Label>
                  <p className="text-xs text-muted-foreground">Use o dedo ou o mouse</p>
                </div>
              </div>
              {signaturePreview.startsWith('http') && (
                <img
                  src={signaturePreview}
                  alt="Assinatura já registrada"
                  className="h-16 w-full rounded-xl border bg-white object-contain"
                />
              )}
              <SignaturePad
                ref={signatureRef}
                height={160}
                onChange={(dataUrl) => setSignaturePreview(dataUrl)}
              />
            </section>
          </div>

          <div className="shrink-0 border-t bg-background px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">
            <Button
              className="h-12 w-full rounded-xl text-base"
              onClick={handleFinalize}
              disabled={saving || uploading}
              data-testid="os-close-finalize"
            >
              {(saving || uploading) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Encerrar ordem
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
