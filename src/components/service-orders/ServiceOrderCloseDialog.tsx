import { useEffect, useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Camera, Loader2, Upload, X } from 'lucide-react';
import { ServiceOrder, ServiceOrderCloseData } from '@/types/serviceOrder';
import { SignaturePad } from './SignaturePad';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

const BUCKET = 'whatsapp-workflow-media';

interface ServiceOrderCloseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: ServiceOrder;
  organizationId: string;
  onClosed: (data: ServiceOrderCloseData) => Promise<boolean>;
}

async function uploadBlob(
  orgId: string,
  orderId: string,
  blob: Blob,
  filename: string
): Promise<string> {
  const path = `${orgId}/service-orders/${orderId}/${Date.now()}-${filename}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    upsert: false,
    cacheControl: '3600',
    contentType: blob.type || 'image/jpeg',
  });
  if (error) throw error;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
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

  const [summary, setSummary] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [attachments, setAttachments] = useState<string[]>([]);
  const [signatureUrl, setSignatureUrl] = useState('');
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
    setSignatureUrl(order.signature_url || '');
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
      const url = await uploadBlob(organizationId, order.id, blob, 'camera.jpg');
      setAttachments((prev) => [...prev, url]);
      stopCamera();
      toast({ title: 'Foto anexada' });
    } catch (err) {
      toast({
        title: 'Erro',
        description: err instanceof Error ? err.message : 'Não foi possível anexar a foto',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      const urls: string[] = [];
      for (const file of Array.from(files)) {
        const url = await uploadBlob(organizationId, order.id, file, file.name.replace(/\s+/g, '_'));
        urls.push(url);
      }
      setAttachments((prev) => [...prev, ...urls]);
      toast({ title: `${urls.length} arquivo(s) anexado(s)` });
    } catch (err) {
      toast({
        title: 'Erro no upload',
        description: err instanceof Error ? err.message : 'Falha ao enviar arquivo',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleSignatureSave = async (dataUrl: string) => {
    if (!dataUrl) {
      setSignatureUrl('');
      setSignaturePreview('');
      return;
    }
    setSignaturePreview(dataUrl);
    setUploading(true);
    try {
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const url = await uploadBlob(organizationId, order.id, blob, 'assinatura.png');
      setSignatureUrl(url);
      toast({ title: 'Assinatura salva' });
    } catch (err) {
      toast({
        title: 'Erro na assinatura',
        description: err instanceof Error ? err.message : 'Não foi possível salvar',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
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
    if (!signatureUrl) {
      toast({
        title: 'Assinatura obrigatória',
        description: 'Salve a assinatura antes de finalizar.',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    const ok = await onClosed({
      execution_summary: summary.trim(),
      execution_starts_at: startDate ? new Date(startDate).toISOString() : undefined,
      execution_ends_at: endDate ? new Date(endDate).toISOString() : undefined,
      close_attachments: attachments,
      signature_url: signatureUrl,
    });
    setSaving(false);
    if (ok) onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) stopCamera();
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto" data-testid="os-close-dialog">
        <DialogHeader>
          <DialogTitle className="text-center tracking-wide">
            ENCERRAR ORDEM DE SERVIÇO
          </DialogTitle>
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
            <div className="grid grid-cols-2 gap-2">
              <Input
                type="datetime-local"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
              <Input
                type="datetime-local"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Anexar arquivos ou fotos:</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                className="flex-1 rounded-full"
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
              >
                <Upload className="h-4 w-4 mr-1" />
                Subir os arquivos
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="flex-1 rounded-full"
                disabled={uploading}
                onClick={openCamera}
              >
                <Camera className="h-4 w-4 mr-1" />
                Abrir Câmera
              </Button>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*,.pdf"
              multiple
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />

            {cameraOpen && (
              <div className="space-y-2 border rounded-lg p-2">
                <video ref={videoRef} className="w-full rounded-md bg-black aspect-video" playsInline muted />
                <div className="flex gap-2">
                  <Button type="button" className="flex-1" onClick={capturePhoto} disabled={uploading}>
                    Capturar
                  </Button>
                  <Button type="button" variant="outline" onClick={stopCamera}>
                    Cancelar
                  </Button>
                </div>
              </div>
            )}

            {attachments.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {attachments.map((url) => (
                  <div key={url} className="relative group">
                    <img src={url} alt="Anexo" className="h-20 w-full object-cover rounded-md border" />
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
            <SignaturePad onSave={handleSignatureSave} />
            {signaturePreview && (
              <img
                src={signaturePreview}
                alt="Assinatura"
                className="mt-2 h-16 object-contain border rounded bg-white"
              />
            )}
          </div>

          <Button
            className="w-full rounded-full"
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
