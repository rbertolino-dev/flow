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
      const currentMonthStart = startOfMonth(new Date());
      const currentMonthEnd = endOfMonth(new Date());

      // Período anterior (mês passado)
      const previousMonth = subMonths(new Date(), 1);
      const previousMonthStart = startOfMonth(previousMonth);
      const previousMonthEnd = endOfMonth(previousMonth);

      // Buscar configuração de custos
      const { data: costConfig } = await supabase
        .from('cloud_cost_config')
        .select('*')
        .single();

      if (!costConfig) {
        console.error('Configuração de custos não encontrada');
        setLoading(false);
        return;
      }

      // OTIMIZAÇÃO: Usar função SQL agregada em vez de múltiplas queries
      // Reduz de 80 queries (10 orgs × 8) para 1 query apenas
      
      const { data: metricsData, error } = await supabase.rpc('get_organization_metrics', {
        current_month_start: currentMonthStart.toISOString(),
        current_month_end: currentMonthEnd.toISOString(),
        previous_month_start: previousMonthStart.toISOString(),
        previous_month_end: previousMonthEnd.toISOString()
      });

      if (error) {
        console.error('Erro ao buscar métricas de organizações:', error);
        // Fallback: se a função SQL não existir, usar método antigo
        // Isso garante compatibilidade durante migração
        const { data: orgs, error: orgsError } = await supabase
          .from('organizations')
          .select('id, name');

        if (orgsError) {
          console.error('Erro ao buscar organizações:', orgsError);
          setLoading(false);
          return;
        }

        const costs: OrganizationCost[] = await Promise.all(
          orgs.map(async (org) => {
            const [
              { count: currentIncoming },
              { count: currentBroadcast },
              { count: currentScheduled },
              { count: currentLeads }
            ] = await Promise.all([
              supabase.from('whatsapp_messages')
                .select('*', { count: 'exact', head: true })
                .eq('organization_id', org.id)
                .eq('direction', 'incoming')
                .gte('timestamp', currentMonthStart.toISOString())
                .lte('timestamp', currentMonthEnd.toISOString()),
              supabase.from('broadcast_queue')
                .select('*', { count: 'exact', head: true })
                .eq('organization_id', org.id)
                .eq('status', 'sent')
                .gte('sent_at', currentMonthStart.toISOString())
                .lte('sent_at', currentMonthEnd.toISOString()),
              supabase.from('scheduled_messages')
                .select('*', { count: 'exact', head: true })
                .eq('organization_id', org.id)
                .eq('status', 'sent')
                .gte('sent_at', currentMonthStart.toISOString())
                .lte('sent_at', currentMonthEnd.toISOString()),
              supabase.from('leads')
                .select('*', { count: 'exact', head: true })
                .eq('organization_id', org.id)
                .is('deleted_at', null)
            ]);

            const [
              { count: prevIncoming },
              { count: prevBroadcast },
              { count: prevScheduled },
              { count: prevLeads }
            ] = await Promise.all([
              supabase.from('whatsapp_messages')
                .select('*', { count: 'exact', head: true })
                .eq('organization_id', org.id)
                .eq('direction', 'incoming')
                .gte('timestamp', previousMonthStart.toISOString())
                .lte('timestamp', previousMonthEnd.toISOString()),
              supabase.from('broadcast_queue')
                .select('*', { count: 'exact', head: true })
                .eq('organization_id', org.id)
                .eq('status', 'sent')
                .gte('sent_at', previousMonthStart.toISOString())
                .lte('sent_at', previousMonthEnd.toISOString()),
              supabase.from('scheduled_messages')
                .select('*', { count: 'exact', head: true })
                .eq('organization_id', org.id)
                .eq('status', 'sent')
                .gte('sent_at', previousMonthStart.toISOString())
                .lte('sent_at', previousMonthEnd.toISOString()),
              supabase.from('leads')
                .select('*', { count: 'exact', head: true })
                .eq('organization_id', org.id)
                .is('deleted_at', null)
                .lte('created_at', previousMonthEnd.toISOString())
            ]);

            const currentCost = 
              (currentIncoming || 0) * Number(costConfig.cost_per_incoming_message) +
              (currentBroadcast || 0) * Number(costConfig.cost_per_broadcast_message) +
              (currentScheduled || 0) * Number(costConfig.cost_per_scheduled_message) +
              (currentLeads || 0) * Number(costConfig.cost_per_lead_storage);

            const previousCost = 
              (prevIncoming || 0) * Number(costConfig.cost_per_incoming_message) +
              (prevBroadcast || 0) * Number(costConfig.cost_per_broadcast_message) +
              (prevScheduled || 0) * Number(costConfig.cost_per_scheduled_message) +
              (prevLeads || 0) * Number(costConfig.cost_per_lead_storage);

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

            return {
              orgId: org.id,
              orgName: org.name,
              currentMonthCost: currentCost,
              previousMonthCost: previousCost,
              trend,
              percentageChange,
              breakdown: {
                incomingMessages: (currentIncoming || 0) * Number(costConfig.cost_per_incoming_message),
                broadcastMessages: (currentBroadcast || 0) * Number(costConfig.cost_per_broadcast_message),
                scheduledMessages: (currentScheduled || 0) * Number(costConfig.cost_per_scheduled_message),
                leadsStored: (currentLeads || 0) * Number(costConfig.cost_per_lead_storage),
                databaseOps: 0
              }
            };
          })
        );

        costs.sort((a, b) => b.currentMonthCost - a.currentMonthCost);
        setOrgCosts(costs);
        return;
      }

      // Transformar dados da função SQL para o formato esperado (MESMA ESTRUTURA)
      const costs: OrganizationCost[] = (metricsData || []).map((row: any) => {
        // MESMOS CÁLCULOS DE CUSTO (lógica idêntica)
        const currentCost = 
          (row.current_incoming || 0) * Number(costConfig.cost_per_incoming_message) +
          (row.current_broadcast || 0) * Number(costConfig.cost_per_broadcast_message) +
          (row.current_scheduled || 0) * Number(costConfig.cost_per_scheduled_message) +
          (row.current_leads || 0) * Number(costConfig.cost_per_lead_storage);

        const previousCost = 
          (row.prev_incoming || 0) * Number(costConfig.cost_per_incoming_message) +
          (row.prev_broadcast || 0) * Number(costConfig.cost_per_broadcast_message) +
          (row.prev_scheduled || 0) * Number(costConfig.cost_per_scheduled_message) +
          (row.prev_leads || 0) * Number(costConfig.cost_per_lead_storage);

        // MESMA LÓGICA DE TENDÊNCIA
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

        return {
          orgId: row.org_id,
          orgName: row.org_name,
          currentMonthCost: currentCost,
          previousMonthCost: previousCost,
          trend,
          percentageChange,
          breakdown: {
            incomingMessages: (row.current_incoming || 0) * Number(costConfig.cost_per_incoming_message),
            broadcastMessages: (row.current_broadcast || 0) * Number(costConfig.cost_per_broadcast_message),
            scheduledMessages: (row.current_scheduled || 0) * Number(costConfig.cost_per_scheduled_message),
            leadsStored: (row.current_leads || 0) * Number(costConfig.cost_per_lead_storage),
            databaseOps: 0
          }
        };
      });

      // MESMA ORDENAÇÃO
      costs.sort((a, b) => b.currentMonthCost - a.currentMonthCost);
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
