import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Loader2, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { Badge } from "@/components/ui/badge";

interface OrganizationCost {
  orgId: string;
  orgName: string;
  currentMonthCost: number;
  previousMonthCost: number;
  trend: 'up' | 'down' | 'stable';
  percentageChange: number;
  breakdown: {
    incomingMessages: number;
    broadcastMessages: number;
    scheduledMessages: number;
    leadsStored: number;
    databaseOps: number;
  };
}

export function OrganizationCostComparison() {
  const [loading, setLoading] = useState(true);
  const [orgCosts, setOrgCosts] = useState<OrganizationCost[]>([]);

  useEffect(() => {
    fetchOrganizationCosts();
  }, []);

  const fetchOrganizationCosts = async () => {
    try {
      setLoading(true);

      // Período atual (mês corrente)
      const currentMonthStart = format(startOfMonth(new Date()), 'yyyy-MM-dd');
      const currentMonthEnd = format(endOfMonth(new Date()), 'yyyy-MM-dd');

      // Período anterior (mês passado)
      const previousMonth = subMonths(new Date(), 1);
      const previousMonthStart = format(startOfMonth(previousMonth), 'yyyy-MM-dd');
      const previousMonthEnd = format(endOfMonth(previousMonth), 'yyyy-MM-dd');

      // Buscar organizações
      const { data: orgs, error: orgsError } = await supabase
        .from('organizations')
        .select('id, name');

      if (orgsError) {
        console.error('Erro ao buscar organizações:', orgsError);
        setLoading(false);
        return;
      }

      // Buscar métricas do mês atual e anterior
      const [currentMetrics, previousMetrics] = await Promise.all([
        supabase
          .from('daily_usage_metrics')
          .select('*')
          .gte('date', currentMonthStart)
          .lte('date', currentMonthEnd),
        supabase
          .from('daily_usage_metrics')
          .select('*')
          .gte('date', previousMonthStart)
          .lte('date', previousMonthEnd)
      ]);

      // Processar custos por organização
      const costs: OrganizationCost[] = orgs.map(org => {
        // Métricas do mês atual
        const currentOrgMetrics = currentMetrics.data?.filter(
          m => m.organization_id === org.id
        ) || [];

        const currentCost = currentOrgMetrics.reduce(
          (sum, m) => sum + Number(m.total_cost), 0
        );

        // Métricas do mês anterior
        const previousOrgMetrics = previousMetrics.data?.filter(
          m => m.organization_id === org.id
        ) || [];

        const previousCost = previousOrgMetrics.reduce(
          (sum, m) => sum + Number(m.total_cost), 0
        );

        // Calcular tendência
        let trend: 'up' | 'down' | 'stable' = 'stable';
        let percentageChange = 0;

        if (previousCost > 0) {
          percentageChange = ((currentCost - previousCost) / previousCost) * 100;
          if (percentageChange > 5) trend = 'up';
          else if (percentageChange < -5) trend = 'down';
        } else if (currentCost > 0) {
          trend = 'up';
          percentageChange = 100;
        }

        // Breakdown por tipo
        const breakdown = {
          incomingMessages: 0,
          broadcastMessages: 0,
          scheduledMessages: 0,
          leadsStored: 0,
          databaseOps: 0
        };

        currentOrgMetrics.forEach(metric => {
          const cost = Number(metric.total_cost);
          switch (metric.metric_type) {
            case 'incoming_messages':
              breakdown.incomingMessages += cost;
              break;
            case 'broadcast_messages':
              breakdown.broadcastMessages += cost;
              break;
            case 'scheduled_messages':
              breakdown.scheduledMessages += cost;
              break;
            case 'leads_stored':
              breakdown.leadsStored += cost;
              break;
            case 'database_reads':
            case 'database_writes':
              breakdown.databaseOps += cost;
              break;
          }
        });

        return {
          orgId: org.id,
          orgName: org.name,
          currentMonthCost: currentCost,
          previousMonthCost: previousCost,
          trend,
          percentageChange,
          breakdown
        };
      }).sort((a, b) => b.currentMonthCost - a.currentMonthCost);

      setOrgCosts(costs);
    } catch (err) {
      console.error('Erro ao processar custos:', err);
    } finally {
      setLoading(false);
    }
  };

  const chartData = orgCosts.map(org => ({
    name: org.orgName,
    'Mês Atual': Number(org.currentMonthCost.toFixed(2)),
    'Mês Anterior': Number(org.previousMonthCost.toFixed(2))
  }));

  const totalCurrentCost = orgCosts.reduce((sum, org) => sum + org.currentMonthCost, 0);

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Gráfico de comparação */}
      <Card>
        <CardHeader>
          <CardTitle>Custos por Organização</CardTitle>
          <CardDescription>
            Comparação mês atual vs mês anterior • Total: ${totalCurrentCost.toFixed(2)}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="name" 
                className="text-xs text-muted-foreground"
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis 
                className="text-xs text-muted-foreground"
                tickFormatter={(value) => `$${value}`}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--background))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '6px'
                }}
                formatter={(value: number) => `$${value.toFixed(2)}`}
              />
              <Legend />
              <Bar dataKey="Mês Atual" fill="hsl(var(--primary))" />
              <Bar dataKey="Mês Anterior" fill="hsl(var(--muted-foreground))" opacity={0.5} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Detalhes por organização */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {orgCosts.map(org => (
          <Card key={org.orgId}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{org.orgName}</CardTitle>
                {org.trend === 'up' && (
                  <Badge variant="destructive" className="gap-1">
                    <TrendingUp className="h-3 w-3" />
                    {Math.abs(org.percentageChange).toFixed(1)}%
                  </Badge>
                )}
                {org.trend === 'down' && (
                  <Badge variant="default" className="gap-1 bg-green-600">
                    <TrendingDown className="h-3 w-3" />
                    {Math.abs(org.percentageChange).toFixed(1)}%
                  </Badge>
                )}
                {org.trend === 'stable' && (
                  <Badge variant="secondary" className="gap-1">
                    <Minus className="h-3 w-3" />
                    Estável
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Mês Atual</span>
                <span className="text-lg font-bold">${org.currentMonthCost.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Mês Anterior</span>
                <span className="text-sm">${org.previousMonthCost.toFixed(2)}</span>
              </div>
              
              <div className="pt-3 border-t space-y-2">
                <div className="text-xs text-muted-foreground font-semibold">Breakdown</div>
                {org.breakdown.incomingMessages > 0 && (
                  <div className="flex justify-between text-xs">
                    <span>Msgs Recebidas</span>
                    <span>${org.breakdown.incomingMessages.toFixed(2)}</span>
                  </div>
                )}
                {org.breakdown.broadcastMessages > 0 && (
                  <div className="flex justify-between text-xs">
                    <span>Broadcasts</span>
                    <span>${org.breakdown.broadcastMessages.toFixed(2)}</span>
                  </div>
                )}
                {org.breakdown.scheduledMessages > 0 && (
                  <div className="flex justify-between text-xs">
                    <span>Msgs Agendadas</span>
                    <span>${org.breakdown.scheduledMessages.toFixed(2)}</span>
                  </div>
                )}
                {org.breakdown.leadsStored > 0 && (
                  <div className="flex justify-between text-xs">
                    <span>Leads Armazenados</span>
                    <span>${org.breakdown.leadsStored.toFixed(2)}</span>
                  </div>
                )}
                {org.breakdown.databaseOps > 0 && (
                  <div className="flex justify-between text-xs">
                    <span>Operações DB</span>
                    <span>${org.breakdown.databaseOps.toFixed(2)}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
