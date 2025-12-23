import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";
import { Upload, FileText, X, CheckCircle2, AlertCircle, Loader2, FileSpreadsheet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useImportPipeline } from "@/hooks/useImportPipeline";
import * as XLSX from "xlsx";

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

  const convertXLSXToPipelineData = (workbook: XLSX.WorkBook): any => {
    const data: any = {
      version: "1.0",
      exportedAt: new Date().toISOString(),
      pipelineStages: [],
      tags: [],
      products: [],
      leads: [],
    };

    // Ler aba de Stages
    if (workbook.SheetNames.includes("Stages") || workbook.SheetNames.includes("Etapas")) {
      const sheetName = workbook.SheetNames.find((n) => n.toLowerCase().includes("stage") || n.toLowerCase().includes("etapa"));
      if (sheetName) {
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet);
        data.pipelineStages = rows.map((row: any, index: number) => ({
          name: row["Nome"] || row["Name"] || row["nome"] || row["name"] || "",
          color: row["Cor"] || row["Color"] || row["color"] || "#3B82F6",
          position: row["Posição"] || row["Position"] || row["posição"] || row["position"] || index,
        })).filter((s: any) => s.name);
      }
    }

    // Ler aba de Tags
    if (workbook.SheetNames.some((n) => n.toLowerCase().includes("tag"))) {
      const sheetName = workbook.SheetNames.find((n) => n.toLowerCase().includes("tag"));
      if (sheetName) {
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet);
        data.tags = rows.map((row: any) => ({
          name: row["Nome"] || row["Name"] || row["nome"] || row["name"] || "",
          color: row["Cor"] || row["Color"] || row["color"] || "#3B82F6",
        })).filter((t: any) => t.name);
      }
    }

    // Ler aba de Products
    if (workbook.SheetNames.some((n) => n.toLowerCase().includes("product") || n.toLowerCase().includes("produto"))) {
      const sheetName = workbook.SheetNames.find((n) => n.toLowerCase().includes("product") || n.toLowerCase().includes("produto"));
      if (sheetName) {
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet);
        data.products = rows.map((row: any) => ({
          name: row["Nome"] || row["Name"] || row["nome"] || row["name"] || "",
          description: row["Descrição"] || row["Description"] || row["descrição"] || row["description"] || "",
          price: parseFloat(row["Preço"] || row["Price"] || row["preço"] || row["price"] || "0") || 0,
          category: row["Categoria"] || row["Category"] || row["categoria"] || row["category"] || "",
          is_active: row["Ativo"] !== undefined ? row["Ativo"] : (row["Active"] !== undefined ? row["Active"] : true),
        })).filter((p: any) => p.name);
      }
    }

    // Ler aba de Leads (principal)
    const leadsSheetName = workbook.SheetNames.find((n) => 
      n.toLowerCase().includes("lead") || 
      n.toLowerCase().includes("contato") || 
      n.toLowerCase().includes("contact") ||
      n === "Leads" ||
      n === "Sheet1"
    ) || workbook.SheetNames[0];

    if (leadsSheetName) {
      const sheet = workbook.Sheets[leadsSheetName];
      const rows = XLSX.utils.sheet_to_json(sheet);
      data.leads = rows.map((row: any) => {
        const lead: any = {
          name: row["Nome"] || row["Name"] || row["nome"] || row["name"] || "",
          phone: row["Telefone"] || row["Phone"] || row["telefone"] || row["phone"] || "",
          email: row["Email"] || row["email"] || "",
          company: row["Empresa"] || row["Company"] || row["empresa"] || row["company"] || "",
          value: parseFloat(row["Valor"] || row["Value"] || row["valor"] || row["value"] || "0") || null,
          status: row["Status"] || row["status"] || "novo",
          source: row["Origem"] || row["Source"] || row["origem"] || row["source"] || "manual",
          assigned_to: row["Responsável"] || row["Assigned To"] || row["responsável"] || row["assigned_to"] || "",
          notes: row["Notas"] || row["Notes"] || row["notas"] || row["notes"] || "",
          stage_name: row["Etapa"] || row["Stage"] || row["etapa"] || row["stage"] || "",
        };

        // Tags (pode ser string separada por vírgula ou array)
        const tagsStr = row["Tags"] || row["tags"] || "";
        if (tagsStr) {
          lead.tags = typeof tagsStr === "string" ? tagsStr.split(",").map((t: string) => t.trim()) : tagsStr;
        }

        return lead;
      }).filter((l: any) => l.name && l.phone);
    }

    return data;
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    const isJSON = selectedFile.name.endsWith(".json");
    const isXLSX = selectedFile.name.match(/\.(xlsx|xls)$/i);

    if (!isJSON && !isXLSX) {
      toast({
        title: "Arquivo inválido",
        description: "Por favor, selecione um arquivo JSON ou Excel (.xlsx, .xls)",
        variant: "destructive",
      });
      return;
    }

    setFile(selectedFile);
    setImportResult(null);

    try {
      let parsed: any;

      if (isJSON) {
        const text = await selectedFile.text();
        parsed = JSON.parse(text);
      } else {
        // Processar XLSX
        const arrayBuffer = await selectedFile.arrayBuffer();
        const data = new Uint8Array(arrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        parsed = convertXLSXToPipelineData(workbook);
      }

      // Validar estrutura básica
      if (!parsed.pipelineStages && !parsed.tags && !parsed.products && !parsed.leads) {
        throw new Error("Arquivo inválido: deve conter pipelineStages, tags, products ou leads");
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
        description: error.message || "Arquivo inválido",
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
                    Selecione um arquivo JSON ou Excel (.xlsx) exportado do pipeline
                  </p>
                  <div className="flex gap-2 justify-center">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".json,.xlsx,.xls"
                      onChange={handleFileSelect}
                      className="hidden"
                      id="pipeline-file-upload"
                    />
                    <label htmlFor="pipeline-file-upload">
                      <Button asChild variant="outline">
                        <span className="flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          Selecionar Arquivo
                        </span>
                      </Button>
                    </label>
                  </div>
                  <p className="text-xs text-muted-foreground mt-4">
                    Formatos suportados: JSON ou Excel (.xlsx, .xls)
                  </p>
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
                    {file.name.match(/\.(xlsx|xls)$/i) ? (
                      <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <FileText className="h-4 w-4 text-muted-foreground" />
                    )}
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

