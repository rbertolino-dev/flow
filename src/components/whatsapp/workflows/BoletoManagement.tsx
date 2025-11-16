import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Download, RefreshCw } from "lucide-react";
import { useAsaasBoletos } from "@/hooks/useAsaasBoletos";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  open: "bg-blue-100 text-blue-800",
  paid: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
  overdue: "bg-orange-100 text-orange-800",
  refunded: "bg-purple-100 text-purple-800",
};

const statusLabels: Record<string, string> = {
  pending: "Pendente",
  open: "Aberto",
  paid: "Pago",
  cancelled: "Cancelado",
  overdue: "Vencido",
  refunded: "Reembolsado",
};

export function BoletoManagement() {
  const { boletos, isLoadingBoletos, refetchBoletos } = useAsaasBoletos();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetchBoletos();
    setIsRefreshing(false);
  };

  const handleDownloadPDF = (pdfUrl: string | null) => {
    if (pdfUrl) {
      window.open(pdfUrl, "_blank");
    }
  };

  if (isLoadingBoletos) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">
            Carregando boletos...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Gestão de Boletos Asaas
          </CardTitle>
          <Button
            onClick={handleRefresh}
            disabled={isRefreshing}
            variant="outline"
            size="sm"
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {boletos.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-4 opacity-20" />
            <p>Nenhum boleto gerado ainda</p>
          </div>
        ) : (
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID Asaas</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {boletos.map((boleto) => (
                  <TableRow key={boleto.id}>
                    <TableCell className="font-mono text-xs">
                      {boleto.asaas_payment_id}
                    </TableCell>
                    <TableCell>
                      <Badge className={statusColors[boleto.status] || "bg-gray-100"}>
                        {statusLabels[boleto.status] || boleto.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-semibold">
                      R$ {boleto.valor.toFixed(2)}
                    </TableCell>
                    <TableCell>
                      {format(new Date(boleto.data_vencimento), "dd/MM/yyyy", {
                        locale: ptBR,
                      })}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                      {boleto.descricao || "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {boleto.boleto_pdf_url && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDownloadPDF(boleto.boleto_pdf_url)}
                          className="gap-2"
                        >
                          <Download className="h-4 w-4" />
                          PDF
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
