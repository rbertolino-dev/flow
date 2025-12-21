import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSellerPerformance, SellerPerformance } from "@/hooks/useSellerPerformance";
import { Lead } from "@/types/lead";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  TrendingUp,
  TrendingDown,
  Users,
  DollarSign,
  MessageSquare,
  PhoneCall,
  FileText,
  Clock,
  Target,
  BarChart3,
  Calendar,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface SellerActivityDashboardProps {
  leads: Lead[];
}

export function SellerActivityDashboard({ leads }: SellerActivityDashboardProps) {
  const [selectedSeller, setSelectedSeller] = useState<string>("all");
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();

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

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Vendedor</label>
              <Select value={selectedSeller} onValueChange={(value) => {
                setSelectedSeller(value);
              }}>
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
              {selectedSeller !== "all" && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2 w-full"
                  onClick={() => setSelectedSeller("all")}
                >
                  Limpar filtro
                </Button>
              )}
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Data Inicial</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <Calendar className="mr-2 h-4 w-4" />
                    {startDate
                      ? format(startDate, "dd/MM/yyyy", { locale: ptBR })
                      : "Selecionar data"}
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
                      : "Selecionar data"}
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

      {/* Cards de Métricas Gerais */}
      {selectedSeller === "all" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total de Vendedores</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{performance.length}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Vendedores ativos
              </p>
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
              <p className="text-xs text-muted-foreground mt-1">
                Todos os vendedores
              </p>
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
              <p className="text-xs text-muted-foreground mt-1">
                Pipeline total
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Taxa de Conversão Média</CardTitle>
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
              <p className="text-xs text-muted-foreground mt-1">
                Média geral
              </p>
            </CardContent>
          </Card>
        </div>
      ) : (
        <SellerDetailCards
          seller={performance.find((p) => p.sellerId === selectedSeller)}
        />
      )}

      {/* Tabela de Performance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Performance por Vendedor
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[600px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vendedor</TableHead>
                  <TableHead>Leads</TableHead>
                  <TableHead>Crescimento</TableHead>
                  <TableHead>Valor Total</TableHead>
                  <TableHead>Ticket Médio</TableHead>
                  <TableHead>Conversão</TableHead>
                  <TableHead>Atividades</TableHead>
                  <TableHead>WhatsApp</TableHead>
                  <TableHead>Ligações</TableHead>
                  <TableHead>Tempo Resposta</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {performance.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center text-muted-foreground">
                      Nenhum dado disponível
                    </TableCell>
                  </TableRow>
                ) : (
                  performance.map((seller) => (
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
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {seller.leadsGrowth >= 0 ? (
                            <TrendingUp className="h-4 w-4 text-green-500" />
                          ) : (
                            <TrendingDown className="h-4 w-4 text-red-500" />
                          )}
                          <span
                            className={
                              seller.leadsGrowth >= 0 ? "text-green-600" : "text-red-600"
                            }
                          >
                            {seller.leadsGrowth >= 0 ? "+" : ""}
                            {seller.leadsGrowth.toFixed(1)}%
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">
                            {formatCurrency(seller.totalValue)}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatCurrency(seller.valueThisMonth)} este mês
                          </span>
                        </div>
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
                        <div className="flex flex-col">
                          <span className="font-medium">{seller.totalActivities}</span>
                          <span className="text-xs text-muted-foreground">
                            {seller.activitiesThisWeek} esta semana
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <MessageSquare className="h-3 w-3" />
                          {seller.whatsappMessages}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <PhoneCall className="h-3 w-3" />
                          {seller.calls}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {seller.averageResponseTime.toFixed(1)}h
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

function SellerDetailCards({ seller }: { seller?: SellerPerformance }) {
  if (!seller) return null;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Users className="h-4 w-4" />
            Total de Leads
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{seller.totalLeads}</div>
          <div className="flex items-center gap-1 mt-1">
            {seller.leadsGrowth >= 0 ? (
              <TrendingUp className="h-3 w-3 text-green-500" />
            ) : (
              <TrendingDown className="h-3 w-3 text-red-500" />
            )}
            <span className="text-xs text-muted-foreground">
              {seller.leadsGrowth >= 0 ? "+" : ""}
              {seller.leadsGrowth.toFixed(1)}% vs mês anterior
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Valor Total
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(seller.totalValue)}</div>
          <p className="text-xs text-muted-foreground mt-1">
            Ticket médio: {formatCurrency(seller.averageTicket)}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Target className="h-4 w-4" />
            Taxa de Conversão
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{seller.conversionRate.toFixed(1)}%</div>
          <p className="text-xs text-muted-foreground mt-1">
            {seller.wonLeads} ganhos / {seller.lostLeads} perdidos
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Atividades
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{seller.totalActivities}</div>
          <div className="flex gap-2 mt-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <MessageSquare className="h-3 w-3" />
              {seller.whatsappMessages}
            </span>
            <span className="flex items-center gap-1">
              <PhoneCall className="h-3 w-3" />
              {seller.calls}
            </span>
            <span className="flex items-center gap-1">
              <FileText className="h-3 w-3" />
              {seller.notes}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}



