import { useRef, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Trash2, Check } from 'lucide-react';

interface SignatureCanvasProps {
  onConfirm: (signatureData: string) => void;
  onCancel?: () => void;
  width?: number;
  height?: number;
}

export function SignatureCanvas({ onConfirm, onCancel, width = 600, height = 200 }: SignatureCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

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

    const startDrawing = (e: MouseEvent | TouchEvent) => {
      setIsDrawing(true);
      const rect = canvas.getBoundingClientRect();
      const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
      const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;
      ctx.beginPath();
      ctx.moveTo(x, y);
    };

    const draw = (e: MouseEvent | TouchEvent) => {
      if (!isDrawing) return;
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
      const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;
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
    canvas.addEventListener('touchstart', startDrawing);
    canvas.addEventListener('touchmove', draw);
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
  }, [isDrawing]);

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  const confirm = () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasSignature) return;

    // Converter canvas para base64 PNG
    const signatureData = canvas.toDataURL('image/png');
    onConfirm(signatureData);
  };

  return (
    <div className="space-y-4">
      <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 bg-white">
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          className="cursor-crosshair w-full h-full touch-none"
          style={{ maxWidth: '100%' }}
        />
      </div>
      <div className="flex gap-2 justify-end">
        <Button
          type="button"
          variant="outline"
          onClick={clear}
          disabled={!hasSignature}
        >
          <Trash2 className="w-4 h-4 mr-2" />
          Limpar
        </Button>
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
          >
            Cancelar
          </Button>
        )}
        <Button
          type="button"
          onClick={confirm}
          disabled={!hasSignature}
        >
          <Check className="w-4 h-4 mr-2" />
          Confirmar Assinatura
        </Button>
      </div>
      {!hasSignature && (
        <p className="text-sm text-muted-foreground text-center">
          Desenhe sua assinatura acima
        </p>
      )}
    </div>
  );
}
