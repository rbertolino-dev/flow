import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";
import { Upload, FileText, X, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useImportPipeline } from "@/hooks/useImportPipeline";

interface ImportPipelineDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPipelineImported: () => void;
}

export function ImportPipelineDialog({ open, onOpenChange, onPipelineImported }: ImportPipelineDialogProps) {
  const { toast } = useToast();
  const { importPipeline, loading, progress } = useImportPipeline();
  const [file, setFile] = useState<File | null>(null);
  const [jsonData, setJsonData] = useState<any>(null);
  const [preview, setPreview] = useState<{
    stages: number;
    tags: number;
    products: number;
    leads: number;
  } | null>(null);
  const [importResult, setImportResult] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith(".json")) {
      toast({
        title: "Arquivo inválido",
        description: "Por favor, selecione um arquivo JSON",
        variant: "destructive",
      });
      return;
    }

    setFile(selectedFile);
    setImportResult(null);

    try {
      const text = await selectedFile.text();
      const parsed = JSON.parse(text);

      // Validar estrutura básica
      if (!parsed.pipelineStages && !parsed.tags && !parsed.products && !parsed.leads) {
        throw new Error("JSON inválido: deve conter pipelineStages, tags, products ou leads");
      }

      setJsonData(parsed);
      setPreview({
        stages: parsed.pipelineStages?.length || 0,
        tags: parsed.tags?.length || 0,
        products: parsed.products?.length || 0,
        leads: parsed.leads?.length || 0,
      });
    } catch (error: any) {
      toast({
        title: "Erro ao ler arquivo",
        description: error.message || "Arquivo JSON inválido",
        variant: "destructive",
      });
      setFile(null);
      setJsonData(null);
      setPreview(null);
    }
  };

  const handleImport = async () => {
    if (!jsonData) return;

    try {
      const result = await importPipeline(jsonData);

      setImportResult(result);

      const totalSuccess =
        result.success.stages +
        result.success.tags +
        result.success.products +
        result.success.leads +
        result.success.leadTags +
        result.success.activities +
        result.success.leadProducts;

      const totalFailed =
        result.failed.stages +
        result.failed.tags +
        result.failed.products +
        result.failed.leads +
        result.failed.leadTags +
        result.failed.activities +
        result.failed.leadProducts;

      if (totalFailed === 0 && result.skipped.leads === 0) {
        toast({
          title: "Importação concluída",
          description: `${totalSuccess} itens importados com sucesso`,
        });
        onPipelineImported();
        handleClose();
      } else {
        toast({
          title: "Importação parcialmente concluída",
          description: `${totalSuccess} sucessos, ${totalFailed} falhas, ${result.skipped.leads} leads pulados`,
          variant: totalFailed > 0 ? "destructive" : "default",
        });
      }
    } catch (error: any) {
      toast({
        title: "Erro na importação",
        description: error.message || "Erro ao importar pipeline",
        variant: "destructive",
      });
    }
  };

  const handleClose = () => {
    if (!loading) {
      setFile(null);
      setJsonData(null);
      setPreview(null);
      setImportResult(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Importar Pipeline Completo</DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-6">
            {/* Upload de Arquivo */}
            {!jsonData && (
              <div className="space-y-4">
                <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
                  <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground mb-4">
                    Selecione um arquivo JSON exportado do pipeline
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json"
                    onChange={handleFileSelect}
                    className="hidden"
                    id="pipeline-json-upload"
                  />
                  <label htmlFor="pipeline-json-upload">
                    <Button asChild variant="outline">
                      <span>Selecionar Arquivo JSON</span>
                    </Button>
                  </label>
                </div>
              </div>
            )}

            {/* Preview dos Dados */}
            {preview && !importResult && (
              <div className="space-y-4">
                <div className="bg-muted/50 rounded-lg p-4">
                  <h3 className="font-semibold mb-3">Preview dos Dados</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Etapas:</span>
                      <Badge variant="secondary">{preview.stages}</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Tags:</span>
                      <Badge variant="secondary">{preview.tags}</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Produtos:</span>
                      <Badge variant="secondary">{preview.products}</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Leads:</span>
                      <Badge variant="secondary">{preview.leads}</Badge>
                    </div>
                  </div>
                </div>

                {file && (
                  <div className="flex items-center gap-2 p-2 bg-muted rounded">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm flex-1 truncate">{file.name}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setFile(null);
                        setJsonData(null);
                        setPreview(null);
                        if (fileInputRef.current) {
                          fileInputRef.current.value = "";
                        }
                      }}
                      disabled={loading}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Progress Bar */}
            {loading && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Importando pipeline...</span>
                  <span>{Math.round(progress)}%</span>
                </div>
                <Progress value={progress} />
              </div>
            )}

            {/* Resultado da Importação */}
            {importResult && (
              <div className="space-y-4">
                <Separator />
                <h3 className="font-semibold">Resultado da Importação</h3>

                {/* Sucessos */}
                <div className="bg-green-50 dark:bg-green-950/20 rounded-lg p-4 space-y-2">
                  <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                    <CheckCircle2 className="h-5 w-5" />
                    <span className="font-semibold">Sucessos</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>Etapas: {importResult.success.stages}</div>
                    <div>Tags: {importResult.success.tags}</div>
                    <div>Produtos: {importResult.success.products}</div>
                    <div>Leads: {importResult.success.leads}</div>
                    <div>Tags de Leads: {importResult.success.leadTags}</div>
                    <div>Atividades: {importResult.success.activities}</div>
                    <div>Produtos de Leads: {importResult.success.leadProducts}</div>
                  </div>
                </div>

                {/* Falhas */}
                {(importResult.failed.stages > 0 ||
                  importResult.failed.tags > 0 ||
                  importResult.failed.products > 0 ||
                  importResult.failed.leads > 0 ||
                  importResult.failed.leadTags > 0 ||
                  importResult.failed.activities > 0 ||
                  importResult.failed.leadProducts > 0) && (
                  <div className="bg-red-50 dark:bg-red-950/20 rounded-lg p-4 space-y-2">
                    <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
                      <AlertCircle className="h-5 w-5" />
                      <span className="font-semibold">Falhas</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      {importResult.failed.stages > 0 && (
                        <div>Etapas: {importResult.failed.stages}</div>
                      )}
                      {importResult.failed.tags > 0 && <div>Tags: {importResult.failed.tags}</div>}
                      {importResult.failed.products > 0 && (
                        <div>Produtos: {importResult.failed.products}</div>
                      )}
                      {importResult.failed.leads > 0 && (
                        <div>Leads: {importResult.failed.leads}</div>
                      )}
                      {importResult.failed.leadTags > 0 && (
                        <div>Tags de Leads: {importResult.failed.leadTags}</div>
                      )}
                      {importResult.failed.activities > 0 && (
                        <div>Atividades: {importResult.failed.activities}</div>
                      )}
                      {importResult.failed.leadProducts > 0 && (
                        <div>Produtos de Leads: {importResult.failed.leadProducts}</div>
                      )}
                    </div>
                  </div>
                )}

                {/* Pulados */}
                {importResult.skipped.leads > 0 && (
                  <div className="bg-yellow-50 dark:bg-yellow-950/20 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-yellow-700 dark:text-yellow-400 mb-2">
                      <AlertCircle className="h-5 w-5" />
                      <span className="font-semibold">Leads Pulados (duplicados)</span>
                    </div>
                    <div className="text-sm">{importResult.skipped.leads} leads</div>
                  </div>
                )}

                {/* Erros Detalhados */}
                {importResult.errors && importResult.errors.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold">Erros Detalhados</h4>
                    <ScrollArea className="h-32 border rounded p-2">
                      <div className="space-y-1">
                        {importResult.errors.slice(0, 20).map((error: any, index: number) => (
                          <div key={index} className="text-xs text-muted-foreground">
                            <span className="font-medium">{error.type}:</span> {error.item} - {error.error}
                          </div>
                        ))}
                        {importResult.errors.length > 20 && (
                          <div className="text-xs text-muted-foreground italic">
                            ... e mais {importResult.errors.length - 20} erros
                          </div>
                        )}
                      </div>
                    </ScrollArea>
                  </div>
                )}
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            {importResult ? "Fechar" : "Cancelar"}
          </Button>
          {jsonData && !importResult && (
            <Button onClick={handleImport} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Importando...
                </>
              ) : (
                "Importar Pipeline"
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

