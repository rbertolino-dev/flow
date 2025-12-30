import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { usePostSaleLeads } from "@/hooks/usePostSaleLeads";
import { usePostSaleStages } from "@/hooks/usePostSaleStages";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, Loader2, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { getUserOrganizationId } from "@/lib/organizationUtils";
import { Checkbox } from "@/components/ui/checkbox";

interface BulkImportPostSaleLeadsDialogProps {
  onImported?: () => void;
  onSuccess?: () => void;
}

interface ParsedLead {
  company: string;
  name: string;
  phone: string;
  lineNumber: number;
  errors?: string[];
  isDuplicate?: boolean;
  duplicateWith?: string[];
  normalizedPhone?: string;
}

export function BulkImportPostSaleLeadsDialog({ onImported, onSuccess }: BulkImportPostSaleLeadsDialogProps) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [selectedStageId, setSelectedStageId] = useState<string>("");
  const [isImporting, setIsImporting] = useState(false);
  const [parsedLeads, setParsedLeads] = useState<ParsedLead[]>([]);
  const [importResults, setImportResults] = useState<{ success: number; errors: number } | null>(null);
  const [checkingDuplicates, setCheckingDuplicates] = useState(false);
  const [duplicatesFound, setDuplicatesFound] = useState(false);
  const [selectedDuplicates, setSelectedDuplicates] = useState<Set<number>>(new Set());
  const [existingLeads, setExistingLeads] = useState<any[]>([]);
  const { toast } = useToast();
  const { createLead, refetch } = usePostSaleLeads();
  const { stages, loading: stagesLoading } = usePostSaleStages();

  // Normalizar telefone para comparação
  const normalizePhone = (phone: string): string => {
    const digits = phone.replace(/\D/g, '');
    // Remover código do país se presente
    if (digits.startsWith('55') && digits.length >= 12) {
      return digits.substring(2);
    }
    return digits;
  };

  const parseText = (input: string): ParsedLead[] => {
    const lines = input.split('\n').filter(line => line.trim());
    const parsed: ParsedLead[] = [];

    lines.forEach((line, index) => {
      const lineNumber = index + 1;
      const trimmed = line.trim();
      
      if (!trimmed) return;

      // Separar por vírgula
      const parts = trimmed.split(',').map(p => p.trim()).filter(p => p);
      
      if (parts.length < 3) {
        parsed.push({
          company: "",
          name: "",
          phone: "",
          lineNumber,
          errors: [`Linha ${lineNumber}: Formato inválido. Use: Nome da Empresa, Nome do Responsável, Telefone`],
        });
        return;
      }

      const [company, name, phone] = parts;
      const errors: string[] = [];

      if (!company) errors.push("Nome da empresa é obrigatório");
      if (!name) errors.push("Nome do responsável é obrigatório");
      if (!phone) errors.push("Telefone é obrigatório");

      // Validar telefone (deve ter pelo menos 10 dígitos)
      const phoneDigits = phone?.replace(/\D/g, '') || '';
      if (phoneDigits.length < 10) {
        errors.push("Telefone inválido (mínimo 10 dígitos)");
      }

      const normalizedPhone = normalizePhone(phone || '');

      parsed.push({
        company: company || "",
        name: name || "",
        phone: phone || "",
        lineNumber,
        normalizedPhone,
        errors: errors.length > 0 ? errors : undefined,
      });
    });

    return parsed;
  };

  // Verificar duplicados antes de importar
  const checkDuplicates = async () => {
    if (parsedLeads.length === 0) return;

    setCheckingDuplicates(true);
    try {
      const organizationId = await getUserOrganizationId();
      if (!organizationId) {
        toast({
          title: "Erro",
          description: "Organização não encontrada",
          variant: "destructive",
        });
        return;
      }

      // Buscar todos os leads existentes
      const { data: existing, error } = await supabase
        .from('post_sale_leads')
        .select('id, name, phone, company, email')
        .eq('organization_id', organizationId)
        .is('deleted_at', null);

      if (error) throw error;

      setExistingLeads(existing || []);

      // Verificar duplicados
      const updatedLeads = parsedLeads.map(lead => {
        if (lead.errors || !lead.normalizedPhone) return lead;

        const duplicates: string[] = [];
        const leadNormalizedPhone = lead.normalizedPhone;

        existing?.forEach((existingLead: any) => {
          const existingNormalizedPhone = normalizePhone(existingLead.phone);
          
          // Verificar por telefone
          if (leadNormalizedPhone.length >= 10 && 
              existingNormalizedPhone.length >= 10 &&
              leadNormalizedPhone === existingNormalizedPhone) {
            duplicates.push(`${existingLead.name}${existingLead.company ? ` (${existingLead.company})` : ''} - ${existingLead.phone}`);
          }
        });

        return {
          ...lead,
          isDuplicate: duplicates.length > 0,
          duplicateWith: duplicates,
        };
      });

      setParsedLeads(updatedLeads);
      const hasDuplicates = updatedLeads.some(l => l.isDuplicate);
      setDuplicatesFound(hasDuplicates);
      
      // Selecionar todos os duplicados por padrão para descartar
      const duplicateIndices = updatedLeads
        .map((l, i) => l.isDuplicate ? i : -1)
        .filter(i => i !== -1);
      setSelectedDuplicates(new Set(duplicateIndices));

      const duplicateCount = updatedLeads.filter(l => l.isDuplicate).length;
      if (duplicateCount > 0) {
        toast({
          title: "Duplicados encontrados",
          description: `${duplicateCount} cliente(s) já existem no sistema`,
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error('Erro ao verificar duplicados:', error);
      toast({
        title: "Erro",
        description: "Erro ao verificar duplicados",
        variant: "destructive",
      });
    } finally {
      setCheckingDuplicates(false);
    }
  };

  const handlePreview = async () => {
    if (!text.trim()) {
      toast({
        title: "Texto vazio",
        description: "Digite os dados dos clientes para visualizar",
        variant: "destructive",
      });
      return;
    }

    const parsed = parseText(text);
    setParsedLeads(parsed);
    
    const validCount = parsed.filter(p => !p.errors).length;
    const errorCount = parsed.filter(p => p.errors).length;

    if (errorCount > 0) {
      toast({
        title: "Erros encontrados",
        description: `${errorCount} linha(s) com erro. ${validCount} linha(s) válida(s).`,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Pré-visualização",
        description: `${validCount} cliente(s) pronto(s) para importar`,
      });
    }

    // Verificar duplicados automaticamente após preview
    if (validCount > 0) {
      await checkDuplicates();
    }
  };

  const handleImport = async () => {
    if (parsedLeads.length === 0) {
      toast({
        title: "Nenhum cliente para importar",
        description: "Faça a pré-visualização primeiro",
        variant: "destructive",
      });
      return;
    }

    if (!selectedStageId) {
      toast({
        title: "Etapa não selecionada",
        description: "Selecione uma etapa do pós-venda antes de importar",
        variant: "destructive",
      });
      return;
    }

    // Filtrar leads válidos e não duplicados (ou duplicados selecionados para importar)
    const validLeads = parsedLeads.filter((p, index) => {
      if (p.errors) return false;
      // Se é duplicado e não está selecionado, descartar
      if (p.isDuplicate && !selectedDuplicates.has(index)) return false;
      return true;
    });

    if (validLeads.length === 0) {
      toast({
        title: "Nenhum cliente para importar",
        description: "Todos os clientes foram descartados ou têm erros",
        variant: "destructive",
      });
      return;
    }

    setIsImporting(true);
    setImportResults(null);

    let successCount = 0;
    let errorCount = 0;

    for (const lead of validLeads) {
      try {
        // Normalizar telefone (remover caracteres não numéricos)
        const phoneDigits = lead.phone.replace(/\D/g, '');
        
        // Se não começar com código do país, adicionar 55 (Brasil)
        const normalizedPhone = phoneDigits.length === 11 && phoneDigits.startsWith('0')
          ? '55' + phoneDigits.substring(1)
          : phoneDigits.length === 10
          ? '55' + phoneDigits
          : phoneDigits.startsWith('55')
          ? phoneDigits
          : '55' + phoneDigits;

        await createLead({
          name: lead.name,
          phone: normalizedPhone,
          company: lead.company,
          stageId: selectedStageId,
          source: 'manual',
        });

        successCount++;
      } catch (error: any) {
        console.error(`Erro ao importar linha ${lead.lineNumber}:`, error);
        errorCount++;
      }
    }

    setImportResults({ success: successCount, errors: errorCount });
    
    if (successCount > 0) {
      await refetch();
      onImported?.();
      onSuccess?.();
      
      toast({
        title: "Importação concluída",
        description: `${successCount} cliente(s) importado(s) com sucesso${errorCount > 0 ? `. ${errorCount} erro(s).` : '.'}`,
      });
    } else {
      toast({
        title: "Erro na importação",
        description: `Nenhum cliente foi importado. ${errorCount} erro(s).`,
        variant: "destructive",
      });
    }

    setIsImporting(false);
  };

  const handleClose = () => {
    setOpen(false);
    setText("");
    setSelectedStageId("");
    setParsedLeads([]);
    setImportResults(null);
    setDuplicatesFound(false);
    setSelectedDuplicates(new Set());
    setExistingLeads([]);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Upload className="h-4 w-4" />
          Importar em Massa
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar Clientes em Massa</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Instruções */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Formato de Importação</CardTitle>
              <CardDescription>
                Digite os dados dos clientes, um por linha, no formato:
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-muted p-3 rounded-md font-mono text-sm">
                Nome da Empresa, Nome do Responsável, Telefone
              </div>
              <div className="mt-3 text-sm text-muted-foreground space-y-1">
                <p><strong>Exemplo:</strong></p>
                <p className="font-mono">Empresa ABC, João Silva, (21) 98765-4321</p>
                <p className="font-mono">Tech Solutions, Maria Santos, 11987654321</p>
                <p className="font-mono">Consultoria XYZ, Pedro Costa, 21 99876-5432</p>
              </div>
            </CardContent>
          </Card>

          {/* Seleção de Etapa */}
          <div className="space-y-2">
            <Label htmlFor="stage-select">Etapa do Pós-Venda *</Label>
            <Select value={selectedStageId} onValueChange={setSelectedStageId} disabled={stagesLoading}>
              <SelectTrigger id="stage-select">
                <SelectValue placeholder={stagesLoading ? "Carregando etapas..." : "Selecione uma etapa"} />
              </SelectTrigger>
              <SelectContent>
                {stages.map((stage) => (
                  <SelectItem key={stage.id} value={stage.id}>
                    {stage.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {stages.length === 0 && !stagesLoading && (
              <p className="text-xs text-muted-foreground">
                Nenhuma etapa encontrada. Crie uma etapa primeiro.
              </p>
            )}
          </div>

          {/* Área de texto */}
          <div className="space-y-2">
            <Label htmlFor="import-text">Dados dos Clientes</Label>
            <Textarea
              id="import-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Empresa ABC, João Silva, (21) 98765-4321&#10;Tech Solutions, Maria Santos, 11987654321&#10;Consultoria XYZ, Pedro Costa, 21 99876-5432"
              rows={10}
              className="font-mono text-sm"
            />
            <div className="flex gap-2">
              <Button onClick={handlePreview} variant="outline" disabled={!text.trim()}>
                Pré-visualizar
              </Button>
            </div>
          </div>

          {/* Pré-visualização */}
          {parsedLeads.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-sm">Pré-visualização</CardTitle>
                    <CardDescription>
                      {parsedLeads.filter((p, i) => !p.errors && (!p.isDuplicate || selectedDuplicates.has(i))).length} cliente(s) válido(s) de {parsedLeads.filter(p => !p.errors).length} total
                      {duplicatesFound && (
                        <span className="text-yellow-600 ml-2">
                          • {parsedLeads.filter(p => p.isDuplicate).length} duplicado(s) encontrado(s)
                        </span>
                      )}
                    </CardDescription>
                  </div>
                  {parsedLeads.filter(p => !p.errors).length > 0 && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={checkDuplicates}
                      disabled={checkingDuplicates}
                    >
                      {checkingDuplicates ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Verificando...
                        </>
                      ) : (
                        <>
                          Verificar Duplicados
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {duplicatesFound && (
                  <Alert className="mb-4 border-yellow-500 bg-yellow-50">
                    <AlertTriangle className="h-4 w-4 text-yellow-600" />
                    <AlertDescription className="text-yellow-800">
                      <strong>Duplicados encontrados!</strong> Desmarque os clientes duplicados que deseja descartar.
                      Clientes marcados serão importados mesmo sendo duplicados.
                    </AlertDescription>
                  </Alert>
                )}
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {parsedLeads.map((lead, index) => {
                    const isSelected = selectedDuplicates.has(index);
                    const willImport = !lead.errors && (!lead.isDuplicate || isSelected);
                    
                    return (
                      <div
                        key={index}
                        className={`p-3 rounded-md border ${
                          lead.errors
                            ? 'bg-destructive/10 border-destructive'
                            : lead.isDuplicate && !isSelected
                            ? 'bg-yellow-50 border-yellow-300 opacity-60'
                            : lead.isDuplicate
                            ? 'bg-yellow-50 border-yellow-500'
                            : 'bg-muted/50'
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          {lead.isDuplicate && !lead.errors && (
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={(checked) => {
                                const newSelected = new Set(selectedDuplicates);
                                if (checked) {
                                  newSelected.add(index);
                                } else {
                                  newSelected.delete(index);
                                }
                                setSelectedDuplicates(newSelected);
                              }}
                              className="mt-0.5"
                            />
                          )}
                          {lead.errors ? (
                            <XCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                          ) : lead.isDuplicate ? (
                            <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                          ) : (
                            <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <div className="text-sm font-medium">
                                {lead.company || <span className="text-muted-foreground">[Sem empresa]</span>}
                              </div>
                              {lead.isDuplicate && (
                                <Badge variant="outline" className="text-xs bg-yellow-100 text-yellow-800 border-yellow-300">
                                  Duplicado
                                </Badge>
                              )}
                              {!willImport && !lead.errors && (
                                <Badge variant="secondary" className="text-xs">
                                  Será descartado
                                </Badge>
                              )}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {lead.name || <span className="text-muted-foreground">[Sem nome]</span>} • {lead.phone || <span className="text-muted-foreground">[Sem telefone]</span>}
                            </div>
                            {lead.errors && (
                              <div className="mt-1 text-xs text-destructive">
                                {lead.errors.join(', ')}
                              </div>
                            )}
                            {lead.isDuplicate && lead.duplicateWith && lead.duplicateWith.length > 0 && (
                              <div className="mt-1 text-xs text-yellow-700">
                                <strong>Já existe:</strong> {lead.duplicateWith.join(', ')}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Resultados da importação */}
          {importResults && (
            <Alert>
              <AlertDescription>
                <div className="flex items-center gap-2">
                  {importResults.success > 0 && (
                    <div className="flex items-center gap-1 text-green-600">
                      <CheckCircle2 className="h-4 w-4" />
                      <span>{importResults.success} importado(s) com sucesso</span>
                    </div>
                  )}
                  {importResults.errors > 0 && (
                    <div className="flex items-center gap-1 text-destructive">
                      <XCircle className="h-4 w-4" />
                      <span>{importResults.errors} erro(s)</span>
                    </div>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Botões de ação */}
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={handleClose} disabled={isImporting}>
              Fechar
            </Button>
            <Button
              onClick={handleImport}
              disabled={isImporting || parsedLeads.filter((p, i) => !p.errors && (!p.isDuplicate || selectedDuplicates.has(i))).length === 0 || !selectedStageId}
            >
              {isImporting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Importando...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Importar {parsedLeads.filter((p, i) => !p.errors && (!p.isDuplicate || selectedDuplicates.has(i))).length} Cliente(s)
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
