import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useMercadoPago } from "@/hooks/useMercadoPago";
import { ExternalLink, Copy, CheckCircle2, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface MercadoPagoPaymentFormProps {
  leadId: string;
  leadName: string;
  leadEmail?: string;
  leadPhone?: string;
  leadCpfCnpj?: string;
  onSuccess?: (payment: any) => void;
}

export function MercadoPagoPaymentForm({
  leadId,
  leadName,
  leadEmail,
  leadPhone,
  leadCpfCnpj,
  onSuccess,
}: MercadoPagoPaymentFormProps) {
  const { createPayment, isCreatingPayment } = useMercadoPago();
  const { toast } = useToast();
  const [showDialog, setShowDialog] = useState(false);
  const [formData, setFormData] = useState({
    cpfCnpj: leadCpfCnpj || "",
    email: leadEmail || "",
    phone: leadPhone || "",
    valor: "",
    descricao: "",
    referenciaExterna: "",
  });
  const [generatedPayment, setGeneratedPayment] = useState<any>(null);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.valor || !formData.email) {
      toast({
        title: "Campos obrigatórios",
        description: "Valor e Email são obrigatórios",
        variant: "destructive",
      });
      return;
    }

    try {
      const result = await createPayment({
        leadId,
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

      setGeneratedPayment(result.payment);
      if (onSuccess) {
        onSuccess(result.payment);
      }

      // Resetar form
      setFormData({
        cpfCnpj: leadCpfCnpj || "",
        email: leadEmail || "",
        phone: leadPhone || "",
        valor: "",
        descricao: "",
        referenciaExterna: "",
      });
    } catch (error: any) {
      console.error("Erro ao criar link de pagamento:", error);
      toast({
        title: "Erro ao criar link",
        description: error.message || "Não foi possível criar o link de pagamento",
        variant: "destructive",
      });
    }
  };

  const handleCopyLink = () => {
    if (generatedPayment?.payment_link) {
      navigator.clipboard.writeText(generatedPayment.payment_link);
      setLinkCopied(true);
      toast({
        title: "Link copiado!",
        description: "O link de pagamento foi copiado para a área de transferência",
      });
      setTimeout(() => setLinkCopied(false), 2000);
    }
  };

  const handleOpenLink = () => {
    if (generatedPayment?.payment_link) {
      window.open(generatedPayment.payment_link, "_blank");
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
        <ExternalLink className="h-4 w-4" />
        Gerar Link de Pagamento
      </Button>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Gerar Link de Pagamento para {leadName}</DialogTitle>
            <DialogDescription>
              Preencha os dados abaixo para gerar um link de pagamento via Mercado Pago
            </DialogDescription>
          </DialogHeader>

          {!generatedPayment ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email do Pagador *</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="email@exemplo.com"
                  value={formData.email}
                  onChange={handleInputChange}
                  required
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
                  <Label htmlFor="cpfCnpj">CPF/CNPJ</Label>
                  <Input
                    id="cpfCnpj"
                    name="cpfCnpj"
                    placeholder="000.000.000-00"
                    value={formData.cpfCnpj}
                    onChange={handleInputChange}
                  />
                </div>
              </div>

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

              <div className="space-y-2">
                <Label htmlFor="descricao">Descrição</Label>
                <Textarea
                  id="descricao"
                  name="descricao"
                  placeholder="Descrição do pagamento (opcional)"
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
                  disabled={!formData.valor || !formData.email || isCreatingPayment}
                >
                  {isCreatingPayment ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Gerando...
                    </>
                  ) : (
                    "Gerar Link"
                  )}
                </Button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              <Card className="bg-green-50 border-green-200 p-4">
                <h3 className="font-semibold text-green-900 mb-2 flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5" />
                  Link de Pagamento Gerado com Sucesso
                </h3>
                <div className="space-y-2 text-sm text-green-800">
                  <p>
                    <strong>Preferência ID:</strong> {generatedPayment.mercado_pago_preference_id}
                  </p>
                  <p>
                    <strong>Valor:</strong> {formatCurrency(generatedPayment.valor)}
                  </p>
                  {generatedPayment.descricao && (
                    <p>
                      <strong>Descrição:</strong> {generatedPayment.descricao}
                    </p>
                  )}
                  <p>
                    <strong>Status:</strong>{" "}
                    <span className="capitalize">{generatedPayment.status}</span>
                  </p>
                </div>
              </Card>

              <div className="space-y-2">
                <Label className="text-sm font-semibold">Link de Pagamento</Label>
                <div className="flex gap-2">
                  <Input
                    value={generatedPayment.payment_link}
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
                    Abrir Link
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Compartilhe este link com o cliente para realizar o pagamento
                </p>
              </div>

              <div className="flex gap-2 justify-end">
                <Button onClick={() => {
                  setGeneratedPayment(null);
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

