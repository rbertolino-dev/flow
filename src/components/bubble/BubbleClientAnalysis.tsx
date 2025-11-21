import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, TrendingUp, Package, FileText, Building2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface CompanyData {
  id: string;
  name: string;
  salesCount: number;
  ordersCount: number;
  totalActivity: number;
}

interface BubbleClientAnalysisProps {
  onExecuteQuery: (params: any) => void;
  isExecuting: boolean;
}

export function BubbleClientAnalysis({ onExecuteQuery, isExecuting }: BubbleClientAnalysisProps) {
  const { toast } = useToast();
  const [companies, setCompanies] = useState<CompanyData[]>([]);
  const [loading, setLoading] = useState(false);
  const [salesData, setSalesData] = useState<any>(null);
  const [ordersData, setOrdersData] = useState<any>(null);

  const analyzeClients = async () => {
    setLoading(true);
    try {
      // 1. Buscar lista de empresas
      const companiesQuery = {
        query_type: "empresa_principal",
        endpoint: "empresa_principal",
        constraints: []
      };

      toast({
        title: "Analisando clientes...",
        description: "Buscando dados de empresas, vendas e ordens de serviço",
      });

      // Executar consulta de empresas
      onExecuteQuery(companiesQuery);
      
      // Aguardar um pouco e buscar vendas
      setTimeout(() => {
        const salesQuery = {
          query_type: "vendas",
          endpoint: "vendas",
          constraints: []
        };
        onExecuteQuery(salesQuery);
      }, 2000);

      // Aguardar e buscar ordens de serviço
      setTimeout(() => {
        const ordersQuery = {
          query_type: "fim_lançamento",
          endpoint: "fim_lançamento",
          constraints: []
        };
        onExecuteQuery(ordersQuery);
      }, 4000);

    } catch (error: any) {
      toast({
        title: "Erro ao analisar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const processAnalysis = (companiesResp: any, salesResp: any, ordersResp: any) => {
    const companyMap = new Map<string, CompanyData>();

    // Processar empresas
    if (companiesResp?.results) {
      companiesResp.results.forEach((company: any) => {
        companyMap.set(company._id, {
          id: company._id,
          name: company.nome_text || company.Nome || company.name || "Empresa sem nome",
          salesCount: 0,
          ordersCount: 0,
          totalActivity: 0,
        });
      });
    }

    // Contar vendas por empresa
    if (salesResp?.results) {
      salesResp.results.forEach((sale: any) => {
        const companyId = sale.empresa?._id || sale.empresa;
        if (companyId && companyMap.has(companyId)) {
          const company = companyMap.get(companyId)!;
          company.salesCount++;
          company.totalActivity++;
        }
      });
    }

    // Contar ordens por empresa
    if (ordersResp?.results) {
      ordersResp.results.forEach((order: any) => {
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
  };

  const getRankBadge = (index: number) => {
    if (index === 0) return <Badge className="bg-yellow-500">🥇 1º</Badge>;
    if (index === 1) return <Badge className="bg-gray-400">🥈 2º</Badge>;
    if (index === 2) return <Badge className="bg-orange-600">🥉 3º</Badge>;
    return <Badge variant="outline">{index + 1}º</Badge>;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Análise de Clientes
          </CardTitle>
          <CardDescription>
            Ranking de empresas por volume de vendas, ordens de serviço e atividade total
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Button
              onClick={analyzeClients}
              disabled={loading || isExecuting}
            >
              {loading || isExecuting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Analisando...
                </>
              ) : (
                <>
                  <TrendingUp className="mr-2 h-4 w-4" />
                  Analisar Clientes
                </>
              )}
            </Button>
          </div>

          <div className="text-sm text-muted-foreground space-y-1">
            <p>Esta análise irá:</p>
            <ul className="list-disc list-inside pl-2">
              <li>Buscar todas as empresas cadastradas</li>
              <li>Contar vendas por empresa</li>
              <li>Contar ordens de serviço por empresa</li>
              <li>Criar ranking por atividade total</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {companies.length > 0 && (
        <>
          {/* Cards de Resumo */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Total de Empresas
                </CardTitle>
                <Building2 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{companies.length}</div>
                <p className="text-xs text-muted-foreground">
                  Empresas ativas no sistema
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
                  Ordens de serviço
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Tabela de Ranking */}
          <Card>
            <CardHeader>
              <CardTitle>Ranking de Empresas</CardTitle>
              <CardDescription>
                Ordenado por atividade total (vendas + ordens de serviço)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[80px]">Posição</TableHead>
                    <TableHead>Empresa</TableHead>
                    <TableHead className="text-right">Vendas</TableHead>
                    <TableHead className="text-right">Ordens</TableHead>
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
                      <TableCell className="text-right">
                        <Badge variant="secondary">{company.ordersCount}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="default">{company.totalActivity}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
