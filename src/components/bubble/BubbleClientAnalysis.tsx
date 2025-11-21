import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, TrendingUp, Package, FileText, Building2, AlertCircle, RefreshCw } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { useActiveOrganization } from "@/hooks/useActiveOrganization";

interface CompanyData {
  id: string;
  name: string;
  salesCount: number;
  ordersCount: number;
  totalActivity: number;
}

export function BubbleClientAnalysis() {
  const { toast } = useToast();
  const { activeOrgId } = useActiveOrganization();
  const [companies, setCompanies] = useState<CompanyData[]>([]);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'config' | 'analyzing' | 'results'>('config');
  
  // Configurações de endpoints
  const [salesEndpoint, setSalesEndpoint] = useState("vendas");
  const [ordersEndpoint, setOrdersEndpoint] = useState("");
  const [companiesEndpoint, setCompaniesEndpoint] = useState("empresa_principal");
  
  // Campo que contém o nome da empresa
  const [companyNameField, setCompanyNameField] = useState("nome_text");

  const executeQuery = async (queryType: string, endpoint: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("Não autenticado");

    const response = await supabase.functions.invoke('bubble-query-data', {
      body: {
        query_type: queryType,
        endpoint: endpoint,
        constraints: []
      },
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });

    if (response.error) throw response.error;
    return response.data;
  };

  const analyzeClients = async () => {
    setLoading(true);
    setStep('analyzing');
    
    try {
      toast({
        title: "Analisando clientes...",
        description: "Buscando dados das empresas",
      });

      // 1. Buscar empresas
      const companiesResp = await executeQuery(companiesEndpoint, companiesEndpoint);
      
      if (!companiesResp?.response?.results) {
        throw new Error("Nenhuma empresa encontrada");
      }

      toast({
        title: "Empresas encontradas",
        description: `${companiesResp.response.results.length} empresas carregadas. Buscando vendas...`,
      });

      // 2. Buscar vendas
      const salesResp = await executeQuery(salesEndpoint, salesEndpoint);

      let ordersResp = null;
      if (ordersEndpoint && ordersEndpoint.trim()) {
        toast({
          title: "Buscando ordens...",
          description: "Consultando ordens de serviço",
        });
        ordersResp = await executeQuery(ordersEndpoint, ordersEndpoint);
      }

      // 3. Processar dados
      const companyMap = new Map<string, CompanyData>();

      // Processar empresas
      companiesResp.response.results.forEach((company: any) => {
        const companyName = company[companyNameField] || 
                          company.Nome || 
                          company.name || 
                          company.nome || 
                          `Empresa ${company._id.substring(0, 8)}`;
        
        companyMap.set(company._id, {
          id: company._id,
          name: companyName,
          salesCount: 0,
          ordersCount: 0,
          totalActivity: 0,
        });
      });

      // Contar vendas por empresa
      if (salesResp?.response?.results) {
        salesResp.response.results.forEach((sale: any) => {
          const companyId = sale.empresa?._id || sale.empresa;
          if (companyId && companyMap.has(companyId)) {
            const company = companyMap.get(companyId)!;
            company.salesCount++;
            company.totalActivity++;
          }
        });
      }

      // Contar ordens por empresa
      if (ordersResp?.response?.results) {
        ordersResp.response.results.forEach((order: any) => {
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
        .filter(c => c.totalActivity > 0) // Apenas empresas com atividade
        .sort((a, b) => b.totalActivity - a.totalActivity);

      setCompanies(sortedCompanies);
      setStep('results');

      toast({
        title: "Análise concluída!",
        description: `${sortedCompanies.length} empresas ativas encontradas`,
      });

    } catch (error: any) {
      console.error("Erro na análise:", error);
      toast({
        title: "Erro ao analisar",
        description: error.message || "Verifique os nomes dos endpoints",
        variant: "destructive",
      });
      setStep('config');
    } finally {
      setLoading(false);
    }
  };

  const getRankBadge = (index: number) => {
    if (index === 0) return <Badge className="bg-yellow-500">🥇 1º</Badge>;
    if (index === 1) return <Badge className="bg-gray-400">🥈 2º</Badge>;
    if (index === 2) return <Badge className="bg-orange-600">🥉 3º</Badge>;
    return <Badge variant="outline">{index + 1}º</Badge>;
  };

  const resetAnalysis = () => {
    setStep('config');
    setCompanies([]);
  };

  if (step === 'config') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Configurar Análise de Clientes
          </CardTitle>
          <CardDescription>
            Configure os endpoints corretos do Bubble para analisar suas empresas
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Esta análise busca empresas e conta vendas/ordens por empresa para criar um ranking.
              Certifique-se de usar os nomes corretos dos endpoints da sua API Bubble.
            </AlertDescription>
          </Alert>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="companiesEndpoint">
                Endpoint de Empresas <span className="text-destructive">*</span>
              </Label>
              <Input
                id="companiesEndpoint"
                value={companiesEndpoint}
                onChange={(e) => setCompaniesEndpoint(e.target.value)}
                placeholder="empresa_principal"
              />
              <p className="text-xs text-muted-foreground">
                Nome do tipo/tabela que contém as empresas no Bubble
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="companyNameField">
                Campo do Nome da Empresa <span className="text-destructive">*</span>
              </Label>
              <Input
                id="companyNameField"
                value={companyNameField}
                onChange={(e) => setCompanyNameField(e.target.value)}
                placeholder="nome_text"
              />
              <p className="text-xs text-muted-foreground">
                Nome do campo que contém o nome da empresa (ex: nome_text, Nome, name)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="salesEndpoint">
                Endpoint de Vendas <span className="text-destructive">*</span>
              </Label>
              <Input
                id="salesEndpoint"
                value={salesEndpoint}
                onChange={(e) => setSalesEndpoint(e.target.value)}
                placeholder="vendas"
              />
              <p className="text-xs text-muted-foreground">
                Nome do tipo/tabela de vendas (deve ter referência para empresa)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ordersEndpoint">
                Endpoint de Ordens de Serviço (opcional)
              </Label>
              <Input
                id="ordersEndpoint"
                value={ordersEndpoint}
                onChange={(e) => setOrdersEndpoint(e.target.value)}
                placeholder="ordens_servico"
              />
              <p className="text-xs text-muted-foreground">
                Deixe vazio se não tiver ordens de serviço separadas
              </p>
            </div>
          </div>

          <Button
            onClick={analyzeClients}
            disabled={loading || !companiesEndpoint || !salesEndpoint || !companyNameField}
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
                Iniciar Análise
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (step === 'analyzing') {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="flex flex-col items-center justify-center space-y-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="text-lg font-medium">Processando dados...</p>
            <p className="text-sm text-muted-foreground">
              Buscando empresas, vendas e ordens de serviço
            </p>
          </div>
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
              {ordersEndpoint ? "Ordens de serviço" : "Não configurado"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabela de Ranking */}
      <Card>
        <CardHeader>
          <CardTitle>Ranking de Empresas por Atividade</CardTitle>
          <CardDescription>
            Ordenado por total de vendas {ordersEndpoint ? "+ ordens de serviço" : ""}
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
                  {ordersEndpoint && (
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
                    {ordersEndpoint && (
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
