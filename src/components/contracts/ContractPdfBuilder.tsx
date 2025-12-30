import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { 
  Loader2, Upload, X, Save, MousePointer2, Move, Maximize2, Trash2, Edit2, 
  ZoomIn, ZoomOut, Grid, RotateCcw, RotateCw, Copy, Eye, EyeOff, 
  ChevronLeft, ChevronRight, Minus, Plus, Image as ImageIcon
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

// Import dinâmico do react-pdf para evitar erros de inicialização
let Document: any, Page: any, pdfjs: any;
let reactPdfModule: any = null;
let workerConfigured = false;

// Configurar worker do PDF.js usando APENAS worker local (evita problemas de CORS)
const configurePdfWorker = (pdfjsInstance: any): boolean => {
  if (!pdfjsInstance || !pdfjsInstance.GlobalWorkerOptions) {
    console.warn('⚠️ pdfjs.GlobalWorkerOptions não disponível');
    return false;
  }

  // Se já foi configurado, não configurar novamente
  if (workerConfigured && pdfjsInstance.GlobalWorkerOptions.workerSrc) {
    console.log('✅ Worker já configurado:', pdfjsInstance.GlobalWorkerOptions.workerSrc);
    return true;
  }

  const pdfjsVersion = pdfjsInstance.version || '5.4.296';
  console.log(`📄 Configurando PDF.js Worker - versão detectada: ${pdfjsVersion}`);

  // ESTRATÉGIA PRINCIPAL: Usar worker local de public/ (evita CORS e problemas de CDN)
  // O arquivo pdf.worker.min.js está em public/ e é servido pelo Vite/Nginx
  // Isso é mais confiável que CDN porque:
  // 1. Não tem problemas de CORS
  // 2. Não depende de serviços externos
  // 3. Funciona mesmo offline
  // 4. Sempre disponível no mesmo domínio
  pdfjsInstance.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
  console.log('✅ Worker configurado para usar arquivo local: /pdf.worker.min.js');
  console.log('   (Evita problemas de CORS e dependência de CDN)');
  workerConfigured = true;
  return true;
};

// Carregar react-pdf dinamicamente apenas quando necessário
const loadReactPdf = async () => {
  if (!reactPdfModule) {
    try {
      console.log('🔄 Carregando react-pdf...');
      reactPdfModule = await import('react-pdf');
      Document = reactPdfModule.Document;
      Page = reactPdfModule.Page;
      pdfjs = reactPdfModule.pdfjs;
      
      if (!pdfjs) {
        throw new Error('pdfjs não disponível após importar react-pdf');
      }

      // Configurar worker de forma robusta
      const workerOk = configurePdfWorker(pdfjs);
      if (!workerOk) {
        console.warn('⚠️ Worker não foi configurado corretamente, mas continuando...');
      }

      console.log('✅ react-pdf carregado com sucesso');
    } catch (error) {
      console.error('❌ Erro ao carregar react-pdf:', error);
      throw error;
    }
  }
  return { Document, Page, pdfjs };
};

interface SignaturePosition {
  id: string;
  signerType: 'user' | 'client' | 'rubric';
  pageNumber: number;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number; // Rotação em graus (0-360)
}

interface ContractPdfBuilderProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contractId: string;
  onSuccess?: () => void;
}

