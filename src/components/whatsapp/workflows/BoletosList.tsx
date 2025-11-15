import React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, Trash2, FileText } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useAsaasBoletos, type Boleto } from "@/hooks/useAsaasBoletos";

interface BoletoListProps {
  leadId?: string;
  workflowId?: string;
}

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

export function BoletosList({ leadId, workflowId }: BoletoListProps) {
  const { boletos, isLoadingBoletos, deleteBoleto, isDeletingBoleto } =
    useAsaasBoletos();

  const [filteredBoletos, setFilteredBoletos] = React.useState<Boleto[]>([]);

  React.useEffect(() => {
    let filtered = boletos;

    if (leadId) {
      filtered = filtered.filter((b) => b.lead_id === leadId);
    }

    if (workflowId) {
      filtered = filtered.filter((b) => b.workflow_id === workflowId);
    }

    setFilteredBoletos(filtered);
  }, [boletos, leadId, workflowId]);

  const handleDownloadPDF = (boleto: Boleto) => {
    if (boleto.boleto_pdf_url) {
      window.open(boleto.boleto_pdf_url, "_blank");
    }
  };

  const handleDownloadBoleto = (boleto: Boleto) => {
    if (boleto.boleto_url) {
      window.open(boleto.boleto_url, "_blank");
    }
  };

  const handleDelete = (boletoId: string) => {
    if (confirm("Tem certeza que deseja deletar este boleto?")) {
      deleteBoleto(boletoId);
    }
  };

  if (isLoadingBoletos) {
    return <div className="text-muted-foreground text-sm">Carregando boletos...</div>;
  }

  if (filteredBoletos.length === 0) {
    return (
      <div className="text-muted-foreground text-sm text-center py-4">
        Nenhum boleto gerado
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Boletos Gerados ({filteredBoletos.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24">Status</TableHead>
                <TableHead className="w-20">Valor</TableHead>
                <TableHead className="w-24">Vencimento</TableHead>
                <TableHead className="w-40">Descrição</TableHead>
                <TableHead className="w-20">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredBoletos.map((boleto) => (
                <TableRow key={boleto.id}>
                  <TableCell>
                    <Badge className={statusColors[boleto.status] || "bg-gray-100"}>
                      {statusLabels[boleto.status] || boleto.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    R$ {boleto.valor.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-sm">
                    {format(new Date(boleto.data_vencimento), "dd/MM/yyyy", {
                      locale: ptBR,
                    })}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground truncate max-w-xs">
                    {boleto.descricao || "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {boleto.boleto_pdf_url && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDownloadPDF(boleto)}
                          title="Download PDF"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      )}
                      {boleto.boleto_url && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDownloadBoleto(boleto)}
                          title="Link do boleto"
                        >
                          <FileText className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(boleto.id)}
                        disabled={isDeletingBoleto}
                        className="text-red-500 hover:text-red-700"
                        title="Deletar"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

