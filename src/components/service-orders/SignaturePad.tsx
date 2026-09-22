import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';

export interface SignaturePadHandle {
  hasInk: () => boolean;
  getDataUrl: () => string | null;
  clear: () => void;
}

interface SignaturePadProps {
  /** Chamado quando a assinatura muda (desenho, limpar ou salvar). */
  onChange?: (dataUrl: string) => void;
  height?: number;
  className?: string;
}

export const SignaturePad = forwardRef<SignaturePadHandle, SignaturePadProps>(
  function SignaturePad({ onChange, height = 180, className }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const drawing = useRef(false);
    const [hasInk, setHasInk] = useState(false);

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const resize = () => {
        const parent = canvas.parentElement;
        const w = parent?.clientWidth || 400;
        const ratio = window.devicePixelRatio || 1;
        canvas.width = w * ratio;
        canvas.height = height * ratio;
        canvas.style.width = `${w}px`;
        canvas.style.height = `${height}px`;
        ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.strokeStyle = '#0f172a';
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(0, 0, w, height);
      };

      resize();
      window.addEventListener('resize', resize);
      return () => window.removeEventListener('resize', resize);
    }, [height]);

    const getPos = (e: React.MouseEvent | React.TouchEvent) => {
      const canvas = canvasRef.current!;
      const rect = canvas.getBoundingClientRect();
      if ('touches' in e) {
        const t = e.touches[0];
        return { x: t.clientX - rect.left, y: t.clientY - rect.top };
      }
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    const emitCurrent = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      onChange?.(canvas.toDataURL('image/png'));
    };

    const start = (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      const ctx = canvasRef.current?.getContext('2d');
      if (!ctx) return;
      drawing.current = true;
      const { x, y } = getPos(e);
      ctx.beginPath();
      ctx.moveTo(x, y);
    };

    const move = (e: React.MouseEvent | React.TouchEvent) => {
      if (!drawing.current) return;
      e.preventDefault();
      const ctx = canvasRef.current?.getContext('2d');
      if (!ctx) return;
      const { x, y } = getPos(e);
      ctx.lineTo(x, y);
      ctx.stroke();
      setHasInk(true);
    };

    const end = () => {
      if (!drawing.current) return;
      drawing.current = false;
      emitCurrent();
    };

    const clear = () => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!canvas || !ctx) return;
      const w = canvas.clientWidth;
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(0, 0, w, height);
      setHasInk(false);
      onChange?.('');
    };

    useImperativeHandle(ref, () => ({
      hasInk: () => hasInk,
      getDataUrl: () => {
        const canvas = canvasRef.current;
        if (!canvas || !hasInk) return null;
        return canvas.toDataURL('image/png');
      },
      clear,
    }));

    return (
      <div className={className}>
        <div className="border rounded-lg overflow-hidden bg-slate-50 relative touch-none">
          <canvas
            ref={canvasRef}
            className="w-full cursor-crosshair block"
            onMouseDown={start}
            onMouseMove={move}
            onMouseUp={end}
            onMouseLeave={end}
            onTouchStart={start}
            onTouchMove={move}
            onTouchEnd={end}
            data-testid="os-signature-canvas"
          />
          {!hasInk && (
            <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
              Assine acima
            </span>
          )}
        </div>
        <div className="flex justify-between mt-2">
          <Button type="button" variant="outline" size="sm" onClick={clear}>
            Limpar
          </Button>
          <span className="text-xs text-muted-foreground self-center">
            {hasInk ? 'Assinatura capturada' : 'Desenhe a assinatura'}
          </span>
        </div>
      </div>
    );
  }
);
