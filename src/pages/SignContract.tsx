import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { SignatureCanvas } from '@/components/contracts/SignatureCanvas';
import { Loader2, FileSignature, CheckCircle2, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { generateContractPDF } from '@/lib/contractPdfGenerator';
import { SupabaseStorageService } from '@/services/contractStorage';
interface ContractData {
  id: string;
  organization_id: string;
  contract_number: string;
  content: string;
  pdf_url: string | null;
  status: string;
  lead: {
    id: string;
    name: string;
    phone: string;
  };
  template?: {
    cover_page_url?: string;
  };
}

export default function SignContract() {
  const { contractId, token } = useParams<{ contractId: string; token?: string }>();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [signing, setSigning] = useState(false);
  const [signed, setSigned] = useState(false);
  const [contract, setContract] = useState<ContractData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [signerName, setSignerName] = useState('');
  const [signatureData, setSignatureData] = useState<string | null>(null);

  useEffect(() => {
    fetchContract();
  }, [contractId, token]);

  const fetchContract = async () => {
    try {
      setLoading(true);
      setError(null);

      // Token é obrigatório para acesso público
      if (!token) {
        setError('Link inválido: token de assinatura não fornecido');
        return;
      }

      // Buscar contrato por ID e token (token é obrigatório para acesso público)
      const { data, error: fetchError } = await supabase
        .from('contracts')
        .select(`
          *,
          lead:leads(id, name, phone),
          template:contract_templates(cover_page_url),
          organization_id
        `)
        .eq('id', contractId!)
        .eq('signature_token', token)
        .single();

      if (fetchError || !data) {
        console.error('Erro ao buscar contrato:', fetchError);
        setError('Contrato não encontrado ou link inválido. Verifique se o link está correto.');
        return;
      }

      // Verificar se já está assinado
      if (data.status === 'signed') {
        setSigned(true);
      }

      // Verificar se está cancelado ou expirado
      if (data.status === 'cancelled') {
        setError('Este contrato foi cancelado');
        return;
      }

      if (data.expires_at && new Date(data.expires_at) < new Date()) {
        setError('Este contrato expirou');
        return;
      }

      setContract(data as any);
    } catch (err: any) {
      console.error('Erro ao buscar contrato:', err);
      setError('Erro ao carregar contrato');
    } finally {
      setLoading(false);
    }
  };

  const handleSignatureConfirm = (signature: string) => {
    setSignatureData(signature);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!signerName.trim()) {
      toast({
        title: 'Nome obrigatório',
        description: 'Digite seu nome completo',
        variant: 'destructive',
      });
      return;
    }

    if (!signatureData) {
      toast({
        title: 'Assinatura obrigatória',
        description: 'Capture sua assinatura',
        variant: 'destructive',
      });
      return;
    }

    if (!contract) {
      toast({
        title: 'Erro',
        description: 'Dados do contrato não encontrados',
        variant: 'destructive',
      });
      return;
    }

    setSigning(true);

    try {
      // Capturar dados de autenticação
      const signedAt = new Date().toISOString();
      
      // Capturar IP address
      let ipAddress: string | null = null;
      let ipCountry: string | null = null;
      try {
        const ipResponse = await fetch('https://api.ipify.org?format=json');
        const ipData = await ipResponse.json();
        ipAddress = ipData.ip;
        
        // Tentar obter país do IP (opcional, não bloqueia se falhar)
        try {
          const geoResponse = await fetch(`https://ipapi.co/${ipAddress}/country/`);
          if (geoResponse.ok) {
            ipCountry = await geoResponse.text();
            ipCountry = ipCountry.trim() || null;
          }
        } catch (geoError) {
          console.log('Não foi possível obter país do IP:', geoError);
        }
      } catch (ipError) {
        console.log('Não foi possível obter IP:', ipError);
      }

      // Capturar User Agent
      const userAgent = navigator.userAgent;

      // Capturar informações básicas do dispositivo
      const deviceInfo = {
        platform: navigator.platform,
        language: navigator.language,
        languages: navigator.languages,
        cookieEnabled: navigator.cookieEnabled,
        onLine: navigator.onLine,
        screenWidth: window.screen.width,
        screenHeight: window.screen.height,
        windowWidth: window.innerWidth,
        windowHeight: window.innerHeight,
      };

      // Gerar hash de validação (SHA-256 de signature_data + timestamp + contract_id)
      const hashData = `${signatureData}|${signedAt}|${contract.id}`;
      let validationHash: string | null = null;
      try {
        const encoder = new TextEncoder();
        const data = encoder.encode(hashData);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        validationHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      } catch (hashError) {
        console.error('Erro ao gerar hash de validação:', hashError);
      }

      // 1. Salvar assinatura com todos os dados de autenticação
      console.log('💾 Salvando assinatura com dados:', {
        contract_id: contract.id,
        signer_name: signerName.trim(),
        ip_address: ipAddress,
        user_agent: userAgent,
        validation_hash: validationHash,
        signed_ip_country: ipCountry,
      });

      const signaturePayload: any = {
        contract_id: contract.id,
        signer_type: 'client',
        signer_name: signerName.trim(),
        signature_data: signatureData,
        signed_at: signedAt,
      };

      // Adicionar campos de autenticação apenas se não forem null
      if (ipAddress) signaturePayload.ip_address = ipAddress;
      if (userAgent) signaturePayload.user_agent = userAgent;
      if (deviceInfo) signaturePayload.device_info = deviceInfo;
      if (validationHash) signaturePayload.validation_hash = validationHash;
      if (ipCountry) signaturePayload.signed_ip_country = ipCountry;

      const { data: savedSignature, error: signatureError } = await supabase
        .from('contract_signatures')
        .insert(signaturePayload)
        .select()
        .single();

      if (signatureError) {
        console.error('❌ Erro ao salvar assinatura:', signatureError);
        console.error('❌ Detalhes do erro:', {
          code: signatureError.code,
          message: signatureError.message,
          details: signatureError.details,
          hint: signatureError.hint,
        });
        
        // Se o erro for de coluna não encontrada, tentar sem os campos de autenticação
        if (signatureError.message?.includes('column') || 
            signatureError.code === '42703' ||
            signatureError.message?.includes('does not exist')) {
          console.warn('⚠️ Colunas de autenticação não encontradas, salvando sem esses dados');
          console.warn('⚠️ IMPORTANTE: Execute as migrações SQL para habilitar dados de autenticação');
          
          // Tentar salvar apenas com campos básicos
          const basicPayload = {
            contract_id: contract.id,
            signer_type: 'client',
            signer_name: signerName.trim(),
            signature_data: signatureData,
            signed_at: signedAt,
          };
          
          // Adicionar ip_address se a coluna existir (é mais antiga)
          if (ipAddress) {
            (basicPayload as any).ip_address = ipAddress;
          }
          
          const { data: basicSaved, error: retryError } = await supabase
            .from('contract_signatures')
            .insert(basicPayload)
            .select()
            .single();
            
          if (retryError) {
            console.error('❌ Erro mesmo salvando sem dados de autenticação:', retryError);
            throw retryError;
          }
          
          console.log('✅ Assinatura salva (sem dados de autenticação):', basicSaved);
          toast({
            title: 'Assinatura salva',
            description: 'Assinatura salva, mas dados de autenticação não disponíveis. Execute as migrações SQL.',
            variant: 'default',
          });
        } else {
          throw signatureError;
        }
      } else {
        console.log('✅ Assinatura salva com sucesso:', savedSignature);
        console.log('✅ Dados de autenticação salvos:', {
          ip: savedSignature.ip_address,
          user_agent: savedSignature.user_agent ? 'Sim' : 'Não',
          validation_hash: savedSignature.validation_hash ? 'Sim' : 'Não',
        });
      }

      // 2. Gerar PDF assinado
      // Buscar conteúdo do contrato
      const { data: contractData } = await supabase
        .from('contracts')
        .select('content, contract_number, template_id')
        .eq('id', contract.id)
        .single();

      if (!contractData) throw new Error('Contrato não encontrado');

      // Buscar template para folha de rosto
      let coverPageUrl = contract.template?.cover_page_url;
      if (contractData.template_id && !coverPageUrl) {
        const { data: templateData } = await supabase
          .from('contract_templates')
          .select('cover_page_url')
          .eq('id', contractData.template_id)
          .single();
        coverPageUrl = templateData?.cover_page_url;
      }

      // Buscar todas as assinaturas do contrato (incluindo a que acabou de ser salva)
      // Tentar buscar com todos os dados de autenticação primeiro
      let allSignatures: any[] = [];
      try {
        const { data, error: selectError } = await supabase
          .from('contract_signatures')
          .select('signer_name, signature_data, signed_at, ip_address, user_agent, signed_ip_country, validation_hash')
          .eq('contract_id', contract.id)
          .order('signed_at', { ascending: true });

        if (selectError) {
          console.warn('⚠️ Erro ao buscar com campos de autenticação, tentando sem:', selectError);
          // Se falhar, buscar apenas campos básicos
          const { data: basicData, error: basicError } = await supabase
            .from('contract_signatures')
            .select('signer_name, signature_data, signed_at, ip_address')
            .eq('contract_id', contract.id)
            .order('signed_at', { ascending: true });
          
          if (basicError) throw basicError;
          allSignatures = basicData || [];
        } else {
          allSignatures = data || [];
        }
      } catch (err: any) {
        console.error('❌ Erro ao buscar assinaturas:', err);
        // Última tentativa: buscar apenas campos obrigatórios
        const { data: minimalData } = await supabase
          .from('contract_signatures')
          .select('signer_name, signature_data, signed_at')
          .eq('contract_id', contract.id)
          .order('signed_at', { ascending: true });
        allSignatures = minimalData || [];
      }

      console.log('📋 Assinaturas encontradas:', allSignatures.length);
      console.log('📋 Dados das assinaturas:', allSignatures);

      // Gerar PDF com todas as assinaturas e dados de autenticação
      const signaturesForPdf = allSignatures.map(sig => ({
        name: sig.signer_name,
        signatureData: sig.signature_data,
        signedAt: sig.signed_at,
        ipAddress: sig.ip_address || undefined,
        userAgent: sig.user_agent || undefined,
        signedIpCountry: sig.signed_ip_country || undefined,
        validationHash: sig.validation_hash || undefined,
      }));

      console.log('📄 Gerando PDF com assinaturas:', signaturesForPdf);

      const pdfBlob = await generateContractPDF({
        content: contractData.content,
        contractNumber: contractData.contract_number,
        leadName: contract.lead.name,
        coverPageUrl: coverPageUrl,
        signatures: signaturesForPdf,
      });

      console.log('✅ PDF gerado com sucesso, tamanho:', pdfBlob.size, 'bytes');

      // 3. Fazer upload do PDF assinado
      const storageService = new SupabaseStorageService(contract.organization_id);
      const signedPdfUrl = await storageService.uploadPDF(pdfBlob, `${contract.id}-signed`);

      // 4. Verificar se ambas as partes já assinaram antes de atualizar status
      const { data: signaturesCheck } = await supabase
        .from('contract_signatures')
        .select('signer_type')
        .eq('contract_id', contract.id);

      const hasUserSignature = signaturesCheck?.some(sig => sig.signer_type === 'user') || false;
      const hasClientSignature = signaturesCheck?.some(sig => sig.signer_type === 'client') || false;

      // Só atualizar status para 'signed' se ambas as partes assinaram
      // Se apenas o cliente assinou, manter status atual (pode ser 'draft' ou 'sent')
      // O usuário ainda pode assinar depois
      const updateData: any = {
        signed_pdf_url: signedPdfUrl,
      };

      if (hasUserSignature && hasClientSignature) {
        // Ambas as partes assinaram - contrato está completamente assinado
        updateData.status = 'signed';
        updateData.signed_at = new Date().toISOString();
        console.log('✅ Ambas as partes assinaram - status atualizado para signed');
      } else {
        // Apenas cliente assinou - manter status atual para permitir assinatura do usuário
        console.log('✅ Cliente assinou, mas usuário ainda não. Status mantido para permitir assinatura do usuário.');
      }

      // Atualizar contrato
      const { error: updateError } = await supabase
        .from('contracts')
        .update(updateData)
        .eq('id', contract.id);

      if (updateError) throw updateError;

      // 5. Registrar atividade
      await supabase.from('activities').insert({
        lead_id: contract.lead.id,
        type: 'contract_signed',
        content: `Contrato ${contract.contract_number} assinado por ${signerName.trim()}`,
        user_name: signerName.trim(),
        direction: 'incoming',
      });

      setSigned(true);
      toast({
        title: 'Contrato assinado!',
        description: 'O contrato foi assinado com sucesso',
      });
    } catch (err: any) {
      console.error('Erro ao assinar contrato:', err);
      toast({
        title: 'Erro',
        description: err.message || 'Erro ao assinar contrato',
        variant: 'destructive',
      });
    } finally {
      setSigning(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Carregando contrato...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              Erro
            </CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (signed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="h-5 w-5" />
              Contrato Assinado
            </CardTitle>
            <CardDescription>
              O contrato {contract?.contract_number} foi assinado com sucesso!
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Você receberá uma cópia do contrato assinado em breve.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!contract) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Assinar Contrato</CardTitle>
            <CardDescription>
              Contrato: {contract.contract_number} | Cliente: {contract.lead.name}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Visualização do PDF */}
              {contract.pdf_url ? (
                <div className="space-y-2">
                  <Label>Visualização do Contrato</Label>
                  <div className="border rounded-lg overflow-hidden bg-muted/50">
                    <iframe
                      src={contract.pdf_url}
                      className="w-full h-96"
                      title="Contrato PDF"
                      onError={() => {
                        console.error('Erro ao carregar PDF no iframe');
                        toast({
                          title: 'Erro ao carregar PDF',
                          description: 'Não foi possível carregar o PDF. Tente abrir em nova aba.',
                          variant: 'destructive',
                        });
                      }}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => window.open(contract.pdf_url!, '_blank')}
                    >
                      Abrir PDF em Nova Aba
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        const link = document.createElement('a');
                        link.href = contract.pdf_url!;
                        link.download = `Contrato_${contract.contract_number}.pdf`;
                        link.click();
                      }}
                    >
                      Baixar PDF
                    </Button>
                  </div>
                </div>
              ) : (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    PDF do contrato não encontrado. Entre em contato com o responsável.
                  </AlertDescription>
                </Alert>
              )}

              {/* Nome do signatário */}
              <div className="space-y-2">
                <Label htmlFor="signer-name">Seu Nome Completo *</Label>
                <Input
                  id="signer-name"
                  value={signerName}
                  onChange={(e) => setSignerName(e.target.value)}
                  placeholder="Digite seu nome completo"
                  required
                  disabled={signing}
                />
              </div>

              {/* Assinatura */}
              <div className="space-y-2">
                <Label>Assinatura Digital *</Label>
                <SignatureCanvas
                  onConfirm={handleSignatureConfirm}
                  onCancel={() => setSignatureData(null)}
                />
                {signatureData && (
                  <Alert>
                    <CheckCircle2 className="h-4 w-4" />
                    <AlertDescription>Assinatura capturada com sucesso</AlertDescription>
                  </Alert>
                )}
              </div>

              {/* Botão de envio */}
              <Button
                type="submit"
                className="w-full"
                disabled={signing || !signerName.trim() || !signatureData}
                size="lg"
              >
                {signing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Assinando...
                  </>
                ) : (
                  <>
                    <FileSignature className="w-4 h-4 mr-2" />
                    Assinar Contrato
                  </>
                )}
              </Button>

              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  Ao assinar, você confirma que leu e concorda com os termos do contrato.
                </AlertDescription>
              </Alert>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

