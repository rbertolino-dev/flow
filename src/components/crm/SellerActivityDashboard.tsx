import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";

interface SellerActivityDashboardProps {
  leads: Lead[];
}

export function SellerActivityDashboard({ leads }: SellerActivityDashboardProps) {
  const [selectedSellers, setSelectedSellers] = useState<Set<string>>(new Set());
  const [periodType, setPeriodType] = useState<'week' | 'biweekly' | 'month' | 'custom'>('week');
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [sellerPopoverOpen, setSellerPopoverOpen] = useState(false);

  // Buscar todos os vendedores primeiro (sem filtro)
  const allPerformance = useSellerPerformance({
    leads,
    startDate: undefined,
    endDate: undefined,
    sellerId: undefined,
  });

  // Calcular datas baseado no período selecionado
  useEffect(() => {
    if (periodType === 'custom') {
      // Usar datas customizadas - não alterar
      return;
    }

    const now = new Date();
    let start: Date;
    let end: Date = new Date(now);
    end.setHours(23, 59, 59, 999);

    switch (periodType) {
      case 'week':
        const dayOfWeek = now.getDay();
        const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
        start = new Date(now);
        start.setDate(diff);
        start.setHours(0, 0, 0, 0);
        break;
      case 'biweekly':
        const biweekStart = new Date(now);
        biweekStart.setDate(now.getDate() - 14);
        biweekStart.setHours(0, 0, 0, 0);
        start = biweekStart;
        break;
      case 'month':
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        start.setHours(0, 0, 0, 0);
        break;
      default:
        start = new Date(now);
        start.setDate(now.getDate() - 7);
        start.setHours(0, 0, 0, 0);
    }

    setStartDate(start);
    setEndDate(end);
  }, [periodType]);

  const sellerIds = selectedSellers.size > 0 
    ? Array.from(selectedSellers) 
    : undefined;

  const performance = useSellerPerformance({
    leads,
    startDate,
    endDate,
    sellerId: sellerIds,
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const toggleSeller = (sellerId: string) => {
    setSelectedSellers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sellerId)) {
        newSet.delete(sellerId);
      } else {
        newSet.add(sellerId);
      }
      return newSet;
    });
  };

  const clearSellerFilter = () => {
    setSelectedSellers(new Set());
  };

  const getSelectedSellersNames = () => {
    if (selectedSellers.size === 0) return "Todos os vendedores";
    if (selectedSellers.size === 1) {
      const seller = allPerformance.find(p => p.sellerId === Array.from(selectedSellers)[0]);
      return seller?.sellerName || "Vendedor selecionado";
    }
    return `${selectedSellers.size} vendedores selecionados`;
  };

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Período</Label>
              <Select value={periodType} onValueChange={(v: any) => setPeriodType(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="week">Semanal</SelectItem>
                  <SelectItem value="biweekly">Quinzenal</SelectItem>
                  <SelectItem value="month">Mensal</SelectItem>
                  <SelectItem value="custom">Data Personalizada</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Vendedor</Label>
              <Popover open={sellerPopoverOpen} onOpenChange={setSellerPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-between">
                    <span className="truncate">{getSelectedSellersNames()}</span>
                    <Users className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[300px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Buscar vendedor..." />
                    <CommandList>
                      <CommandEmpty>Nenhum vendedor encontrado.</CommandEmpty>
                      <CommandGroup>
                        {allPerformance.map((seller) => (
                          <CommandItem
                            key={seller.sellerId}
                            onSelect={() => {
                              toggleSeller(seller.sellerId);
                            }}
                          >
                            <div className="flex items-center space-x-2 w-full">
                              <Checkbox
                                checked={selectedSellers.has(seller.sellerId)}
                                onCheckedChange={() => toggleSeller(seller.sellerId)}
                              />
                              <div className="flex-1">
                                <div className="font-medium">{seller.sellerName}</div>
                                <div className="text-xs text-muted-foreground">{seller.sellerEmail}</div>
                              </div>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                  {selectedSellers.size > 0 && (
                    <div className="border-t p-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full"
                        onClick={() => {
                          clearSellerFilter();
                          setSellerPopoverOpen(false);
                        }}
                      >
                        <X className="h-4 w-4 mr-2" />
                        Limpar Filtro
                      </Button>
                    </div>
                  )}
                </PopoverContent>
              </Popover>
              {selectedSellers.size > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {Array.from(selectedSellers).map((sellerId) => {
                    const seller = allPerformance.find(p => p.sellerId === sellerId);
                    if (!seller) return null;
                    return (
                      <Badge key={sellerId} variant="secondary" className="gap-1">
                        {seller.sellerName}
                        <button
                          type="button"
                          onClick={() => toggleSeller(sellerId)}
                          className="ml-1 hover:opacity-70"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    );
                  })}
                </div>
              )}
            </div>
            {periodType === 'custom' && (
              <>
                <div className="space-y-2">
                  <Label>Data Inicial</Label>
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
                <div className="space-y-2">
                  <Label>Data Final</Label>
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
              </>
            )}
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
          seller={performance.find((p) => p.sellerId === Array.from(selectedSellers)[0])}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Vendedores Selecionados</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{selectedSellers.size}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Vendedores filtrados
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
