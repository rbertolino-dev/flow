import { useState, useCallback, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Upload, X, Save, MousePointer2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

// Import dinâmico do react-pdf para evitar erros de inicialização
let Document: any, Page: any, pdfjs: any;
let reactPdfModule: any = null;
let workerConfigured = false;

// Configurar worker do PDF.js de forma robusta com múltiplos fallbacks
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

  // Estratégia 1: Tentar usar worker local de public/ (se existir)
  // O arquivo pdf.worker.min.js foi copiado para public/ durante setup
  try {
    pdfjsInstance.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
    console.log('✅ Tentando worker local de public/');
    workerConfigured = true;
    // Não retornar true ainda - vamos testar se funciona, se não, usar CDN
  } catch (error) {
    console.warn('⚠️ Worker local não disponível, usando CDN...', error);
  }

  // Estratégia 2: Usar CDN do unpkg.com com versão específica (mais confiável)
  // Esta é a estratégia principal - unpkg.com é muito confiável
  pdfjsInstance.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsVersion}/build/pdf.worker.min.js`;
  console.log(`✅ Worker configurado via CDN (unpkg): versão ${pdfjsVersion}`);
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
      width: 60,
      height: 30,
    };

    setPositions([...positions, newPosition]);
  };

  const removePosition = (id: string) => {
    setPositions(positions.filter(p => p.id !== id));
  };

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

  // Carregar posições existentes quando abrir
  useEffect(() => {
    if (open && contractId) {
      loadExistingPositions();
    }
  }, [open, contractId, loadExistingPositions]);

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
                  .map((pos) => (
                    <div
                      key={pos.id}
                      className="absolute border-2 border-primary bg-primary/20 rounded cursor-pointer"
                      style={{
                        left: `${pos.x}px`,
                        top: `${pos.y}px`,
                        width: `${pos.width}px`,
                        height: `${pos.height}px`,
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        removePosition(pos.id);
                      }}
                      title={`${pos.signerType === 'user' ? 'Usuário' : pos.signerType === 'client' ? 'Cliente' : 'Rubrica'} - Clique para remover`}
                    >
                      <div className="absolute -top-6 left-0 text-xs bg-primary text-white px-1 rounded">
                        {pos.signerType === 'user' ? 'Usuário' : pos.signerType === 'client' ? 'Cliente' : 'Rubrica'}
                      </div>
                    </div>
                  ))}
              </div>

              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800 flex items-center gap-2">
                  <MousePointer2 className="w-4 h-4" />
                  Clique no PDF para marcar onde a assinatura deve aparecer. Clique em um marcador para removê-lo.
                </p>
              </div>

              {/* Lista de posições */}
              {positions.length > 0 && (
                <div className="border rounded-lg p-4">
                  <h3 className="font-semibold mb-2">Posições Definidas ({positions.length})</h3>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {positions.map((pos) => (
                      <div
                        key={pos.id}
                        className="flex items-center justify-between p-2 bg-muted rounded text-sm"
                      >
                        <span>
                          Página {pos.pageNumber} - {pos.signerType === 'user' ? 'Usuário' : pos.signerType === 'client' ? 'Cliente' : 'Rubrica'} ({pos.x.toFixed(0)}, {pos.y.toFixed(0)})
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removePosition(pos.id)}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
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
