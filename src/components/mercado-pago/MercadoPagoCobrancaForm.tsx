import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useMercadoPago } from "@/hooks/useMercadoPago";
import { useActiveOrganization } from "@/hooks/useActiveOrganization";
import { supabase } from "@/integrations/supabase/client";
import { Download, FileText, ExternalLink, Copy, CheckCircle2, Loader2, Calendar } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";

interface MercadoPagoCobrancaFormProps {
  leadId: string;
  leadName: string;
  leadEmail?: string;
  leadPhone?: string;
  leadCpfCnpj?: string;
  onSuccess?: (cobranca: any) => void;
}

export function MercadoPagoCobrancaForm({
  leadId,
  leadName,
  leadEmail,
  leadPhone,
  leadCpfCnpj,
  onSuccess,
}: MercadoPagoCobrancaFormProps) {
  const { createPayment, createBoleto, isCreatingPayment, isCreatingBoleto } = useMercadoPago();
  const { activeOrgId } = useActiveOrganization();
  const { toast } = useToast();
  const [showDialog, setShowDialog] = useState(false);
  const [isCreatingLead, setIsCreatingLead] = useState(false);
  const [tipoCobranca, setTipoCobranca] = useState<"link" | "boleto">("link");
  const [formData, setFormData] = useState({
    cpfCnpj: leadCpfCnpj || "",
    email: leadEmail || "",
    phone: leadPhone || "",
    valor: "",
    descricao: "",
    referenciaExterna: "",
    dataVencimento: format(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), "yyyy-MM-dd"), // 7 dias
    // Endereço (opcional para boleto)
    street_name: "",
    street_number: "",
    zip_code: "",
  });
  const [generatedCobranca, setGeneratedCobranca] = useState<any>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const createTemporaryLead = async (name: string, email?: string, phone?: string) => {
    if (!activeOrgId) throw new Error("Organização não encontrada");

    // Buscar primeiro estágio do funil
    const { data: firstStage } = await supabase
      .from("pipeline_stages")
      .select("id")
      .eq("organization_id", activeOrgId)
      .order("position", { ascending: true })
      .limit(1)
      .maybeSingle();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Usuário não autenticado");

    const { data: newLead, error } = await supabase
      .from("leads")
      .insert({
        user_id: user.id,
        organization_id: activeOrgId,
        name: name || "Cobrança Mercado Pago",
        phone: phone || "00000000000",
        email: email,
        source: "mercado_pago",
        status: "novo",
        stage_id: firstStage?.id,
      })
      .select()
      .single();

    if (error) throw error;
    return newLead.id;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.valor) {
      toast({
        title: "Campo obrigatório",
        description: "Valor é obrigatório",
        variant: "destructive",
      });
      return;
    }

    if (tipoCobranca === "link" && !formData.email) {
      toast({
        title: "Campo obrigatório",
        description: "Email é obrigatório para link de pagamento",
        variant: "destructive",
      });
      return;
    }

    if (tipoCobranca === "boleto" && !formData.cpfCnpj) {
      toast({
        title: "Campo obrigatório",
        description: "CPF/CNPJ é obrigatório para boleto",
        variant: "destructive",
      });
      return;
    }

    try {
      // Criar lead temporário se necessário
      let finalLeadId = leadId;
      if (!leadId || leadId === activeOrgId) {
        setIsCreatingLead(true);
        finalLeadId = await createTemporaryLead(
          leadName || formData.email || "Cliente",
          formData.email,
          formData.phone
        );
        setIsCreatingLead(false);
      }

      let result;
      
      if (tipoCobranca === "link") {
        // Criar link de pagamento
        result = await createPayment({
          leadId: finalLeadId,
          payer: {
            name: leadName,
            email: formData.email,
            phone: formData.phone || undefined,
            cpfCnpj: formData.cpfCnpj || undefined,
          },
          payment: {
            valor: parseFloat(formData.valor),
            descricao: formData.descricao || undefined,
            referenciaExterna: formData.referenciaExterna || undefined,
          },
        });
      } else {
        // Criar boleto
        result = await createBoleto({
          leadId: finalLeadId,
          payer: {
            name: leadName,
            email: formData.email || undefined,
            phone: formData.phone || undefined,
            cpfCnpj: formData.cpfCnpj,
            address: formData.street_name
              ? {
                  street_name: formData.street_name,
                  street_number: formData.street_number,
                  zip_code: formData.zip_code,
                }
              : undefined,
          },
          boleto: {
            valor: parseFloat(formData.valor),
            descricao: formData.descricao || undefined,
            referenciaExterna: formData.referenciaExterna || undefined,
            dataVencimento: formData.dataVencimento || undefined,
          },
        });
      }

      setGeneratedCobranca(result.payment || result.boleto);
      if (onSuccess) {
        onSuccess(result.payment || result.boleto);
      }

      // Resetar form
      setFormData({
        cpfCnpj: leadCpfCnpj || "",
        email: leadEmail || "",
        phone: leadPhone || "",
        valor: "",
        descricao: "",
        referenciaExterna: "",
        dataVencimento: format(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), "yyyy-MM-dd"),
        street_name: "",
        street_number: "",
        zip_code: "",
      });
    } catch (error: any) {
      console.error("Erro ao criar cobrança:", error);
      toast({
        title: "Erro ao criar cobrança",
        description: error.message || "Não foi possível criar a cobrança",
        variant: "destructive",
      });
    }
  };

  const handleCopyLink = () => {
    if (generatedCobranca?.payment_link) {
      navigator.clipboard.writeText(generatedCobranca.payment_link);
      setLinkCopied(true);
      toast({
        title: "Link copiado!",
        description: "O link foi copiado para a área de transferência",
      });
      setTimeout(() => setLinkCopied(false), 2000);
    }
  };

  const handleOpenLink = () => {
    if (generatedCobranca?.payment_link || generatedCobranca?.ticket_url) {
      window.open(generatedCobranca.payment_link || generatedCobranca.ticket_url, "_blank");
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  return (
    <>
      <Button
        onClick={() => setShowDialog(true)}
        className="gap-2"
        size="sm"
        variant="outline"
      >
        <FileText className="h-4 w-4" />
        Gerar Cobrança MP
      </Button>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Criar Cobrança Mercado Pago para {leadName}</DialogTitle>
            <DialogDescription>
              Escolha o tipo de cobrança e preencha os dados abaixo
            </DialogDescription>
          </DialogHeader>

          {!generatedCobranca ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Tipo de cobrança */}
              <div className="space-y-3">
                <Label>Tipo de Cobrança *</Label>
                <RadioGroup
                  value={tipoCobranca}
                  onValueChange={(value) => setTipoCobranca(value as "link" | "boleto")}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="link" id="link" />
                    <Label htmlFor="link" className="font-normal cursor-pointer">
                      Link de Pagamento (Checkout Pro)
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="boleto" id="boleto" />
                    <Label htmlFor="boleto" className="font-normal cursor-pointer">
                      Boleto Bancário
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Dados do pagador */}
              <div className="space-y-2">
                <Label htmlFor="email">Email {tipoCobranca === "link" && "*"}</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="email@exemplo.com"
                  value={formData.email}
                  onChange={handleInputChange}
                  required={tipoCobranca === "link"}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">Telefone</Label>
                  <Input
                    id="phone"
                    name="phone"
                    type="tel"
                    placeholder="(11) 99999-9999"
                    value={formData.phone}
                    onChange={handleInputChange}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cpfCnpj">CPF/CNPJ {tipoCobranca === "boleto" && "*"}</Label>
                  <Input
                    id="cpfCnpj"
                    name="cpfCnpj"
                    placeholder="000.000.000-00"
                    value={formData.cpfCnpj}
                    onChange={handleInputChange}
                    required={tipoCobranca === "boleto"}
                  />
                </div>
              </div>

              {/* Valor e vencimento */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="valor">Valor *</Label>
                  <Input
                    id="valor"
                    name="valor"
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="0.00"
                    value={formData.valor}
                    onChange={handleInputChange}
                    required
                  />
                </div>

                {tipoCobranca === "boleto" && (
                  <div className="space-y-2">
                    <Label htmlFor="dataVencimento">Data de Vencimento</Label>
                    <Input
                      id="dataVencimento"
                      name="dataVencimento"
                      type="date"
                      value={formData.dataVencimento}
                      onChange={handleInputChange}
                    />
                  </div>
                )}
              </div>

              {/* Endereço (opcional para boleto) */}
              {tipoCobranca === "boleto" && (
                <div className="space-y-3 border-t pt-3">
                  <Label className="text-sm font-semibold">Endereço (Opcional)</Label>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-2 col-span-2">
                      <Label htmlFor="street_name">Rua</Label>
                      <Input
                        id="street_name"
                        name="street_name"
                        placeholder="Nome da rua"
                        value={formData.street_name}
                        onChange={handleInputChange}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="street_number">Número</Label>
                      <Input
                        id="street_number"
                        name="street_number"
                        placeholder="123"
                        value={formData.street_number}
                        onChange={handleInputChange}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="zip_code">CEP</Label>
                    <Input
                      id="zip_code"
                      name="zip_code"
                      placeholder="00000-000"
                      value={formData.zip_code}
                      onChange={handleInputChange}
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="descricao">Descrição</Label>
                <Textarea
                  id="descricao"
                  name="descricao"
                  placeholder="Descrição da cobrança (opcional)"
                  value={formData.descricao}
                  onChange={handleInputChange}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="referenciaExterna">Referência Externa</Label>
                <Input
                  id="referenciaExterna"
                  name="referenciaExterna"
                  placeholder="Número de referência (opcional)"
                  value={formData.referenciaExterna}
                  onChange={handleInputChange}
                />
              </div>

              <div className="flex gap-2 justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowDialog(false)}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={
                    !formData.valor ||
                    (tipoCobranca === "link" && !formData.email) ||
                    (tipoCobranca === "boleto" && !formData.cpfCnpj) ||
                    isCreatingPayment ||
                    isCreatingBoleto ||
                    isCreatingLead
                  }
                >
                  {(isCreatingPayment || isCreatingBoleto || isCreatingLead) ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      {isCreatingLead ? "Preparando..." : "Gerando..."}
                    </>
                  ) : (
                    tipoCobranca === "link" ? "Gerar Link" : "Gerar Boleto"
                  )}
                </Button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              <Card className="bg-green-50 border-green-200 p-4">
                <h3 className="font-semibold text-green-900 mb-2 flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5" />
                  {tipoCobranca === "link" ? "Link de Pagamento" : "Boleto"} Gerado com Sucesso
                </h3>
                <div className="space-y-2 text-sm text-green-800">
                  <p>
                    <strong>ID Mercado Pago:</strong> {generatedCobranca.mercado_pago_payment_id || generatedCobranca.mercado_pago_preference_id}
                  </p>
                  <p>
                    <strong>Valor:</strong> {formatCurrency(generatedCobranca.valor)}
                  </p>
                  {generatedCobranca.descricao && (
                    <p>
                      <strong>Descrição:</strong> {generatedCobranca.descricao}
                    </p>
                  )}
                  <p>
                    <strong>Status:</strong>{" "}
                    <span className="capitalize">{generatedCobranca.status}</span>
                  </p>
                  {tipoCobranca === "boleto" && generatedCobranca.data_vencimento && (
                    <p className="flex gap-2 items-center">
                      <Calendar className="h-4 w-4" />
                      <strong>Vencimento:</strong>{" "}
                      {format(
                        new Date(generatedCobranca.data_vencimento),
                        "dd/MM/yyyy",
                        { locale: ptBR }
                      )}
                    </p>
                  )}
                </div>
              </Card>

              {(generatedCobranca.payment_link || generatedCobranca.ticket_url) && (
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">
                    {tipoCobranca === "link" ? "Link de Pagamento" : "Link do Boleto"}
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      value={generatedCobranca.payment_link || generatedCobranca.ticket_url}
                      readOnly
                      className="font-mono text-xs"
                    />
                    <Button
                      onClick={handleCopyLink}
                      variant="outline"
                      size="icon"
                      title="Copiar link"
                    >
                      {linkCopied ? (
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      onClick={handleOpenLink}
                      variant="default"
                      className="gap-2"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Abrir
                    </Button>
                  </div>
                </div>
              )}

              {tipoCobranca === "boleto" && generatedCobranca.barcode && (
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Código de Barras</Label>
                  <Input
                    value={generatedCobranca.barcode}
                    readOnly
                    className="font-mono text-xs"
                  />
                </div>
              )}

              <div className="flex gap-2 justify-end">
                <Button onClick={() => {
                  setGeneratedCobranca(null);
                  setShowDialog(false);
                }}>
                  Fechar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

