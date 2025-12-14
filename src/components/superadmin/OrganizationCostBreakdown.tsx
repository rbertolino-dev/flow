import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, TrendingUp, Users, Database, Send, Calendar, DollarSign } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

interface OrgMetrics {
  id: string;
  name: string;
  userCount: number;
  leadCount: number;
  messageCount: number;
  broadcastCount: number;
  scheduledCount: number;
  totalCost: number;
  storageGB: number;
  edgeFunctionCalls: number;
  workflowExecutions: number;
  activityScore: number;
}

export function OrganizationCostBreakdown() {
  const [loading, setLoading] = useState(true);
  const [orgMetrics, setOrgMetrics] = useState<OrgMetrics[]>([]);

  useEffect(() => {
    fetchOrganizationMetrics();
  }, []);

  const fetchOrganizationMetrics = async () => {
    try {
      setLoading(true);

      // Fetch all organizations
      const { data: orgs, error: orgsError } = await supabase
        .from('organizations')
        .select('id, name')
        .order('name');

      if (orgsError) throw orgsError;

      // Buscar métricas dos últimos 30 dias de daily_usage_metrics
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const startDate = thirtyDaysAgo.toISOString().split('T')[0];

      const { data: dailyMetrics, error: metricsError } = await supabase
        .from('daily_usage_metrics')
        .select('organization_id, metric_type, metric_value, total_cost')
        .gte('date', startDate)
        .not('organization_id', 'is', null);

      if (metricsError) {
        console.error('Error fetching daily metrics:', metricsError);
      }

      // Agregar métricas por organização
      const orgMetricsMap = new Map<string, {
        incoming: number;
        broadcast: number;
        scheduled: number;
        storage: number;
        edgeFunctions: number;
        workflows: number;
        totalCost: number;
      }>();

      dailyMetrics?.forEach((metric) => {
        if (!metric.organization_id) return;
        
        const orgId = metric.organization_id;
        const current = orgMetricsMap.get(orgId) || {
          incoming: 0,
          broadcast: 0,
          scheduled: 0,
          storage: 0,
          edgeFunctions: 0,
          workflows: 0,
          totalCost: 0
        };

        const value = metric.metric_value || 0;
        const cost = metric.total_cost || 0;

        switch (metric.metric_type) {
          case 'incoming_messages':
            current.incoming += value;
            current.totalCost += cost;
            break;
          case 'broadcast_messages':
            current.broadcast += value;
            current.totalCost += cost;
            break;
          case 'scheduled_messages':
            current.scheduled += value;
            current.totalCost += cost;
            break;
          case 'storage_gb':
            current.storage += value;
            current.totalCost += cost;
            break;
          case 'edge_function_calls':
            current.edgeFunctions += value;
            current.totalCost += cost;
            break;
          case 'workflow_executions':
            current.workflows += value;
            current.totalCost += cost;
            break;
        }

        orgMetricsMap.set(orgId, current);
      });

      // Fetch basic counts for each organization (para activity score)
      const metricsPromises = (orgs || []).map(async (org) => {
        const [
          { count: users },
          { count: leads }
        ] = await Promise.all([
          supabase.from('organization_members').select('*', { count: 'exact', head: true }).eq('organization_id', org.id),
          supabase.from('leads').select('*', { count: 'exact', head: true }).eq('organization_id', org.id).is('deleted_at', null)
        ]);

        const aggregated = orgMetricsMap.get(org.id) || {
          incoming: 0,
          broadcast: 0,
          scheduled: 0,
          storage: 0,
          edgeFunctions: 0,
          workflows: 0,
          totalCost: 0
        };

        // Calculate activity score (weighted sum)
        const activityScore = 
          (users || 0) * 1 +
          (leads || 0) * 2 +
          aggregated.incoming * 5 +
          aggregated.broadcast * 10 +
          aggregated.scheduled * 3;

        return {
          id: org.id,
          name: org.name,
          userCount: users || 0,
          leadCount: leads || 0,
          messageCount: aggregated.incoming,
          broadcastCount: aggregated.broadcast,
          scheduledCount: aggregated.scheduled,
          totalCost: aggregated.totalCost,
          storageGB: aggregated.storage,
          edgeFunctionCalls: aggregated.edgeFunctions,
          workflowExecutions: aggregated.workflows,
          activityScore
        };
      });

      const metrics = await Promise.all(metricsPromises);
      
      // Sort by total cost descending (mais relevante que activity score)
      metrics.sort((a, b) => b.totalCost - a.totalCost);
      
      setOrgMetrics(metrics);
    } catch (error) {
      console.error('Error fetching organization metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  const chartData = orgMetrics.slice(0, 10).map(org => ({
    name: org.name.length > 15 ? org.name.substring(0, 15) + '...' : org.name,
    Leads: org.leadCount,
    Mensagens: org.messageCount,
    Disparos: org.broadcastCount,
    Usuários: org.userCount
  }));

  const chartConfig = {
    Leads: {
      label: "Leads",
      color: "hsl(var(--chart-1))",
    },
    Mensagens: {
      label: "Mensagens",
      color: "hsl(var(--chart-2))",
    },
    Disparos: {
      label: "Disparos",
      color: "hsl(var(--chart-3))",
    },
    Usuários: {
      label: "Usuários",
      color: "hsl(var(--chart-4))",
    },
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Top 10 Organizações por Atividade</CardTitle>
          <CardDescription>Organizações com maior uso do sistema</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="name" 
                  angle={-45} 
                  textAnchor="end" 
                  height={100}
                  interval={0}
                />
                <YAxis />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Legend />
                <Bar dataKey="Leads" fill="var(--color-Leads)" />
                <Bar dataKey="Mensagens" fill="var(--color-Mensagens)" />
                <Bar dataKey="Disparos" fill="var(--color-Disparos)" />
                <Bar dataKey="Usuários" fill="var(--color-Usuários)" />
              </BarChart>
            </ResponsiveContainer>
          </ChartContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Detalhamento por Organização</CardTitle>
          <CardDescription>
            Uso detalhado de cada organização ordenado por impacto no custo
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Organização</TableHead>
                  <TableHead className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Users className="h-4 w-4" />
                      Usuários
                    </div>
                  </TableHead>
                  <TableHead className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Database className="h-4 w-4" />
                      Leads
                    </div>
                  </TableHead>
                  <TableHead className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Send className="h-4 w-4" />
                      Mensagens
                    </div>
                  </TableHead>
                  <TableHead className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <TrendingUp className="h-4 w-4" />
                      Disparos
                    </div>
                  </TableHead>
                  <TableHead className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Calendar className="h-4 w-4" />
                      Agendadas
                    </div>
                  </TableHead>
                  <TableHead className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <DollarSign className="h-4 w-4" />
                      Custo Total
                    </div>
                  </TableHead>
                  <TableHead className="text-center">Score</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orgMetrics.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground">
                      Nenhuma organização encontrada
                    </TableCell>
                  </TableRow>
                ) : (
                  orgMetrics.map((org) => (
                    <TableRow key={org.id}>
                      <TableCell className="font-medium">{org.name}</TableCell>
                      <TableCell className="text-center">{org.userCount}</TableCell>
                      <TableCell className="text-center">{org.leadCount}</TableCell>
                      <TableCell className="text-center">{org.messageCount}</TableCell>
                      <TableCell className="text-center">{org.broadcastCount}</TableCell>
                      <TableCell className="text-center">{org.scheduledCount}</TableCell>
                      <TableCell className="text-center">
                        <span className="font-semibold text-success">
                          ${org.totalCost.toFixed(2)}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={org.activityScore > 1000 ? "destructive" : org.activityScore > 500 ? "default" : "secondary"}>
                          {org.activityScore}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
