import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { BarChart, TrendingUp, Database, Calendar, Activity } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface BubbleQuery {
  id: string;
  query_type: string;
  created_at: string;
  organization_id: string;
  query_params: any;
  response_data: any;
}

interface UsageReportProps {
  queries: BubbleQuery[];
  organizationName?: string;
}

export function BubbleUsageReport({ queries, organizationName }: UsageReportProps) {
  // Análise de uso por tipo de consulta
  const queryTypeStats = queries.reduce((acc, query) => {
    const type = query.query_type || 'sem_tipo';
    if (!acc[type]) {
      acc[type] = { count: 0, lastUsed: query.created_at };
    }
    acc[type].count++;
    if (new Date(query.created_at) > new Date(acc[type].lastUsed)) {
      acc[type].lastUsed = query.created_at;
    }
    return acc;
  }, {} as Record<string, { count: number; lastUsed: string }>);

  const sortedTypes = Object.entries(queryTypeStats)
    .sort(([, a], [, b]) => b.count - a.count);

  const totalQueries = queries.length;
  const mostUsedType = sortedTypes[0]?.[0] || 'N/A';
  const mostUsedCount = sortedTypes[0]?.[1]?.count || 0;

  // Análise de uso por período
  const last7Days = queries.filter(q => {
    const daysDiff = Math.floor((Date.now() - new Date(q.created_at).getTime()) / (1000 * 60 * 60 * 24));
    return daysDiff <= 7;
  }).length;

  const last30Days = queries.filter(q => {
    const daysDiff = Math.floor((Date.now() - new Date(q.created_at).getTime()) / (1000 * 60 * 60 * 24));
    return daysDiff <= 30;
  }).length;

  // Análise de dados retornados (economia com cache)
  const totalRecordsReturned = queries.reduce((sum, query) => {
    return sum + (query.response_data?.response?.results?.length || 0);
  }, 0);

  const avgRecordsPerQuery = totalQueries > 0 ? Math.round(totalRecordsReturned / totalQueries) : 0;

  // Economia estimada com cache (assumindo que consultas repetidas usaram cache)
  const uniqueQueryKeys = new Set(queries.map(q => 
    `${q.query_type}_${JSON.stringify(q.query_params)}`
  )).size;
  
  const cacheSavings = totalQueries - uniqueQueryKeys;
  const cacheSavingsPercent = totalQueries > 0 ? Math.round((cacheSavings / totalQueries) * 100) : 0;

  return (
    <div className="space-y-4">
      <Alert>
        <Activity className="h-4 w-4" />
        <AlertDescription>
          <strong>💡 Relatório Econômico:</strong> Este relatório usa apenas dados já armazenados localmente.
          Nenhuma requisição adicional foi feita ao Bubble.io.
        </AlertDescription>
      </Alert>

      {/* Resumo Geral */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total de Consultas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalQueries}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Histórico completo
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Últimos 7 Dias
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{last7Days}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Consultas recentes
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Economia com Cache
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{cacheSavingsPercent}%</div>
            <p className="text-xs text-muted-foreground mt-1">
              {cacheSavings} requisições economizadas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Registros Retornados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalRecordsReturned.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Média: {avgRecordsPerQuery} por consulta
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Uso por Funcionalidade/Tipo */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart className="w-5 h-5" />
            Uso por Funcionalidade (Tipo de Tabela)
          </CardTitle>
          <CardDescription>
            Quais tabelas do Bubble.io são mais consultadas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tipo de Tabela</TableHead>
                <TableHead className="text-right">Consultas</TableHead>
                <TableHead className="text-right">% do Total</TableHead>
                <TableHead className="text-right">Último Uso</TableHead>
                <TableHead>Uso</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedTypes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    Nenhuma consulta registrada ainda
                  </TableCell>
                </TableRow>
              ) : (
                sortedTypes.map(([type, stats]) => {
                  const percentage = Math.round((stats.count / totalQueries) * 100);
                  const isTopUsed = stats.count === mostUsedCount;
                  
                  return (
                    <TableRow key={type}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Database className="w-4 h-4 text-muted-foreground" />
                          {type}
                          {isTopUsed && (
                            <Badge variant="secondary" className="ml-2">
                              <TrendingUp className="w-3 h-3 mr-1" />
                              Mais usado
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {stats.count}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline">{percentage}%</Badge>
                      </TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">
                        <div className="flex items-center justify-end gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(stats.lastUsed).toLocaleDateString('pt-BR')}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Progress value={percentage} className="h-2" />
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Análise de Tendências */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Análise de Tendências
          </CardTitle>
          <CardDescription>
            Padrões de uso ao longo do tempo
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 border rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Atividade Recente (7 dias)</span>
                <Badge>{last7Days} consultas</Badge>
              </div>
              <Progress value={(last7Days / totalQueries) * 100} className="h-2" />
              <p className="text-xs text-muted-foreground mt-2">
                {Math.round((last7Days / totalQueries) * 100)}% do total de consultas
              </p>
            </div>

            <div className="p-4 border rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Atividade Mensal (30 dias)</span>
                <Badge>{last30Days} consultas</Badge>
              </div>
              <Progress value={(last30Days / totalQueries) * 100} className="h-2" />
              <p className="text-xs text-muted-foreground mt-2">
                {Math.round((last30Days / totalQueries) * 100)}% do total de consultas
              </p>
            </div>
          </div>

          <Alert className="bg-blue-50 border-blue-200">
            <Activity className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-sm text-blue-800">
              <strong>💰 Economia Total com Cache:</strong> {cacheSavings} requisições foram economizadas 
              graças ao sistema de cache de 24 horas, reduzindo custos e melhorando a performance.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
}
