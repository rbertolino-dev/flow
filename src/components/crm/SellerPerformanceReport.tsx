import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSellerPerformance } from "@/hooks/useSellerPerformance";
import { Lead } from "@/types/lead";
import { PipelineStage } from "@/hooks/usePipelineStages";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  TrendingUp,
  TrendingDown,
  Users,
  DollarSign,
  Target,
  Clock,
  MessageSquare,
  PhoneCall,
  FileText,
  BarChart3,
  Calendar,
  Download,
  Award,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";

interface SellerPerformanceReportProps {
  leads: Lead[];
  stages: PipelineStage[];
}

export function SellerPerformanceReport({
  leads,
  stages,
}: SellerPerformanceReportProps) {
  const [selectedSeller, setSelectedSeller] = useState<string>("all");
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [activeTab, setActiveTab] = useState("overview");

  const performance = useSellerPerformance({
    leads,
    startDate,
    endDate,
    sellerId: selectedSeller !== "all" ? selectedSeller : undefined,
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const handleExport = () => {
    const csv = [
      [
        "Vendedor",
        "Email",
        "Total Leads",
        "Leads Este Mês",
        "Valor Total",
        "Ticket Médio",
        "Taxa Conversão",
        "Leads Ganhos",
        "Leads Perdidos",
        "Total Atividades",
        "Mensagens WhatsApp",
        "Ligações",
        "Notas",
        "Tempo Médio Resposta (h)",
        "Tempo Médio Fechamento (dias)",
      ].join(","),
      ...performance.map((seller) =>
        [
          `"${seller.sellerName}"`,
          `"${seller.sellerEmail}"`,
          seller.totalLeads,
          seller.leadsThisMonth,
          seller.totalValue,
          seller.averageTicket,
          seller.conversionRate,
          seller.wonLeads,
          seller.lostLeads,
          seller.totalActivities,
          seller.whatsappMessages,
          seller.calls,
          seller.notes,
          seller.averageResponseTime,
          seller.averageTimeToClose,
        ].join(",")
      ),
    ].join("\n");

    const blob = new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8;",
    });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `relatorio-vendedores-${format(new Date(), "yyyy-MM-dd")}.csv`
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Preparar dados para gráficos
  const chartData = performance.map((seller) => ({
    name: seller.sellerName.length > 15
      ? seller.sellerName.substring(0, 15) + "..."
      : seller.sellerName,
    leads: seller.totalLeads,
    value: seller.totalValue,
    conversion: seller.conversionRate,
    activities: seller.totalActivities,
  }));

  const topPerformers = [...performance]
    .sort((a, b) => b.totalValue - a.totalValue)
    .slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Filtros e Exportação */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Relatório de Performance por Vendedor</CardTitle>
              <CardDescription>
                Análise detalhada de atividades e resultados por vendedor
              </CardDescription>
            </div>
            <Button variant="outline" onClick={handleExport}>
              <Download className="h-4 w-4 mr-2" />
              Exportar CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Vendedor</label>
              <Select value={selectedSeller} onValueChange={setSelectedSeller}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos os vendedores" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os vendedores</SelectItem>
                  {performance.map((seller) => (
                    <SelectItem key={seller.sellerId} value={seller.sellerId}>
                      {seller.sellerName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Data Inicial</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <Calendar className="mr-2 h-4 w-4" />
                    {startDate
                      ? format(startDate, "dd/MM/yyyy", { locale: ptBR })
                      : "Selecionar"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <CalendarComponent
                    mode="single"
                    selected={startDate}
                    onSelect={setStartDate}
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Data Final</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <Calendar className="mr-2 h-4 w-4" />
                    {endDate
                      ? format(endDate, "dd/MM/yyyy", { locale: ptBR })
                      : "Selecionar"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <CalendarComponent
                    mode="single"
                    selected={endDate}
                    onSelect={setEndDate}
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Top Performers */}
      {selectedSeller === "all" && topPerformers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5" />
              Top 5 Vendedores
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              {topPerformers.map((seller, index) => (
                <Card key={seller.sellerId} className="border-primary/20">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant="outline" className="text-lg font-bold">
                        #{index + 1}
                      </Badge>
                    </div>
                    <h3 className="font-semibold text-sm mb-1">{seller.sellerName}</h3>
                    <p className="text-2xl font-bold text-primary">
                      {formatCurrency(seller.totalValue)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {seller.totalLeads} leads • {seller.conversionRate.toFixed(1)}% conversão
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs com diferentes visualizações */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="charts">Gráficos</TabsTrigger>
          <TabsTrigger value="activities">Atividades</TabsTrigger>
          <TabsTrigger value="stages">Por Etapa</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total de Vendedores</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{performance.length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total de Leads</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {performance.reduce((sum, p) => sum + p.totalLeads, 0)}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Valor Total</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(
                    performance.reduce((sum, p) => sum + p.totalValue, 0)
                  )}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Conversão Média</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {performance.length > 0
                    ? Math.round(
                        (performance.reduce((sum, p) => sum + p.conversionRate, 0) /
                          performance.length) *
                          10
                      ) / 10
                    : 0}
                  %
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Tabela Detalhada */}
          <Card>
            <CardHeader>
              <CardTitle>Performance Detalhada</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Vendedor</TableHead>
                      <TableHead>Leads</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Ticket Médio</TableHead>
                      <TableHead>Conversão</TableHead>
                      <TableHead>Ganhos</TableHead>
                      <TableHead>Perdidos</TableHead>
                      <TableHead>Atividades</TableHead>
                      <TableHead>Tempo Resposta</TableHead>
                      <TableHead>Tempo Fechamento</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {performance.map((seller) => (
                      <TableRow key={seller.sellerId}>
                        <TableCell className="font-medium">
                          <div className="flex flex-col">
                            <span>{seller.sellerName}</span>
                            <span className="text-xs text-muted-foreground">
                              {seller.sellerEmail}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium">{seller.totalLeads}</span>
                            <span className="text-xs text-muted-foreground">
                              {seller.leadsThisMonth} este mês
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">
                          {formatCurrency(seller.totalValue)}
                        </TableCell>
                        <TableCell>{formatCurrency(seller.averageTicket)}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              seller.conversionRate >= 30
                                ? "default"
                                : seller.conversionRate >= 15
                                ? "secondary"
                                : "outline"
                            }
                          >
                            {seller.conversionRate.toFixed(1)}%
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="default">{seller.wonLeads}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="destructive">{seller.lostLeads}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span>{seller.totalActivities}</span>
                            <div className="flex gap-1 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <MessageSquare className="h-3 w-3" />
                                {seller.whatsappMessages}
                              </span>
                              <span className="flex items-center gap-1">
                                <PhoneCall className="h-3 w-3" />
                                {seller.calls}
                              </span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {seller.averageResponseTime.toFixed(1)}h
                          </div>
                        </TableCell>
                        <TableCell>
                          {seller.averageTimeToClose > 0
                            ? `${seller.averageTimeToClose.toFixed(1)} dias`
                            : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="charts" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Leads por Vendedor</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="name"
                      angle={-45}
                      textAnchor="end"
                      height={100}
                      fontSize={12}
                    />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="leads" fill="#8884d8" name="Leads" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Valor por Vendedor</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="name"
                      angle={-45}
                      textAnchor="end"
                      height={100}
                      fontSize={12}
                    />
                    <YAxis />
                    <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                    <Legend />
                    <Bar dataKey="value" fill="#82ca9d" name="Valor (R$)" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Taxa de Conversão</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="name"
                      angle={-45}
                      textAnchor="end"
                      height={100}
                      fontSize={12}
                    />
                    <YAxis />
                    <Tooltip formatter={(value) => `${value}%`} />
                    <Legend />
                    <Bar dataKey="conversion" fill="#ffc658" name="Conversão (%)" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Atividades por Vendedor</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="name"
                      angle={-45}
                      textAnchor="end"
                      height={100}
                      fontSize={12}
                    />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="activities" fill="#ff7300" name="Atividades" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="activities" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Distribuição de Atividades</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {performance.map((seller) => (
                  <Card key={seller.sellerId}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">{seller.sellerName}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm flex items-center gap-2">
                            <MessageSquare className="h-4 w-4" />
                            WhatsApp
                          </span>
                          <span className="font-medium">{seller.whatsappMessages}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm flex items-center gap-2">
                            <PhoneCall className="h-4 w-4" />
                            Ligações
                          </span>
                          <span className="font-medium">{seller.calls}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm flex items-center gap-2">
                            <FileText className="h-4 w-4" />
                            Notas
                          </span>
                          <span className="font-medium">{seller.notes}</span>
                        </div>
                        <div className="pt-2 border-t">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">Total</span>
                            <span className="font-bold">{seller.totalActivities}</span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stages" className="space-y-4">
          {performance.map((seller) => (
            <Card key={seller.sellerId}>
              <CardHeader>
                <CardTitle>{seller.sellerName}</CardTitle>
                <CardDescription>Distribuição de leads por etapa</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Etapa</TableHead>
                      <TableHead>Quantidade</TableHead>
                      <TableHead>Valor Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {seller.leadsByStage.map((stage) => (
                      <TableRow key={stage.stageId}>
                        <TableCell>{stage.stageName}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{stage.count}</Badge>
                        </TableCell>
                        <TableCell className="font-medium">
                          {formatCurrency(stage.value)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}



