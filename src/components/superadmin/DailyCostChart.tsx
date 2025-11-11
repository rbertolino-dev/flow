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
  operations: {
    incomingMessages: number;
    broadcastMessages: number;
    scheduledMessages: number;
    databaseReads: number;
    databaseWrites: number;
  };
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
  const [startDate, setStartDate] = useState<Date>(startOfMonth(new Date()));
  const [endDate, setEndDate] = useState<Date>(endOfMonth(new Date()));
  const [costConfig, setCostConfig] = useState<CostConfig | null>(null);

  useEffect(() => {
    fetchCostConfig();
  }, []);

  useEffect(() => {
    if (costConfig) {
      fetchDailyCosts();
    }
  }, [startDate, endDate, costConfig]);

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
    
    setLoading(true);
    try {
      const days = eachDayOfInterval({ start: startDate, end: endDate });
      
      const dailyData = await Promise.all(
        days.map(async (day) => {
          const dayStart = format(day, 'yyyy-MM-dd');
          const dayEnd = format(new Date(day.getTime() + 86400000), 'yyyy-MM-dd');

          const [
            { count: incomingCount },
            { count: broadcastCount },
            { count: scheduledCount }
          ] = await Promise.all([
            supabase
              .from('whatsapp_messages')
              .select('*', { count: 'exact', head: true })
              .eq('direction', 'incoming')
              .gte('created_at', dayStart)
              .lt('created_at', dayEnd),
            supabase
              .from('broadcast_queue')
              .select('*', { count: 'exact', head: true })
              .eq('status', 'sent')
              .gte('created_at', dayStart)
              .lt('created_at', dayEnd),
            supabase
              .from('scheduled_messages')
              .select('*', { count: 'exact', head: true })
              .eq('status', 'sent')
              .gte('sent_at', dayStart)
              .lt('sent_at', dayEnd)
          ]);

          const incoming = incomingCount || 0;
          const broadcast = broadcastCount || 0;
          const scheduled = scheduledCount || 0;
          
          // Estimativa simples de reads/writes
          const dbReads = (incoming + broadcast + scheduled) * 2;
          const dbWrites = incoming + broadcast + scheduled;

          const totalCost = 
            (incoming * costConfig.cost_per_incoming_message) +
            (broadcast * costConfig.cost_per_broadcast_message) +
            (scheduled * costConfig.cost_per_scheduled_message) +
            (dbReads * costConfig.cost_per_database_read) +
            (dbWrites * costConfig.cost_per_database_write);

          return {
            date: format(day, 'dd/MM'),
            totalCost: Number(totalCost.toFixed(2)),
            operations: {
              incomingMessages: incoming,
              broadcastMessages: broadcast,
              scheduledMessages: scheduled,
              databaseReads: dbReads,
              databaseWrites: dbWrites
            }
          };
        })
      );

      setDailyCosts(dailyData);
    } catch (error) {
      console.error('Error fetching daily costs:', error);
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
                  {format(startDate, 'dd/MM/yyyy', { locale: ptBR })}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <CalendarComponent
                  mode="single"
                  selected={startDate}
                  onSelect={(date) => date && setStartDate(date)}
                  locale={ptBR}
                />
              </PopoverContent>
            </Popover>
            <span className="flex items-center">até</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm">
                  <Calendar className="mr-2 h-4 w-4" />
                  {format(endDate, 'dd/MM/yyyy', { locale: ptBR })}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <CalendarComponent
                  mode="single"
                  selected={endDate}
                  onSelect={(date) => date && setEndDate(date)}
                  locale={ptBR}
                />
              </PopoverContent>
            </Popover>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => {
                setStartDate(startOfMonth(new Date()));
                setEndDate(endOfMonth(new Date()));
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
