import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Contract } from '@/types/contract';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Info, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import {
  replaceTemplateVariables,
  extractTemplateVariables,
  DEFAULT_CONTRACT_MESSAGE_TEMPLATE,
} from '@/lib/messageTemplateUtils';

interface EditMessageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contract: Contract | null;
  onSuccess?: () => void;
}

export function EditMessageDialog({
  open,
  onOpenChange,
  contract,
  onSuccess,
}: EditMessageDialogProps) {
  const { toast } = useToast();
  const [messageTemplate, setMessageTemplate] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<string>('');

  // Carregar template existente ou usar padrão
  useEffect(() => {
    if (open && contract) {
      setMessageTemplate(
        contract.whatsapp_message_template || DEFAULT_CONTRACT_MESSAGE_TEMPLATE
      );
    }
  }, [open, contract]);

  // Gerar preview da mensagem
  useEffect(() => {
    if (messageTemplate && contract?.lead) {
      const signUrl = contract.signature_token
        ? `${window.location.origin}/sign-contract/${contract.id}/${contract.signature_token}`
        : '{{link_assinatura}}';

      const previewText = replaceTemplateVariables(messageTemplate, {
        nome: contract.lead.name || '{{nome}}',
        numero_contrato: contract.contract_number || '{{numero_contrato}}',
        link_assinatura: signUrl,
        telefone: contract.lead.phone || '{{telefone}}',
        email: contract.lead.email || '{{email}}',
        empresa: contract.lead.company || '{{empresa}}',
      });

      setPreview(previewText);
    } else {
      setPreview('');
    }
  }, [messageTemplate, contract]);

  const handleSave = async () => {
    if (!contract) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('contracts')
        .update({
          whatsapp_message_template: messageTemplate.trim() || null,
        })
        .eq('id', contract.id);

      if (error) throw error;

      toast({
        title: 'Mensagem salva',
        description: 'A mensagem personalizada foi salva com sucesso',
      });

      onSuccess?.();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Erro ao salvar mensagem:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao salvar mensagem',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setMessageTemplate(DEFAULT_CONTRACT_MESSAGE_TEMPLATE);
  };

  const variables = extractTemplateVariables(messageTemplate);
  const availableVariables = ['nome', 'numero_contrato', 'link_assinatura', 'telefone', 'email', 'empresa'];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Mensagem WhatsApp</DialogTitle>
          <DialogDescription>
            Personalize a mensagem que será enviada junto com o contrato. Use as variáveis disponíveis para personalizar o conteúdo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Variáveis disponíveis */}
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-1">
                <p className="font-semibold">Variáveis disponíveis:</p>
                <div className="flex flex-wrap gap-2 text-xs">
                  {availableVariables.map((varName) => (
                    <code
                      key={varName}
                      className="px-2 py-1 bg-muted rounded"
                    >
                      {`{{${varName}}}`}
                    </code>
                  ))}
                </div>
              </div>
            </AlertDescription>
          </Alert>

          {/* Editor de mensagem */}
          <div className="space-y-2">
            <Label htmlFor="message-template">Mensagem Personalizada</Label>
            <Textarea
              id="message-template"
              value={messageTemplate}
              onChange={(e) => setMessageTemplate(e.target.value)}
              placeholder={DEFAULT_CONTRACT_MESSAGE_TEMPLATE}
              rows={8}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              {messageTemplate.length} caracteres
            </p>
          </div>

          {/* Preview */}
          <div className="space-y-2">
            <Label>Preview da Mensagem</Label>
            <div className="p-4 bg-muted rounded-lg border">
              <pre className="whitespace-pre-wrap text-sm font-sans">
                {preview || 'Digite uma mensagem para ver o preview...'}
              </pre>
            </div>
          </div>

          {/* Variáveis usadas */}
          {variables.length > 0 && (
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-1">
                  <p className="font-semibold">Variáveis detectadas:</p>
                  <div className="flex flex-wrap gap-2 text-xs">
                    {variables.map((varName) => (
                      <code
                        key={varName}
                        className="px-2 py-1 bg-muted rounded"
                      >
                        {`{{${varName}}}`}
                      </code>
                    ))}
                  </div>
                </div>
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleReset}
            disabled={saving}
          >
            Restaurar Padrão
          </Button>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              'Salvar Mensagem'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

