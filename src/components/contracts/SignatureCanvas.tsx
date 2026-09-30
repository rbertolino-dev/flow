import { useRef, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Trash2, Check, Upload, PenTool } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface SignatureCanvasProps {
  onConfirm: (signatureData: string) => void;
  onCancel?: () => void;
  width?: number;
  height?: number;
}

type SignatureMode = 'draw' | 'upload';

export function SignatureCanvas({ onConfirm, onCancel, width = 600, height = 200 }: SignatureCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [mode, setMode] = useState<SignatureMode>('draw');
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [canvasWidth, setCanvasWidth] = useState(width);
  const [canvasHeight, setCanvasHeight] = useState(height);

  useEffect(() => {
    const updateSize = () => {
      const maxW = Math.min(width, Math.max(280, window.innerWidth - 48));
      const ratio = height / width;
      setCanvasWidth(maxW);
      setCanvasHeight(Math.round(maxW * ratio));
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, [width, height]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Configurar canvas
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const getPos = (e: MouseEvent | TouchEvent) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY,
      };
    };

    const startDrawing = (e: MouseEvent | TouchEvent) => {
      setIsDrawing(true);
      const { x, y } = getPos(e);
      ctx.beginPath();
      ctx.moveTo(x, y);
    };

    const draw = (e: MouseEvent | TouchEvent) => {
      if (!isDrawing) return;
      e.preventDefault();
      const { x, y } = getPos(e);
      ctx.lineTo(x, y);
      ctx.stroke();
      setHasSignature(true);
    };

    const stopDrawing = () => {
      setIsDrawing(false);
    };

    // Event listeners para mouse
    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseout', stopDrawing);

    // Event listeners para touch
    canvas.addEventListener('touchstart', startDrawing, { passive: false });
    canvas.addEventListener('touchmove', draw, { passive: false });
    canvas.addEventListener('touchend', stopDrawing);

    return () => {
      canvas.removeEventListener('mousedown', startDrawing);
      canvas.removeEventListener('mousemove', draw);
      canvas.removeEventListener('mouseup', stopDrawing);
      canvas.removeEventListener('mouseout', stopDrawing);
      canvas.removeEventListener('touchstart', startDrawing);
      canvas.removeEventListener('touchmove', draw);
      canvas.removeEventListener('touchend', stopDrawing);
    };
  }, [isDrawing, canvasWidth, canvasHeight]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar tipo de arquivo (apenas PNG/JPG)
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg'];
    if (!validTypes.includes(file.type)) {
      alert('Por favor, selecione apenas imagens PNG ou JPG');
      return;
    }

    // Validar tamanho (máx 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('A imagem deve ter no máximo 5MB');
      return;
    }

    try {
      const reader = new FileReader();
      reader.onload = (event) => {
        const imageUrl = event.target?.result as string;
        
        // Carregar imagem e redimensionar se necessário
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (!ctx) return;

          // Redimensionar se muito grande (máx 800x300px)
          let targetWidth = img.width;
          let targetHeight = img.height;
          const maxWidth = 800;
          const maxHeight = 300;

          if (targetWidth > maxWidth || targetHeight > maxHeight) {
            const ratio = Math.min(maxWidth / targetWidth, maxHeight / targetHeight);
            targetWidth = img.width * ratio;
            targetHeight = img.height * ratio;
          }

          canvas.width = targetWidth;
          canvas.height = targetHeight;
          ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

          // Converter para base64 PNG
          const base64Image = canvas.toDataURL('image/png');
          setUploadedImage(base64Image);
          setHasSignature(true);
        };
        img.src = imageUrl;
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Erro ao processar imagem:', error);
      alert('Erro ao processar imagem. Tente novamente.');
    }
  };

  const confirm = () => {
    if (mode === 'upload' && uploadedImage) {
      // Se for upload, usar imagem carregada
      onConfirm(uploadedImage);
    } else {
      // Se for desenho, usar canvas
      const canvas = canvasRef.current;
      if (!canvas || !hasSignature) return;

      // Converter canvas para base64 PNG
      const signatureData = canvas.toDataURL('image/png');
      onConfirm(signatureData);
    }
  };

  const clear = () => {
    if (mode === 'upload') {
      setUploadedImage(null);
      setHasSignature(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } else {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      setHasSignature(false);
    }
  };

  return (
    <div className="space-y-4 w-full max-w-full overflow-hidden">
      {/* Toggle entre desenho e upload */}
      <div className="flex flex-wrap gap-2 border-b pb-2">
        <Button
          type="button"
          variant={mode === 'draw' ? 'default' : 'outline'}
          size="sm"
          className="flex-1 min-w-[120px] sm:flex-none"
          onClick={() => {
            setMode('draw');
            clear();
          }}
        >
          <PenTool className="w-4 h-4 mr-2 shrink-0" />
          Desenhar
        </Button>
        <Button
          type="button"
          variant={mode === 'upload' ? 'default' : 'outline'}
          size="sm"
          className="flex-1 min-w-[120px] sm:flex-none"
          onClick={() => {
            setMode('upload');
            clear();
            fileInputRef.current?.click();
          }}
        >
          <Upload className="w-4 h-4 mr-2 shrink-0" />
          Upload Imagem
        </Button>
      </div>

      {/* Input de arquivo (oculto) */}
      <Input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg"
        onChange={handleImageUpload}
        className="hidden"
      />

      {/* Área de desenho ou preview de imagem */}
      {mode === 'draw' ? (
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-2 sm:p-4 bg-white overflow-hidden">
          <canvas
            ref={canvasRef}
            width={canvasWidth}
            height={canvasHeight}
            className="cursor-crosshair w-full touch-none block mx-auto"
            style={{ maxWidth: '100%', height: 'auto' }}
          />
        </div>
      ) : (
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 bg-white min-h-[160px] sm:min-h-[200px] flex items-center justify-center">
          {uploadedImage ? (
            <div className="space-y-2 w-full">
              <img
                src={uploadedImage}
                alt="Assinatura carregada"
                className="max-w-full max-h-[200px] mx-auto"
              />
              <p className="text-sm text-center text-muted-foreground">
                Imagem carregada com sucesso
              </p>
            </div>
          ) : (
            <div className="text-center space-y-2 px-2">
              <Upload className="w-12 h-12 mx-auto text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Clique em "Upload Imagem" para selecionar uma imagem (PNG ou JPG)
              </p>
            </div>
          )}
        </div>
      )}

      {/* Ações: empilha no mobile para Limpar não sumir */}
      <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end w-full">
        <Button
          type="button"
          variant="outline"
          onClick={clear}
          disabled={!hasSignature}
          className="w-full sm:w-auto"
        >
          <Trash2 className="w-4 h-4 mr-2 shrink-0" />
          Limpar
        </Button>
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            className="w-full sm:w-auto"
          >
            Cancelar
          </Button>
        )}
        <Button
          type="button"
          onClick={confirm}
          disabled={!hasSignature}
          className="w-full sm:w-auto"
        >
          <Check className="w-4 h-4 mr-2 shrink-0" />
          Confirmar Assinatura
        </Button>
      </div>
      {!hasSignature && (
        <p className="text-sm text-muted-foreground text-center">
          {mode === 'draw' ? 'Desenhe sua assinatura acima' : 'Faça upload de uma imagem de assinatura'}
        </p>
      )}
    </div>
  );
}
