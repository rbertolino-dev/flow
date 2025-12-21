import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Upload, Download, FileSpreadsheet, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import * as XLSX from 'xlsx';

interface ProductBulkImportProps {
  onImport: (products: Array<{
    name: string;
    description?: string;
    price: number;
    category?: string;
    unit?: string;
    is_active?: boolean;
  }>) => Promise<void>;
  isImporting?: boolean;
}

export function ProductBulkImport({ onImport, isImporting = false }: ProductBulkImportProps) {
  const [showDialog, setShowDialog] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<Array<any>>([]);
  const [importErrors, setImportErrors] = useState<Array<{ row: number; error: string }>>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Gerar template Excel para download
  const downloadTemplate = () => {
    const templateData = [
      {
        'Nome': 'Produto Exemplo 1',
        'Descrição': 'Descrição do produto exemplo',
        'Preço': 100.00,
        'Categoria': 'Produto',
        'Unidade': 'un',
        'Ativo': 'SIM'
      },
      {
        'Nome': 'Produto Exemplo 2',
        'Descrição': 'Outro produto exemplo',
        'Preço': 250.50,
        'Categoria': 'Serviço',
        'Unidade': 'h',
        'Ativo': 'SIM'
      },
      {
        'Nome': 'Material Exemplo',
        'Descrição': 'Material de construção',
        'Preço': 45.80,
        'Categoria': 'Material',
        'Unidade': 'm²',
        'Ativo': 'SIM'
      }
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Produtos');
    
    // Ajustar largura das colunas
    const colWidths = [
      { wch: 30 }, // Nome
      { wch: 40 }, // Descrição
      { wch: 15 }, // Preço
      { wch: 20 }, // Categoria
      { wch: 15 }, // Unidade
      { wch: 10 }  // Ativo
    ];
    ws['!cols'] = colWidths;

    XLSX.writeFile(wb, 'template-produtos.xlsx');
    
    toast({
      title: 'Template baixado',
      description: 'Preencha o template e faça o upload para importar os produtos.',
    });
  };

  // Processar arquivo Excel
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validar extensão
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      toast({
        title: 'Arquivo inválido',
        description: 'Por favor, selecione um arquivo Excel (.xlsx ou .xls)',
        variant: 'destructive',
      });
      return;
    }

    setImportFile(file);
    setImportPreview([]);
    setImportErrors([]);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet);

        // Validar limite de 500 produtos
        if (jsonData.length > 500) {
          toast({
            title: 'Limite excedido',
            description: `A planilha contém ${jsonData.length} produtos. O limite é de 500 produtos por importação.`,
            variant: 'destructive',
          });
          setImportFile(null);
          return;
        }

        // Validar e processar dados
        const errors: Array<{ row: number; error: string }> = [];
        const preview: Array<any> = [];

        jsonData.forEach((row: any, index: number) => {
          const rowNum = index + 2; // +2 porque começa na linha 2 (linha 1 é cabeçalho)
          const rowErrors: string[] = [];

          // Validar nome (obrigatório)
          const name = String(row['Nome'] || row['nome'] || '').trim();
          if (!name) {
            rowErrors.push('Nome é obrigatório');
          }

          // Validar preço (obrigatório)
          const priceStr = String(row['Preço'] || row['preço'] || row['Preco'] || row['preco'] || '0').trim();
          const price = parseFloat(priceStr.replace(',', '.'));
          if (isNaN(price) || price < 0) {
            rowErrors.push('Preço deve ser um número válido maior ou igual a zero');
          }

          // Processar outros campos
          const description = String(row['Descrição'] || row['descrição'] || row['Descricao'] || row['descricao'] || '').trim() || undefined;
          const category = String(row['Categoria'] || row['categoria'] || '').trim() || undefined;
          const unit = String(row['Unidade'] || row['unidade'] || '').trim() || undefined;
          const activeStr = String(row['Ativo'] || row['ativo'] || 'SIM').trim().toUpperCase();
          const is_active = activeStr === 'SIM' || activeStr === 'S' || activeStr === 'YES' || activeStr === 'Y' || activeStr === 'TRUE' || activeStr === '1';

          if (rowErrors.length > 0) {
            errors.push({ row: rowNum, error: rowErrors.join('; ') });
          } else {
            preview.push({
              name,
              description,
              price,
              category,
              unit,
              is_active,
            });
          }
        });

        setImportPreview(preview);
        setImportErrors(errors);

        if (errors.length > 0) {
          toast({
            title: 'Erros encontrados',
            description: `${errors.length} linha(s) têm erros. Corrija antes de importar.`,
            variant: 'destructive',
          });
        } else {
          toast({
            title: 'Arquivo validado',
            description: `${preview.length} produto(s) prontos para importar.`,
          });
        }
      } catch (error: any) {
        toast({
          title: 'Erro ao processar arquivo',
          description: error.message || 'Erro desconhecido ao ler o arquivo Excel',
          variant: 'destructive',
        });
        setImportFile(null);
      }
    };

    reader.readAsArrayBuffer(file);
  };

  // Executar importação
  const handleImport = async () => {
    if (importPreview.length === 0) {
      toast({
        title: 'Nenhum produto para importar',
        description: 'Por favor, selecione um arquivo válido primeiro.',
        variant: 'destructive',
      });
      return;
    }

    if (importErrors.length > 0) {
      toast({
        title: 'Corrija os erros primeiro',
        description: 'Existem erros na planilha que precisam ser corrigidos antes de importar.',
        variant: 'destructive',
      });
      return;
    }

    try {
      await onImport(importPreview);
      setShowDialog(false);
      setImportFile(null);
      setImportPreview([]);
      setImportErrors([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error: any) {
      console.error('Erro ao importar:', error);
    }
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={() => setShowDialog(true)}
        className="gap-2"
      >
        <Upload className="w-4 h-4" />
        Importar em Massa
      </Button>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold flex items-center gap-2">
              <FileSpreadsheet className="w-6 h-6 text-primary" />
              Importar Produtos em Massa
            </DialogTitle>
            <DialogDescription>
              Importe até 500 produtos de uma vez usando uma planilha Excel. Baixe o template, preencha com seus produtos e faça o upload.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Botão para baixar template */}
            <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/50">
              <div>
                <h4 className="font-semibold mb-1">1. Baixar Template</h4>
                <p className="text-sm text-muted-foreground">
                  Baixe o template Excel com o formato correto
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={downloadTemplate}
                className="gap-2"
              >
                <Download className="w-4 h-4" />
                Baixar Template
              </Button>
            </div>

            {/* Upload de arquivo */}
            <div className="space-y-2">
              <h4 className="font-semibold">2. Selecionar Arquivo</h4>
              <div className="flex items-center gap-4">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="product-import-file"
                />
                <label htmlFor="product-import-file">
                  <Button
                    type="button"
                    variant="outline"
                    asChild
                    className="gap-2"
                  >
                    <span>
                      <Upload className="w-4 h-4" />
                      Selecionar Arquivo Excel
                    </span>
                  </Button>
                </label>
                {importFile && (
                  <span className="text-sm text-muted-foreground">
                    {importFile.name}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Limite: 500 produtos por planilha. Formatos aceitos: .xlsx, .xls
              </p>
            </div>

            {/* Preview e erros */}
            {importPreview.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-semibold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                  Produtos Prontos para Importar: {importPreview.length}
                </h4>
                <div className="max-h-40 overflow-y-auto border rounded p-2 bg-muted/30">
                  <div className="space-y-1 text-sm">
                    {importPreview.slice(0, 10).map((product, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <CheckCircle2 className="w-3 h-3 text-green-600" />
                        <span className="font-medium">{product.name}</span>
                        <span className="text-muted-foreground">
                          - {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(product.price)}
                        </span>
                        {product.unit && (
                          <span className="text-muted-foreground">({product.unit})</span>
                        )}
                        {product.category && (
                          <span className="text-muted-foreground">- {product.category}</span>
                        )}
                      </div>
                    ))}
                    {importPreview.length > 10 && (
                      <p className="text-xs text-muted-foreground italic">
                        ... e mais {importPreview.length - 10} produto(s)
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {importErrors.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-semibold flex items-center gap-2 text-destructive">
                  <AlertCircle className="w-4 h-4" />
                  Erros Encontrados: {importErrors.length}
                </h4>
                <div className="max-h-40 overflow-y-auto border border-destructive rounded p-2 bg-destructive/10">
                  <div className="space-y-1 text-sm">
                    {importErrors.map((error, index) => (
                      <div key={index} className="text-destructive">
                        <strong>Linha {error.row}:</strong> {error.error}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowDialog(false);
                setImportFile(null);
                setImportPreview([]);
                setImportErrors([]);
                if (fileInputRef.current) {
                  fileInputRef.current.value = '';
                }
              }}
              disabled={isImporting}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleImport}
              disabled={isImporting || importPreview.length === 0 || importErrors.length > 0}
            >
              {isImporting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Importando...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Importar {importPreview.length} Produto(s)
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

