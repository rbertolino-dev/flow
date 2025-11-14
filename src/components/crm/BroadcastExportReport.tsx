import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Download, Loader2, Eye } from "lucide-react";
import { format as formatDate } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useActiveOrganization } from "@/hooks/useActiveOrganization";

interface BroadcastExportReportProps {
  instances: any[];
}

interface ReportData {
  phone: string;
  name: string | null;
  sent_at: string | null;
  status: string;
  campaign_name: string;
  instance_name: string;
  error_message: string | null;
}

export function BroadcastExportReport({ instances }: BroadcastExportReportProps) {
  const { activeOrgId } = useActiveOrganization();
  const { toast } = useToast();
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [selectedInstance, setSelectedInstance] = useState<string>("all");
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState<ReportData[]>([]);
  const [showPreview, setShowPreview] = useState(false);

  const handleGenerateReport = async () => {
    if (!activeOrgId) {
      toast({
        title: "Erro",
        description: "Organização não identificada",
        variant: "destructive",
      });
      return;
    }

    if (!startDate || !endDate) {
      toast({
        title: "Atenção",
        description: "Selecione a data inicial e final",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    setShowPreview(false);

    try {
      let query = supabase
        .from("broadcast_queue")
        .select(`
          phone,
          name,
          sent_at,
          status,
          campaign_id,
          instance_id,
          error_message,
          broadcast_campaigns!inner(name, organization_id),
          evolution_config(instance_name)
        `)
        .eq("broadcast_campaigns.organization_id", activeOrgId)
        .eq("status", "sent")
        .gte("sent_at", startDate.toISOString())
        .lte("sent_at", new Date(endDate.getTime() + 86400000).toISOString());

      if (selectedInstance !== "all") {
        query = query.eq("instance_id", selectedInstance);
      }

      const { data, error } = await query.order("sent_at", { ascending: false });

      if (error) throw error;

      const formattedData: ReportData[] = (data || []).map((item: any) => ({
        phone: item.phone,
        name: item.name,
        sent_at: item.sent_at,
        status: item.status,
        campaign_name: item.broadcast_campaigns?.name || "N/A",
        instance_name: item.evolution_config?.instance_name || "N/A",
        error_message: item.error_message,
      }));

      setReportData(formattedData);
      setShowPreview(true);

      toast({
        title: "Relatório gerado",
        description: `${formattedData.length} registros encontrados`,
      });
    } catch (error: any) {
      toast({
        title: "Erro ao gerar relatório",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = () => {
    if (reportData.length === 0) {
      toast({
        title: "Atenção",
        description: "Nenhum dado para exportar",
        variant: "destructive",
      });
      return;
    }

    // Criar CSV
    const headers = ["Telefone", "Nome", "Data/Hora Envio", "Status", "Campanha", "Instância"];
    const csvContent = [
      headers.join(","),
      ...reportData.map((row) =>
        [
          row.phone,
          row.name || "",
          row.sent_at ? new Date(row.sent_at).toLocaleString("pt-BR") : "",
          row.status,
          `"${row.campaign_name}"`,
          row.instance_name,
        ].join(",")
      ),
    ].join("\n");

    // Download
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `relatorio-disparos-${formatDate(new Date(), "yyyy-MM-dd-HHmmss")}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Exportado com sucesso",
      description: `${reportData.length} registros exportados para CSV`,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Relatório de Disparos</CardTitle>
        <CardDescription>
          Exporte todos os disparos realizados por período e instância
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Filtros */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Data Inicial</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {startDate ? formatDate(startDate, "PPP", { locale: ptBR }) : "Selecione..."}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={startDate}
                  onSelect={setStartDate}
                  initialFocus
                  locale={ptBR}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label>Data Final</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {endDate ? formatDate(endDate, "PPP", { locale: ptBR }) : "Selecione..."}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={endDate}
                  onSelect={setEndDate}
                  initialFocus
                  locale={ptBR}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label>Instância</Label>
            <Select value={selectedInstance} onValueChange={setSelectedInstance}>
              <SelectTrigger>
                <SelectValue placeholder="Todas as instâncias" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as instâncias</SelectItem>
                {instances.map((instance) => (
                  <SelectItem key={instance.id} value={instance.id}>
                    {instance.instance_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Botões de ação */}
        <div className="flex gap-3">
          <Button onClick={handleGenerateReport} disabled={loading || !startDate || !endDate}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Gerando...
              </>
            ) : (
              <>
                <Eye className="h-4 w-4 mr-2" />
                Visualizar Relatório
              </>
            )}
          </Button>

          {showPreview && reportData.length > 0 && (
            <Button onClick={handleExportCSV} variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Exportar CSV ({reportData.length} registros)
            </Button>
          )}
        </div>

        {/* Preview dos dados */}
        {showPreview && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Preview dos Dados</h3>
              <Badge variant="secondary">{reportData.length} registros</Badge>
            </div>

            {reportData.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground border rounded-lg">
                Nenhum disparo encontrado no período selecionado
              </div>
            ) : (
              <ScrollArea className="h-[400px] border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Telefone</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Data/Hora</TableHead>
                      <TableHead>Campanha</TableHead>
                      <TableHead>Instância</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reportData.map((row, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-mono">{row.phone}</TableCell>
                        <TableCell>{row.name || "-"}</TableCell>
                        <TableCell className="text-sm">
                          {row.sent_at ? new Date(row.sent_at).toLocaleString("pt-BR") : "-"}
                        </TableCell>
                        <TableCell className="text-sm">{row.campaign_name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{row.instance_name}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="default">Enviado</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
