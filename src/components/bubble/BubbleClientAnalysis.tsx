import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, TrendingUp, Package, FileText, Building2, AlertCircle, RefreshCw } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface CompanyData {
  id: string;
  name: string;
  salesCount: number;
  ordersCount: number;
  totalActivity: number;
}

interface BubbleClientAnalysisProps {
  queryHistory: any[];
}

export function BubbleClientAnalysis({ queryHistory = [] }: BubbleClientAnalysisProps) {
  const { toast } = useToast();
  const [companies, setCompanies] = useState<CompanyData[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Seleção de consultas existentes
  const [selectedCompaniesQuery, setSelectedCompaniesQuery] = useState("");
  const [selectedSalesQuery, setSelectedSalesQuery] = useState("");
  const [selectedOrdersQuery, setSelectedOrdersQuery] = useState("");
  const [companyNameField, setCompanyNameField] = useState("nome_text");

  // Filtrar consultas por tipo
  const availableQueries = queryHistory.filter(q => 
    q.response_data?.response?.results && 
    q.response_data.response.results.length > 0
  );

  const analyzeClients = async () => {
    setLoading(true);
    
    try {
      if (!selectedCompaniesQuery) {
        throw new Error("Selecione uma consulta de empresas");
      }

      // Buscar dados do histórico
      const companiesData = queryHistory.find(q => q.id === selectedCompaniesQuery);
      const salesData = selectedSalesQuery ? queryHistory.find(q => q.id === selectedSalesQuery) : null;
      const ordersData = selectedOrdersQuery ? queryHistory.find(q => q.id === selectedOrdersQuery) : null;

      const empresasResults = companiesData?.response_data?.response?.results || [];
      const salesResults = salesData?.response_data?.response?.results || [];
      const ordersResults = ordersData?.response_data?.response?.results || [];

      if (empresasResults.length === 0) {
        throw new Error("Nenhuma empresa encontrada na consulta selecionada");
      }

      toast({
        title: "Processando dados...",
        description: `${empresasResults.length} empresas, ${salesResults.length} vendas, ${ordersResults.length} ordens`,
      });

      // Processar dados
      const companyMap = new Map<string, CompanyData>();

      // Processar empresas
      empresasResults.forEach((company: any) => {
        const companyName = company[companyNameField] || 
                          company.nome_da_empresa ||
                          company.Nome || 
                          company.name || 
                          company.nome || 
                          `Empresa ${company._id?.substring(0, 8) || 'sem ID'}`;
        
        companyMap.set(company._id, {
          id: company._id,
          name: companyName,
          salesCount: 0,
          ordersCount: 0,
          totalActivity: 0,
        });
      });

      // Contar vendas por empresa
      if (salesResults.length > 0) {
        salesResults.forEach((sale: any) => {
          const companyId = sale.empresa?._id || sale.empresa;
          if (companyId && companyMap.has(companyId)) {
            const company = companyMap.get(companyId)!;
            company.salesCount++;
            company.totalActivity++;
          }
        });
      }

      // Contar ordens por empresa
      if (ordersResults.length > 0) {
        ordersResults.forEach((order: any) => {
          const companyId = order.empresa?._id || order.empresa;
          if (companyId && companyMap.has(companyId)) {
            const company = companyMap.get(companyId)!;
            company.ordersCount++;
            company.totalActivity++;
          }
        });
      }

      // Converter para array e ordenar
      const sortedCompanies = Array.from(companyMap.values())
        .sort((a, b) => b.totalActivity - a.totalActivity);

      setCompanies(sortedCompanies);

      toast({
        title: "Análise concluída!",
        description: `${sortedCompanies.filter(c => c.totalActivity > 0).length} empresas com atividade`,
      });

    } catch (error: any) {
      console.error("Erro na análise:", error);
      toast({
        title: "Erro ao analisar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const resetAnalysis = () => {
    setCompanies([]);
    setSelectedCompaniesQuery("");
    setSelectedSalesQuery("");
    setSelectedOrdersQuery("");
  };

  const getRankBadge = (index: number) => {
    if (index === 0) return <Badge className="bg-yellow-500">🥇 1º</Badge>;
    if (index === 1) return <Badge className="bg-gray-400">🥈 2º</Badge>;
    if (index === 2) return <Badge className="bg-orange-600">🥉 3º</Badge>;
    return <Badge variant="outline">{index + 1}º</Badge>;
  };

  if (availableQueries.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            Nenhuma Consulta Disponível
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Você precisa fazer consultas primeiro na aba "Consultas" para ter dados disponíveis para análise.
              Faça consultas de empresas, vendas e ordens de serviço antes de usar esta funcionalidade.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (companies.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Análise de Clientes
          </CardTitle>
          <CardDescription>
            Use dados já consultados para analisar suas empresas
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Esta análise usa consultas que você já fez, evitando novas requisições à API do Bubble.
              Selecione as consultas abaixo para gerar o ranking de empresas.
            </AlertDescription>
          </Alert>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="companiesQuery">
                Consulta de Empresas <span className="text-destructive">*</span>
              </Label>
              <Select value={selectedCompaniesQuery} onValueChange={setSelectedCompaniesQuery}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a consulta de empresas" />
                </SelectTrigger>
                <SelectContent>
                  {availableQueries.map((query) => (
                    <SelectItem key={query.id} value={query.id}>
                      {query.query_type} ({query.response_data.response.results.length} registros) - {new Date(query.created_at).toLocaleString()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="salesQuery">
                Consulta de Vendas <span className="text-destructive">*</span>
              </Label>
              <Select value={selectedSalesQuery} onValueChange={setSelectedSalesQuery}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a consulta de vendas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Nenhuma</SelectItem>
                  {availableQueries.map((query) => (
                    <SelectItem key={query.id} value={query.id}>
                      {query.query_type} ({query.response_data.response.results.length} registros) - {new Date(query.created_at).toLocaleString()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ordersQuery">
                Consulta de Ordens de Serviço (opcional)
              </Label>
              <Select value={selectedOrdersQuery} onValueChange={setSelectedOrdersQuery}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a consulta de ordens (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Nenhuma</SelectItem>
                  {availableQueries.map((query) => (
                    <SelectItem key={query.id} value={query.id}>
                      {query.query_type} ({query.response_data.response.results.length} registros) - {new Date(query.created_at).toLocaleString()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button
            onClick={analyzeClients}
            disabled={loading || !selectedCompaniesQuery}
            className="w-full"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Analisando...
              </>
            ) : (
              <>
                <TrendingUp className="mr-2 h-4 w-4" />
                Gerar Análise
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Resultados da Análise</h3>
          <p className="text-sm text-muted-foreground">
            Ranking de empresas por atividade total
          </p>
        </div>
        <Button variant="outline" onClick={resetAnalysis}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Nova Análise
        </Button>
      </div>

      {/* Cards de Resumo */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Empresas Ativas
            </CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{companies.length}</div>
            <p className="text-xs text-muted-foreground">
              Com vendas ou ordens
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total de Vendas
            </CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {companies.reduce((sum, c) => sum + c.salesCount, 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Vendas registradas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total de Ordens
            </CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {companies.reduce((sum, c) => sum + c.ordersCount, 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              {selectedOrdersQuery ? "Ordens de serviço" : "Não selecionado"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabela de Ranking */}
      <Card>
        <CardHeader>
          <CardTitle>Ranking de Empresas por Atividade</CardTitle>
          <CardDescription>
            Ordenado por total de vendas {selectedOrdersQuery ? "+ ordens de serviço" : ""}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {companies.length === 0 ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Nenhuma empresa com atividade encontrada. Verifique os endpoints configurados.
              </AlertDescription>
            </Alert>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[80px]">Posição</TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead className="text-right">Vendas</TableHead>
                  {selectedOrdersQuery && (
                    <TableHead className="text-right">Ordens</TableHead>
                  )}
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {companies.map((company, index) => (
                  <TableRow key={company.id}>
                    <TableCell>{getRankBadge(index)}</TableCell>
                    <TableCell className="font-medium">
                      {company.name}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant="secondary">{company.salesCount}</Badge>
                    </TableCell>
                    {selectedOrdersQuery && (
                      <TableCell className="text-right">
                        <Badge variant="secondary">{company.ordersCount}</Badge>
                      </TableCell>
                    )}
                    <TableCell className="text-right">
                      <Badge variant="default" className="bg-primary">
                        {company.totalActivity}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
