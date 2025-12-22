import { useState, useCallback, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Upload, X, Save, MousePointer2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';

// Configurar worker do PDF.js
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

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
  const containerRef = useRef<HTMLDivElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      toast({
        title: 'Arquivo inválido',
        description: 'Por favor, selecione um arquivo PDF',
        variant: 'destructive',
      });
      return;
    }

    setPdfFile(file);
    const url = URL.createObjectURL(file);
    setPdfUrl(url);
    setPositions([]);
    setCurrentPage(1);
  };

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
  };

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
              />
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
                    onChange={(e) => setSelectedSignerType(e.target.value as any)}
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
                <Document
                  file={pdfUrl}
                  onLoadSuccess={onDocumentLoadSuccess}
                  loading={
                    <div className="flex items-center justify-center p-8">
                      <Loader2 className="w-8 h-8 animate-spin" />
                    </div>
                  }
                >
                  <Page
                    pageNumber={currentPage}
                    renderTextLayer={false}
                    renderAnnotationLayer={false}
                    className="mx-auto"
                  />
                </Document>

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
              setPdfFile(null);
              setPdfUrl(null);
              setPositions([]);
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

