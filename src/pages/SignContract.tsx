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
  require_signature_otp?: boolean | null;
  lead: {
    id: string;
    name: string;
    phone?: string | null;
  };
  template?: {
    cover_page_url?: string;
    acceptance_terms?: string | null;
    require_signature_otp?: boolean | null;
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
          template:contract_templates(cover_page_url, acceptance_terms, require_signature_otp),
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
      const needsOtp = !!(row.require_signature_otp ?? row.template?.require_signature_otp);

      if (needsOtp && !lead?.phone) {
        setError(
          'Este contrato exige código WhatsApp, mas o cliente não possui telefone cadastrado.',
        );
        return;
      }

      setContract(row);
      if (lead?.name) setSignerName(lead.name);
      setStep(needsOtp ? 'identity' : 'sign');
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

  const contractRequiresOtp = !!(
    contract?.require_signature_otp ?? contract?.template?.require_signature_otp
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!contract) {
      toast({
        title: 'Erro',
        description: 'Dados do contrato não encontrados',
        variant: 'destructive',
      });
      return;
    }

    const needsOtp = !!(
      contract.require_signature_otp ?? contract.template?.require_signature_otp
    );

    if (needsOtp && (!verificationToken || !otpVerifiedAt)) {
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

    if (needsOtp && !isValidCpf(signerCpf)) {
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

    setSigning(true);

    try {
      const signedAt = new Date().toISOString();
      const cpfDigits = needsOtp ? cleanCpf(signerCpf) : '';
      const termsSnapshot = (
        contract.acceptance_terms ||
        contract.template?.acceptance_terms ||
        DEFAULT_CONTRACT_ACCEPTANCE_TERMS
      ).trim();
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

      // IP/geo com timeout curto — não pode travar a assinatura
      const authMetaPromise = (async () => {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 1200);
        try {
          const ipResponse = await fetch('https://api.ipify.org?format=json', {
            signal: ctrl.signal,
          });
          const ipData = (await ipResponse.json()) as { ip?: string };
          const ipAddress = ipData.ip || null;
          let ipCountry: string | null = null;
          if (ipAddress) {
            try {
              const geoCtrl = new AbortController();
              const geoTimer = setTimeout(() => geoCtrl.abort(), 800);
              const geoResponse = await fetch(`https://ipapi.co/${ipAddress}/country/`, {
                signal: geoCtrl.signal,
              });
              clearTimeout(geoTimer);
              if (geoResponse.ok) {
                ipCountry = (await geoResponse.text()).trim() || null;
              }
            } catch {
              /* ignore */
            }
          }
          return { ipAddress, ipCountry };
        } catch {
          return { ipAddress: null as string | null, ipCountry: null as string | null };
        } finally {
          clearTimeout(timer);
        }
      })();

      const hashPromise = (async () => {
        try {
          const hashData = `${signatureData}|${signedAt}|${contract.id}|${cpfDigits || 'standard'}`;
          const hashBuffer = await crypto.subtle.digest(
            'SHA-256',
            new TextEncoder().encode(hashData),
          );
          return Array.from(new Uint8Array(hashBuffer))
            .map((b) => b.toString(16).padStart(2, '0'))
            .join('');
        } catch {
          return null as string | null;
        }
      })();

      // Em paralelo: meta de rede (timeout) + hash
      const [{ ipAddress, ipCountry }, validationHash] = await Promise.all([
        authMetaPromise,
        hashPromise,
      ]);

      const signaturePayload: Record<string, unknown> = {
        contract_id: contract.id,
        signer_type: 'client',
        signer_name: signerName.trim(),
        signature_data: signatureData,
        signed_at: signedAt,
        otp_verified: needsOtp,
        identity_verification_method: needsOtp ? 'cpf_whatsapp_otp' : 'standard_electronic',
        terms_accepted: true,
        terms_accepted_at: signedAt,
        accepted_terms_snapshot: termsSnapshot,
        user_agent: userAgent,
        device_info: deviceInfo,
      };
      if (needsOtp && cpfDigits) {
        signaturePayload.signer_cpf = cpfDigits;
        signaturePayload.otp_verified_at = otpVerifiedAt;
      }
      if (ipAddress) signaturePayload.ip_address = ipAddress;
      if (validationHash) signaturePayload.validation_hash = validationHash;
      if (ipCountry) signaturePayload.signed_ip_country = ipCountry;

      const { data: savedSignature, error: signatureError } = await supabase
        .from('contract_signatures')
        .insert(signaturePayload)
        .select('id, signer_name, signature_data, signed_at, signer_type, ip_address, user_agent, signed_ip_country, validation_hash')
        .single();

      if (signatureError) {
        if (
          signatureError.message?.includes('column') ||
          signatureError.code === '42703' ||
          signatureError.message?.includes('does not exist')
        ) {
          const { error: retryError } = await supabase
            .from('contract_signatures')
            .insert({
              contract_id: contract.id,
              signer_type: 'client',
              signer_name: signerName.trim(),
              signature_data: signatureData,
              signed_at: signedAt,
              ...(ipAddress ? { ip_address: ipAddress } : {}),
            })
            .select('id')
            .single();
          if (retryError) throw retryError;
        } else {
          throw signatureError;
        }
      }

      // Status no CRM imediatamente após gravar a assinatura do cliente (não espera PDF)
      await supabase
        .from('contracts')
        .update({ status: 'signed', signed_at: signedAt })
        .eq('id', contract.id)
        .eq('signature_token', token!);

      // Sucesso imediato para o signatário — PDF em background
      setSigned(true);
      setSigning(false);
      toast({
        title: 'Contrato assinado!',
        description: 'O contrato foi assinado com sucesso',
      });

      // PDF + upload + atividade (não bloqueia a tela)
      void (async () => {
        try {
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

          const { data: allSigs } = await supabase
            .from('contract_signatures')
            .select(
              'signer_name, signature_data, signed_at, signer_type, ip_address, user_agent, signed_ip_country, validation_hash',
            )
            .eq('contract_id', contract.id)
            .order('signed_at', { ascending: true });

          let allSignatures = (allSigs || []) as SigRow[];
          if (
            savedSignature &&
            !allSignatures.some((s) => s.signature_data === savedSignature.signature_data)
          ) {
            allSignatures = [...allSignatures, savedSignature as SigRow];
          }

          const coverPageUrl = contract.template?.cover_page_url;
          const signaturePositions = getSignaturePositions(contract.content || '');
          const pdfBlob = await generateContractPDF({
            content: contract.content,
            contractNumber: contract.contract_number,
            title: (contract as { title?: string }).title,
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

          const pdfBase64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              const result = reader.result as string;
              resolve(result.split(',')[1] || '');
            };
            reader.onerror = reject;
            reader.readAsDataURL(pdfBlob);
          });

          const bothSigned =
            allSignatures.some((s) => s.signer_type === 'user') &&
            allSignatures.some((s) => s.signer_type === 'client');

          const { data: uploadResult, error: uploadFnError } = await supabase.functions.invoke(
            'upload-signed-contract-pdf',
            {
              body: {
                contract_id: contract.id,
                signature_token: token,
                pdf_base64: pdfBase64,
                update_status: bothSigned,
                signed_at: bothSigned ? signedAt : undefined,
              },
            },
          );

          if (uploadFnError || uploadResult?.error) {
            console.warn('PDF assinado em background falhou (assinatura já salva):', uploadFnError || uploadResult?.error);
          }

          const authNote = needsOtp
            ? 'CPF verificado via OTP WhatsApp'
            : 'assinatura eletrônica padrão';
          await supabase.from('activities').insert({
            lead_id: contract.lead.id,
            type: 'contract_signed',
            content: `Contrato ${contract.contract_number} assinado por ${signerName.trim()} (${authNote})`,
            user_name: signerName.trim(),
            direction: 'incoming',
          });
        } catch (bgErr) {
          console.warn('Pós-assinatura (PDF/atividade) falhou em background:', bgErr);
        }
      })();
    } catch (err: unknown) {
      console.error('Erro ao assinar contrato:', err);
      toast({
        title: 'Erro',
        description: err instanceof Error ? err.message : 'Erro ao assinar contrato',
        variant: 'destructive',
      });
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
            {contractRequiresOtp ? (
              <div className="flex gap-2 pt-2 text-xs text-muted-foreground flex-wrap">
                <span className={step === 'identity' ? 'text-primary font-medium' : ''}>1. Identidade</span>
                <span>→</span>
                <span className={step === 'otp' ? 'text-primary font-medium' : ''}>2. Código WhatsApp</span>
                <span>→</span>
                <span className={step === 'sign' ? 'text-primary font-medium' : ''}>3. Assinatura</span>
              </div>
            ) : (
              <p className="pt-2 text-xs text-muted-foreground">
                Assinatura eletrônica padrão — nome, assinatura e aceite dos termos
              </p>
            )}
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

              {contractRequiresOtp && (step === 'identity' || step === 'otp') && (
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

              {contractRequiresOtp && step === 'identity' && (
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

              {contractRequiresOtp && step === 'otp' && (
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
                  {contractRequiresOtp ? (
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
                    </>
                  ) : (
                    <div className="space-y-2">
                      <Label htmlFor="signer-name-standard">Seu Nome Completo *</Label>
                      <Input
                        id="signer-name-standard"
                        data-testid="signer-name"
                        value={signerName}
                        onChange={(e) => setSignerName(e.target.value)}
                        placeholder="Digite seu nome completo"
                        required
                        disabled={signing}
                      />
                    </div>
                  )}

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
