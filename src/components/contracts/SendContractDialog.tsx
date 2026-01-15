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
      // Não verificar assinaturas - permitir envio mesmo sem assinaturas
      // O contrato pode ser enviado para o cliente assinar
      setHasBothSignatures(true);
    } catch (error) {
      console.error('Erro ao verificar assinaturas:', error);
      setHasBothSignatures(true); // Permitir envio mesmo com erro
    } finally {
      setCheckingSignatures(false);
    }
  };

  const handleSend = async () => {
    // Removido: não exigir assinaturas antes de enviar
    // O contrato pode ser enviado para o cliente assinar

    if (!selectedInstanceId) {
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

      const functionName = 'send-contract-whatsapp';
      
      // Para WhatsApp, usar formato da função existente
      const requestBodyForFunction = {
        contract_id: contract.id,
        instance_id: selectedInstanceId,
      };

      console.log('📤 Enviando contrato:', {
        url: `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${functionName}`,
        method: 'whatsapp',
        function: functionName,
        contract_id: contract.id,
        instance_id: selectedInstanceId,
        has_phone: !!contract.lead?.phone,
      });

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${functionName}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify(requestBodyForFunction),
        }
      ).catch((fetchError) => {
        // Tratar erro de rede (ERR_FAILED, CORS, etc.)
        console.error('❌ Erro de rede ao chamar Edge Function:', {
          error: fetchError,
          message: fetchError.message,
          name: fetchError.name,
          stack: fetchError.stack,
          url: `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-contract-signed`,
        });
        
        // Mensagem mais específica baseada no tipo de erro
        let errorMsg = 'Erro de conexão';
        if (fetchError.message?.includes('Failed to fetch')) {
          errorMsg = 'Não foi possível conectar ao servidor. Verifique sua conexão ou se a Edge Function está deployada.';
        } else if (fetchError.message?.includes('CORS')) {
          errorMsg = 'Erro de CORS. Verifique configuração da Edge Function.';
        } else if (fetchError.message?.includes('timeout')) {
          errorMsg = 'Tempo limite excedido. Tente novamente.';
        } else {
          errorMsg = `Erro de conexão: ${fetchError.message || 'Não foi possível conectar ao servidor'}`;
        }
        
        throw new Error(errorMsg);
      });

      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch (parseError) {
          // Se não conseguir parsear JSON, usar texto da resposta
          const text = await response.text().catch(() => 'Erro desconhecido');
          errorData = { error: text || `Erro HTTP ${response.status}` };
        }
        throw new Error(errorData.error || `Erro ao enviar contrato (${response.status})`);
      }

      const result = await response.json();

      toast({
        title: 'Contrato enviado',
        description: 'Contrato enviado via WhatsApp com sucesso',
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
          <DialogTitle>Enviar Contrato por WhatsApp</DialogTitle>
          <DialogDescription>
            Envie o contrato para o cliente via WhatsApp
          </DialogDescription>
        </DialogHeader>

        {checkingSignatures ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4 py-4">
            <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <CheckCircle2 className="w-5 h-5 text-blue-600 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-blue-900">
                  Pronto para enviar
                </p>
                <p className="text-sm text-blue-700 mt-1">
                  O contrato será enviado ao cliente para assinatura.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="instance">Instância do WhatsApp *</Label>
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
              {contract.lead?.phone && (
                <p className="text-xs text-muted-foreground">
                  Será enviado para: {contract.lead.phone}
                </p>
              )}
            </div>
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
            disabled={sending || !selectedInstanceId}
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

