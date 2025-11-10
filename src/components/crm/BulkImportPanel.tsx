import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { normalizePhone } from "@/lib/phoneUtils";
import { Upload, AlertCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePipelineStages } from "@/hooks/usePipelineStages";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { getUserOrganizationId } from "@/lib/organizationUtils";

interface BulkImportPanelProps {
  onImportComplete: () => void;
  showStageSelector?: boolean;
}

interface ParsedContact {
  name: string;
  phone: string;
  valid: boolean;
  error?: string;
}

export function BulkImportPanel({ onImportComplete, showStageSelector = false }: BulkImportPanelProps) {
  const [inputText, setInputText] = useState("");
  const [importing, setImporting] = useState(false);
  const [preview, setPreview] = useState<ParsedContact[]>([]);
  const [selectedStageId, setSelectedStageId] = useState<string>("");
  const [currentPage, setCurrentPage] = useState(1);
  const [checkDuplicates, setCheckDuplicates] = useState(true);
  const [duplicatesRemoved, setDuplicatesRemoved] = useState(0);
  const itemsPerPage = 10;
  const { toast } = useToast();
  const { stages, loading: stagesLoading } = usePipelineStages();

  const parseContacts = (text: string): ParsedContact[] => {
    if (!text.trim()) return [];

    const lines = text.split('\n').filter(line => line.trim());
    const contacts: ParsedContact[] = [];

    for (const line of lines) {
      let name = '';
      let rawPhone = '';

      // Tentar detectar padrões mais flexíveis
      // Padrão 1: Separadores comuns (vírgula, ponto-e-vírgula, hífen, pipe, tab)
      const separatorMatch = line.match(/^(.+?)\s*[,;\-|:\t]\s*(.+)$/);
      
      if (separatorMatch) {
        // Verificar qual parte é o telefone
        const part1 = separatorMatch[1].trim();
        const part2 = separatorMatch[2].trim();
        
        const part1HasPhone = /\d/.test(part1);
        const part2HasPhone = /\d/.test(part2);
        
        // Se ambos tiverem números, escolher o que tem mais dígitos
        if (part1HasPhone && part2HasPhone) {
          const part1Digits = (part1.match(/\d/g) || []).length;
          const part2Digits = (part2.match(/\d/g) || []).length;
          
          if (part1Digits > part2Digits) {
            rawPhone = part1;
            name = part2;
          } else {
            name = part1;
            rawPhone = part2;
          }
        } else if (part1HasPhone) {
          // Telefone, Nome (ordem invertida)
          rawPhone = part1;
          name = part2;
        } else if (part2HasPhone) {
          // Nome, Telefone (ordem normal)
          name = part1;
          rawPhone = part2;
        }
      } else {
        // Padrão 2: Apenas espaços - pegar números como telefone
        const phoneMatch = line.match(/(\+?\d[\d\s\(\)\-\.]{8,})/);
        if (phoneMatch) {
          rawPhone = phoneMatch[1];
          name = line.replace(rawPhone, '').trim();
        } else {
          // Linha sem número detectável
          contacts.push({
            name: line.trim(),
            phone: "",
            valid: false,
            error: "Telefone não encontrado"
          });
          continue;
        }
      }

      // Normalizar telefone
      const phone = normalizePhone(rawPhone);
      
      // Validação
      let valid = true;
      let error: string | undefined;

      if (!name) {
        name = phone; // Usar telefone como nome se não tiver nome
      }
      
      if (!phone || phone.length < 10) {
        valid = false;
        error = "Telefone inválido ou muito curto";
      } else if (!phone.startsWith('55') && phone.length < 10) {
        valid = false;
        error = "Telefone deve ter DDI +55 ou pelo menos 10 dígitos";
      }

      contacts.push({ name: name.trim(), phone, valid, error });
    }

    return contacts;
  };

  const handlePreview = () => {
    const parsed = parseContacts(inputText);
    setPreview(parsed);
    
    if (parsed.length === 0) {
      toast({
        title: "Nenhum contato encontrado",
        description: "Cole os contatos no formato: Nome, Telefone",
        variant: "destructive",
      });
    }
  };

  const handleImport = async () => {
    let validContacts = preview.filter(c => c.valid);
    
    if (validContacts.length === 0) {
      toast({
        title: "Nenhum contato válido",
        description: "Corrija os erros antes de importar",
        variant: "destructive",
      });
      return;
    }

    if (showStageSelector && !selectedStageId) {
      toast({
        title: "Selecione uma etapa",
        description: "Escolha a etapa do funil para os leads importados",
        variant: "destructive",
      });
      return;
    }

    setImporting(true);
    setDuplicatesRemoved(0);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const orgId = await getUserOrganizationId();
      if (!orgId) throw new Error("Usuário não pertence a uma organização");

      // Verificar duplicados se a opção estiver ativada
      if (checkDuplicates) {
        const phones = validContacts.map(c => c.phone);
        
        const { data: existingLeads } = await (supabase as any)
          .from('leads')
          .select('phone')
          .eq('organization_id', orgId)
          .is('deleted_at', null)
          .in('phone', phones);

        if (existingLeads && existingLeads.length > 0) {
          const existingPhones = new Set(existingLeads.map((l: any) => l.phone));
          const beforeCount = validContacts.length;
          validContacts = validContacts.filter(c => !existingPhones.has(c.phone));
          const removed = beforeCount - validContacts.length;
          
          if (removed > 0) {
            setDuplicatesRemoved(removed);
            toast({
              title: "Duplicados removidos",
              description: `${removed} contato(s) já cadastrado(s) no funil foram removidos da importação`,
            });
          }

          if (validContacts.length === 0) {
            toast({
              title: "Nenhum contato novo",
              description: "Todos os contatos já estão cadastrados no funil",
              variant: "destructive",
            });
            setImporting(false);
            return;
          }
        }
      }

      let successCount = 0;
      let errorCount = 0;

      for (const contact of validContacts) {
        try {
          // Verificar se o lead já existe
          const { data: existingLead } = await (supabase as any)
            .from('leads')
            .select('id')
            .eq('phone', contact.phone)
            .eq('organization_id', orgId)
            .is('deleted_at', null)
            .maybeSingle();

          let leadId: string;

          if (existingLead) {
            leadId = existingLead.id;
            
            // Se tiver seletor de etapa, atualizar a etapa do lead existente
            if (showStageSelector && selectedStageId) {
              await (supabase as any)
                .from('leads')
                .update({ stage_id: selectedStageId })
                .eq('id', leadId);
            }
          } else {
            // Criar novo lead via RPC segura
            const { data: newLeadId, error: leadError } = await supabase.rpc('create_lead_secure', {
              p_org_id: orgId,
              p_name: contact.name,
              p_phone: contact.phone,
              p_email: null,
              p_company: null,
              p_value: null,
              p_stage_id: showStageSelector ? selectedStageId : null,
              p_notes: 'Importado em massa',
              p_source: 'manual',
            });

            if (leadError) throw leadError;
            leadId = newLeadId as string;
          }

          // Adicionar à fila de chamadas
          const scheduledFor = new Date();
          scheduledFor.setHours(scheduledFor.getHours() + 1);

          const { error: queueError } = await (supabase as any)
            .from('call_queue')
            .insert({
              lead_id: leadId,
              organization_id: orgId,
              scheduled_for: scheduledFor.toISOString(),
              priority: 'medium',
              status: 'pending',
              notes: 'Importado em massa',
            });

          if (queueError) throw queueError;
          successCount++;
        } catch (error) {
          console.error(`Erro ao importar ${contact.name}:`, error);
          errorCount++;
        }
      }

      const duplicatesMsg = duplicatesRemoved > 0 ? ` ${duplicatesRemoved} duplicado(s) removido(s).` : '';
      
      toast({
        title: "Importação concluída",
        description: `${successCount} contatos adicionados à fila.${duplicatesMsg} ${errorCount > 0 ? `${errorCount} erros.` : ''}`,
      });

      setInputText("");
      setPreview([]);
      setSelectedStageId("");
      setCurrentPage(1);
      setDuplicatesRemoved(0);
      onImportComplete();
    } catch (error: any) {
      toast({
        title: "Erro na importação",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setImporting(false);
    }
  };

  const totalPages = Math.ceil(preview.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentPageData = preview.slice(startIndex, endIndex);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  return (
    <Card className="w-full">
      <CardHeader className="space-y-1 p-4 sm:p-6">
        <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
          <Upload className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
          <span className="truncate">Importação em Massa</span>
        </CardTitle>
        <CardDescription className="text-xs sm:text-sm">
          Cole uma lista de contatos para adicionar rapidamente à fila de ligações
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 p-4 sm:p-6">
        <div>
          <label className="text-xs sm:text-sm font-medium mb-2 block">
            Cole os contatos (um por linha)
          </label>
          <Textarea
            placeholder="Exemplos aceitos:&#10;Maria Silva, (11) 98765-4321&#10;21987654321, João Santos&#10;Ana Costa - 11999998888&#10;11988887777 | Pedro Oliveira&#10;Carlos Lima: (21) 99999-8888&#10;+5511987654321 Juliana"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            className="min-h-[150px] sm:min-h-[200px] font-mono text-xs sm:text-sm"
          />
          <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
            <strong>Formatos aceitos:</strong> Nome, Tel | Tel, Nome | Nome - Tel | Nome; Tel | Nome: Tel | +55Tel Nome
            <br className="hidden sm:block" />
            <strong>Ordem flexível:</strong> O sistema detecta automaticamente qual parte é o nome e qual é o telefone
          </p>
        </div>

        <div className="flex items-center space-x-2 p-3 rounded-lg bg-muted/50">
          <Checkbox
            id="check-duplicates"
            checked={checkDuplicates}
            onCheckedChange={(checked) => setCheckDuplicates(checked as boolean)}
          />
          <label
            htmlFor="check-duplicates"
            className="text-xs sm:text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
          >
            Verificar e remover contatos já cadastrados no funil
          </label>
        </div>

        {showStageSelector && (
          <div className="space-y-2">
            <label className="text-xs sm:text-sm font-medium">Etapa do Funil *</label>
            <Select value={selectedStageId} onValueChange={setSelectedStageId}>
              <SelectTrigger className="text-xs sm:text-sm">
                <SelectValue placeholder="Selecione a etapa inicial" />
              </SelectTrigger>
              <SelectContent className="bg-popover z-50">
                {stages.map((stage) => (
                  <SelectItem key={stage.id} value={stage.id} className="text-xs sm:text-sm">
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full flex-shrink-0" 
                        style={{ backgroundColor: stage.color }}
                      />
                      <span className="truncate">{stage.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Todos os leads importados serão adicionados nesta etapa
            </p>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-2">
          <Button 
            onClick={handlePreview} 
            variant="outline"
            disabled={!inputText.trim()}
            className="w-full sm:w-auto text-xs sm:text-sm"
          >
            Visualizar
          </Button>
          <Button 
            onClick={handleImport}
            disabled={preview.length === 0 || importing || !preview.some(c => c.valid) || (showStageSelector && !selectedStageId)}
            className="w-full sm:w-auto text-xs sm:text-sm"
          >
            {importing ? "Importando..." : `Importar ${preview.filter(c => c.valid).length} contatos`}
          </Button>
        </div>

        {preview.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs sm:text-sm font-medium">
                Preview ({preview.filter(c => c.valid).length} válidos de {preview.length})
              </h4>
              {totalPages > 1 && (
                <div className="flex items-center gap-1 sm:gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="h-7 w-7 p-0 sm:h-8 sm:w-8"
                  >
                    <ChevronLeft className="h-3 w-3 sm:h-4 sm:w-4" />
                  </Button>
                  <span className="text-xs sm:text-sm text-muted-foreground min-w-[60px] sm:min-w-[80px] text-center">
                    {currentPage} de {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="h-7 w-7 p-0 sm:h-8 sm:w-8"
                  >
                    <ChevronRight className="h-3 w-3 sm:h-4 sm:w-4" />
                  </Button>
                </div>
              )}
            </div>
            
            <div className="max-h-[300px] sm:max-h-[400px] overflow-y-auto space-y-2">
              {currentPageData.map((contact, idx) => (
                <Alert key={startIndex + idx} variant={contact.valid ? "default" : "destructive"} className="py-2 sm:py-3">
                  <AlertCircle className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0 mt-0.5" />
                  <AlertDescription className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-2">
                    <div className="flex-1 min-w-0">
                      <strong className="text-xs sm:text-sm block sm:inline truncate">
                        {contact.name || "(sem nome)"}
                      </strong>
                      {contact.phone && (
                        <span className="ml-0 sm:ml-2 text-xs text-muted-foreground block sm:inline truncate">
                          {contact.phone}
                        </span>
                      )}
                    </div>
                    {!contact.valid && (
                      <Badge variant="destructive" className="text-[10px] sm:text-xs self-start sm:self-auto whitespace-nowrap">
                        {contact.error}
                      </Badge>
                    )}
                  </AlertDescription>
                </Alert>
              ))}
            </div>

            {totalPages > 1 && (
              <div className="flex justify-center pt-2">
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                    <Button
                      key={page}
                      variant={currentPage === page ? "default" : "outline"}
                      size="sm"
                      onClick={() => handlePageChange(page)}
                      className="h-7 w-7 p-0 text-xs sm:h-8 sm:w-8 sm:text-sm"
                    >
                      {page}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
