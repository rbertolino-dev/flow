import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Loader2, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { format, startOfMonth, endOfMonth, eachDayOfInterval } from "date-fns";
import { ptBR } from "date-fns/locale";

interface DailyCost {
  date: string;
  totalCost: number;
  incomingMessages: number;
  broadcastMessages: number;
  scheduledMessages: number;
  storageGB: number;
  edgeFunctionCalls: number;
  realtimeMessages: number;
  workflowExecutions: number;
  formSubmissions: number;
  agentAICalls: number;
  databaseReads: number;
  databaseWrites: number;
  leadsStored: number;
}

interface CostConfig {
  cost_per_incoming_message: number;
  cost_per_broadcast_message: number;
  cost_per_scheduled_message: number;
  cost_per_database_read: number;
  cost_per_database_write: number;
  cost_per_storage_gb: number;
  cost_per_edge_function_call: number;
  cost_per_realtime_message: number;
  cost_per_workflow_execution: number;
  cost_per_form_submission: number;
  cost_per_agent_ai_call: number;
}

export function DailyCostChart() {
  const [loading, setLoading] = useState(true);
  const [dailyCosts, setDailyCosts] = useState<DailyCost[]>([]);
  const [dateRange, setDateRange] = useState({
    start: startOfMonth(new Date()),
    end: endOfMonth(new Date())
  });
  const [costConfig, setCostConfig] = useState<CostConfig | null>(null);

  useEffect(() => {
    fetchCostConfig();
  }, []);

  useEffect(() => {
    if (costConfig) {
      fetchDailyCosts();
    }
  }, [dateRange.start, dateRange.end, costConfig]);

  const fetchCostConfig = async () => {
    const { data } = await supabase
      .from('cloud_cost_config')
      .select('*')
      .single();
    
    if (data) {
      const extendedData = data as Record<string, any>;
      setCostConfig({
        cost_per_incoming_message: Number(data.cost_per_incoming_message),
        cost_per_broadcast_message: Number(data.cost_per_broadcast_message),
        cost_per_scheduled_message: Number(data.cost_per_scheduled_message),
        cost_per_database_read: Number(data.cost_per_database_read),
        cost_per_database_write: Number(data.cost_per_database_write),
        cost_per_storage_gb: Number(data.cost_per_storage_gb || 0),
        cost_per_edge_function_call: Number(data.cost_per_edge_function_call || 0),
        cost_per_realtime_message: Number(data.cost_per_realtime_message || 0),
        cost_per_workflow_execution: Number(extendedData.cost_per_workflow_execution || 0),
        cost_per_form_submission: Number(extendedData.cost_per_form_submission || 0),
        cost_per_agent_ai_call: Number(extendedData.cost_per_agent_ai_call || 0),
      });
    }
  };

  const fetchDailyCosts = async () => {
    if (!costConfig) return;

    try {
      setLoading(true);

      // Usar daily_usage_metrics diretamente - dados já agregados e calculados
      const startDateStr = format(dateRange.start, 'yyyy-MM-dd');
      const endDateStr = format(dateRange.end, 'yyyy-MM-dd');

      const { data: metricsData, error } = await supabase
        .from('daily_usage_metrics')
        .select('date, metric_type, metric_value, total_cost')
        .gte('date', startDateStr)
        .lte('date', endDateStr)
        .order('date', { ascending: true });

      if (error) {
        console.error('Erro ao buscar métricas diárias:', error);
        setDailyCosts([]);
        return;
      }

      // Agregar métricas por dia
      const dailyMap = new Map<string, DailyCost>();

      // Inicializar todos os dias do intervalo
      const days = eachDayOfInterval({
        start: dateRange.start,
        end: dateRange.end
      });

      days.forEach(day => {
        const dateKey = format(day, 'yyyy-MM-dd');
        dailyMap.set(dateKey, {
          date: format(day, 'dd/MM'),
          totalCost: 0,
          incomingMessages: 0,
          broadcastMessages: 0,
          scheduledMessages: 0,
          storageGB: 0,
          edgeFunctionCalls: 0,
          realtimeMessages: 0,
          workflowExecutions: 0,
          formSubmissions: 0,
          agentAICalls: 0,
          databaseReads: 0,
          databaseWrites: 0,
          leadsStored: 0
        });
      });

      // Processar métricas
      metricsData?.forEach((metric) => {
        const dateKey = metric.date;
        const dayData = dailyMap.get(dateKey) || {
          date: format(new Date(dateKey), 'dd/MM'),
          totalCost: 0,
          incomingMessages: 0,
          broadcastMessages: 0,
          scheduledMessages: 0,
          storageGB: 0,
          edgeFunctionCalls: 0,
          realtimeMessages: 0,
          workflowExecutions: 0,
          formSubmissions: 0,
          agentAICalls: 0,
          databaseReads: 0,
          databaseWrites: 0,
          leadsStored: 0
        };

        const value = metric.metric_value || 0;
        const cost = metric.total_cost || 0;

        switch (metric.metric_type) {
          case 'incoming_messages':
            dayData.incomingMessages = value;
            dayData.totalCost += cost;
            break;
          case 'broadcast_messages':
            dayData.broadcastMessages = value;
            dayData.totalCost += cost;
            break;
          case 'scheduled_messages':
            dayData.scheduledMessages = value;
            dayData.totalCost += cost;
            break;
          case 'storage_gb':
            dayData.storageGB = value;
            dayData.totalCost += cost;
            break;
          case 'edge_function_calls':
            dayData.edgeFunctionCalls = value;
            dayData.totalCost += cost;
            break;
          case 'realtime_messages':
            dayData.realtimeMessages = value;
            dayData.totalCost += cost;
            break;
          case 'workflow_executions':
            dayData.workflowExecutions = value;
            dayData.totalCost += cost;
            break;
          case 'form_submissions':
            dayData.formSubmissions = value;
            dayData.totalCost += cost;
            break;
          case 'agent_ai_calls':
            dayData.agentAICalls = value;
            dayData.totalCost += cost;
            break;
          case 'database_reads':
            dayData.databaseReads = value;
            dayData.totalCost += cost;
            break;
          case 'database_writes':
            dayData.databaseWrites = value;
            dayData.totalCost += cost;
            break;
          case 'leads_stored':
            dayData.leadsStored = value;
            dayData.totalCost += cost;
            break;
        }

        dailyMap.set(dateKey, dayData);
      });

      // Converter para array e ordenar por data original
      const dailyData = Array.from(dailyMap.entries())
        .sort((a, b) => a[0].localeCompare(b[0])) // Ordenar por chave (yyyy-MM-dd)
        .map(([_, value]) => value); // Extrair apenas o valor

      setDailyCosts(dailyData);
    } catch (err) {
      console.error('Erro ao processar métricas:', err);
    } finally {
      setLoading(false);
    }
  };

  const totalPeriodCost = dailyCosts.reduce((sum, day) => sum + day.totalCost, 0);

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
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Gastos Diários</CardTitle>
            <CardDescription>
              Total do período: ${totalPeriodCost.toFixed(2)}
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm">
                  <Calendar className="mr-2 h-4 w-4" />
                  {format(dateRange.start, 'dd/MM/yyyy', { locale: ptBR })}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <CalendarComponent
                  mode="single"
                  selected={dateRange.start}
                  onSelect={(date) => date && setDateRange(prev => ({ ...prev, start: date }))}
                  locale={ptBR}
                />
              </PopoverContent>
            </Popover>
            <span className="flex items-center">até</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm">
                  <Calendar className="mr-2 h-4 w-4" />
                  {format(dateRange.end, 'dd/MM/yyyy', { locale: ptBR })}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <CalendarComponent
                  mode="single"
                  selected={dateRange.end}
                  onSelect={(date) => date && setDateRange(prev => ({ ...prev, end: date }))}
                  locale={ptBR}
                />
              </PopoverContent>
            </Popover>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => {
                setDateRange({
                  start: startOfMonth(new Date()),
                  end: endOfMonth(new Date())
                });
              }}
            >
              Mês Atual
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={350}>
          <LineChart data={dailyCosts}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis 
              dataKey="date" 
              className="text-xs text-muted-foreground"
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
              formatter={(value: number) => [`$${value.toFixed(2)}`, 'Custo']}
            />
            <Legend />
            <Line 
              type="monotone" 
              dataKey="totalCost" 
              stroke="hsl(var(--primary))" 
              strokeWidth={2}
              name="Custo Total ($)"
              dot={{ fill: 'hsl(var(--primary))' }}
            />
            <Line 
              type="monotone" 
              dataKey="storageGB" 
              stroke="hsl(var(--chart-2))" 
              strokeWidth={1}
              name="Storage (GB)"
              dot={false}
            />
            <Line 
              type="monotone" 
              dataKey="edgeFunctionCalls" 
              stroke="hsl(var(--chart-3))" 
              strokeWidth={1}
              name="Edge Functions"
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