export function ContractPdfBuilder({
  open,
  onOpenChange,
  contractId,
  onSuccess,
}: ContractPdfBuilderProps) {
  const { toast } = useToast();
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [positions, setPositions] = useState<SignaturePosition[]>([]);
  const [selectedSignerType, setSelectedSignerType] = useState<'user' | 'client' | 'rubric'>('user');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reactPdfLoaded, setReactPdfLoaded] = useState(false);
  const [reactPdfError, setReactPdfError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedPositionId, setSelectedPositionId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 });
  // Estado temporário para preview durante drag/resize (evita re-renders)
  const [previewPosition, setPreviewPosition] = useState<{ id: string; x: number; y: number; width: number; height: number } | null>(null);
  const positionsRef = useRef<SignaturePosition[]>([]);
  const rafIdRef = useRef<number | null>(null);
  
  // Novos estados para melhorias
  const [showGrid, setShowGrid] = useState(false);
  const [gridSize, setGridSize] = useState(16);
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [history, setHistory] = useState<SignaturePosition[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [previewMode, setPreviewMode] = useState(false);
  const [showThumbnails, setShowThumbnails] = useState(true);
  const [showPropertyPanel, setShowPropertyPanel] = useState(true);
  const [pageThumbnails, setPageThumbnails] = useState<Map<number, string>>(new Map());
  const thumbnailRefs = useRef<Map<number, HTMLCanvasElement>>(new Map());

  // Carregar react-pdf quando o componente abrir
  useEffect(() => {
    if (open && !reactPdfLoaded && !reactPdfError) {
      loadReactPdf()
        .then(() => {
          setReactPdfLoaded(true);
          setReactPdfError(null);
        })
        .catch((error) => {
          console.error('Erro ao carregar react-pdf:', error);
          setReactPdfError('Erro ao carregar visualizador de PDF');
          toast({
            title: 'Erro',
            description: 'Erro ao carregar visualizador de PDF. Tente novamente.',
            variant: 'destructive',
          });
        });
    }
  }, [open, reactPdfLoaded, reactPdfError, toast]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validação 1: Tipo de arquivo
    if (file.type !== 'application/pdf') {
      toast({
        title: 'Arquivo inválido',
        description: 'Por favor, selecione um arquivo PDF válido',
        variant: 'destructive',
      });
      return;
    }

    // Validação 2: Tamanho do arquivo (máximo 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: 'Arquivo muito grande',
        description: 'O PDF deve ter no máximo 10MB',
        variant: 'destructive',
      });
      return;
    }

    // Validação 3: Arquivo não vazio
    if (file.size === 0) {
      toast({
        title: 'Arquivo vazio',
        description: 'O arquivo PDF está vazio',
        variant: 'destructive',
      });
      return;
    }

    // Validação 4: Verificar se react-pdf está carregado
    if (!reactPdfLoaded) {
      toast({
        title: 'Aguarde',
        description: 'O visualizador de PDF ainda está carregando. Aguarde alguns segundos e tente novamente.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    setReactPdfError(null);

    try {
      // Limpar URL anterior se existir
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
      }

      // Criar URL do objeto
      const url = URL.createObjectURL(file);
      
      // Validação 5: Testar se o PDF pode ser lido (verificação básica)
      // Ler os primeiros bytes para verificar se é um PDF válido
      const arrayBuffer = await file.slice(0, 4).arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      const pdfHeader = String.fromCharCode(...uint8Array);
      
      if (!pdfHeader.startsWith('%PDF')) {
        URL.revokeObjectURL(url);
        toast({
          title: 'Arquivo inválido',
          description: 'O arquivo não parece ser um PDF válido',
          variant: 'destructive',
        });
        setLoading(false);
        return;
      }

      setPdfFile(file);
      setPdfUrl(url);
      setPositions([]);
      setCurrentPage(1);
      
      toast({
        title: 'PDF carregado',
        description: 'Arquivo carregado com sucesso. Clique no PDF para marcar as posições de assinatura.',
      });
    } catch (error: any) {
      console.error('Erro ao processar arquivo PDF:', error);
      toast({
        title: 'Erro ao processar PDF',
        description: error.message || 'Não foi possível processar o arquivo PDF',
        variant: 'destructive',
      });
      setReactPdfError('Erro ao processar arquivo PDF');
    } finally {
      setLoading(false);
    }
  };

  const onDocumentLoadSuccess = useCallback(({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
  }, []);

  const handlePageClick = (event: React.MouseEvent<HTMLDivElement>) => {
    // Não adicionar nova posição se estiver arrastando ou redimensionando
    if (isDragging || isResizing || previewMode) return;
    
    // Não adicionar se clicou em uma posição existente
    if ((event.target as HTMLElement).closest('.signature-position')) return;

    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    let x = (event.clientX - rect.left) / zoomLevel;
    let y = (event.clientY - rect.top) / zoomLevel;

    // Aplicar snap to grid
    x = snapToGridValue(x);
    y = snapToGridValue(y);

    const newPosition: SignaturePosition = {
      id: `pos-${Date.now()}`,
      signerType: selectedSignerType,
      pageNumber: currentPage,
      x,
      y,
      width: 120,
      height: 50,
      rotation: 0,
    };

    const newPositions = [...positions, newPosition];
    setPositions(newPositions);
    setSelectedPositionId(newPosition.id);
    saveToHistory(newPositions);
  };

  const removePosition = useCallback((id: string) => {
    const newPositions = positions.filter(p => p.id !== id);
    setPositions(newPositions);
    if (selectedPositionId === id) {
      setSelectedPositionId(null);
    }
    saveToHistory(newPositions);
  }, [positions, selectedPositionId, saveToHistory]);

  // Atualizar referência quando positions mudar
  useEffect(() => {
    positionsRef.current = positions;
  }, [positions]);

  // Funções helper para grid e snap
  const snapToGridValue = useCallback((value: number): number => {
    if (!snapToGrid) return value;
    return Math.round(value / gridSize) * gridSize;
  }, [snapToGrid, gridSize]);

  const calculateDistance = useCallback((pos1: SignaturePosition, pos2: SignaturePosition): number => {
    const dx = pos1.x - pos2.x;
    const dy = pos1.y - pos2.y;
    return Math.sqrt(dx * dx + dy * dy);
  }, []);

  // Funções de histórico (undo/redo)
  const saveToHistory = useCallback((newPositions: SignaturePosition[]) => {
    setHistory(prev => {
      const newHistory = prev.slice(0, historyIndex + 1);
      newHistory.push([...newPositions]);
      // Limitar histórico a 50 ações
      if (newHistory.length > 50) {
        newHistory.shift();
        setHistoryIndex(49);
      } else {
        setHistoryIndex(newHistory.length - 1);
      }
      return newHistory;
    });
  }, [historyIndex]);

  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setPositions([...history[newIndex]]);
    }
  }, [history, historyIndex]);

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setPositions([...history[newIndex]]);
    }
  }, [history, historyIndex]);

  // Função para duplicar posição
  const duplicatePosition = useCallback((positionId: string, targetPages: number[]) => {
    const pos = positions.find(p => p.id === positionId);
    if (!pos) return;

    const newPositions: SignaturePosition[] = [];
    targetPages.forEach(pageNum => {
      newPositions.push({
        ...pos,
        id: `pos-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        pageNumber: pageNum,
      });
    });

    setPositions([...positions, ...newPositions]);
    saveToHistory([...positions, ...newPositions]);
  }, [positions, saveToHistory]);

  // Funções de zoom
  const handleZoomIn = useCallback(() => {
    setZoomLevel(prev => Math.min(prev + 0.25, 3));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoomLevel(prev => Math.max(prev - 0.25, 0.5));
  }, []);

  const handleZoomReset = useCallback(() => {
    setZoomLevel(1);
  }, []);

  const handleZoomFit = useCallback(() => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      // Ajustar zoom para caber na largura disponível
      setZoomLevel(rect.width / 800); // Assumindo largura padrão de 800px
    }
  }, []);

  const updatePosition = useCallback((id: string, updates: Partial<SignaturePosition>) => {
    setPositions(prev => {
      const newPositions = prev.map(p => {
        if (p.id === id) {
          const updated = { ...p, ...updates };
          // Aplicar snap to grid se necessário
          if (updates.x !== undefined) updated.x = snapToGridValue(updated.x);
          if (updates.y !== undefined) updated.y = snapToGridValue(updated.y);
          return updated;
        }
        return p;
      });
      saveToHistory(newPositions);
      return newPositions;
    });
  }, [snapToGridValue, saveToHistory]);

  const handlePositionMouseDown = (e: React.MouseEvent, positionId: string) => {
    e.stopPropagation();
    setSelectedPositionId(positionId);
    
    if ((e.target as HTMLElement).classList.contains('resize-handle')) {
      // Iniciar redimensionamento
      const pos = positions.find(p => p.id === positionId);
      if (!pos) return;
      
      setIsResizing(true);
      setResizeStart({
        x: e.clientX,
        y: e.clientY,
        width: pos.width,
        height: pos.height,
      });
    } else {
      // Iniciar arrastar
      setIsDragging(true);
      setDragStart({
        x: e.clientX,
        y: e.clientY,
      });
    }
  };

  useEffect(() => {
    // Cancelar qualquer animação pendente
    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current);
    }

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current || !selectedPositionId) return;

      // Usar requestAnimationFrame para atualizações suaves
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
      }

      rafIdRef.current = requestAnimationFrame(() => {
        if (!containerRef.current || !selectedPositionId) return;

        const rect = containerRef.current.getBoundingClientRect();
        const pos = positionsRef.current.find(p => p.id === selectedPositionId);
        if (!pos) return;

        if (isDragging) {
          const deltaX = (e.clientX - dragStart.x) / zoomLevel;
          const deltaY = (e.clientY - dragStart.y) / zoomLevel;

          let newX = Math.max(0, Math.min(pos.x + deltaX, rect.width / zoomLevel - pos.width));
          let newY = Math.max(0, Math.min(pos.y + deltaY, rect.height / zoomLevel - pos.height));

          // Aplicar snap to grid
          newX = snapToGridValue(newX);
          newY = snapToGridValue(newY);

          // Verificar snap entre posições (se próximo de outra posição, alinhar)
          const otherPositions = positionsRef.current.filter(p => p.id !== selectedPositionId && p.pageNumber === currentPage);
          const snapThreshold = 10;
          for (const otherPos of otherPositions) {
            if (Math.abs(newX - otherPos.x) < snapThreshold) newX = otherPos.x;
            if (Math.abs(newY - otherPos.y) < snapThreshold) newY = otherPos.y;
            if (Math.abs(newX + pos.width - (otherPos.x + otherPos.width)) < snapThreshold) newX = otherPos.x + otherPos.width - pos.width;
            if (Math.abs(newY + pos.height - (otherPos.y + otherPos.height)) < snapThreshold) newY = otherPos.y + otherPos.height - pos.height;
          }

          // Atualizar apenas preview durante drag (evita re-renders)
          setPreviewPosition({ id: selectedPositionId, x: newX, y: newY, width: pos.width, height: pos.height });
        } else if (isResizing) {
          const deltaX = (e.clientX - resizeStart.x) / zoomLevel;
          const deltaY = (e.clientY - resizeStart.y) / zoomLevel;

          let newWidth = Math.max(60, snapToGridValue(resizeStart.width + deltaX));
          let newHeight = Math.max(30, snapToGridValue(resizeStart.height + deltaY));

          // Atualizar apenas preview durante resize (evita re-renders)
          setPreviewPosition({ id: selectedPositionId, x: pos.x, y: pos.y, width: newWidth, height: newHeight });
        }
      });
    };

    const handleMouseUp = () => {
      // Aplicar mudanças finais quando soltar
      if (previewPosition && selectedPositionId) {
        updatePosition(selectedPositionId, {
          x: previewPosition.x,
          y: previewPosition.y,
          width: previewPosition.width,
          height: previewPosition.height,
        });
        setPreviewPosition(null);
      }

      setIsDragging(false);
      setIsResizing(false);
      
      // Cancelar animação pendente
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };

    if (isDragging || isResizing) {
      window.addEventListener('mousemove', handleMouseMove, { passive: true });
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, [isDragging, isResizing, selectedPositionId, dragStart, resizeStart, previewPosition, updatePosition, zoomLevel, snapToGridValue, currentPage]);

  const handleSave = async () => {
    if (positions.length === 0) {
      toast({
        title: 'Nenhuma posição definida',
        description: 'Clique no PDF para marcar onde as assinaturas devem aparecer',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      // Salvar posições no banco
      const positionsToSave = positions.map(({ id, ...rest }) => rest);

      // Deletar posições antigas
      await supabase
        .from('contract_signature_positions')
        .delete()
        .eq('contract_id', contractId);

      // Inserir novas posições
      const { error } = await supabase
        .from('contract_signature_positions')
        .insert(
          positionsToSave.map(pos => ({
            contract_id: contractId,
            signer_type: pos.signerType,
            page_number: pos.pageNumber,
            x_position: pos.x,
            y_position: pos.y,
            width: pos.width,
            height: pos.height,
          }))
        );

      if (error) throw error;

      toast({
        title: 'Posições salvas',
        description: `${positions.length} posição(ões) de assinatura salva(s) com sucesso`,
      });

      onSuccess?.();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Erro ao salvar posições:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao salvar posições de assinatura',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const loadExistingPositions = useCallback(async () => {
    if (!contractId) return;

    try {
      const { data, error } = await supabase
        .from('contract_signature_positions')
        .select('*')
        .eq('contract_id', contractId);

      if (error) throw error;

      if (data && data.length > 0) {
        setPositions(
          data.map((pos: any) => ({
            id: pos.id,
            signerType: pos.signer_type,
            pageNumber: pos.page_number,
            x: pos.x_position,
            y: pos.y_position,
            width: pos.width || 60,
            height: pos.height || 30,
          }))
        );
      }
    } catch (error) {
      console.error('Erro ao carregar posições existentes:', error);
    }
  }, [contractId]);

  // Carregar PDF do contrato se já existir
  const loadContractPdf = useCallback(async () => {
    if (!contractId || !open) return;

    try {
      const { data: contract, error } = await supabase
        .from('contracts')
        .select('pdf_url')
        .eq('id', contractId)
        .single();

      if (error) throw error;

      if (contract?.pdf_url) {
        // PDF já existe no contrato, usar ele
        setPdfUrl(contract.pdf_url);
        toast({
          title: 'PDF carregado',
          description: 'PDF do contrato carregado. Clique no PDF para marcar as posições de assinatura.',
        });
      }
    } catch (error) {
      console.error('Erro ao carregar PDF do contrato:', error);
      // Não mostrar erro - pode ser que o PDF ainda não exista
    }
  }, [contractId, open, toast]);

  // Carregar posições existentes e PDF quando abrir
  useEffect(() => {
    if (open && contractId) {
      loadExistingPositions();
      loadContractPdf();
    }
  }, [open, contractId, loadExistingPositions, loadContractPdf]);

  // Inicializar histórico quando positions mudar (após carregar)
  useEffect(() => {
    if (positions.length > 0 && history.length === 0 && open) {
      setHistory([[...positions]]);
      setHistoryIndex(0);
    }
  }, [positions, history.length, open]);

  // Atalhos de teclado (undo/redo, delete)
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Z para undo
      if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
        return;
      }
      // Ctrl+Shift+Z ou Ctrl+Y para redo
      if ((e.ctrlKey && e.shiftKey && e.key === 'z') || (e.ctrlKey && e.key === 'y')) {
        e.preventDefault();
        redo();
        return;
      }
      // Delete para remover posição selecionada
      if (e.key === 'Delete' && selectedPositionId) {
        e.preventDefault();
        removePosition(selectedPositionId);
        return;
      }
      // Arrow keys para mover posição selecionada (com Shift para mover mais rápido)
      if (selectedPositionId && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        const step = e.shiftKey ? gridSize * 2 : gridSize;
        const pos = positions.find(p => p.id === selectedPositionId);
        if (pos) {
          let newX = pos.x;
          let newY = pos.y;
          if (e.key === 'ArrowLeft') newX = Math.max(0, pos.x - step);
          if (e.key === 'ArrowRight') newX = pos.x + step;
          if (e.key === 'ArrowUp') newY = Math.max(0, pos.y - step);
          if (e.key === 'ArrowDown') newY = pos.y + step;
          updatePosition(selectedPositionId, { x: newX, y: newY });
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, selectedPositionId, positions, undo, redo, removePosition, updatePosition, gridSize]);

  // Zoom com mouse wheel (Ctrl + scroll)
  useEffect(() => {
    if (!open || !containerRef.current) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        if (e.deltaY < 0) {
          handleZoomIn();
        } else {
          handleZoomOut();
        }
      }
    };

    const container = containerRef.current;
    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, [open, handleZoomIn, handleZoomOut]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Configurar Posições de Assinatura no PDF</DialogTitle>
          <DialogDescription>
            Faça upload do PDF e clique onde deseja posicionar as assinaturas
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Upload de PDF */}
          {!pdfUrl && (
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
              <Upload className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <Label htmlFor="pdf-upload" className="cursor-pointer">
                <Button variant="outline" asChild>
                  <span>
                    <Upload className="w-4 h-4 mr-2" />
                    Fazer Upload do PDF
                  </span>
                </Button>
              </Label>
              <Input
                id="pdf-upload"
                type="file"
                accept="application/pdf"
                onChange={handleFileUpload}
                className="hidden"
                disabled={!reactPdfLoaded}
              />
              {!reactPdfLoaded && (
                <p className="text-sm text-muted-foreground mt-2">
                  Aguardando carregamento do visualizador...
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-2">
                Tamanho máximo: 10MB
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Ou aguarde enquanto carregamos o PDF do contrato...
              </p>
            </div>
          )}

          {/* Visualizador de PDF */}
          {pdfUrl && (
            <div className="space-y-4">
              {/* Toolbar Principal */}
              <div className="flex items-center justify-between p-4 bg-muted rounded-lg flex-wrap gap-4">
                {/* Tipo de Assinatura */}
                <div className="flex items-center gap-2">
                  <Label>Tipo:</Label>
                  <select
                    value={selectedSignerType}
                    onChange={(e) => setSelectedSignerType(e.target.value as 'user' | 'client' | 'rubric')}
                    className="px-3 py-1 border rounded text-sm"
                    disabled={previewMode}
                  >
                    <option value="user">Usuário</option>
                    <option value="client">Cliente</option>
                    <option value="rubric">Rubrica</option>
                  </select>
                </div>

                <Separator orientation="vertical" className="h-6" />

                {/* Controles de Zoom */}
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={handleZoomOut} disabled={zoomLevel <= 0.5}>
                    <ZoomOut className="w-4 h-4" />
                  </Button>
                  <div className="flex items-center gap-2 min-w-[120px]">
                    <Slider
                      value={[zoomLevel]}
                      onValueChange={([value]) => setZoomLevel(value)}
                      min={0.5}
                      max={3}
                      step={0.1}
                      className="w-20"
                    />
                    <span className="text-xs text-muted-foreground min-w-[40px]">{Math.round(zoomLevel * 100)}%</span>
                  </div>
                  <Button variant="outline" size="sm" onClick={handleZoomIn} disabled={zoomLevel >= 3}>
                    <ZoomIn className="w-4 h-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleZoomReset} title="Reset Zoom">
                    100%
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleZoomFit} title="Fit to Width">
                    <Maximize2 className="w-4 h-4" />
                  </Button>
                </div>

                <Separator orientation="vertical" className="h-6" />

                {/* Grid e Snap */}
                <div className="flex items-center gap-2">
                  <Button
                    variant={showGrid ? "default" : "outline"}
                    size="sm"
                    onClick={() => setShowGrid(!showGrid)}
                    title="Mostrar/Ocultar Grid"
                  >
                    <Grid className="w-4 h-4" />
                  </Button>
                  <div className="flex items-center gap-1">
                    <Checkbox
                      id="snap-to-grid"
                      checked={snapToGrid}
                      onCheckedChange={(checked) => setSnapToGrid(checked === true)}
                    />
                    <Label htmlFor="snap-to-grid" className="text-xs cursor-pointer">Snap</Label>
                  </div>
                  <select
                    value={gridSize}
                    onChange={(e) => setGridSize(Number(e.target.value))}
                    className="px-2 py-1 border rounded text-xs"
                  >
                    <option value="8">8px</option>
                    <option value="16">16px</option>
                    <option value="32">32px</option>
                  </select>
                </div>

                <Separator orientation="vertical" className="h-6" />

                {/* Undo/Redo */}
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={undo}
                    disabled={historyIndex <= 0}
                    title="Desfazer (Ctrl+Z)"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={redo}
                    disabled={historyIndex >= history.length - 1}
                    title="Refazer (Ctrl+Shift+Z)"
                  >
                    <RotateCw className="w-4 h-4" />
                  </Button>
                </div>

                <Separator orientation="vertical" className="h-6" />

                {/* Preview Mode */}
                <Button
                  variant={previewMode ? "default" : "outline"}
                  size="sm"
                  onClick={() => setPreviewMode(!previewMode)}
                  title="Modo Preview"
                >
                  {previewMode ? <EyeOff className="w-4 h-4 mr-2" /> : <Eye className="w-4 h-4 mr-2" />}
                  Preview
                </Button>

                <Separator orientation="vertical" className="h-6" />

                {/* Navegação de Páginas */}
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <span className="text-sm min-w-[80px] text-center">
                    Página {currentPage} de {numPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(Math.min(numPages, currentPage + 1))}
                    disabled={currentPage === numPages}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Container Principal com Layout Flex */}
              <div className="flex gap-4">
                {/* Sidebar de Miniaturas */}
                {showThumbnails && numPages > 0 && (
                  <div className="w-48 border rounded-lg p-2 bg-muted/50 overflow-y-auto" style={{ maxHeight: '600px' }}>
                    <div className="flex items-center justify-between mb-2">
                      <Label className="text-xs font-semibold">Páginas</Label>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowThumbnails(false)}
                        className="h-6 w-6 p-0"
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                    <div className="space-y-2">
                      {Array.from({ length: numPages }, (_, i) => i + 1).map((pageNum) => {
                        const pagePositions = positions.filter(p => p.pageNumber === pageNum);
                        const isCurrentPage = pageNum === currentPage;
                        return (
                          <div
                            key={pageNum}
                            className={`border rounded p-2 cursor-pointer transition-all ${
                              isCurrentPage ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'
                            }`}
                            onClick={() => setCurrentPage(pageNum)}
                          >
                            <div className="text-xs font-medium mb-1">Página {pageNum}</div>
                            <div className="w-full h-24 bg-white border rounded flex items-center justify-center text-xs text-muted-foreground relative overflow-hidden">
                              {pagePositions.length > 0 && (
                                <div className="absolute inset-0">
                                  {pagePositions.map((pos) => {
                                    const colors = pos.signerType === 'user' ? 'bg-blue-500/30' : pos.signerType === 'client' ? 'bg-green-500/30' : 'bg-purple-500/30';
                                    return (
                                      <div
                                        key={pos.id}
                                        className={`absolute border border-current ${colors}`}
                                        style={{
                                          left: `${(pos.x / 800) * 100}%`,
                                          top: `${(pos.y / 1000) * 100}%`,
                                          width: `${(pos.width / 800) * 100}%`,
                                          height: `${(pos.height / 1000) * 100}%`,
                                        }}
                                      />
                                    );
                                  })}
                                </div>
                              )}
                              {pagePositions.length === 0 && 'Sem assinaturas'}
                              {pagePositions.length > 0 && (
                                <span className="absolute bottom-0 right-0 bg-primary text-primary-foreground text-xs px-1 rounded-tl">
                                  {pagePositions.length}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Área Principal do PDF */}
                <div className="flex-1 flex gap-4">
                  {/* PDF Viewer */}
                  <div
                    ref={containerRef}
                    className="relative border rounded-lg overflow-auto bg-gray-100 flex-1"
                    style={{ maxHeight: '600px' }}
                    onClick={handlePageClick}
                  >
                    {/* Grid Overlay */}
                    {showGrid && !previewMode && (
                      <div
                        className="absolute inset-0 pointer-events-none opacity-20"
                        style={{
                          backgroundImage: `
                            linear-gradient(to right, rgba(0,0,0,0.1) 1px, transparent 1px),
                            linear-gradient(to bottom, rgba(0,0,0,0.1) 1px, transparent 1px)
                          `,
                          backgroundSize: `${gridSize * zoomLevel}px ${gridSize * zoomLevel}px`,
                        }}
                      />
                    )}

                    {/* Container com Zoom */}
                    <div
                      style={{
                        transform: `scale(${zoomLevel})`,
                        transformOrigin: 'top left',
                        width: `${100 / zoomLevel}%`,
                        height: `${100 / zoomLevel}%`,
                      }}
                    >
                {!reactPdfLoaded ? (
                  <div className="flex items-center justify-center p-8">
                    <Loader2 className="w-8 h-8 animate-spin" />
                    <p className="ml-2">Carregando visualizador de PDF...</p>
                  </div>
                ) : reactPdfError ? (
                  <div className="flex items-center justify-center p-8">
                    <p className="text-red-600">{reactPdfError}</p>
                  </div>
                ) : Document && Page ? (
                  <Document
                    file={pdfUrl}
                    onLoadSuccess={(pdfInfo) => {
                      console.log('✅ PDF carregado com sucesso:', pdfInfo);
                      onDocumentLoadSuccess(pdfInfo);
                      setReactPdfError(null);
                    }}
                    onLoadError={(error) => {
                      console.error('❌ Erro ao carregar PDF:', error);
                      
                      // Extrair mensagem de erro mais amigável
                      let errorMessage = 'Erro ao carregar PDF. Verifique se o arquivo é válido.';
                      if (error?.message) {
                        if (error.message.includes('version')) {
                          errorMessage = 'Erro de versão do PDF.js. Recarregue a página e tente novamente.';
                        } else if (error.message.includes('Invalid PDF')) {
                          errorMessage = 'O arquivo não é um PDF válido.';
                        } else if (error.message.includes('password')) {
                          errorMessage = 'O PDF está protegido por senha. Remova a senha e tente novamente.';
                        } else {
                          errorMessage = error.message;
                        }
                      }
                      
                      setReactPdfError(errorMessage);
                      toast({
                        title: 'Erro ao carregar PDF',
                        description: errorMessage,
                        variant: 'destructive',
                      });
                    }}
                    error={
                      <div className="flex flex-col items-center justify-center p-8">
                        <p className="text-red-600 mb-2">Erro ao carregar PDF</p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            if (pdfUrl) {
                              URL.revokeObjectURL(pdfUrl);
                            }
                            setPdfUrl(null);
                            setPdfFile(null);
                            setReactPdfError(null);
                          }}
                        >
                          Tentar outro arquivo
                        </Button>
                      </div>
                    }
                    loading={
                      <div className="flex items-center justify-center p-8">
                        <Loader2 className="w-8 h-8 animate-spin" />
                        <p className="ml-2">Carregando PDF...</p>
                      </div>
                    }
                    options={{
                      cMapUrl: 'https://unpkg.com/pdfjs-dist@5.4.296/cmaps/',
                      cMapPacked: true,
                      standardFontDataUrl: 'https://unpkg.com/pdfjs-dist@5.4.296/standard_fonts/',
                    }}
                  >
                    <Page
                      pageNumber={currentPage}
                      renderTextLayer={false}
                      renderAnnotationLayer={false}
                      className="mx-auto"
                      onRenderSuccess={() => {
                        console.log(`✅ Página ${currentPage} renderizada com sucesso`);
                      }}
                      onRenderError={(error) => {
                        console.error(`❌ Erro ao renderizar página ${currentPage}:`, error);
                        toast({
                          title: 'Erro ao renderizar página',
                          description: `Não foi possível renderizar a página ${currentPage} do PDF.`,
                          variant: 'destructive',
                        });
                      }}
                      loading={
                        <div className="flex items-center justify-center p-4">
                          <Loader2 className="w-6 h-6 animate-spin" />
                          <p className="ml-2 text-sm">Carregando página...</p>
                        </div>
                      }
                    />
                  </Document>
                ) : (
                  <div className="flex items-center justify-center p-8">
                    <p className="text-red-600">Erro ao carregar visualizador de PDF</p>
                  </div>
                )}

                    {/* Marcadores de posição */}
                    {!previewMode && positions
                      .filter(p => p.pageNumber === currentPage)
                      .map((pos) => {
                    const isSelected = selectedPositionId === pos.id;
                    const isPreview = previewPosition?.id === pos.id;
                    
                    // Usar preview se disponível durante drag/resize
                    const displayPos = isPreview && previewPosition ? {
                      x: previewPosition.x,
                      y: previewPosition.y,
                      width: previewPosition.width,
                      height: previewPosition.height,
                    } : pos;
                    
                    const signerTypeLabel = pos.signerType === 'user' ? 'Usuário' : pos.signerType === 'client' ? 'Cliente' : 'Rubrica';
                    
                    // Cores baseadas no tipo de assinatura
                    const getColorClasses = () => {
                      if (pos.signerType === 'user') {
                        return {
                          border: isSelected ? 'border-blue-500' : 'border-blue-300',
                          bg: isSelected ? 'bg-blue-200/80' : 'bg-blue-100/40',
                          hover: 'hover:border-blue-400 hover:bg-blue-100/60',
                          labelBg: 'bg-blue-500',
                          handleBg: 'bg-blue-500',
                        };
                      } else if (pos.signerType === 'client') {
                        return {
                          border: isSelected ? 'border-green-500' : 'border-green-300',
                          bg: isSelected ? 'bg-green-200/80' : 'bg-green-100/40',
                          hover: 'hover:border-green-400 hover:bg-green-100/60',
                          labelBg: 'bg-green-500',
                          handleBg: 'bg-green-500',
                        };
                      } else {
                        return {
                          border: isSelected ? 'border-purple-500' : 'border-purple-300',
                          bg: isSelected ? 'bg-purple-200/80' : 'bg-purple-100/40',
                          hover: 'hover:border-purple-400 hover:bg-purple-100/60',
                          labelBg: 'bg-purple-500',
                          handleBg: 'bg-purple-500',
                        };
                      }
                    };
                    
                    const colors = getColorClasses();
                    
                    return (
                      <div
                        key={pos.id}
                        className={`signature-position absolute border-2 rounded cursor-move ${colors.border} ${colors.bg} ${!isSelected ? colors.hover : ''} ${isSelected ? 'shadow-lg z-10' : 'z-0'} ${isPreview ? 'transition-none' : 'transition-all duration-75'}`}
                        style={{
                          left: `${displayPos.x}px`,
                          top: `${displayPos.y}px`,
                          width: `${displayPos.width}px`,
                          height: `${displayPos.height}px`,
                          willChange: isPreview ? 'transform' : 'auto',
                        }}
                        onMouseDown={(e) => handlePositionMouseDown(e, pos.id)}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedPositionId(pos.id);
                        }}
                        title={`${signerTypeLabel} - Arraste para mover, arraste o canto para redimensionar`}
                      >
                        {/* Label do tipo */}
                        <div className={`absolute -top-6 left-0 text-xs text-white px-2 py-0.5 rounded flex items-center gap-1 ${colors.labelBg} shadow-sm`}>
                          {signerTypeLabel}
                          {isSelected && <Edit2 className="w-3 h-3" />}
                        </div>

                        {/* Botão de excluir (visível quando selecionado) */}
                        {isSelected && (
                          <button
                            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1.5 hover:bg-red-600 transition-colors z-20 shadow-lg hover:scale-110"
                            onClick={(e) => {
                              e.stopPropagation();
                              removePosition(pos.id);
                            }}
                            title="Excluir posição"
                            onMouseDown={(e) => e.stopPropagation()}
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {/* Handle de redimensionamento (canto inferior direito) */}
                        <div
                          className={`resize-handle absolute bottom-0 right-0 w-5 h-5 cursor-nwse-resize ${colors.handleBg} rounded-tl-full opacity-80 hover:opacity-100 transition-opacity shadow-sm`}
                          title="Arraste para redimensionar"
                          onMouseDown={(e) => e.stopPropagation()}
                        />

                        {/* Indicador visual quando selecionado */}
                        {isSelected && (
                          <div className="absolute inset-0 border-2 border-dashed border-white/60 rounded pointer-events-none" />
                        )}
                      </div>
                    );
                  })}

                    {/* Preview Mode - Renderizar assinaturas sobre o PDF */}
                    {previewMode && positions
                      .filter(p => p.pageNumber === currentPage)
                      .map((pos) => {
                        const signerTypeLabel = pos.signerType === 'user' ? 'Usuário' : pos.signerType === 'client' ? 'Cliente' : 'Rubrica';
                        return (
                          <div
                            key={pos.id}
                            className="absolute border-2 border-dashed border-gray-400 bg-white/90 rounded flex items-center justify-center text-xs text-gray-600"
                            style={{
                              left: `${pos.x}px`,
                              top: `${pos.y}px`,
                              width: `${pos.width}px`,
                              height: `${pos.height}px`,
                              transform: pos.rotation ? `rotate(${pos.rotation}deg)` : undefined,
                            }}
                          >
                            {signerTypeLabel}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Painel Lateral de Propriedades */}
                  {showPropertyPanel && selectedPositionId && (
                    <div className="w-64 border rounded-lg p-4 bg-muted/50 overflow-y-auto" style={{ maxHeight: '600px' }}>
                      <div className="flex items-center justify-between mb-4">
                        <Label className="text-sm font-semibold">Propriedades</Label>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowPropertyPanel(false)}
                          className="h-6 w-6 p-0"
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                      {(() => {
                        const pos = positions.find(p => p.id === selectedPositionId);
                        if (!pos) return null;
                        return (
                          <div className="space-y-4">
                            <div>
                              <Label className="text-xs">Tipo</Label>
                              <select
                                value={pos.signerType}
                                onChange={(e) => updatePosition(pos.id, { signerType: e.target.value as 'user' | 'client' | 'rubric' })}
                                className="w-full px-2 py-1 border rounded text-sm mt-1"
                              >
                                <option value="user">Usuário</option>
                                <option value="client">Cliente</option>
                                <option value="rubric">Rubrica</option>
                              </select>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <Label className="text-xs">X</Label>
                                <Input
                                  type="number"
                                  value={Math.round(pos.x)}
                                  onChange={(e) => updatePosition(pos.id, { x: Math.max(0, Number(e.target.value)) })}
                                  className="text-sm mt-1"
                                  min="0"
                                />
                              </div>
                              <div>
                                <Label className="text-xs">Y</Label>
                                <Input
                                  type="number"
                                  value={Math.round(pos.y)}
                                  onChange={(e) => updatePosition(pos.id, { y: Math.max(0, Number(e.target.value)) })}
                                  className="text-sm mt-1"
                                  min="0"
                                />
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <Label className="text-xs">Largura</Label>
                                <Input
                                  type="number"
                                  value={Math.round(pos.width)}
                                  onChange={(e) => updatePosition(pos.id, { width: Math.max(60, Number(e.target.value)) })}
                                  className="text-sm mt-1"
                                  min="60"
                                />
                              </div>
                              <div>
                                <Label className="text-xs">Altura</Label>
                                <Input
                                  type="number"
                                  value={Math.round(pos.height)}
                                  onChange={(e) => updatePosition(pos.id, { height: Math.max(30, Number(e.target.value)) })}
                                  className="text-sm mt-1"
                                  min="30"
                                />
                              </div>
                            </div>
                            <div>
                              <Label className="text-xs">Rotação (graus)</Label>
                              <Input
                                type="number"
                                value={pos.rotation || 0}
                                onChange={(e) => updatePosition(pos.id, { rotation: Number(e.target.value) % 360 })}
                                className="text-sm mt-1"
                                min="0"
                                max="360"
                              />
                            </div>
                            <Separator />
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                className="flex-1"
                                onClick={() => {
                                  const targetPages = Array.from({ length: numPages }, (_, i) => i + 1).filter(p => p !== pos.pageNumber);
                                  if (targetPages.length > 0) {
                                    duplicatePosition(pos.id, targetPages);
                                    toast({
                                      title: 'Posição duplicada',
                                      description: `Duplicada para ${targetPages.length} página(s)`,
                                    });
                                  }
                                }}
                              >
                                <Copy className="w-4 h-4 mr-1" />
                                Duplicar
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => removePosition(pos.id)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              </div>

              {/* Botões para mostrar/ocultar painéis */}
              <div className="flex gap-2 justify-center">
                {!showThumbnails && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowThumbnails(true)}
                  >
                    <ImageIcon className="w-4 h-4 mr-2" />
                    Mostrar Miniaturas
                  </Button>
                )}
                {!showPropertyPanel && selectedPositionId && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowPropertyPanel(true)}
                  >
                    <Edit2 className="w-4 h-4 mr-2" />
                    Mostrar Propriedades
                  </Button>
                )}
              </div>

              {!previewMode && (
                <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg shadow-sm">
                  <div className="flex items-start gap-3">
                    <MousePointer2 className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-blue-900">
                        Como usar o Builder de Assinaturas:
                      </p>
                      <ul className="text-xs text-blue-800 space-y-1 list-disc list-inside">
                        <li><strong>Adicionar:</strong> Selecione o tipo e clique no PDF</li>
                        <li><strong>Mover:</strong> Arraste a posição ou use setas (Shift para mover mais rápido)</li>
                        <li><strong>Redimensionar:</strong> Arraste o canto inferior direito</li>
                        <li><strong>Editar:</strong> Use o painel lateral para editar propriedades numéricas</li>
                        <li><strong>Duplicar:</strong> Use o botão Duplicar no painel de propriedades</li>
                        <li><strong>Atalhos:</strong> Ctrl+Z (undo), Ctrl+Shift+Z (redo), Delete (excluir)</li>
                        <li><strong>Zoom:</strong> Ctrl + Scroll do mouse ou use os controles</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* Lista de posições */}
              {positions.length > 0 && (
                <div className="border rounded-lg p-4">
                  <h3 className="font-semibold mb-2">Posições Definidas ({positions.length})</h3>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {positions.map((pos) => {
                      const isSelected = selectedPositionId === pos.id;
                      const signerTypeLabel = pos.signerType === 'user' ? 'Usuário' : pos.signerType === 'client' ? 'Cliente' : 'Rubrica';
                      
                      return (
                        <div
                          key={pos.id}
                          className={`flex items-center justify-between p-2 rounded text-sm cursor-pointer transition-colors ${
                            isSelected ? 'bg-primary/20 border-2 border-primary' : 'bg-muted hover:bg-muted/80'
                          }`}
                          onClick={() => {
                            setSelectedPositionId(pos.id);
                            if (pos.pageNumber !== currentPage) {
                              setCurrentPage(pos.pageNumber);
                            }
                          }}
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-medium">
                              Página {pos.pageNumber} - {signerTypeLabel}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              ({pos.x.toFixed(0)}, {pos.y.toFixed(0)}) - {pos.width.toFixed(0)}x{pos.height.toFixed(0)}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedPositionId(pos.id);
                                if (pos.pageNumber !== currentPage) {
                                  setCurrentPage(pos.pageNumber);
                                }
                              }}
                              title="Editar posição"
                            >
                              <Edit2 className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                removePosition(pos.id);
                              }}
                              title="Excluir posição"
                            >
                              <Trash2 className="w-4 h-4 text-red-500" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              // Limpar URL do objeto para liberar memória
              if (pdfUrl) {
                URL.revokeObjectURL(pdfUrl);
              }
              setPdfFile(null);
              setPdfUrl(null);
              setPositions([]);
              setReactPdfError(null);
              onOpenChange(false);
            }}
            disabled={saving}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || !pdfUrl || positions.length === 0}
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Salvar Posições
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
