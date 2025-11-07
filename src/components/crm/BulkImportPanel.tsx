import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { normalizePhone } from "@/lib/phoneUtils";
import { Upload, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePipelineStages } from "@/hooks/usePipelineStages";
import { Badge } from "@/components/ui/badge";
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
  const { toast } = useToast();
  const { stages, loading: stagesLoading } = usePipelineStages();

  const parseContacts = (text: string): ParsedContact[] => {
    if (!text.trim()) return [];

    const lines = text.split('\n').filter(line => line.trim());
    const contacts: ParsedContact[] = [];

    for (const line of lines) {
      // Suporta formatos: "Nome, Telefone" ou "Nome - Telefone" ou "Nome | Telefone" ou "Nome;Telefone"
      const separators = [',', '-', '|', ';'];
      let parts: string[] = [];
      
      for (const sep of separators) {
        if (line.includes(sep)) {
          parts = line.split(sep).map(p => p.trim());
          break;
        }
      }

      if (parts.length < 2) {
        // Tentar extrair telefone do texto
        const phoneMatch = line.match(/(\d[\d\s\-\(\)]{8,})/);
        if (phoneMatch) {
          const phone = phoneMatch[1];
          const name = line.replace(phone, '').trim();
          parts = [name, phone];
        }
      }

      if (parts.length >= 2) {
        const name = parts[0].trim();
        const phone = normalizePhone(parts[1].trim());
        
        let valid = true;
        let error: string | undefined;

        if (!name) {
          valid = false;
          error = "Nome vazio";
        } else if (!phone || phone.length < 10) {
          valid = false;
          error = "Telefone inválido";
        } else if (!phone.startsWith('55')) {
          valid = false;
          error = "Apenas telefones brasileiros (+55)";
        }

        contacts.push({ name, phone, valid, error });
      } else {
        contacts.push({
          name: line,
          phone: "",
          valid: false,
          error: "Formato inválido"
        });
      }
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
    const validContacts = preview.filter(c => c.valid);
    
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

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const orgId = await getUserOrganizationId();
      if (!orgId) throw new Error("Organização não encontrada");

      let successCount = 0;
      let errorCount = 0;

      for (const contact of validContacts) {
        try {
          // Verificar se o lead já existe
          const { data: existingLead } = await (supabase as any)
            .from('leads')
            .select('id')
            .eq('phone', contact.phone)
            .eq('user_id', user.id)
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
            // Criar novo lead
            const { data: newLead, error: leadError } = await (supabase as any)
              .from('leads')
              .insert({
                name: contact.name,
                phone: contact.phone,
                source: 'Manual',
                status: 'new',
                user_id: user.id,
                organization_id: orgId,
                assigned_to: user.email,
                stage_id: showStageSelector ? selectedStageId : null,
              })
              .select('id')
              .single();

            if (leadError) throw leadError;
            leadId = newLead.id;
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

      toast({
        title: "Importação concluída",
        description: `${successCount} contatos adicionados à fila. ${errorCount > 0 ? `${errorCount} erros.` : ''}`,
      });

      setInputText("");
      setPreview([]);
      setSelectedStageId("");
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Importação em Massa
        </CardTitle>
        <CardDescription>
          Cole uma lista de contatos para adicionar rapidamente à fila de ligações
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="text-sm font-medium mb-2 block">
            Cole os contatos (um por linha)
          </label>
          <Textarea
            placeholder="Exemplo:&#10;Maria Silva, (11) 98765-4321&#10;João Santos, 21987654321&#10;Ana Costa - 11999998888"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            className="min-h-[200px] font-mono text-sm"
          />
          <p className="text-xs text-muted-foreground mt-2">
            Formatos aceitos: Nome, Telefone | Nome - Telefone | Nome; Telefone
          </p>
        </div>

        {showStageSelector && (
          <div className="space-y-2">
            <label className="text-sm font-medium">Etapa do Funil *</label>
            <Select value={selectedStageId} onValueChange={setSelectedStageId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a etapa inicial" />
              </SelectTrigger>
              <SelectContent className="bg-popover z-50">
                {stages.map((stage) => (
                  <SelectItem key={stage.id} value={stage.id}>
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: stage.color }}
                      />
                      {stage.name}
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

        <div className="flex gap-2">
          <Button 
            onClick={handlePreview} 
            variant="outline"
            disabled={!inputText.trim()}
          >
            Visualizar
          </Button>
          <Button 
            onClick={handleImport}
            disabled={preview.length === 0 || importing || !preview.some(c => c.valid) || (showStageSelector && !selectedStageId)}
          >
            {importing ? "Importando..." : `Importar ${preview.filter(c => c.valid).length} contatos`}
          </Button>
        </div>

        {preview.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">
              Preview ({preview.filter(c => c.valid).length} válidos de {preview.length})
            </h4>
            <div className="max-h-[300px] overflow-y-auto space-y-2">
              {preview.map((contact, idx) => (
                <Alert key={idx} variant={contact.valid ? "default" : "destructive"}>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="flex items-center justify-between">
                    <div>
                      <strong>{contact.name || "(sem nome)"}</strong>
                      {contact.phone && <span className="ml-2 text-muted-foreground">{contact.phone}</span>}
                    </div>
                    {!contact.valid && (
                      <span className="text-xs text-destructive">{contact.error}</span>
                    )}
                  </AlertDescription>
                </Alert>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
