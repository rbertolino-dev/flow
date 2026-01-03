import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, Check, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const BUCKET_ID = "whatsapp-workflow-media";
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/webp'];

export function LogoUploader() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const { toast } = useToast();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!ALLOWED_TYPES.includes(selectedFile.type)) {
      toast({
        title: "Formato inválido",
        description: "Use PNG, JPG, SVG ou WEBP",
        variant: "destructive",
      });
      return;
    }

    if (selectedFile.size > 2 * 1024 * 1024) { // 2MB
      toast({
        title: "Arquivo muito grande",
        description: "Use uma imagem menor que 2MB",
        variant: "destructive",
      });
      return;
    }

    setFile(selectedFile);
  };

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `agilizeflow-logo.${fileExt}`;
      const filePath = `logos/${fileName}`;

      // Upload para Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from(BUCKET_ID)
        .upload(filePath, file, {
          upsert: true, // Substitui se já existir
          cacheControl: '3600',
        });

      if (uploadError) {
        throw uploadError;
      }

      // Obter URL pública
      const { data: { publicUrl } } = supabase.storage
        .from(BUCKET_ID)
        .getPublicUrl(filePath);

      setLogoUrl(publicUrl);

      toast({
        title: "Logo enviada com sucesso!",
        description: `URL: ${publicUrl}`,
      });

      // Copiar URL para clipboard
      await navigator.clipboard.writeText(publicUrl);
      toast({
        title: "URL copiada!",
        description: "Cole a URL no código para usar a logo",
      });
    } catch (error: any) {
      console.error('Erro no upload:', error);
      toast({
        title: "Erro no upload",
        description: error.message || "Falha ao fazer upload da logo",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Upload da Logo AgilizeFLOW</CardTitle>
        <CardDescription>
          Faça upload da logo para o Supabase Storage
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="logo-file">Selecione a logo (PNG, JPG, SVG ou WEBP)</Label>
          <Input
            id="logo-file"
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp"
            onChange={handleFileSelect}
            disabled={uploading}
          />
        </div>

        {file && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Arquivo selecionado: {file.name} ({(file.size / 1024).toFixed(2)} KB)
            </p>
            <Button
              onClick={handleUpload}
              disabled={uploading}
              className="w-full"
            >
              {uploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Fazer Upload
                </>
              )}
            </Button>
          </div>
        )}

        {logoUrl && (
          <div className="space-y-2 p-4 bg-muted rounded-lg">
            <div className="flex items-center gap-2 text-sm text-green-600">
              <Check className="h-4 w-4" />
              <span className="font-medium">Logo enviada com sucesso!</span>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">URL da Logo:</Label>
              <code className="block p-2 bg-background rounded text-xs break-all">
                {logoUrl}
              </code>
            </div>
            <div className="mt-2">
              <Label className="text-xs">Preview:</Label>
              <img
                src={logoUrl}
                alt="Logo AgilizeFLOW"
                className="mt-2 max-w-full h-20 object-contain"
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

