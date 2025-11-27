import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useWorkflowStats } from "@/hooks/useWorkflowStats";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Activity,
  Play,
  Pause,
  CheckCircle2,
  MessageSquare,
  Clock,
  AlertCircle,
  Calendar,
} from "lucide-react";

export function WorkflowStatsDashboard() {
  const { stats, isLoading } = useWorkflowStats();

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(8)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total de Workflows</CardTitle>
          <Activity className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.total}</div>
          <div className="flex gap-4 text-xs text-muted-foreground mt-2">
            <span className="flex items-center gap-1">
              <Play className="h-3 w-3 text-green-500" />
              {stats.active} ativos
            </span>
            <span className="flex items-center gap-1">
              <Pause className="h-3 w-3 text-yellow-500" />
              {stats.paused} pausados
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Mensagens Hoje</CardTitle>
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.messagesSentToday}</div>
          <p className="text-xs text-muted-foreground mt-2">
            {stats.messagesSentThisWeek} esta semana
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Pendentes</CardTitle>
          <Clock className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.messagesPending}</div>
          <p className="text-xs text-muted-foreground mt-2">
            {stats.messagesFailed} falharam
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Próximas Execuções</CardTitle>
          <Calendar className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.nextExecutions}</div>
          <p className="text-xs text-muted-foreground mt-2">
            Mensagens agendadas
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

