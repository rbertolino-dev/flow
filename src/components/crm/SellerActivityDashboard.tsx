import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
  X,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useOrganizationUsers } from "@/hooks/useOrganizationUsers";

interface SellerActivityDashboardProps {
  leads: Lead[];
}

export function SellerActivityDashboard({ leads }: SellerActivityDashboardProps) {
  const [selectedSellers, setSelectedSellers] = useState<Set<string>>(new Set());
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const { users } = useOrganizationUsers();

  // Obter todos os vendedores disponíveis (primeiro buscar do performance, depois dos users)
  const allPerformance = useSellerPerformance({
    leads,
    startDate,
    endDate,
  });

  const availableSellers = useMemo(() => {
    const sellerMap = new Map<string, { id: string; name: string; email: string }>();
    
    // Adicionar vendedores do performance
    allPerformance.forEach((seller) => {
      sellerMap.set(seller.sellerId, {
        id: seller.sellerId,
        name: seller.sellerName,
        email: seller.sellerEmail,
      });
    });

    // Adicionar vendedores dos users que ainda não estão no mapa
    users.forEach((user) => {
      if (!sellerMap.has(user.id)) {
        sellerMap.set(user.id, {
          id: user.id,
          name: user.full_name || user.email,
          email: user.email,
        });
      }
    });

    return Array.from(sellerMap.values());
  }, [allPerformance, users]);

  const performance = useSellerPerformance({
    leads,
    startDate,
    endDate,
    sellerId: selectedSellers.size > 0 ? Array.from(selectedSellers) : undefined,
  });

  const toggleSeller = (sellerId: string) => {
    setSelectedSellers((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(sellerId)) {
        newSet.delete(sellerId);
      } else {
        newSet.add(sellerId);
      }
      return newSet;
    });
  };

  const clearAllSellers = () => {
    setSelectedSellers(new Set());
  };

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
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium">Vendedor</label>
                {selectedSellers.size > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearAllSellers}
                    className="h-6 px-2 text-xs"
                  >
                    <X className="h-3 w-3 mr-1" />
                    Limpar
                  </Button>
                )}
              </div>
              <ScrollArea className="h-[200px] border rounded-md p-3">
                <div className="space-y-2">
                  {availableSellers.map((seller) => (
                    <div
                      key={seller.id}
                      className="flex items-center space-x-2 cursor-pointer hover:bg-muted/50 p-2 rounded"
                      onClick={() => toggleSeller(seller.id)}
                    >
                      <Checkbox
                        checked={selectedSellers.has(seller.id)}
                        onCheckedChange={() => toggleSeller(seller.id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{seller.name}</div>
                        {seller.email && (
                          <div className="text-xs text-muted-foreground truncate">
                            {seller.email}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
              {selectedSellers.size > 0 && (
                <div className="mt-2 text-xs text-muted-foreground">
                  {selectedSellers.size} vendedor{selectedSellers.size > 1 ? "es" : ""} selecionado{selectedSellers.size > 1 ? "s" : ""}
                </div>
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
      {selectedSellers.size === 0 ? (
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
      ) : selectedSellers.size === 1 ? (
        <SellerDetailCards
          seller={performance.find((p) => selectedSellers.has(p.sellerId))}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total de Vendedores</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{selectedSellers.size}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Vendedores selecionados
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
                Vendedores selecionados
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
                Média dos selecionados
              </p>
            </CardContent>
          </Card>
        </div>
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



