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
import { useAsaasBoletos } from "@/hooks/useAsaasBoletos";
import { Download, FileText, Calendar } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface AsaasBoletoFormProps {
  leadId: string;
  leadName: string;
  leadEmail?: string;
  leadPhone?: string;
  leadCpfCnpj?: string;
  onSuccess?: (boleto: any) => void;
}

export function AsaasBoletoForm({
  leadId,
  leadName,
  leadEmail,
  leadPhone,
  leadCpfCnpj,
  onSuccess,
}: AsaasBoletoFormProps) {
  const { createBoleto, isCreatingBoleto } = useAsaasBoletos();
  const [showDialog, setShowDialog] = useState(false);
  const [formData, setFormData] = useState({
    valor: "",
    dataVencimento: format(new Date(), "yyyy-MM-dd"),
    descricao: "",
    referenciaExterna: "",
  });
  const [generatedBoleto, setGeneratedBoleto] = useState<any>(null);

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

    if (!formData.valor || !formData.dataVencimento) {
      return;
    }

    try {
      const result = await createBoleto({
        leadId,
        customer: {
          name: leadName,
          cpfCnpj: leadCpfCnpj,
          email: leadEmail,
          phone: leadPhone,
        },
        boleto: {
          valor: parseFloat(formData.valor),
          dataVencimento: formData.dataVencimento,
          descricao: formData.descricao || undefined,
          referenciaExterna: formData.referenciaExterna || undefined,
        },
      });

      setGeneratedBoleto(result.boleto);
      if (onSuccess) {
        onSuccess(result.boleto);
      }

      // Resetar form
      setFormData({
        valor: "",
        dataVencimento: format(new Date(), "yyyy-MM-dd"),
        descricao: "",
        referenciaExterna: "",
      });
    } catch (error) {
      console.error("Erro ao criar boleto:", error);
    }
  };

  const handleDownloadPDF = () => {
    if (generatedBoleto?.boleto_pdf_url) {
      window.open(generatedBoleto.boleto_pdf_url, "_blank");
    }
  };

  const handleDownloadBoleto = () => {
    if (generatedBoleto?.boleto_url) {
      window.open(generatedBoleto.boleto_url, "_blank");
    }
  };

  return (
    <>
      <Button
        onClick={() => setShowDialog(true)}
        className="gap-2"
        size="sm"
      >
        <FileText className="h-4 w-4" />
        Gerar Boleto
      </Button>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Gerar Boleto para {leadName}</DialogTitle>
            <DialogDescription>
              Preencha os dados abaixo para gerar um boleto bancário via Asaas
            </DialogDescription>
          </DialogHeader>

          {!generatedBoleto ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="valor">Valor *</Label>
                  <Input
                    id="valor"
                    name="valor"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={formData.valor}
                    onChange={handleInputChange}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="dataVencimento">Data de Vencimento *</Label>
                  <Input
                    id="dataVencimento"
                    name="dataVencimento"
                    type="date"
                    value={formData.dataVencimento}
                    onChange={handleInputChange}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="descricao">Descrição</Label>
                <Textarea
                  id="descricao"
                  name="descricao"
                  placeholder="Descrição do boleto (opcional)"
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

              {leadCpfCnpj && (
                <p className="text-xs text-muted-foreground">
                  CPF/CNPJ: {leadCpfCnpj}
                </p>
              )}
              {leadEmail && (
                <p className="text-xs text-muted-foreground">
                  Email: {leadEmail}
                </p>
              )}

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
                  disabled={!formData.valor || isCreatingBoleto}
                >
                  {isCreatingBoleto ? "Gerando..." : "Gerar Boleto"}
                </Button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              <Card className="bg-green-50 border-green-200 p-4">
                <h3 className="font-semibold text-green-900 mb-2">
                  Boleto Gerado com Sucesso
                </h3>
                <div className="space-y-2 text-sm text-green-800">
                  <p>
                    <strong>ID Asaas:</strong> {generatedBoleto.asaas_payment_id}
                  </p>
                  <p>
                    <strong>Valor:</strong> R$ {generatedBoleto.valor.toFixed(2)}
                  </p>
                  <p className="flex gap-2 items-center">
                    <Calendar className="h-4 w-4" />
                    <strong>Vencimento:</strong>{" "}
                    {format(
                      new Date(generatedBoleto.data_vencimento),
                      "dd/MM/yyyy",
                      { locale: ptBR }
                    )}
                  </p>
                  {generatedBoleto.codigo_barras && (
                    <p>
                      <strong>Código de Barras:</strong> {generatedBoleto.codigo_barras}
                    </p>
                  )}
                </div>
              </Card>

              <div className="space-y-2">
                <Label className="text-sm font-semibold">Downloads</Label>
                <div className="grid grid-cols-2 gap-2">
                  {generatedBoleto.boleto_pdf_url && (
                    <Button
                      onClick={handleDownloadPDF}
                      variant="outline"
                      className="gap-2"
                    >
                      <Download className="h-4 w-4" />
                      PDF do Boleto
                    </Button>
                  )}
                  {generatedBoleto.boleto_url && (
                    <Button
                      onClick={handleDownloadBoleto}
                      variant="outline"
                      className="gap-2"
                    >
                      <Download className="h-4 w-4" />
                      Link do Boleto
                    </Button>
                  )}
                </div>
              </div>

              <div className="flex gap-2 justify-end">
                <Button onClick={() => setShowDialog(false)}>Fechar</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

