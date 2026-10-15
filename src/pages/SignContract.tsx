import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { SignatureCanvas } from '@/components/contracts/SignatureCanvas';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, FileSignature, CheckCircle2, AlertCircle, Smartphone } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { generateContractPDF } from '@/lib/contractPdfGenerator';
import { getSignaturePositions } from '@/lib/pdfAnnotationUtils';
import { cleanCpf, formatCpf, isValidCpf } from '@/lib/cpfValidator';
import { DEFAULT_CONTRACT_ACCEPTANCE_TERMS } from '@/types/contract';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ContractData {
  id: string;
  organization_id: string;
  contract_number: string;
  content: string;
  pdf_url: string | null;
  status: string;
  acceptance_terms?: string | null;
  lead: {
    id: string;
    name: string;
    phone: string;
  };
  template?: {
    cover_page_url?: string;
    acceptance_terms?: string | null;
  };
}

type SignStep = 'identity' | 'otp' | 'sign';

export default function SignContract() {
  const { contractId, token } = useParams<{ contractId: string; token?: string }>();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [signing, setSigning] = useState(false);
  const [signed, setSigned] = useState(false);
  const [contract, setContract] = useState<ContractData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [step, setStep] = useState<SignStep>('identity');
  const [signerName, setSignerName] = useState('');
  const [signerCpf, setSignerCpf] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [maskedPhone, setMaskedPhone] = useState<string | null>(null);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [verificationToken, setVerificationToken] = useState<string | null>(null);
  const [otpVerifiedAt, setOtpVerifiedAt] = useState<string | null>(null);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [signatureData, setSignatureData] = useState<string | null>(null);

  useEffect(() => {
    void fetchContract();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- carrega só quando muda o link
  }, [contractId, token]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  const fetchContract = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!token) {
        setError('Link inválido: token de assinatura não fornecido');
        return;
      }

      const { data, error: fetchError } = await supabase
        .from('contracts')
        .select(`
          *,
          lead:leads(id, name, phone),
          template:contract_templates(cover_page_url, acceptance_terms),
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

      if (data.status === 'signed') {
        setSigned(true);
      }

      if (data.status === 'cancelled') {
        setError('Este contrato foi cancelado');
        return;
      }

      if (data.expires_at && new Date(data.expires_at) < new Date()) {
        setError('Este contrato expirou');
        return;
      }

      const row = data as ContractData & { expires_at?: string };
      const lead = row.lead;
      if (!lead?.phone) {
        setError(
          'Este contrato não pode ser assinado digitalmente: o cliente não possui telefone cadastrado para envio do código WhatsApp.',
        );
        return;
      }

      setContract(row);
      if (lead?.name) setSignerName(lead.name);
    } catch (err: unknown) {
      console.error('Erro ao buscar contrato:', err);
      setError('Erro ao carregar contrato');
    } finally {
      setLoading(false);
    }
  };

  const handleCpfChange = (value: string) => {
    const digits = cleanCpf(value).slice(0, 11);
    if (digits.length === 11) {
      setSignerCpf(formatCpf(digits));
      return;
    }
    setSignerCpf(
      digits.replace(/(\d{3})(\d{0,3})(\d{0,3})(\d{0,2})/, (_m, a, b, c, d) => {
        let out = a as string;
        if (b) out += `.${b}`;
        if (c) out += `.${c}`;
        if (d) out += `-${d}`;
        return out;
      }),
    );
  };

  const requestOtp = useCallback(async () => {
    if (!contract || !token) return;

    if (!signerName.trim()) {
      toast({
        title: 'Nome obrigatório',
        description: 'Digite seu nome completo',
        variant: 'destructive',
      });
      return;
    }

    if (!isValidCpf(signerCpf)) {
      toast({
        title: 'CPF inválido',
        description: 'Informe um CPF válido',
        variant: 'destructive',
      });
      return;
    }

    setSendingOtp(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('request-signature-otp', {
        body: {
          contract_id: contract.id,
          signature_token: token,
          signer_cpf: cleanCpf(signerCpf),
          signer_name: signerName.trim(),
        },
      });

      if (fnError) {
        let detail = fnError.message || 'Erro ao enviar código';
        try {
          const ctx = (fnError as { context?: { json?: () => Promise<{ error?: string }> } })?.context;
          if (ctx && typeof ctx.json === 'function') {
            const errBody = await ctx.json();
            if (errBody?.error) detail = errBody.error;
          }
        } catch {
          /* ignore */
        }
        throw new Error(detail);
      }

      if (data?.error) throw new Error(String(data.error));

      setMaskedPhone(data?.masked_phone ? String(data.masked_phone) : null);
      setResendCooldown(60);
      setStep('otp');
      setOtpCode('');
      toast({
        title: 'Código enviado',
        description: data?.masked_phone
          ? `Enviamos um código WhatsApp para ${data.masked_phone}`
          : 'Verifique o WhatsApp do número cadastrado',
      });
    } catch (err: unknown) {
      toast({
        title: 'Erro',
        description: err instanceof Error ? err.message : 'Não foi possível enviar o código',
        variant: 'destructive',
      });
    } finally {
      setSendingOtp(false);
    }
  }, [contract, token, signerName, signerCpf, toast]);

  const verifyOtp = useCallback(async () => {
    if (!contract || !token) return;

    const code = otpCode.replace(/\D/g, '');
    if (code.length !== 6) {
      toast({
        title: 'Código inválido',
        description: 'Digite o código de 6 dígitos',
        variant: 'destructive',
      });
      return;
    }

    setVerifyingOtp(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('verify-signature-otp', {
        body: {
          contract_id: contract.id,
          signature_token: token,
          signer_cpf: cleanCpf(signerCpf),
          code,
        },
      });

      if (fnError) {
        let detail = fnError.message || 'Erro ao verificar código';
        try {
          const ctx = (fnError as { context?: { json?: () => Promise<{ error?: string }> } })?.context;
          if (ctx && typeof ctx.json === 'function') {
            const errBody = await ctx.json();
            if (errBody?.error) detail = errBody.error;
          }
        } catch {
          /* ignore */
        }
        throw new Error(detail);
      }

      if (data?.error) throw new Error(String(data.error));
      if (!data?.verification_token) throw new Error('Verificação incompleta');

      setVerificationToken(String(data.verification_token));
      setOtpVerifiedAt(
        data.verified_at ? String(data.verified_at) : new Date().toISOString(),
      );
      setStep('sign');
      toast({
        title: 'Código verificado',
        description: 'Agora você pode assinar o contrato',
      });
    } catch (err: unknown) {
      toast({
        title: 'Erro',
        description: err instanceof Error ? err.message : 'Código incorreto',
        variant: 'destructive',
      });
    } finally {
      setVerifyingOtp(false);
    }
  }, [contract, token, otpCode, signerCpf, toast]);

  const handleSignatureConfirm = (signature: string) => {
    setSignatureData(signature);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!verificationToken || !otpVerifiedAt) {
      toast({
        title: 'Verificação necessária',
        description: 'Confirme o código WhatsApp antes de assinar',
        variant: 'destructive',
      });
      setStep('identity');
      return;
    }

    if (!signerName.trim()) {
      toast({
        title: 'Nome obrigatório',
        description: 'Digite seu nome completo',
        variant: 'destructive',
      });
      return;
    }

    if (!isValidCpf(signerCpf)) {
      toast({
        title: 'CPF inválido',
        description: 'Informe um CPF válido',
        variant: 'destructive',
      });
      return;
    }

    if (!acceptedTerms) {
      toast({
        title: 'Aceite os termos',
        description: 'Marque que leu e aceita os termos do contrato',
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
      const signedAt = new Date().toISOString();

      let ipAddress: string | null = null;
      let ipCountry: string | null = null;
      try {
        const ipResponse = await fetch('https://api.ipify.org?format=json');
        const ipData = await ipResponse.json();
        ipAddress = ipData.ip;

        try {
          const geoResponse = await fetch(`https://ipapi.co/${ipAddress}/country/`);
          if (geoResponse.ok) {
            ipCountry = (await geoResponse.text()).trim() || null;
          }
        } catch {
          /* ignore */
        }
      } catch {
        /* ignore */
      }

      const userAgent = navigator.userAgent;
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

      const hashData = `${signatureData}|${signedAt}|${contract.id}|${cleanCpf(signerCpf)}`;
      let validationHash: string | null = null;
      try {
        const encoder = new TextEncoder();
        const data = encoder.encode(hashData);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        validationHash = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
      } catch (hashError) {
        console.error('Erro ao gerar hash de validação:', hashError);
      }

      const cpfDigits = cleanCpf(signerCpf);
      const termsSnapshot = (
        contract.acceptance_terms ||
        contract.template?.acceptance_terms ||
        DEFAULT_CONTRACT_ACCEPTANCE_TERMS
      ).trim();

      const signaturePayload: Record<string, unknown> = {
        contract_id: contract.id,
        signer_type: 'client',
        signer_name: signerName.trim(),
        signature_data: signatureData,
        signed_at: signedAt,
        signer_cpf: cpfDigits,
        otp_verified: true,
        otp_verified_at: otpVerifiedAt,
        identity_verification_method: 'cpf_whatsapp_otp',
        terms_accepted: true,
        terms_accepted_at: signedAt,
        accepted_terms_snapshot: termsSnapshot,
      };

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
        // Fallback se colunas novas ainda não existirem
        if (
          signatureError.message?.includes('column') ||
          signatureError.code === '42703' ||
          signatureError.message?.includes('does not exist')
        ) {
          const basicPayload = {
            contract_id: contract.id,
            signer_type: 'client',
            signer_name: signerName.trim(),
            signature_data: signatureData,
            signed_at: signedAt,
            ...(ipAddress ? { ip_address: ipAddress } : {}),
          };
          const { error: retryError } = await supabase
            .from('contract_signatures')
            .insert(basicPayload)
            .select()
            .single();
          if (retryError) throw retryError;
          toast({
            title: 'Assinatura salva',
            description: 'Assinatura salva; execute a migration de CPF/OTP para auditoria completa.',
          });
        } else {
          throw signatureError;
        }
      } else {
        console.log('✅ Assinatura salva:', savedSignature?.id);
      }

      const { data: contractData } = await supabase
        .from('contracts')
        .select('content, contract_number, template_id, title')
        .eq('id', contract.id)
        .single();

      if (!contractData) throw new Error('Contrato não encontrado');

      let coverPageUrl = contract.template?.cover_page_url;
      if (contractData.template_id && !coverPageUrl) {
        const { data: templateData } = await supabase
          .from('contract_templates')
          .select('cover_page_url')
          .eq('id', contractData.template_id)
          .single();
        coverPageUrl = templateData?.cover_page_url;
      }

      type SigRow = {
        signer_name: string;
        signature_data: string;
        signed_at: string;
        signer_type?: 'user' | 'client';
        ip_address?: string | null;
        user_agent?: string | null;
        signed_ip_country?: string | null;
        validation_hash?: string | null;
      };
      let allSignatures: SigRow[] = [];
      try {
        const { data, error: selectError } = await supabase
          .from('contract_signatures')
          .select(
            'signer_name, signature_data, signed_at, signer_type, ip_address, user_agent, signed_ip_country, validation_hash, signer_cpf, otp_verified',
          )
          .eq('contract_id', contract.id)
          .order('signed_at', { ascending: true });

        if (selectError) {
          const { data: basicData, error: basicError } = await supabase
            .from('contract_signatures')
            .select('signer_name, signature_data, signed_at, ip_address')
            .eq('contract_id', contract.id)
            .order('signed_at', { ascending: true });
          if (basicError) throw basicError;
          allSignatures = (basicData || []) as SigRow[];
        } else {
          allSignatures = (data || []) as SigRow[];
        }
      } catch {
        const { data: minimalData } = await supabase
          .from('contract_signatures')
          .select('signer_name, signature_data, signed_at')
          .eq('contract_id', contract.id)
          .order('signed_at', { ascending: true });
        allSignatures = (minimalData || []) as SigRow[];
      }

      const signaturePositions = getSignaturePositions(contractData.content || '');

      const pdfBlob = await generateContractPDF({
        content: contractData.content,
        contractNumber: contractData.contract_number,
        title: (contractData as { title?: string }).title,
        coverPageUrl,
        signatures: allSignatures.map((sig) => ({
          name: sig.signer_name,
          signatureData: sig.signature_data,
          signedAt: sig.signed_at,
          signerType: sig.signer_type,
          ipAddress: sig.ip_address || undefined,
          userAgent: sig.user_agent || undefined,
          signedIpCountry: sig.signed_ip_country || undefined,
          validationHash: sig.validation_hash || undefined,
        })),
        signaturePositions,
      });

      const reader = new FileReader();
      const pdfBase64 = await new Promise<string>((resolve, reject) => {
        reader.onloadend = () => {
          const result = reader.result as string;
          resolve(result.split(',')[1] || '');
        };
        reader.onerror = reject;
        reader.readAsDataURL(pdfBlob);
      });

      const hasUserSignature = allSignatures.some((s) => s.signer_type === 'user');
      const hasClientSignature = allSignatures.some((s) => s.signer_type === 'client');
      const bothSigned = hasUserSignature && hasClientSignature;

      const { data: uploadResult, error: uploadFnError } = await supabase.functions.invoke(
        'upload-signed-contract-pdf',
        {
          body: {
            contract_id: contract.id,
            signature_token: token,
            pdf_base64: pdfBase64,
            update_status: bothSigned,
            signed_at: bothSigned ? new Date().toISOString() : undefined,
          },
        },
      );

      if (uploadFnError) {
        let detail = uploadFnError.message || 'Erro ao fazer upload do PDF assinado';
        try {
          const ctx = (uploadFnError as { context?: { json?: () => Promise<{ error?: string }> } })?.context;
          if (ctx && typeof ctx.json === 'function') {
            const errBody = await ctx.json();
            if (errBody?.error) detail = errBody.error;
          }
        } catch {
          /* ignore */
        }
        throw new Error(detail);
      }

      if (uploadResult?.error) throw new Error(String(uploadResult.error));
      if (!uploadResult?.signed_pdf_url) {
        throw new Error('Upload do PDF assinado não retornou URL');
      }

      try {
        await supabase.from('activities').insert({
          lead_id: contract.lead.id,
          type: 'contract_signed',
          content: `Contrato ${contract.contract_number} assinado por ${signerName.trim()} (CPF verificado via OTP WhatsApp)`,
          user_name: signerName.trim(),
          direction: 'incoming',
        });
      } catch {
        /* não crítico */
      }

      setSigned(true);
      toast({
        title: 'Contrato assinado!',
        description: 'O contrato foi assinado com sucesso',
      });
    } catch (err: unknown) {
      console.error('Erro ao assinar contrato:', err);
      toast({
        title: 'Erro',
        description: err instanceof Error ? err.message : 'Erro ao assinar contrato',
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
        <Card className="max-w-md w-full" data-testid="sign-contract-success">
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
    <div className="min-h-screen bg-background p-3 sm:p-6 overflow-x-hidden">
      <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6 w-full">
        <Card className="overflow-hidden">
          <CardHeader className="px-4 sm:px-6">
            <CardTitle className="text-lg sm:text-xl">Assinar Contrato</CardTitle>
            <CardDescription className="break-words">
              Contrato: {contract.contract_number} | Cliente: {contract.lead.name}
            </CardDescription>
            <div className="flex gap-2 pt-2 text-xs text-muted-foreground flex-wrap">
              <span className={step === 'identity' ? 'text-primary font-medium' : ''}>1. Identidade</span>
              <span>→</span>
              <span className={step === 'otp' ? 'text-primary font-medium' : ''}>2. Código WhatsApp</span>
              <span>→</span>
              <span className={step === 'sign' ? 'text-primary font-medium' : ''}>3. Assinatura</span>
            </div>
          </CardHeader>
          <CardContent className="px-4 sm:px-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              {contract.pdf_url ? (
                <div className="space-y-2">
                  <Label>Visualização do Contrato</Label>
                  <div className="border rounded-lg overflow-hidden bg-muted/50">
                    <iframe
                      src={contract.pdf_url}
                      className="w-full h-64 sm:h-96"
                      title="Contrato PDF"
                    />
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full sm:w-auto"
                      onClick={() => window.open(contract.pdf_url!, '_blank')}
                    >
                      Abrir PDF em Nova Aba
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

              {(step === 'identity' || step === 'otp') && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="signer-name">Seu Nome Completo *</Label>
                    <Input
                      id="signer-name"
                      data-testid="signer-name"
                      value={signerName}
                      onChange={(e) => setSignerName(e.target.value)}
                      placeholder="Digite seu nome completo"
                      required
                      disabled={sendingOtp || verifyingOtp || step === 'otp'}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signer-cpf">CPF *</Label>
                    <Input
                      id="signer-cpf"
                      data-testid="signer-cpf"
                      value={signerCpf}
                      onChange={(e) => handleCpfChange(e.target.value)}
                      placeholder="000.000.000-00"
                      inputMode="numeric"
                      disabled={sendingOtp || verifyingOtp || step === 'otp'}
                    />
                  </div>
                </>
              )}

              {step === 'identity' && (
                <Button
                  type="button"
                  className="w-full"
                  size="lg"
                  data-testid="send-otp-btn"
                  disabled={sendingOtp || !signerName.trim() || !isValidCpf(signerCpf)}
                  onClick={requestOtp}
                >
                  {sendingOtp ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Enviando código...
                    </>
                  ) : (
                    <>
                      <Smartphone className="w-4 h-4 mr-2" />
                      Enviar código WhatsApp
                    </>
                  )}
                </Button>
              )}

              {step === 'otp' && (
                <div className="space-y-4">
                  <Alert>
                    <Smartphone className="h-4 w-4" />
                    <AlertDescription>
                      Digite o código de 6 dígitos enviado por WhatsApp
                      {maskedPhone ? ` para ${maskedPhone}` : ''}.
                    </AlertDescription>
                  </Alert>

                  <div className="space-y-2">
                    <Label htmlFor="otp-code">Código de verificação *</Label>
                    <Input
                      id="otp-code"
                      data-testid="otp-code"
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="000000"
                      inputMode="numeric"
                      maxLength={6}
                      disabled={verifyingOtp}
                      autoComplete="one-time-code"
                    />
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2">
                    <Button
                      type="button"
                      className="w-full"
                      size="lg"
                      data-testid="verify-otp-btn"
                      disabled={verifyingOtp || otpCode.replace(/\D/g, '').length !== 6}
                      onClick={verifyOtp}
                    >
                      {verifyingOtp ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Verificando...
                        </>
                      ) : (
                        'Verificar código'
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full sm:w-auto"
                      disabled={sendingOtp || resendCooldown > 0}
                      onClick={requestOtp}
                      data-testid="resend-otp-btn"
                    >
                      {resendCooldown > 0 ? `Reenviar (${resendCooldown}s)` : 'Reenviar código'}
                    </Button>
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full"
                    onClick={() => {
                      setStep('identity');
                      setOtpCode('');
                      setVerificationToken(null);
                    }}
                  >
                    Alterar nome ou CPF
                  </Button>
                </div>
              )}

              {step === 'sign' && (
                <>
                  <Alert>
                    <CheckCircle2 className="h-4 w-4" />
                    <AlertDescription>
                      Identidade verificada via CPF e OTP WhatsApp. Assine abaixo.
                    </AlertDescription>
                  </Alert>

                  <div className="text-sm text-muted-foreground space-y-1">
                    <p>
                      <strong>Nome:</strong> {signerName}
                    </p>
                    <p>
                      <strong>CPF:</strong> {formatCpf(cleanCpf(signerCpf))}
                    </p>
                  </div>

                  <div className="space-y-2 w-full overflow-hidden">
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

                  {(() => {
                    const termsText =
                      (contract.acceptance_terms ||
                        contract.template?.acceptance_terms ||
                        DEFAULT_CONTRACT_ACCEPTANCE_TERMS).trim();
                    return (
                      <div className="space-y-3" data-testid="acceptance-terms-block">
                        <Label>Termos de aceite *</Label>
                        <ScrollArea className="h-48 w-full rounded-md border bg-muted/30 p-3">
                          <div className="pr-3 text-sm whitespace-pre-wrap leading-relaxed text-foreground">
                            {termsText}
                          </div>
                        </ScrollArea>
                        <p className="text-xs text-muted-foreground">
                          Leia os termos acima e o conteúdo do contrato antes de aceitar.
                        </p>
                        <div className="flex items-start gap-3">
                          <Checkbox
                            id="accept-terms"
                            data-testid="accept-terms"
                            checked={acceptedTerms}
                            onCheckedChange={(v) => setAcceptedTerms(v === true)}
                            disabled={signing}
                          />
                          <Label
                            htmlFor="accept-terms"
                            className="text-sm font-normal leading-relaxed cursor-pointer"
                          >
                            Li e aceito os termos acima e o conteúdo deste contrato
                          </Label>
                        </div>
                      </div>
                    );
                  })()}

                  <Button
                    type="submit"
                    className="w-full"
                    disabled={signing || !signatureData || !acceptedTerms}
                    size="lg"
                    data-testid="submit-signature-btn"
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
                </>
              )}
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
