import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  FileText,
  ExternalLink,
  Search,
  RefreshCw,
  Copy,
  CheckCircle2,
} from "lucide-react";
import { useMercadoPago, type MercadoPagoPayment } from "@/hooks/useMercadoPago";
import { MercadoPagoCobrancaForm } from "./MercadoPagoCobrancaForm";
import { useActiveOrganization } from "@/hooks/useActiveOrganization";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800 border-yellow-300",
  approved: "bg-green-100 text-green-800 border-green-300",
  authorized: "bg-blue-100 text-blue-800 border-blue-300",
  in_process: "bg-purple-100 text-purple-800 border-purple-300",
  in_mediation: "bg-orange-100 text-orange-800 border-orange-300",
  rejected: "bg-red-100 text-red-800 border-red-300",
  cancelled: "bg-gray-100 text-gray-800 border-gray-300",
  refunded: "bg-pink-100 text-pink-800 border-pink-300",
  charged_back: "bg-red-100 text-red-800 border-red-300",
};

const statusLabels: Record<string, string> = {
  pending: "Pendente",
  approved: "Aprovado",
  authorized: "Autorizado",
  in_process: "Em Processamento",
  in_mediation: "Em Mediação",
  rejected: "Rejeitado",
  cancelled: "Cancelado",
  refunded: "Reembolsado",
  charged_back: "Estornado",
};

export function MercadoPagoCobrancasManagement() {
  const { payments, isLoadingPayments, refetchPayments } = useMercadoPago();
  const { activeOrgId } = useActiveOrganization();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [linkCopied, setLinkCopied] = useState<string | null>(null);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetchPayments();
    setIsRefreshing(false);
  };

  const handleCopyLink = (link: string, paymentId: string) => {
    navigator.clipboard.writeText(link);
    setLinkCopied(paymentId);
    toast({
      title: "Link copiado!",
      description: "O link foi copiado para a área de transferência",
    });
    setTimeout(() => setLinkCopied(null), 2000);
  };

  const handleOpenLink = (link: string) => {
    window.open(link, "_blank");
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const filteredPayments = useMemo(() => {
    let filtered = payments;

    if (searchTerm) {
      filtered = filtered.filter(
        (p) =>
          p.payer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          p.payer_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          p.descricao?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          p.mercado_pago_payment_id?.includes(searchTerm) ||
          p.mercado_pago_preference_id?.includes(searchTerm)
      );
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter((p) => p.status === statusFilter);
    }

    return filtered;
  }, [payments, searchTerm, statusFilter]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Cobranças Mercado Pago
            </CardTitle>
            <div className="flex gap-2">
              {activeOrgId && (
                <MercadoPagoCobrancaForm
                  leadId={activeOrgId}
                  leadName="Nova Cobrança"
                  leadEmail=""
                  onSuccess={() => {
                    queryClient.invalidateQueries({ queryKey: ["mercado-pago-payments", activeOrgId] });
                  }}
                />
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={isRefreshing}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
                Atualizar
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Filtros */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Input
                  placeholder="Buscar por nome, email, descrição ou ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full"
                />
              </div>
              <div className="space-y-2">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Filtrar por status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os status</SelectItem>
                    {Object.entries(statusLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Tabela */}
            {isLoadingPayments ? (
              <div className="text-center py-8 text-muted-foreground">
                Carregando cobranças...
              </div>
            ) : filteredPayments.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {searchTerm || statusFilter !== "all"
                  ? "Nenhuma cobrança encontrada com os filtros aplicados"
                  : "Nenhuma cobrança gerada ainda"}
              </div>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Pagador</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPayments.map((payment) => (
                      <TableRow key={payment.id}>
                        <TableCell className="font-mono text-xs">
                          {payment.mercado_pago_payment_id || payment.mercado_pago_preference_id}
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{payment.payer_name || "N/A"}</div>
                            {payment.payer_email && (
                              <div className="text-xs text-muted-foreground">
                                {payment.payer_email}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{formatCurrency(payment.valor)}</div>
                            {payment.valor_pago && payment.valor_pago !== payment.valor && (
                              <div className="text-xs text-muted-foreground">
                                Pago: {formatCurrency(payment.valor_pago)}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={statusColors[payment.status] || "bg-gray-100 text-gray-800"}
                          >
                            {statusLabels[payment.status] || payment.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {format(new Date(payment.created_at), "dd/MM/yyyy", { locale: ptBR })}
                          </div>
                          {payment.data_pagamento && (
                            <div className="text-xs text-muted-foreground">
                              Pago: {format(new Date(payment.data_pagamento), "dd/MM/yyyy", { locale: ptBR })}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          {payment.payment_link?.includes("checkout") ? (
                            <Badge variant="outline" className="bg-blue-50 text-blue-700">
                              Link
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-green-50 text-green-700">
                              Boleto
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            {payment.payment_link && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleCopyLink(payment.payment_link, payment.id)}
                                  title="Copiar link"
                                >
                                  {linkCopied === payment.id ? (
                                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                                  ) : (
                                    <Copy className="h-4 w-4" />
                                  )}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleOpenLink(payment.payment_link)}
                                  title="Abrir link"
                                >
                                  <ExternalLink className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* Resumo */}
            {filteredPayments.length > 0 && (
              <div className="flex justify-between items-center text-sm text-muted-foreground pt-4 border-t">
                <div>
                  Total: {filteredPayments.length} cobrança(s)
                </div>
                <div>
                  Total: {formatCurrency(
                    filteredPayments.reduce((sum, p) => sum + p.valor, 0)
                  )}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

