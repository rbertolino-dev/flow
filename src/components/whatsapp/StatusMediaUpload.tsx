import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Upload, X, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useActiveOrganization } from "@/hooks/useActiveOrganization";

import { compressImage, validateImageFile } from "@/lib/imageCompression";

const BUCKET_ID = "whatsapp-workflow-media";
const MAX_FILE_SIZE_BEFORE_COMPRESSION = 16 * 1024 * 1024; // 16MB (antes da compressão)
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

interface StatusMediaUploadProps {
  onMediaSelected: (mediaUrl: string, mediaType: "image") => void;
  onCaptionChange?: (caption: string) => void;
  initialMediaUrl?: string;
  initialMediaType?: "image";
  initialCaption?: string;
}

export function StatusMediaUpload({
  onMediaSelected,
  onCaptionChange,
  initialMediaUrl,
  initialMediaType,
  initialCaption,
}: StatusMediaUploadProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [mediaUrl, setMediaUrl] = useState<string | undefined>(initialMediaUrl);
  const [mediaType, setMediaType] = useState<"image" | null>(
    initialMediaType ?? null,
  );
  const [caption, setCaption] = useState<string>(initialCaption || "");
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { activeOrgId } = useActiveOrganization();

  const handleFileSelect = async (file: File) => {
    const isImage = ALLOWED_IMAGE_TYPES.includes(file.type);

    if (!isImage) {
      toast({
        title: "Tipo de arquivo inválido",
        description:
          "Apenas imagens (JPG, PNG, WEBP) são permitidas. A Evolution API não documenta envio de vídeo no status.",
        variant: "destructive",
      });
      return;
    }

    if (file.size > MAX_FILE_SIZE_BEFORE_COMPRESSION) {
      toast({
        title: "Arquivo muito grande",
        description: `O arquivo deve ter no máximo ${MAX_FILE_SIZE_BEFORE_COMPRESSION / 1024 / 1024}MB antes da compressão`,
        variant: "destructive",
      });
      return;
    }

    let fileToUpload = file;
    const validation = validateImageFile(file);
    if (!validation.valid) {
      toast({
        title: "Erro na validação",
        description: validation.error,
        variant: "destructive",
      });
      return;
    }

    try {
      setUploading(true);
      fileToUpload = await compressImage(file);
    } catch (error: unknown) {
      console.error("Erro ao comprimir imagem:", error);
      toast({
        title: "Erro ao comprimir imagem",
        description: "Tentando fazer upload do arquivo original...",
        variant: "default",
      });
      fileToUpload = file;
    } finally {
      setUploading(false);
    }

    setSelectedFile(fileToUpload);
    setMediaType("image");

    const url = URL.createObjectURL(file);
    setPreviewUrl(url);

    await uploadFile(fileToUpload);
  };

  const uploadFile = async (file: File) => {
    if (!activeOrgId) {
      toast({
        title: "Erro",
        description: "Organização não encontrada",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);

    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${crypto.randomUUID()}-${Date.now()}.${fileExt}`;
      const filePath = `${activeOrgId}/status/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from(BUCKET_ID)
        .upload(filePath, file, {
          upsert: false,
          cacheControl: "86400",
        });

      if (uploadError) {
        throw uploadError;
      }

      const { data: publicUrlData } = supabase.storage
        .from(BUCKET_ID)
        .getPublicUrl(filePath);

      const publicUrl = publicUrlData.publicUrl;
      setMediaUrl(publicUrl);
      onMediaSelected(publicUrl, "image");

      toast({
        title: "Upload concluído",
        description: "Imagem carregada com sucesso",
      });
    } catch (error: unknown) {
      console.error("Erro no upload:", error);
      toast({
        title: "Erro no upload",
        description:
          error instanceof Error ? error.message : "Falha ao fazer upload do arquivo",
        variant: "destructive",
      });
      setSelectedFile(null);
      setPreviewUrl(null);
      setMediaType(null);
    } finally {
      setUploading(false);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleRemove = () => {
    setSelectedFile(null);
    setMediaUrl(undefined);
    setMediaType(null);
    setPreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleCaptionChange = (value: string) => {
    setCaption(value);
    onCaptionChange?.(value);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  return (
    <div className="space-y-4">
      <div>
        <Label>Imagem</Label>
        {!mediaUrl ? (
          <div
            className="mt-2 border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-gray-400 transition-colors"
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-8 w-8 mx-auto mb-2 text-gray-400" />
            <p className="text-sm text-gray-600 mb-1">
              Clique ou arraste uma imagem aqui
            </p>
            <p className="text-xs text-gray-500">
              JPG, PNG ou WEBP (máx. 16MB — compressão automática). Vídeo não é
              suportado pelo status na Evolution API.
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp"
              onChange={handleFileInputChange}
              className="hidden"
            />
          </div>
        ) : (
          <div className="mt-2 relative">
            {mediaType === "image" && previewUrl && (
              <div className="relative border rounded-lg overflow-hidden">
                <img
                  src={previewUrl}
                  alt="Preview"
                  className="w-full h-auto max-h-64 object-contain"
                />
                <Button
                  variant="destructive"
                  size="icon"
                  className="absolute top-2 right-2"
                  onClick={handleRemove}
                  disabled={uploading}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
            {uploading && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-lg">
                <Loader2 className="h-8 w-8 animate-spin text-white" />
              </div>
            )}
          </div>
        )}
      </div>

      <div>
        <Label htmlFor="caption">Legenda (Opcional)</Label>
        <Textarea
          id="caption"
          placeholder="Adicione uma legenda para o status..."
          value={caption}
          onChange={(e) => handleCaptionChange(e.target.value)}
          rows={3}
          className="mt-2"
        />
        <p className="text-xs text-gray-500 mt-1">
          {caption.length}/500 caracteres
        </p>
      </div>
    </div>
  );
}
