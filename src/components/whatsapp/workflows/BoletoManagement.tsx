import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  Download,
  RefreshCw,
  Search,
  Eye,
  ExternalLink,
  Copy,
  CheckCircle2,
} from "lucide-react";
import { useAsaasBoletos, type Boleto } from "@/hooks/useAsaasBoletos";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800 border-yellow-300",
  open: "bg-blue-100 text-blue-800 border-blue-300",
  paid: "bg-green-100 text-green-800 border-green-300",
  cancelled: "bg-red-100 text-red-800 border-red-300",
  overdue: "bg-orange-100 text-orange-800 border-orange-300",
  refunded: "bg-purple-100 text-purple-800 border-purple-300",
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
  const { boletos, isLoadingBoletos, refetchBoletos, syncBoletoStatus, isSyncingStatus } = useAsaasBoletos();
  const { toast } = useToast();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedBoleto, setSelectedBoleto] = useState<Boleto | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetchBoletos();
    setIsRefreshing(false);
  };

  const handleSyncStatus = async () => {
    try {
      const result = await syncBoletoStatus();
      if (result?.synced !== undefined) {
        toast({
          title: "Status sincronizado",
          description: `Status de ${result.synced} boleto(s) atualizado(s) com sucesso.`,
        });
      }
    } catch (error) {
      // Erro já é tratado pelo hook
      console.error("Erro ao sincronizar status:", error);
    }
  };

  const handleDownloadPDF = (pdfUrl: string | null) => {
    if (pdfUrl) {
      window.open(pdfUrl, "_blank");
    } else {
      toast({
        title: "PDF não disponível",
        description: "O PDF deste boleto ainda não foi gerado.",
        variant: "destructive",
      });
    }
  };

  const handleCopyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copiado!",
      description: `${label} copiado para a área de transferência.`,
    });
  };

  const handleViewDetails = (boleto: Boleto) => {
    setSelectedBoleto(boleto);
    setIsDetailOpen(true);
  };

  const filteredBoletos = useMemo(() => {
    let filtered = boletos;

    // Filtro por status
    if (statusFilter !== "all") {
      filtered = filtered.filter((b) => b.status === statusFilter);
    }

    // Filtro por busca
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (b) =>
          b.asaas_payment_id.toLowerCase().includes(term) ||
          b.descricao?.toLowerCase().includes(term) ||
          b.asaas_customer_id.toLowerCase().includes(term) ||
          b.linha_digitavel?.toLowerCase().includes(term) ||
          b.codigo_barras?.toLowerCase().includes(term)
      );
    }

    return filtered;
  }, [boletos, statusFilter, searchTerm]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    boletos.forEach((b) => {
      counts[b.status] = (counts[b.status] || 0) + 1;
    });
    return counts;
  }, [boletos]);

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
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Gestão de Boletos Asaas
              {boletos.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {boletos.length} total
                </Badge>
              )}
            </CardTitle>
            <div className="flex gap-2">
              <Button
                onClick={handleSyncStatus}
                disabled={isSyncingStatus || boletos.length === 0}
                variant="outline"
                size="sm"
                className="gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${isSyncingStatus ? "animate-spin" : ""}`} />
                {isSyncingStatus ? "Sincronizando..." : "Sincronizar Status"}
              </Button>
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
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filtros e busca */}
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="search">Buscar</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="ID, descrição, código..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="status-filter">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger id="status-filter">
                  <SelectValue placeholder="Todos os status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos ({boletos.length})</SelectItem>
                  {Object.entries(statusLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label} ({statusCounts[value] || 0})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <div className="flex gap-2 flex-wrap">
                {Object.entries(statusLabels).map(([value, label]) => {
                  const count = statusCounts[value] || 0;
                  if (count === 0) return null;
                  return (
                    <Badge
                      key={value}
                      variant="outline"
                      className={`${statusColors[value]} cursor-pointer`}
                      onClick={() => setStatusFilter(value)}
                    >
                      {label}: {count}
                    </Badge>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Lista de boletos */}
          {filteredBoletos.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>
                {searchTerm || statusFilter !== "all"
                  ? "Nenhum boleto encontrado com os filtros aplicados"
                  : "Nenhum boleto gerado ainda"}
              </p>
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
                  {filteredBoletos.map((boleto) => (
                    <TableRow key={boleto.id}>
                      <TableCell className="font-mono text-xs">
                        {boleto.asaas_payment_id.slice(0, 12)}...
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
                        <div className="flex gap-1 justify-end">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleViewDetails(boleto)}
                            title="Ver detalhes"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {boleto.boleto_pdf_url && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDownloadPDF(boleto.boleto_pdf_url)}
                              className="gap-2"
                              title="Download PDF"
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de detalhes do boleto */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Detalhes do Boleto
            </DialogTitle>
          </DialogHeader>
          {selectedBoleto && (
            <div className="space-y-4">
              {/* Status e valor */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Status</Label>
                  <Badge className={statusColors[selectedBoleto.status]}>
                    {statusLabels[selectedBoleto.status] || selectedBoleto.status}
                  </Badge>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Valor</Label>
                  <p className="text-lg font-semibold">R$ {selectedBoleto.valor.toFixed(2)}</p>
                </div>
              </div>

              {/* Datas */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Data de Vencimento</Label>
                  <p className="text-sm">
                    {format(new Date(selectedBoleto.data_vencimento), "dd/MM/yyyy", {
                      locale: ptBR,
                    })}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Criado em</Label>
                  <p className="text-sm">
                    {format(new Date(selectedBoleto.created_at), "dd/MM/yyyy HH:mm", {
                      locale: ptBR,
                    })}
                  </p>
                </div>
              </div>

              {/* Descrição */}
              {selectedBoleto.descricao && (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Descrição</Label>
                  <p className="text-sm">{selectedBoleto.descricao}</p>
                </div>
              )}

              {/* IDs */}
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">ID do Pagamento Asaas</Label>
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-mono flex-1 bg-muted p-2 rounded">
                      {selectedBoleto.asaas_payment_id}
                    </p>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        handleCopyToClipboard(selectedBoleto.asaas_payment_id, "ID do pagamento")
                      }
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">ID do Cliente Asaas</Label>
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-mono flex-1 bg-muted p-2 rounded">
                      {selectedBoleto.asaas_customer_id}
                    </p>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        handleCopyToClipboard(selectedBoleto.asaas_customer_id, "ID do cliente")
                      }
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* Linha digitável e código de barras */}
              {selectedBoleto.linha_digitavel && (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Linha Digitável</Label>
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-mono flex-1 bg-muted p-2 rounded">
                      {selectedBoleto.linha_digitavel}
                    </p>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        handleCopyToClipboard(selectedBoleto.linha_digitavel!, "Linha digitável")
                      }
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}

              {selectedBoleto.codigo_barras && (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Código de Barras</Label>
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-mono flex-1 bg-muted p-2 rounded">
                      {selectedBoleto.codigo_barras}
                    </p>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        handleCopyToClipboard(selectedBoleto.codigo_barras!, "Código de barras")
                      }
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}

              {selectedBoleto.nosso_numero && (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Nosso Número</Label>
                  <p className="text-sm font-mono">{selectedBoleto.nosso_numero}</p>
                </div>
              )}

              {/* URLs e ações */}
              <div className="flex flex-col gap-2 pt-4 border-t">
                {selectedBoleto.boleto_pdf_url && (
                  <Button
                    onClick={() => handleDownloadPDF(selectedBoleto.boleto_pdf_url)}
                    className="w-full gap-2"
                    variant="default"
                  >
                    <Download className="h-4 w-4" />
                    Baixar PDF do Boleto
                  </Button>
                )}
                {selectedBoleto.boleto_url && (
                  <Button
                    onClick={() => window.open(selectedBoleto.boleto_url!, "_blank")}
                    className="w-full gap-2"
                    variant="outline"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Abrir Link do Boleto
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
