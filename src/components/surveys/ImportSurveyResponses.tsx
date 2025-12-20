import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, Download, FileText, CheckCircle2, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useActiveOrganization } from "@/hooks/useActiveOrganization";
import { Survey } from "@/types/survey";

interface ImportSurveyResponsesProps {
  survey: Survey;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete?: () => void;
}

export function ImportSurveyResponses({ survey, open, onOpenChange, onImportComplete }: ImportSurveyResponsesProps) {
  const { toast } = useToast();
  const { activeOrgId } = useActiveOrganization();
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<any[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [importedCount, setImportedCount] = useState(0);

  // Gerar template CSV
  const generateTemplateCSV = () => {
    const headers = ["respondent_name", "respondent_email", ...survey.fields.map(f => f.name || f.id)];
    const exampleRow = ["João Silva", "joao@exemplo.com", ...survey.fields.map(() => "Resposta exemplo")];
    
    const csvContent = [
      headers.join(","),
      exampleRow.join(","),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `template-${survey.name.replace(/\s+/g, "-")}.csv`;
    link.click();
    
    toast({
      title: "Template baixado",
      description: "Preencha o template com as respostas e importe novamente.",
    });
  };

  const parseCSV = (text: string): any[] => {
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    if (lines.length === 0) return [];

    // Detectar delimitador (vírgula ou ponto e vírgula)
    const delimiter = lines[0].includes(';') ? ';' : ',';
    
    // Parsear cabeçalho
    const headers = lines[0].split(delimiter).map(h => h.trim().replace(/^"|"$/g, ''));
    
    // Parsear linhas
    const rows: any[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(delimiter).map(v => v.trim().replace(/^"|"$/g, ''));
      if (values.length === 0 || values.every(v => !v)) continue;
      
      const row: any = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });
      rows.push(row);
    }

    return rows;
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      toast({
        title: "Arquivo inválido",
        description: "Por favor, selecione um arquivo CSV",
        variant: "destructive",
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (!text) return;

      try {
        const parsed = parseCSV(text);
        
        if (parsed.length === 0) {
          toast({
            title: "Arquivo vazio",
            description: "O arquivo CSV não contém dados válidos",
            variant: "destructive",
          });
          return;
        }

        // Validar estrutura
        const expectedHeaders = ["respondent_name", "respondent_email", ...survey.fields.map(f => f.name || f.id)];
        const firstRow = parsed[0];
        const missingFields = survey.fields.filter(f => {
          const fieldName = f.name || f.id;
          return !firstRow.hasOwnProperty(fieldName);
        });

        if (missingFields.length > 0) {
          toast({
            title: "Campos faltando",
            description: `Campos obrigatórios não encontrados: ${missingFields.map(f => f.label).join(", ")}`,
            variant: "destructive",
          });
          return;
        }

        setPreview(parsed.slice(0, 10)); // Mostrar primeiras 10 linhas
        setCsvFile(file);
        
        toast({
          title: `${parsed.length} resposta(s) encontrada(s)`,
          description: parsed.length > 10 ? "Mostrando primeiras 10 linhas" : "Revise antes de importar",
        });
      } catch (error: any) {
        toast({
          title: "Erro ao processar CSV",
          description: error.message || "Formato de arquivo inválido",
          variant: "destructive",
        });
      }
    };

    reader.readAsText(file, 'UTF-8');
  };

  const handleImport = async () => {
    if (!csvFile || !activeOrgId) return;

    setIsImporting(true);
    setImportedCount(0);

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const text = e.target?.result as string;
        if (!text) return;

        const parsed = parseCSV(text);
        let successCount = 0;
        let errorCount = 0;

        for (const row of parsed) {
          try {
            // Preparar respostas
            const responses: Record<string, any> = {};
            survey.fields.forEach(field => {
              const fieldName = field.name || field.id;
              const value = row[fieldName];
              if (value !== undefined && value !== '') {
                responses[field.id] = value;
                // Também salvar pelo name para compatibilidade
                responses[fieldName] = value;
              }
            });

            // Inserir resposta
            const { error } = await supabase
              .from('survey_responses')
              .insert({
                survey_id: survey.id,
                organization_id: activeOrgId,
                respondent_name: row.respondent_name || null,
                respondent_email: row.respondent_email || null,
                responses: responses,
                metadata: {
                  imported: true,
                  imported_at: new Date().toISOString(),
                  source: 'csv_import',
                },
              });

            if (error) throw error;
            successCount++;
            setImportedCount(successCount);
          } catch (error: any) {
            console.error('Erro ao importar resposta:', error);
            errorCount++;
          }
        }

        setIsImporting(false);
        
        toast({
          title: "Importação concluída",
          description: `${successCount} resposta(s) importada(s)${errorCount > 0 ? `. ${errorCount} erro(s).` : '.'}`,
          variant: successCount > 0 ? "default" : "destructive",
        });

        if (onImportComplete) {
          onImportComplete();
        }

        // Limpar
        setCsvFile(null);
        setPreview([]);
        onOpenChange(false);
      };

      reader.readAsText(csvFile, 'UTF-8');
    } catch (error: any) {
      setIsImporting(false);
      toast({
        title: "Erro na importação",
        description: error.message || "Erro desconhecido",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar Respostas via CSV</DialogTitle>
          <DialogDescription>
            Importe respostas da pesquisa "{survey.name}" usando um arquivo CSV
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Template */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Template CSV</CardTitle>
              <CardDescription>
                Baixe o template com a estrutura correta para importação
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={generateTemplateCSV} variant="outline" className="w-full">
                <Download className="h-4 w-4 mr-2" />
                Baixar Template CSV
              </Button>
            </CardContent>
          </Card>

          {/* Upload */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Arquivo CSV</CardTitle>
              <CardDescription>
                Selecione o arquivo CSV com as respostas para importar
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="csv-file">Arquivo CSV</Label>
                <Input
                  id="csv-file"
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  disabled={isImporting}
                />
                <p className="text-xs text-muted-foreground">
                  Formato: CSV com cabeçalhos (respondent_name, respondent_email, e campos da pesquisa)
                </p>
              </div>

              {preview.length > 0 && (
                <div className="space-y-2">
                  <Label>Preview (primeiras {preview.length} linhas)</Label>
                  <div className="border rounded-md max-h-64 overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nome</TableHead>
                          <TableHead>Email</TableHead>
                          {survey.fields.slice(0, 3).map(field => (
                            <TableHead key={field.id}>{field.label}</TableHead>
                          ))}
                          {survey.fields.length > 3 && <TableHead>...</TableHead>}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {preview.map((row, idx) => (
                          <TableRow key={idx}>
                            <TableCell>{row.respondent_name || '-'}</TableCell>
                            <TableCell>{row.respondent_email || '-'}</TableCell>
                            {survey.fields.slice(0, 3).map(field => (
                              <TableCell key={field.id}>
                                {row[field.name || field.id] || '-'}
                              </TableCell>
                            ))}
                            {survey.fields.length > 3 && <TableCell>...</TableCell>}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Campos esperados */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Campos Esperados no CSV</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <span><strong>respondent_name</strong> (opcional) - Nome do respondente</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <span><strong>respondent_email</strong> (opcional) - Email do respondente</span>
                </div>
                {survey.fields.map(field => (
                  <div key={field.id} className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-blue-600" />
                    <span><strong>{field.name || field.id}</strong> - {field.label}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Botões */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isImporting}>
              Cancelar
            </Button>
            <Button 
              onClick={handleImport} 
              disabled={!csvFile || preview.length === 0 || isImporting}
            >
              {isImporting ? (
                <>
                  Importando... ({importedCount})
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Importar Respostas
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}


