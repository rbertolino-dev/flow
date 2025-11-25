import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useFlowExecutions } from "@/hooks/useFlowExecutions";
import { FlowExecution } from "@/types/automationFlow";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Play, Pause, X, Loader2, Clock, CheckCircle2, AlertCircle } from "lucide-react";

interface FlowExecutionsPanelProps {
  flowId?: string;
}

export function FlowExecutionsPanel({ flowId }: FlowExecutionsPanelProps) {
  const { executions, loading, pauseExecution, resumeExecution, cancelExecution } = useFlowExecutions(flowId);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'running':
        return (
          <Badge className="bg-blue-500">
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            Em Execução
          </Badge>
        );
      case 'waiting':
        return (
          <Badge className="bg-yellow-500">
            <Clock className="h-3 w-3 mr-1" />
            Aguardando
          </Badge>
        );
      case 'completed':
        return (
          <Badge className="bg-green-500">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Concluído
          </Badge>
        );
      case 'paused':
        return (
          <Badge variant="secondary">
            <Pause className="h-3 w-3 mr-1" />
            Pausado
          </Badge>
        );
      case 'error':
        return (
          <Badge variant="destructive">
            <AlertCircle className="h-3 w-3 mr-1" />
            Erro
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Execuções de Fluxos</h2>
          <p className="text-muted-foreground">
            {flowId ? "Execuções deste fluxo" : "Todas as execuções ativas"}
          </p>
        </div>
      </div>

      {executions.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground">Nenhuma execução encontrada</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {executions.map((execution) => (
            <Card key={execution.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg">
                      {execution.leads?.name || 'Lead desconhecido'}
                    </CardTitle>
                    <CardDescription>
                      {execution.automation_flows?.name || 'Fluxo desconhecido'}
                    </CardDescription>
                  </div>
                  {getStatusBadge(execution.status)}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Iniciado:</span>
                    <span>{format(execution.startedAt, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
                  </div>
                  
                  {execution.nextExecutionAt && (
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Próxima execução:</span>
                      <span>{format(execution.nextExecutionAt, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
                    </div>
                  )}

                  {execution.completedAt && (
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Concluído:</span>
                      <span>{format(execution.completedAt, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
                    </div>
                  )}

                  {execution.currentNodeId && (
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Nó atual:</span>
                      <Badge variant="outline">{execution.currentNodeId}</Badge>
                    </div>
                  )}

                  <div className="flex gap-2 mt-4">
                    {execution.status === 'running' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => pauseExecution(execution.id)}
                      >
                        <Pause className="h-4 w-4 mr-2" />
                        Pausar
                      </Button>
                    )}

                    {execution.status === 'paused' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => resumeExecution(execution.id)}
                      >
                        <Play className="h-4 w-4 mr-2" />
                        Retomar
                      </Button>
                    )}

                    {['running', 'waiting', 'paused'].includes(execution.status) && (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => cancelExecution(execution.id)}
                      >
                        <X className="h-4 w-4 mr-2" />
                        Cancelar
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

