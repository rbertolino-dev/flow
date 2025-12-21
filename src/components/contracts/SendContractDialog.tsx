import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Contract } from '@/types/contract';
import { Loader2, Send, CheckCircle2, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useEvolutionConfigs } from '@/hooks/useEvolutionConfigs';

interface SendContractDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contract: Contract;
  onSuccess?: () => void;
}

export function SendContractDialog({
  open,
  onOpenChange,
  contract,
  onSuccess,
}: SendContractDialogProps) {
  const { toast } = useToast();
  const { configs: evolutionConfigs } = useEvolutionConfigs();
  const [sending, setSending] = useState(false);
  const [sendMethod, setSendMethod] = useState<'whatsapp' | 'email'>('whatsapp');
  const [selectedInstanceId, setSelectedInstanceId] = useState<string>('');
  const [hasBothSignatures, setHasBothSignatures] = useState(false);
  const [checkingSignatures, setCheckingSignatures] = useState(true);

  // Verificar se contrato tem ambas assinaturas
  useEffect(() => {
    if (open && contract.id) {
      checkSignatures();
    }
  }, [open, contract.id]);

  const checkSignatures = async () => {
    setCheckingSignatures(true);
    try {
      const { data: signatures } = await supabase
        .from('contract_signatures')
        .select('signer_type')
        .eq('contract_id', contract.id);

      const hasUser = signatures?.some(s => s.signer_type === 'user') || false;
      const hasClient = signatures?.some(s => s.signer_type === 'client') || false;

      setHasBothSignatures(hasUser && hasClient);
    } catch (error) {
      console.error('Erro ao verificar assinaturas:', error);
      setHasBothSignatures(false);
    } finally {
      setCheckingSignatures(false);
    }
  };

  const handleSend = async () => {
    if (!hasBothSignatures) {
      toast({
        title: 'Contrato não assinado',
        description: 'O contrato precisa estar assinado por ambas as partes antes de ser enviado.',
        variant: 'destructive',
      });
      return;
    }

    if (sendMethod === 'whatsapp' && !selectedInstanceId) {
      toast({
        title: 'Instância não selecionada',
        description: 'Selecione uma instância do WhatsApp para enviar o contrato.',
        variant: 'destructive',
      });
      return;
    }

    setSending(true);
    try {
      // Buscar PDF do contrato
      const pdfUrl = contract.signed_pdf_url || contract.pdf_url;
      if (!pdfUrl) {
        throw new Error('PDF do contrato não encontrado');
      }

      // Gerar link permanente de download (usar URL pública do Supabase)
      // Se já for URL pública, usar diretamente; caso contrário, gerar URL pública
      let downloadLink = pdfUrl;
      
      // Se for URL do Supabase Storage, garantir que seja pública
      if (pdfUrl.includes('supabase.co/storage')) {
        // Extrair path do arquivo da URL
        const urlParts = pdfUrl.split('/storage/v1/object/public/');
        if (urlParts.length > 1) {
          const pathParts = urlParts[1].split('/');
          const bucket = pathParts[0];
          const filePath = pathParts.slice(1).join('/');
          
          // Gerar URL pública permanente
          const { data: publicUrlData } = supabase.storage
            .from(bucket)
            .getPublicUrl(filePath);
          
          downloadLink = publicUrlData.publicUrl;
        }
      }

      // Chamar edge function para enviar
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Não autenticado');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-contract-signed`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            contract_id: contract.id,
            send_method: sendMethod,
            download_link: downloadLink,
            instance_id: sendMethod === 'whatsapp' ? selectedInstanceId : null,
            recipient_phone: sendMethod === 'whatsapp' ? contract.lead?.phone : null,
            recipient_email: sendMethod === 'email' ? contract.lead?.email : null,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido' }));
        throw new Error(errorData.error || 'Erro ao enviar contrato');
      }

      const result = await response.json();

      toast({
        title: 'Contrato enviado',
        description: `Contrato enviado via ${sendMethod === 'whatsapp' ? 'WhatsApp' : 'Email'} com sucesso`,
      });

      onSuccess?.();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Erro ao enviar contrato:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao enviar contrato',
        variant: 'destructive',
      });
    } finally {
      setSending(false);
    }
  };

  const connectedInstances = evolutionConfigs.filter((config) => config.is_connected);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Enviar Contrato Assinado</DialogTitle>
          <DialogDescription>
            Envie o contrato assinado para o cliente via WhatsApp ou Email
          </DialogDescription>
        </DialogHeader>

        {checkingSignatures ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : !hasBothSignatures ? (
          <div className="space-y-4 py-4">
            <div className="flex items-start gap-3 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-yellow-900">
                  Contrato não está completamente assinado
                </p>
                <p className="text-sm text-yellow-700 mt-1">
                  O contrato precisa estar assinado por ambas as partes (usuário e cliente) antes de ser enviado.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            <div className="flex items-start gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
              <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-green-900">
                  Contrato completamente assinado
                </p>
                <p className="text-sm text-green-700 mt-1">
                  Ambas as partes assinaram o contrato. Você pode enviá-lo ao cliente.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="send-method">Método de Envio</Label>
              <Select value={sendMethod} onValueChange={(value) => setSendMethod(value as 'whatsapp' | 'email')}>
                <SelectTrigger id="send-method">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {sendMethod === 'whatsapp' && (
              <div className="space-y-2">
                <Label htmlFor="instance">Instância do WhatsApp</Label>
                <Select value={selectedInstanceId} onValueChange={setSelectedInstanceId}>
                  <SelectTrigger id="instance">
                    <SelectValue placeholder="Selecione uma instância" />
                  </SelectTrigger>
                  <SelectContent>
                    {connectedInstances.length === 0 ? (
                      <SelectItem value="" disabled>
                        Nenhuma instância conectada
                      </SelectItem>
                    ) : (
                      connectedInstances.map((config) => (
                        <SelectItem key={config.id} value={config.id}>
                          {config.instance_name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                {connectedInstances.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    Configure uma instância do WhatsApp nas configurações
                  </p>
                )}
              </div>
            )}

            {sendMethod === 'email' && (
              <div className="space-y-2">
                <Label>Email do Cliente</Label>
                <p className="text-sm text-muted-foreground">
                  {contract.lead?.email || 'Email não cadastrado'}
                </p>
                {!contract.lead?.email && (
                  <p className="text-xs text-yellow-600">
                    Adicione o email do cliente no cadastro do lead para enviar por email
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={sending}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleSend}
            disabled={sending || !hasBothSignatures || (sendMethod === 'whatsapp' && !selectedInstanceId) || (sendMethod === 'email' && !contract.lead?.email)}
          >
            {sending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                Enviar
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

