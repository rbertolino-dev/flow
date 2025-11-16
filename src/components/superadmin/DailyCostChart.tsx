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

      // OTIMIZAÇÃO: Usar função SQL agregada em vez de múltiplas queries
      // Reduz de 120 queries (30 dias × 4) para 1 query apenas
      // A função SQL retorna todos os dias do intervalo, mesmo sem dados
      
      const { data: metricsData, error } = await supabase.rpc('get_daily_metrics', {
        start_date: dateRange.start.toISOString(),
        end_date: dateRange.end.toISOString()
      });

      if (error) {
        console.error('Erro ao buscar métricas diárias:', error);
        // Fallback: se a função SQL não existir, usar método antigo
        // Isso garante compatibilidade durante migração
        const days = eachDayOfInterval({
          start: dateRange.start,
          end: dateRange.end
        });

        const dailyData = await Promise.all(
          days.map(async (day) => {
            const dayStart = new Date(day);
            dayStart.setHours(0, 0, 0, 0);
            const dayEnd = new Date(day);
            dayEnd.setHours(23, 59, 59, 999);

            const [
              { count: incoming },
              { count: broadcast },
              { count: scheduled },
              { count: leads }
            ] = await Promise.all([
              supabase.from('whatsapp_messages')
                .select('*', { count: 'exact', head: true })
                .eq('direction', 'incoming')
                .gte('timestamp', dayStart.toISOString())
                .lte('timestamp', dayEnd.toISOString()),
              supabase.from('broadcast_queue')
                .select('*', { count: 'exact', head: true })
                .eq('status', 'sent')
                .gte('sent_at', dayStart.toISOString())
                .lte('sent_at', dayEnd.toISOString()),
              supabase.from('scheduled_messages')
                .select('*', { count: 'exact', head: true })
                .eq('status', 'sent')
                .gte('sent_at', dayStart.toISOString())
                .lte('sent_at', dayEnd.toISOString()),
              supabase.from('leads')
                .select('*', { count: 'exact', head: true })
                .is('deleted_at', null)
                .lte('created_at', dayEnd.toISOString())
            ]);

            const incomingCost = (incoming || 0) * costConfig.cost_per_incoming_message;
            const broadcastCost = (broadcast || 0) * costConfig.cost_per_broadcast_message;
            const scheduledCost = (scheduled || 0) * costConfig.cost_per_scheduled_message;
            const totalCost = incomingCost + broadcastCost + scheduledCost;

            return {
              date: format(day, 'dd/MM'),
              totalCost,
              incomingMessages: incoming || 0,
              broadcastMessages: broadcast || 0,
              scheduledMessages: scheduled || 0,
              databaseReads: 0,
              databaseWrites: 0,
              leadsStored: leads || 0
            };
          })
        );

        setDailyCosts(dailyData);
        return;
      }

      // Transformar dados da função SQL para o formato esperado (MESMA ESTRUTURA)
      const dailyData = (metricsData || []).map((row: any) => {
        // Converter string de data para objeto Date
        const day = new Date(row.date);
        
        // MESMOS CÁLCULOS DE CUSTO (lógica idêntica)
        const incomingCost = (row.incoming_count || 0) * costConfig.cost_per_incoming_message;
        const broadcastCost = (row.broadcast_count || 0) * costConfig.cost_per_broadcast_message;
        const scheduledCost = (row.scheduled_count || 0) * costConfig.cost_per_scheduled_message;
        const totalCost = incomingCost + broadcastCost + scheduledCost;

        return {
          date: format(day, 'dd/MM'), // MESMO FORMATO DE DATA
          totalCost, // MESMO CÁLCULO
          incomingMessages: row.incoming_count || 0,
          broadcastMessages: row.broadcast_count || 0,
          scheduledMessages: row.scheduled_count || 0,
          databaseReads: 0, // MANTIDO (mesmo valor)
          databaseWrites: 0, // MANTIDO (mesmo valor)
          leadsStored: row.leads_count || 0
        };
      });

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
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
