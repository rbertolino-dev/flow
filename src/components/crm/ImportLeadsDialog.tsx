import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { normalizePhone, isValidBrazilianPhone } from "@/lib/phoneUtils";
import { getUserOrganizationId } from "@/lib/organizationUtils";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Upload, FileText, Copy, X, CheckCircle2, AlertCircle, Download, Info, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

interface ImportLeadsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLeadsImported: () => void;
  stages: Array<{ id: string; name: string; color: string }>;
  tags: Array<{ id: string; name: string; color: string }>;
}

interface ParsedContact {
  name: string;
  phone: string;
  email?: string;
  company?: string;
  value?: number;
  notes?: string;
}

interface ImportResult {
  success: number;
  failed: number;
  skipped: number;
  errors: Array<{ row: number; error: string }>;
}

export function ImportLeadsDialog({ open, onOpenChange, onLeadsImported, stages, tags }: ImportLeadsDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [importMode, setImportMode] = useState<"paste" | "csv">("paste");
  const [pasteText, setPasteText] = useState("");
  const [selectedStageId, setSelectedStageId] = useState<string>("");
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [parsedContacts, setParsedContacts] = useState<ParsedContact[]>([]);
  const [importProgress, setImportProgress] = useState(0);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [organizationLimits, setOrganizationLimits] = useState<{ maxLeads: number | null; currentLeads: number } | null>(null);
  const [checkDuplicates, setCheckDuplicates] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Carregar limites da organização ao abrir o dialog
  useEffect(() => {
    if (open) {
      loadOrganizationLimits();
      // Resetar estado
      setPasteText("");
      setSelectedStageId(stages[0]?.id || "");
      setSelectedTagIds([]);
      setParsedContacts([]);
      setImportProgress(0);
      setImportResult(null);
      setImportMode("paste");
    }
  }, [open, stages]);

  // Definir etapa padrão quando stages mudarem
  useEffect(() => {
    if (stages.length > 0 && !selectedStageId) {
      setSelectedStageId(stages[0].id);
    }
  }, [stages, selectedStageId]);

  const loadOrganizationLimits = async () => {
    try {
      const organizationId = await getUserOrganizationId();
      if (!organizationId) return;

      // Buscar limites usando a função RPC
      const { data: limitsData, error } = await supabase
        .rpc('get_organization_limits', { _org_id: organizationId });

      if (error) {
        console.error('Erro ao buscar limites:', error);
        // Se falhar, buscar contagem atual diretamente
        const { count } = await supabase
          .from('leads')
          .select('*', { count: 'exact', head: true })
          .eq('organization_id', organizationId)
          .is('deleted_at', null);

        setOrganizationLimits({
          maxLeads: null,
          currentLeads: count || 0,
        });
        return;
      }

      // A função retorna TABLE, então será um array
      if (limitsData && Array.isArray(limitsData) && limitsData.length > 0) {
        const limits = limitsData[0];
        setOrganizationLimits({
          maxLeads: limits.max_leads,
          currentLeads: Number(limits.current_leads_count) || 0,
        });
      } else {
        // Se não há limites, considerar ilimitado e buscar contagem atual
        const { count } = await supabase
          .from('leads')
          .select('*', { count: 'exact', head: true })
          .eq('organization_id', organizationId)
          .is('deleted_at', null);

        setOrganizationLimits({
          maxLeads: null,
          currentLeads: count || 0,
        });
      }
    } catch (error: any) {
      console.error('Erro ao carregar limites:', error);
    }
  };

  const parseCSVLine = (line: string): ParsedContact | null => {
    // Suporta CSV com aspas e vírgulas dentro dos campos
    const fields: string[] = [];
    let currentField = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          // Aspas duplas escapadas
          currentField += '"';
          i++; // Pular próxima aspas
        } else {
          // Toggle quotes
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        // Separador de campo
        fields.push(currentField.trim());
        currentField = "";
      } else {
        currentField += char;
      }
    }
    fields.push(currentField.trim()); // Último campo

    // Esperado: nome, telefone, email (opcional), empresa (opcional), valor (opcional), observações (opcional)
    if (fields.length < 2) return null;

    const name = fields[0]?.trim() || "";
    const phone = fields[1]?.trim() || "";
    const email = fields[2]?.trim() || "";
    const company = fields[3]?.trim() || "";
    const valueStr = fields[4]?.trim() || "";
    const notes = fields[5]?.trim() || "";

    if (!name || !phone) return null;

    const value = valueStr ? parseFloat(valueStr.replace(/[^\d.,]/g, '').replace(',', '.')) : undefined;

    return {
      name,
      phone,
      email: email || undefined,
      company: company || undefined,
      value: value && !isNaN(value) ? value : undefined,
      notes: notes || undefined,
    };
  };

  // Função melhorada para detectar telefone em uma string
  const extractPhone = (text: string): string | null => {
    // Extrai todos os dígitos
    const digits = text.replace(/\D/g, '');
    
    // Remove código do país se presente (55)
    let phoneDigits = digits;
    if (digits.startsWith('55') && digits.length >= 12) {
      phoneDigits = digits.substring(2);
    }
    
    // Telefone brasileiro válido: 10 ou 11 dígitos (DDD + número)
    if (phoneDigits.length === 10 || phoneDigits.length === 11) {
      return phoneDigits;
    }
    
    // Se tem 12 ou 13 dígitos com código do país, tenta remover
    if (digits.length === 12 || digits.length === 13) {
      const withoutCountry = digits.substring(2);
      if (withoutCountry.length === 10 || withoutCountry.length === 11) {
        return withoutCountry;
      }
    }
    
    return null;
  };

  // Função melhorada para detectar nome (tudo que não é telefone)
  const extractName = (text: string, phone: string): string => {
    let name = text;
    
    // Remove o telefone formatado de várias formas
    const phonePatterns = [
      // Padrões com formatação
      /\+?55\s*\(?\s*\d{2}\s*\)?\s*\d{4,5}\s*-?\s*\d{4}/g,
      /\(?\s*\d{2}\s*\)?\s*\d{4,5}\s*-?\s*\d{4}/g,
      // Apenas dígitos (10-13 dígitos)
      /\d{10,13}/g,
      // Com código do país
      /\+?55\s*\d{10,11}/g,
    ];
    
    phonePatterns.forEach(pattern => {
      name = name.replace(pattern, '');
    });
    
    // Remove separadores comuns e limpa
    name = name.replace(/[,\-|:;]/g, ' ').trim();
    name = name.replace(/\s+/g, ' ').trim();
    
    return name;
  };

  const parsePasteText = (text: string): ParsedContact[] => {
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    const contacts: ParsedContact[] = [];

    for (const line of lines) {
      // Primeiro, tenta extrair telefone
      const phone = extractPhone(line);
      if (!phone) continue;

      // Extrai o nome removendo o telefone
      const name = extractName(line, phone);
      if (!name || name.length < 2) continue;

      // Valida se é um telefone brasileiro válido
      if (!isValidBrazilianPhone(phone)) continue;

      contacts.push({
        name,
        phone: normalizePhone(phone),
        email: undefined,
        company: undefined,
        value: undefined,
        notes: undefined,
      });
    }

    return contacts;
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

      // Pular primeira linha se for cabeçalho
      const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
      const contacts: ParsedContact[] = [];

      // Verificar se primeira linha é cabeçalho (contém "nome", "telefone", etc)
      const firstLine = lines[0]?.toLowerCase() || "";
      const startIndex = (firstLine.includes('nome') || firstLine.includes('name') || firstLine.includes('telefone') || firstLine.includes('phone')) ? 1 : 0;

      for (let i = startIndex; i < lines.length; i++) {
        const contact = parseCSVLine(lines[i]);
        if (contact) {
          contacts.push(contact);
        }
      }

      if (contacts.length === 0) {
        toast({
          title: "Nenhum contato encontrado",
          description: "O arquivo CSV não contém contatos válidos",
          variant: "destructive",
        });
        return;
      }

      setParsedContacts(contacts);
      toast({
        title: `${contacts.length} contatos encontrados`,
        description: "Revise os contatos antes de importar",
      });
    };

    reader.readAsText(file, 'UTF-8');
  };

  const handleParsePaste = () => {
    if (!pasteText.trim()) {
      toast({
        title: "Texto vazio",
        description: "Cole a lista de contatos separada por vírgula",
        variant: "destructive",
      });
      return;
    }

    const contacts = parsePasteText(pasteText);
    
    if (contacts.length === 0) {
      toast({
        title: "Nenhum contato encontrado",
        description: "Formato inválido. Use: Nome, Telefone, Email (opcional), Empresa (opcional), Valor (opcional), Observações (opcional)",
        variant: "destructive",
      });
      return;
    }

    setParsedContacts(contacts);
    toast({
      title: `${contacts.length} contatos encontrados`,
      description: "Revise os contatos antes de importar",
    });
  };

  const validateContacts = (contacts: ParsedContact[]): { valid: ParsedContact[]; invalid: Array<{ contact: ParsedContact; error: string }> } => {
    const valid: ParsedContact[] = [];
    const invalid: Array<{ contact: ParsedContact; error: string }> = [];

    for (const contact of contacts) {
      if (!contact.name || contact.name.trim().length === 0) {
        invalid.push({ contact, error: "Nome é obrigatório" });
        continue;
      }

      if (!contact.phone || contact.phone.trim().length === 0) {
        invalid.push({ contact, error: "Telefone é obrigatório" });
        continue;
      }

      if (!isValidBrazilianPhone(contact.phone)) {
        invalid.push({ contact, error: "Telefone inválido" });
        continue;
      }

      if (contact.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email)) {
        invalid.push({ contact, error: "Email inválido" });
        continue;
      }

      valid.push(contact);
    }

    return { valid, invalid };
  };

  const downloadExampleCSV = () => {
    const csvContent = `Nome,Telefone,Email,Empresa,Valor,Observações
João Silva,11987654321,joao@exemplo.com,Empresa ABC,1500.00,Cliente interessado em produto X
Maria Santos,21998765432,maria@exemplo.com,Empresa XYZ,2500.00,Contato via site
Pedro Oliveira,31987654321,pedro@exemplo.com,,1000.00,
Ana Costa,41998765432,,Empresa DEF,500.00,Cliente VIP`;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'exemplo_importacao_contatos.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImport = async () => {
    if (parsedContacts.length === 0) {
      toast({
        title: "Nenhum contato para importar",
        description: "Parse os contatos primeiro",
        variant: "destructive",
      });
      return;
    }

    if (stages.length === 0) {
      toast({
        title: "Nenhuma etapa disponível",
        description: "Crie pelo menos uma etapa no funil antes de importar contatos",
        variant: "destructive",
      });
      return;
    }

    if (!selectedStageId) {
      toast({
        title: "Etapa não selecionada",
        description: "Selecione uma etapa do funil",
        variant: "destructive",
      });
      return;
    }

    const organizationId = await getUserOrganizationId();
    if (!organizationId) {
      toast({
        title: "Erro",
        description: "Usuário não pertence a uma organização",
        variant: "destructive",
      });
      return;
    }

    // Validar contatos
    const { valid, invalid } = validateContacts(parsedContacts);

    if (valid.length === 0) {
      toast({
        title: "Nenhum contato válido",
        description: "Corrija os erros antes de importar",
        variant: "destructive",
      });
      return;
    }

    // Verificar limites
    if (organizationLimits) {
      const { maxLeads, currentLeads } = organizationLimits;
      if (maxLeads !== null && currentLeads + valid.length > maxLeads) {
        const available = maxLeads - currentLeads;
        toast({
          title: "Limite de leads excedido",
          description: `Você pode importar no máximo ${available} contatos. Limite atual: ${currentLeads}/${maxLeads}`,
          variant: "destructive",
        });
        return;
      }
    }

    setLoading(true);
    setImportProgress(0);
    setImportResult(null);

    const result: ImportResult = {
      success: 0,
      failed: 0,
      skipped: 0,
      errors: [],
    };

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Processar em lotes de 10 para não sobrecarregar
      const batchSize = 10;
      const totalBatches = Math.ceil(valid.length / batchSize);

      for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
        const batchStart = batchIndex * batchSize;
        const batchEnd = Math.min(batchStart + batchSize, valid.length);
        const batch = valid.slice(batchStart, batchEnd);

        const batchPromises = batch.map(async (contact, index) => {
          const rowNumber = batchStart + index + 1;
          try {
            const normalizedPhone = normalizePhone(contact.phone);

            // Verificar se lead já existe (se checkDuplicates estiver ativado)
            if (checkDuplicates) {
              const { data: existingLead } = await supabase
                .from('leads')
                .select('id')
                .eq('organization_id', organizationId)
                .eq('phone', normalizedPhone)
                .is('deleted_at', null)
                .maybeSingle();

              if (existingLead) {
                result.skipped++;
                result.errors.push({ row: rowNumber, error: "Lead já existe" });
                return;
              }
            }

            // Criar lead
            const { data: leadId, error: createError } = await supabase
              .rpc('create_lead_secure', {
                p_org_id: organizationId,
                p_name: contact.name,
                p_phone: normalizedPhone,
                p_email: contact.email || null,
                p_company: contact.company || null,
                p_value: contact.value || null,
                p_stage_id: selectedStageId,
                p_notes: contact.notes || null,
                p_source: 'import',
              });

            if (createError) {
              result.failed++;
              result.errors.push({ row: rowNumber, error: createError.message });
              return;
            }

            // Adicionar tags se selecionadas
            if (selectedTagIds.length > 0 && leadId) {
              const tagPromises = selectedTagIds.map(tagId =>
                supabase
                  .from('lead_tags')
                  .insert({
                    lead_id: leadId,
                    tag_id: tagId,
                  })
                  .then(() => null)
                  .catch(() => null) // Ignorar erros de tags duplicadas
              );
              await Promise.all(tagPromises);
            }

            result.success++;
          } catch (error: any) {
            result.failed++;
            result.errors.push({ row: rowNumber, error: error.message || "Erro desconhecido" });
          }
        });

        await Promise.all(batchPromises);

        // Atualizar progresso
        const progress = Math.round((batchEnd / valid.length) * 100);
        setImportProgress(progress);
      }

      setImportResult(result);

      // Atualizar contagem de leads
      await loadOrganizationLimits();

      if (result.success > 0) {
        toast({
          title: "Importação concluída",
          description: `${result.success} contatos importados com sucesso${result.skipped > 0 ? `, ${result.skipped} já existiam` : ''}${result.failed > 0 ? `, ${result.failed} falharam` : ''}`,
        });
        onLeadsImported();
      } else {
        toast({
          title: "Nenhum contato importado",
          description: result.errors.length > 0 ? result.errors[0].error : "Erro desconhecido",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Erro na importação",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-w-[90vw] max-h-[85vh] p-0 flex flex-col">
        <DialogHeader className="px-4 pt-4 pb-3 border-b shrink-0">
          <DialogTitle className="text-lg font-semibold">Importar Contatos</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-4 py-3 min-h-0">
          <div className="space-y-4">
            {/* Limites da organização */}
            {organizationLimits && (
              <div className="p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-blue-700 dark:text-blue-300">Limite:</span>
                  <span className="font-semibold text-blue-900 dark:text-blue-100">
                    {organizationLimits.currentLeads} / {organizationLimits.maxLeads === null ? "Ilimitado" : organizationLimits.maxLeads}
                  </span>
                </div>
                {organizationLimits.maxLeads !== null && (
                  <Progress
                    value={(organizationLimits.currentLeads / organizationLimits.maxLeads) * 100}
                    className="h-1.5 mt-1.5"
                  />
                )}
              </div>
            )}

            {/* Modo de importação */}
            <Tabs value={importMode} onValueChange={(v) => setImportMode(v as "paste" | "csv")} className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="paste" className="flex items-center gap-2">
                  <Copy className="h-4 w-4" />
                  Colar Lista
                </TabsTrigger>
                <TabsTrigger value="csv" className="flex items-center gap-2">
                  <Upload className="h-4 w-4" />
                  Upload CSV
                </TabsTrigger>
              </TabsList>

              <TabsContent value="paste" className="space-y-2 mt-3">
                <div className="space-y-2">
                  <Label htmlFor="pasteText" className="text-xs font-medium">Cole os contatos (um por linha)</Label>
                  <Textarea
                    id="pasteText"
                    value={pasteText}
                    onChange={(e) => setPasteText(e.target.value)}
                    placeholder="Exemplos aceitos:&#10;&#10;Maria Silva, (11) 98765-4321&#10;21987654321, João Santos&#10;Ana Costa - 11999998888&#10;11988887777 | Pedro Oliveira&#10;Carlos Lima: (21) 99999-8888&#10;+5511987654321 Juliana"
                    rows={6}
                    className="font-mono text-xs resize-none"
                    spellCheck={false}
                  />
                  <p className="text-xs text-muted-foreground">
                    <strong>Formatos:</strong> Nome, Tel | Tel, Nome | Nome - Tel | Nome: Tel | +55Tel Nome
                  </p>
                  <div className="flex items-center space-x-2 p-2 rounded bg-muted/50">
                    <Checkbox
                      id="check-duplicates"
                      checked={checkDuplicates}
                      onCheckedChange={(checked) => setCheckDuplicates(Boolean(checked))}
                    />
                    <Label htmlFor="check-duplicates" className="text-xs font-medium cursor-pointer">
                      Verificar duplicados
                    </Label>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="sm" 
                      onClick={handleParsePaste} 
                      disabled={!pasteText.trim()}
                      className="flex-1 text-xs"
                    >
                      Visualizar
                    </Button>
                    <Button
                      type="button"
                      variant="default"
                      size="sm"
                      onClick={handleImport}
                      disabled={loading || parsedContacts.length === 0 || stages.length === 0 || !selectedStageId}
                      className="flex-1 text-xs"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                          Importando...
                        </>
                      ) : (
                        <>
                          <Upload className="h-3 w-3 mr-1" />
                          Importar {parsedContacts.length}
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="csv" className="space-y-2 mt-3">
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Selecione o arquivo CSV</Label>
                  <div className="flex gap-2">
                    <Input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                    <Button
                      type="button"
                      variant="default"
                      onClick={() => fileInputRef.current?.click()}
                      size="sm"
                      className="flex-1 text-xs"
                    >
                      <Upload className="h-3 w-3 mr-1" />
                      Selecionar CSV
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={downloadExampleCSV}
                      size="sm"
                      className="text-xs"
                    >
                      <Download className="h-3 w-3 mr-1" />
                      Exemplo
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Colunas: Nome, Telefone, Email, Empresa, Valor, Observações
                  </p>
                </div>
              </TabsContent>
            </Tabs>

            <Separator />

            {/* Contatos parseados */}
            {parsedContacts.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Label className="text-xs font-medium">{parsedContacts.length} contatos</Label>
                    <Badge variant="secondary" className="text-xs px-1.5 py-0">{parsedContacts.length}</Badge>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setParsedContacts([])}
                    className="h-7 px-2"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
                <div className="max-h-[180px] overflow-y-auto border rounded p-2 space-y-1.5">
                  {parsedContacts.map((contact, index) => (
                    <div key={index} className="p-2 bg-muted rounded border text-xs">
                      <div className="font-medium truncate">{contact.name}</div>
                      <div className="text-muted-foreground">📞 {contact.phone}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Separator />

            {/* Configurações de importação */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Seleção de etapa */}
              <div className="space-y-2">
                <Label htmlFor="stage" className="text-xs font-medium">Etapa do Funil *</Label>
                <Select value={selectedStageId} onValueChange={setSelectedStageId}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Selecione a etapa" />
                  </SelectTrigger>
                  <SelectContent>
                    {stages.map((stage) => (
                      <SelectItem key={stage.id} value={stage.id}>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: stage.color }}
                          />
                          {stage.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {stages.length === 0 && (
                  <p className="text-xs text-amber-600">
                    Crie uma etapa no funil primeiro
                  </p>
                )}
              </div>

              {/* Seleção de tags */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Tags (opcional)</Label>
                <div className="max-h-[80px] overflow-y-auto border rounded p-2">
                  {tags.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-2">Nenhuma tag</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {tags.map((tag) => (
                        <div key={tag.id} className="flex items-center gap-1">
                          <Checkbox
                            id={`tag-${tag.id}`}
                            checked={selectedTagIds.includes(tag.id)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedTagIds([...selectedTagIds, tag.id]);
                              } else {
                                setSelectedTagIds(selectedTagIds.filter(id => id !== tag.id));
                              }
                            }}
                            className="h-3 w-3"
                          />
                          <Label
                            htmlFor={`tag-${tag.id}`}
                            className="cursor-pointer"
                          >
                            <Badge
                              variant="outline"
                              style={{ borderColor: tag.color, color: tag.color }}
                              className="cursor-pointer text-xs px-1.5 py-0"
                            >
                              {tag.name}
                            </Badge>
                          </Label>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

              <Separator />

            {/* Progresso da importação */}
            {loading && (
              <div className="space-y-1.5 p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded">
                <div className="flex items-center justify-between text-xs font-medium text-blue-900 dark:text-blue-100">
                  <span>Importando...</span>
                  <span>{importProgress}%</span>
                </div>
                <Progress value={importProgress} className="h-1.5" />
              </div>
            )}

            {/* Resultado da importação */}
            {importResult && !loading && (
              <div className="space-y-2 p-3 border rounded bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800">
                <div className="flex items-center gap-1.5 font-medium text-sm">
                  {importResult.success > 0 && (
                    <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                  )}
                  {importResult.failed > 0 && (
                    <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                  )}
                  Resultado
                </div>
                <div className="space-y-1 text-xs">
                  <div className="flex items-center gap-1.5 text-green-700 dark:text-green-300">
                    <CheckCircle2 className="h-3 w-3" />
                    <span>{importResult.success} importados</span>
                  </div>
                  {importResult.skipped > 0 && (
                    <div className="flex items-center gap-1.5 text-yellow-700 dark:text-yellow-300">
                      <AlertCircle className="h-3 w-3" />
                      <span>{importResult.skipped} duplicados</span>
                    </div>
                  )}
                  {importResult.failed > 0 && (
                    <div className="flex items-center gap-1.5 text-red-700 dark:text-red-300">
                      <AlertCircle className="h-3 w-3" />
                      <span>{importResult.failed} falharam</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer apenas para modo CSV */}
        {importMode === "csv" && (
          <DialogFooter className="px-4 py-3 border-t bg-muted/50 shrink-0 gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} size="sm" className="text-xs">
              Fechar
            </Button>
            <Button
              type="button"
              onClick={handleImport}
              disabled={loading || parsedContacts.length === 0 || stages.length === 0 || !selectedStageId}
              size="sm"
              className="text-xs"
            >
              {loading ? (
                <>
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  Importando...
                </>
              ) : (
                <>
                  <Upload className="h-3 w-3 mr-1" />
                  Importar {parsedContacts.length}
                </>
              )}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

