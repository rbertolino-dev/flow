import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { normalizePhone, isValidBrazilianPhone } from "@/lib/phoneUtils";
import { getUserOrganizationId } from "@/lib/organizationUtils";
import { Progress } from "@/components/ui/progress";
import { Loader2, CheckCircle2, AlertCircle, Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { usePostSaleStages } from "@/hooks/usePostSaleStages";

interface BulkImportPostSaleLeadsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLeadsImported: () => void;
}

interface ParsedContact {
  company: string;
  name: string;
  phone: string;
  row: number;
}

interface ImportResult {
  success: number;
  failed: number;
  errors: Array<{ row: number; error: string }>;
}

export function BulkImportPostSaleLeadsDialog({ 
  open, 
  onOpenChange, 
  onLeadsImported 
}: BulkImportPostSaleLeadsDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [parsedContacts, setParsedContacts] = useState<ParsedContact[]>([]);
  const [importProgress, setImportProgress] = useState(0);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const { stages } = usePostSaleStages();

  useEffect(() => {
    if (open) {
      setPasteText("");
      setParsedContacts([]);
      setImportProgress(0);
      setImportResult(null);
    }
  }, [open]);

  const parseContacts = (text: string): ParsedContact[] => {
    const lines = text.split('\n').filter(line => line.trim());
    const contacts: ParsedContact[] = [];

    lines.forEach((line, index) => {
      const trimmed = line.trim();
      if (!trimmed) return;

      // Formato: empresa, responsável, telefone (separados por vírgula)
      const parts = trimmed.split(',').map(p => p.trim()).filter(p => p);
      
      if (parts.length < 3) {
        contacts.push({
          company: parts[0] || '',
          name: parts[1] || '',
          phone: parts[2] || '',
          row: index + 1,
        });
      } else {
        contacts.push({
          company: parts[0] || '',
          name: parts[1] || '',
          phone: parts[2] || '',
          row: index + 1,
        });
      }
    });

    return contacts;
  };

  const handleParse = () => {
    if (!pasteText.trim()) {
      toast({
        title: "Texto vazio",
        description: "Cole os dados dos clientes no formato: empresa, responsável, telefone",
        variant: "destructive",
      });
      return;
    }

    const contacts = parseContacts(pasteText);
    
    // Validar contatos
    const valid: ParsedContact[] = [];
    const errors: Array<{ row: number; error: string }> = [];

    contacts.forEach((contact) => {
      if (!contact.company || !contact.name || !contact.phone) {
        errors.push({
          row: contact.row,
          error: "Dados incompletos (empresa, responsável e telefone são obrigatórios)",
        });
        return;
      }

      const normalizedPhone = normalizePhone(contact.phone);
      if (!isValidBrazilianPhone(normalizedPhone)) {
        errors.push({
          row: contact.row,
          error: "Telefone inválido",
        });
        return;
      }

      valid.push({
        ...contact,
        phone: normalizedPhone,
      });
    });

    setParsedContacts(valid);
    
    if (errors.length > 0) {
      toast({
        title: "Alguns contatos têm erros",
        description: `${valid.length} válidos, ${errors.length} com erros`,
        variant: errors.length === contacts.length ? "destructive" : "default",
      });
    } else {
      toast({
        title: "Contatos parseados",
        description: `${valid.length} contatos prontos para importar`,
      });
    }
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

    setLoading(true);
    setImportProgress(0);
    setImportResult(null);

    try {
      const organizationId = await getUserOrganizationId();
      if (!organizationId) {
        throw new Error("Organização não encontrada");
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error("Usuário não autenticado");
      }

      // Pegar primeira etapa disponível
      const defaultStageId = stages.length > 0 ? stages[0].id : null;

      const result: ImportResult = {
        success: 0,
        failed: 0,
        errors: [],
      };

      // Processar em lotes de 10
      const batchSize = 10;
      const totalBatches = Math.ceil(parsedContacts.length / batchSize);

      for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
        const batchStart = batchIndex * batchSize;
        const batchEnd = Math.min(batchStart + batchSize, parsedContacts.length);
        const batch = parsedContacts.slice(batchStart, batchEnd);

        const batchPromises = batch.map(async (contact) => {
          try {
            // Verificar se já existe (por telefone)
            const { data: existing } = await supabase
              .from('post_sale_leads')
              .select('id')
              .eq('organization_id', organizationId)
              .eq('phone', contact.phone)
              .is('deleted_at', null)
              .maybeSingle();

            if (existing) {
              result.failed++;
              result.errors.push({
                row: contact.row,
                error: "Cliente já existe (mesmo telefone)",
              });
              return;
            }

            // Criar novo lead de pós-venda
            const { error: createError } = await supabase
              .from('post_sale_leads')
              .insert({
                organization_id: organizationId,
                name: contact.name,
                phone: contact.phone,
                company: contact.company,
                stage_id: defaultStageId,
                source: 'import',
                status: 'new',
              });

            if (createError) throw createError;

            result.success++;
          } catch (error: any) {
            result.failed++;
            result.errors.push({
              row: contact.row,
              error: error.message || "Erro ao criar cliente",
            });
          }
        });

        await Promise.all(batchPromises);
        setImportProgress(Math.round(((batchIndex + 1) / totalBatches) * 100));
      }

      setImportResult(result);

      if (result.success > 0) {
        toast({
          title: "Importação concluída",
          description: `${result.success} clientes importados com sucesso${result.failed > 0 ? `, ${result.failed} falharam` : ''}`,
        });
        onLeadsImported();
      } else {
        toast({
          title: "Importação falhou",
          description: "Nenhum cliente foi importado",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error('Erro na importação:', error);
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
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar Clientes em Massa - Pós-Venda</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              <strong>Formato:</strong> Uma linha por cliente, separado por vírgula:<br />
              <code className="text-xs">Nome da Empresa, Nome do Responsável, Telefone</code><br />
              <br />
              <strong>Exemplo:</strong><br />
              <code className="text-xs">
                Empresa ABC, João Silva, (21) 98765-4321<br />
                Empresa XYZ, Maria Santos, 11987654321
              </code>
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label htmlFor="paste-text">Cole os dados dos clientes:</Label>
            <Textarea
              id="paste-text"
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder="Empresa ABC, João Silva, (21) 98765-4321&#10;Empresa XYZ, Maria Santos, 11987654321"
              rows={10}
              className="font-mono text-sm"
            />
          </div>

          <div className="flex gap-2">
            <Button onClick={handleParse} disabled={!pasteText.trim() || loading}>
              Parsear Contatos
            </Button>
            {parsedContacts.length > 0 && (
              <Button onClick={handleImport} disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Importando...
                  </>
                ) : (
                  `Importar ${parsedContacts.length} Cliente(s)`
                )}
              </Button>
            )}
          </div>

          {loading && (
            <div className="space-y-2">
              <Progress value={importProgress} />
              <p className="text-sm text-muted-foreground text-center">
                {importProgress}% concluído
              </p>
            </div>
          )}

          {parsedContacts.length > 0 && !loading && (
            <div className="space-y-2">
              <p className="text-sm font-medium">
                {parsedContacts.length} contato(s) pronto(s) para importar
              </p>
              <div className="max-h-40 overflow-y-auto border rounded p-2 space-y-1">
                {parsedContacts.slice(0, 10).map((contact, index) => (
                  <div key={index} className="text-xs text-muted-foreground">
                    {contact.company} - {contact.name} - {contact.phone}
                  </div>
                ))}
                {parsedContacts.length > 10 && (
                  <div className="text-xs text-muted-foreground">
                    ... e mais {parsedContacts.length - 10} contato(s)
                  </div>
                )}
              </div>
            </div>
          )}

          {importResult && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                {importResult.success > 0 && (
                  <div className="flex items-center gap-1 text-green-600">
                    <CheckCircle2 className="h-4 w-4" />
                    <span className="text-sm font-medium">{importResult.success} importado(s)</span>
                  </div>
                )}
                {importResult.failed > 0 && (
                  <div className="flex items-center gap-1 text-red-600">
                    <AlertCircle className="h-4 w-4" />
                    <span className="text-sm font-medium">{importResult.failed} falhou(ram)</span>
                  </div>
                )}
              </div>

              {importResult.errors.length > 0 && (
                <div className="max-h-40 overflow-y-auto border rounded p-2 space-y-1">
                  {importResult.errors.slice(0, 10).map((error, index) => (
                    <div key={index} className="text-xs text-red-600">
                      Linha {error.row}: {error.error}
                    </div>
                  ))}
                  {importResult.errors.length > 10 && (
                    <div className="text-xs text-muted-foreground">
                      ... e mais {importResult.errors.length - 10} erro(s)
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

