import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { DigitalContract } from '@/types/digital-contract';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useDigitalContractSignatures } from '@/hooks/useDigitalContractSignatures';
import { Loader2 } from 'lucide-react';

export default function DigitalContractSign() {
  const { contractId, token } = useParams<{ contractId: string; token?: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [contract, setContract] = useState<DigitalContract | null>(null);
  const [loading, setLoading] = useState(true);
  const [signerName, setSignerName] = useState('');
  const [signatureData, setSignatureData] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  const { createSignature } = useDigitalContractSignatures(contractId || '');

  useEffect(() => {
    if (contractId) {
      fetchContract();
    }
  }, [contractId]);

  const fetchContract = async () => {
    if (!contractId) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('contracts')
        .select(`
          *,
          template:contract_templates(*),
          lead:leads(id, name, phone, email, company)
        `)
        .eq('id', contractId)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        toast({
          title: 'Erro',
          description: 'Contrato não encontrado',
          variant: 'destructive',
        });
        return;
      }

      // Validar token se fornecido
      if (token && data.signature_token !== token) {
        toast({
          title: 'Erro',
          description: 'Token de assinatura inválido',
          variant: 'destructive',
        });
        return;
      }

      setContract(data as DigitalContract);
    } catch (error: any) {
      console.error('Erro ao carregar contrato:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao carregar contrato',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSignatureCapture = (dataUrl: string) => {
    setSignatureData(dataUrl);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!signerName.trim()) {
      toast({
        title: 'Erro',
        description: 'Nome do signatário é obrigatório',
        variant: 'destructive',
      });
      return;
    }

    if (!signatureData) {
      toast({
        title: 'Erro',
        description: 'Assinatura é obrigatória',
        variant: 'destructive',
      });
      return;
    }

    if (!contractId) return;

    setSubmitting(true);
    try {
      // Coletar dados de autenticação
      const ipResponse = await fetch('https://api.ipify.org?format=json');
      const ipData = await ipResponse.json();
      const ipAddress = ipData.ip;

      // Criar hash de validação
      const hashData = `${contractId}-${signerName}-${signatureData}-${Date.now()}`;
      const encoder = new TextEncoder();
      const data = encoder.encode(hashData);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const validationHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      // Criar assinatura
      await createSignature({
        signer_type: 'client',
        signer_name: signerName,
        signature_data: signatureData,
        ip_address: ipAddress,
        user_agent: navigator.userAgent,
        device_info: {
          platform: navigator.platform,
          language: navigator.language,
          screenResolution: `${window.screen.width}x${window.screen.height}`,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
        validation_hash: validationHash,
      });

      // Atualizar status do contrato
      await supabase
        .from('contracts')
        .update({ 
          status: 'signed',
          signed_at: new Date().toISOString(),
        })
        .eq('id', contractId);

      toast({
        title: 'Contrato assinado',
        description: 'Contrato assinado com sucesso',
      });

      // Redirecionar após 2 segundos
      setTimeout(() => {
        navigate('/');
      }, 2000);
    } catch (error: any) {
      console.error('Erro ao assinar contrato:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao assinar contrato',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!contract) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Contrato não encontrado</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              O contrato solicitado não foi encontrado ou não está mais disponível.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Assinar Contrato</CardTitle>
            <CardDescription>
              Contrato {contract.contract_number} - {contract.lead?.name}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {contract.pdf_url && (
              <iframe
                src={contract.pdf_url}
                className="w-full border rounded-md mb-6"
                style={{ height: '600px' }}
                title="PDF do Contrato"
              />
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="signerName">
                  Nome do Signatário <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="signerName"
                  value={signerName}
                  onChange={(e) => setSignerName(e.target.value)}
                  placeholder="Digite seu nome completo"
                  required
                  disabled={submitting}
                />
              </div>

              <div className="space-y-2">
                <Label>
                  Assinatura <span className="text-destructive">*</span>
                </Label>
                <div className="border rounded-md p-4 bg-white">
                  <p className="text-sm text-muted-foreground mb-4">
                    Use o mouse ou toque na tela para assinar
                  </p>
                  {/* Canvas de assinatura será implementado em componente separado */}
                  <div className="border-2 border-dashed border-gray-300 rounded-md h-48 flex items-center justify-center">
                    <p className="text-muted-foreground">
                      Componente de assinatura será implementado
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex gap-4">
                <Button
                  type="submit"
                  disabled={submitting || !signerName.trim() || !signatureData}
                  className="flex-1"
                >
                  {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Assinar Contrato
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

