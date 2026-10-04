import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SignatureCanvas } from './SignatureCanvas';
import { useContractSignatures } from '@/hooks/useContractSignatures';
import { useContracts } from '@/hooks/useContracts';
import { Contract } from '@/types/contract';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface ContractSignatureDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contract: Contract;
  signerType: 'user' | 'client';
  onSuccess?: () => void;
}

export function ContractSignatureDialog({
  open,
  onOpenChange,
  contract,
  signerType,
  onSuccess,
}: ContractSignatureDialogProps) {
  const { addSignature } = useContractSignatures(contract.id);
  const { updateContractStatus, regenerateContractPDF } = useContracts();
  const { toast } = useToast();

  const [signerName, setSignerName] = useState('');
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [signing, setSigning] = useState(false);

  const handleSignatureConfirm = (data: string) => {
    setSignatureData(data);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!signerName || !signatureData) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Preencha o nome e capture a assinatura',
        variant: 'destructive',
      });
      return;
    }

    setSigning(true);
    try {
      // Adicionar assinatura
      await addSignature(contract.id, signerType, signerName, signatureData);

      // Buscar todas as assinaturas para verificar se ambas (usuário e cliente) assinaram
      const { data: allSignatures } = await supabase
        .from('contract_signatures')
        .select('signer_type')
        .eq('contract_id', contract.id);

      const hasUserSignature = allSignatures?.some(sig => sig.signer_type === 'user') || false;
      const hasClientSignature = allSignatures?.some(sig => sig.signer_type === 'client') || false;

      // Sempre regenerar o PDF com todas as assinaturas já salvas (usuário e cliente)
      try {
        await regenerateContractPDF(contract.id);
      } catch (pdfError: any) {
        console.error('⚠️ Erro ao regenerar PDF:', pdfError);
        toast({
          title: 'Aviso',
          description: 'Assinatura salva, mas houve erro ao regenerar PDF. Use Recarregar Contrato.',
          variant: 'default',
        });
      }

      // Se ambas as partes assinaram, atualizar status para 'signed'
      if (hasUserSignature && hasClientSignature) {
        console.log('✅ Ambas as partes assinaram - atualizando status para signed');
        // Atualizar status para 'signed' se ainda não estiver
        if (contract.status !== 'signed') {
          await updateContractStatus(contract.id, 'signed');
        }
      } else {
        console.log('📝 Assinatura registrada. PDF regenerado com as assinaturas disponíveis.');
      }

      toast({
        title: 'Assinatura adicionada',
        description: 'Contrato assinado com sucesso',
      });

      onSuccess?.();
      onOpenChange(false);

      // Reset
      setSignerName('');
      setSignatureData(null);
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao assinar contrato',
        variant: 'destructive',
      });
    } finally {
      setSigning(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Assinar Contrato</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {contract.pdf_url && (
            <div className="space-y-2">
              <Label>Visualização do Contrato</Label>
              <iframe
                src={contract.pdf_url}
                className="w-full h-96 border rounded-lg"
                title="Contrato PDF"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="signer-name">Nome do Signatário *</Label>
            <Input
              id="signer-name"
              value={signerName}
              onChange={(e) => setSignerName(e.target.value)}
              placeholder="Digite seu nome completo"
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Assinatura *</Label>
            <SignatureCanvas
              onConfirm={handleSignatureConfirm}
              onCancel={() => setSignatureData(null)}
            />
            {signatureData && (
              <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded">
                <p className="text-sm text-green-800">✓ Assinatura capturada</p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={signing || !signerName || !signatureData}
            >
              {signing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Assinando...
                </>
              ) : (
                'Assinar e Finalizar'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
