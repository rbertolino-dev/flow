import { useMemo } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Boleto } from "@/hooks/useAsaasBoletos";
import {
  STATUS_CLASSES,
  STATUS_LABELS,
  formatMoney,
} from "./cobrancaTypes";
import { ExternalLink, FileText, User, X } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface CobrancaDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  boleto: Boleto | null;
  allBoletos: Boleto[];
}

function formatDate(value?: string | null, withTime = false) {
  if (!value) return "—";
  try {
    return format(
      parseISO(value.length === 10 ? `${value}T12:00:00` : value),
      withTime ? "dd/MM/yyyy HH:mm" : "dd 'de' MMMM 'de' yyyy",
      { locale: ptBR },
    );
  } catch {
    return value;
  }
}

export function CobrancaDetailSheet({
  open,
  onOpenChange,
  boleto,
  allBoletos,
}: CobrancaDetailSheetProps) {
  const groupParcels = useMemo(() => {
    if (!boleto?.installment_group_id) return boleto ? [boleto] : [];
    return allBoletos
      .filter((b) => b.installment_group_id === boleto.installment_group_id)
      .sort((a, b) => (a.installment_number || 0) - (b.installment_number || 0));
  }, [boleto, allBoletos]);

  if (!boleto) return null;

  const status = (boleto.status || "pending").toLowerCase();
  const boletoLink = boleto.boleto_pdf_url || boleto.boleto_url;
  const paymentLink = boleto.boleto_url || boleto.boleto_pdf_url;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="space-y-3 text-left">
          <div className="flex items-start justify-between gap-2">
            <SheetTitle>Detalhes da Cobrança</SheetTitle>
            <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center shrink-0">
              <User className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-medium leading-snug break-words">
                {boleto.descricao || "Cobrança"}
              </p>
              <p className="text-lg font-semibold mt-1">{formatMoney(Number(boleto.valor) || 0)}</p>
            </div>
          </div>
        </SheetHeader>

        <Tabs defaultValue="geral" className="mt-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="geral">Geral</TabsTrigger>
            <TabsTrigger value="financeiro">Financeiro</TabsTrigger>
          </TabsList>

          <TabsContent value="geral" className="space-y-4 mt-4">
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Vencimento</dt>
                <dd className="font-medium text-right">{formatDate(boleto.data_vencimento)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Criado em</dt>
                <dd className="font-medium text-right">{formatDate(boleto.created_at, true)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Multa</dt>
                <dd className="font-medium">{formatMoney(Number(boleto.multa_valor) || 0)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Juros</dt>
                <dd className="font-medium">{Number(boleto.juros_percentual) || 0}%</dd>
              </div>
              <div className="flex justify-between gap-3 items-center">
                <dt className="text-muted-foreground">Status</dt>
                <dd>
                  <Badge variant="outline" className={cn(STATUS_CLASSES[status])}>
                    {STATUS_LABELS[status] || boleto.status}
                  </Badge>
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Email</dt>
                <dd className="font-medium text-right break-all">{boleto.customer_email || "—"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Telefone</dt>
                <dd className="font-medium">{boleto.customer_phone || "—"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Cliente</dt>
                <dd className="font-medium text-right">{boleto.customer_name || "—"}</dd>
              </div>
            </dl>

            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm flex items-center gap-2">
                  <FileText className="h-4 w-4" /> Boleto
                </span>
                {boletoLink ? (
                  <Button asChild size="sm" variant="default">
                    <a href={boletoLink} target="_blank" rel="noreferrer">
                      Acessar <ExternalLink className="h-3 w-3 ml-1" />
                    </a>
                  </Button>
                ) : (
                  <span className="text-xs text-muted-foreground">Indisponível</span>
                )}
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm">Link de pagamento Asaas</span>
                {paymentLink ? (
                  <Button asChild size="sm" variant="default">
                    <a href={paymentLink} target="_blank" rel="noreferrer">
                      Acessar <ExternalLink className="h-3 w-3 ml-1" />
                    </a>
                  </Button>
                ) : (
                  <span className="text-xs text-muted-foreground">Indisponível</span>
                )}
              </div>
            </div>

            {groupParcels.length > 1 && (
              <div className="pt-4 border-t space-y-2">
                <p className="text-sm font-medium">Parcelas do grupo</p>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {groupParcels.map((parcel) => {
                    const link = parcel.boleto_pdf_url || parcel.boleto_url;
                    const payLink = parcel.boleto_url || parcel.boleto_pdf_url;
                    return (
                      <div
                        key={parcel.id}
                        className="rounded-lg border bg-muted/40 p-3 space-y-2"
                      >
                        <div className="flex justify-between gap-2 text-sm">
                          <span className="font-medium">
                            Parcela {parcel.installment_number} de {parcel.installment_count}
                          </span>
                          <span>{formatMoney(Number(parcel.valor) || 0)}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Venc. {formatDate(parcel.data_vencimento)}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {link && (
                            <Button asChild size="sm" variant="outline" className="text-emerald-700 border-emerald-300">
                              <a href={link} target="_blank" rel="noreferrer">Ver Boleto</a>
                            </Button>
                          )}
                          {payLink && (
                            <Button asChild size="sm" variant="outline" className="text-emerald-700 border-emerald-300">
                              <a href={payLink} target="_blank" rel="noreferrer">Link de Pagamento</a>
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="financeiro" className="space-y-3 mt-4 text-sm">
            <p>
              <span className="text-muted-foreground">Conta a receber: </span>
              {boleto.generate_financial === false
                ? "Não gerada para esta cobrança"
                : "Gerada automaticamente no Financeiro (origem boleto/Asaas)"}
            </p>
            <p>
              <span className="text-muted-foreground">Valor: </span>
              {formatMoney(Number(boleto.valor) || 0)}
            </p>
            <p>
              <span className="text-muted-foreground">Vencimento: </span>
              {formatDate(boleto.data_vencimento)}
            </p>
            {boleto.data_pagamento && (
              <p>
                <span className="text-muted-foreground">Pago em: </span>
                {formatDate(boleto.data_pagamento)}
                {boleto.valor_pago != null ? ` · ${formatMoney(Number(boleto.valor_pago))}` : ""}
              </p>
            )}
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
