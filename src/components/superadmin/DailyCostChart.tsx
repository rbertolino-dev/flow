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
      setCostConfig({
        cost_per_incoming_message: Number(data.cost_per_incoming_message),
        cost_per_broadcast_message: Number(data.cost_per_broadcast_message),
        cost_per_scheduled_message: Number(data.cost_per_scheduled_message),
        cost_per_database_read: Number(data.cost_per_database_read),
        cost_per_database_write: Number(data.cost_per_database_write),
      });
    }
  };

  const fetchDailyCosts = async () => {
    if (!costConfig) return;

    try {
      setLoading(true);

      // Buscar métricas agregadas por data da tabela daily_usage_metrics
      const { data: metricsData, error } = await supabase
        .from('daily_usage_metrics')
        .select('*')
        .gte('date', format(dateRange.start, 'yyyy-MM-dd'))
        .lte('date', format(dateRange.end, 'yyyy-MM-dd'))
        .order('date', { ascending: true });

      if (error) {
        console.error('Erro ao buscar métricas:', error);
        setLoading(false);
        return;
      }

      // Agregar por data
      const costsByDate = new Map<string, DailyCost>();

      metricsData?.forEach(metric => {
        const dateKey = metric.date;
        
        if (!costsByDate.has(dateKey)) {
          costsByDate.set(dateKey, {
            date: format(new Date(dateKey), 'dd/MM'),
            totalCost: 0,
            incomingMessages: 0,
            broadcastMessages: 0,
            scheduledMessages: 0,
            databaseReads: 0,
            databaseWrites: 0,
            leadsStored: 0
          });
        }

        const dayCost = costsByDate.get(dateKey)!;
        dayCost.totalCost += Number(metric.total_cost);

        // Mapear tipos de métrica para campos
        switch (metric.metric_type) {
          case 'incoming_messages':
            dayCost.incomingMessages += Number(metric.metric_value);
            break;
          case 'broadcast_messages':
            dayCost.broadcastMessages += Number(metric.metric_value);
            break;
          case 'scheduled_messages':
            dayCost.scheduledMessages += Number(metric.metric_value);
            break;
          case 'database_reads':
            dayCost.databaseReads += Number(metric.metric_value);
            break;
          case 'database_writes':
            dayCost.databaseWrites += Number(metric.metric_value);
            break;
          case 'leads_stored':
            dayCost.leadsStored += Number(metric.metric_value);
            break;
        }
      });

      const aggregatedCosts = Array.from(costsByDate.values())
        .sort((a, b) => a.date.localeCompare(b.date));

      setDailyCosts(aggregatedCosts);
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
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
