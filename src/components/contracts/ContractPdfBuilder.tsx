import { useState, useCallback, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Upload, X, Save, MousePointer2, Move, Maximize2, Trash2, Edit2 } from 'lucide-react';
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
    if (isDragging || isResizing) return;
    
    // Não adicionar se clicou em uma posição existente
    if ((event.target as HTMLElement).closest('.signature-position')) return;

    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const newPosition: SignaturePosition = {
      id: `pos-${Date.now()}`,
      signerType: selectedSignerType,
      pageNumber: currentPage,
      x,
      y,
      width: 120,
      height: 50,
    };

    setPositions([...positions, newPosition]);
    setSelectedPositionId(newPosition.id);
  };

  const removePosition = (id: string) => {
    setPositions(positions.filter(p => p.id !== id));
    if (selectedPositionId === id) {
      setSelectedPositionId(null);
    }
  };

  // Atualizar referência quando positions mudar
  useEffect(() => {
    positionsRef.current = positions;
  }, [positions]);

  const updatePosition = useCallback((id: string, updates: Partial<SignaturePosition>) => {
    setPositions(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
  }, []);

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
          const deltaX = e.clientX - dragStart.x;
          const deltaY = e.clientY - dragStart.y;

          const newX = Math.max(0, Math.min(pos.x + deltaX, rect.width - pos.width));
          const newY = Math.max(0, Math.min(pos.y + deltaY, rect.height - pos.height));

          // Atualizar apenas preview durante drag (evita re-renders)
          setPreviewPosition({ id: selectedPositionId, x: newX, y: newY, width: pos.width, height: pos.height });
        } else if (isResizing) {
          const deltaX = e.clientX - resizeStart.x;
          const deltaY = e.clientY - resizeStart.y;

          const newWidth = Math.max(60, resizeStart.width + deltaX);
          const newHeight = Math.max(30, resizeStart.height + deltaY);

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
  }, [isDragging, isResizing, selectedPositionId, dragStart, resizeStart, previewPosition, updatePosition]);

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
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
              {/* Controles */}
              <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <div className="flex items-center gap-4">
                  <Label>Tipo de Assinatura:</Label>
                  <select
                    value={selectedSignerType}
                    onChange={(e) => setSelectedSignerType(e.target.value as 'user' | 'client' | 'rubric')}
                    className="px-3 py-1 border rounded"
                  >
                    <option value="user">Usuário</option>
                    <option value="client">Cliente</option>
                    <option value="rubric">Rubrica</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                  >
                    ← Anterior
                  </Button>
                  <span className="text-sm">
                    Página {currentPage} de {numPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(Math.min(numPages, currentPage + 1))}
                    disabled={currentPage === numPages}
                  >
                    Próxima →
                  </Button>
                </div>
              </div>

              {/* PDF Viewer */}
              <div
                ref={containerRef}
                className="relative border rounded-lg overflow-auto bg-gray-100"
                style={{ maxHeight: '600px' }}
                onClick={handlePageClick}
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
                {positions
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
              </div>

              <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg shadow-sm">
                <div className="flex items-start gap-3">
                  <MousePointer2 className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-blue-900">
                      Como usar o Builder de Assinaturas:
                    </p>
                    <ul className="text-xs text-blue-800 space-y-1 list-disc list-inside">
                      <li><strong>Adicionar:</strong> Selecione o tipo (Usuário/Cliente/Rubrica) e clique no PDF</li>
                      <li><strong>Mover:</strong> Clique e arraste a posição selecionada</li>
                      <li><strong>Redimensionar:</strong> Arraste o canto inferior direito da posição</li>
                      <li><strong>Excluir:</strong> Selecione a posição e clique no X vermelho</li>
                      <li><strong>Editar:</strong> Clique na posição na lista abaixo para navegar até ela</li>
                    </ul>
                  </div>
                </div>
              </div>

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
