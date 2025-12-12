import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useWorkflowExecutionHistory } from "@/hooks/useWorkflowExecutionHistory";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle2, Clock, XCircle, AlertCircle, MessageSquare } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface WorkflowExecutionHistoryProps {
  workflowId?: string;
  limit?: number;
}

const statusConfig = {
  sent: { label: "Enviado", icon: CheckCircle2, color: "bg-green-100 text-green-800" },
  pending: { label: "Pendente", icon: Clock, color: "bg-yellow-100 text-yellow-800" },
  failed: { label: "Falhou", icon: XCircle, color: "bg-red-100 text-red-800" },
  cancelled: { label: "Cancelado", icon: AlertCircle, color: "bg-gray-100 text-gray-800" },
};

export function WorkflowExecutionHistory({ workflowId, limit = 50 }: WorkflowExecutionHistoryProps) {
  const { executions, isLoading } = useWorkflowExecutionHistory(workflowId, limit);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Histórico de Execuções</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (executions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Histórico de Execuções</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-sm text-muted-foreground">
            <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-20" />
            <p>Nenhuma execução encontrada</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Histórico de Execuções
          <Badge variant="secondary" className="ml-2">
            {executions.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px]">
          <div className="space-y-3">
            {executions.map((execution) => {
              const status = statusConfig[execution.status as keyof typeof statusConfig] || statusConfig.pending;
              const StatusIcon = status.icon;

              return (
                <div
                  key={execution.id}
                  className="p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <StatusIcon className={`h-4 w-4 ${status.color.split(' ')[1]}`} />
                      <Badge className={status.color}>
                        {status.label}
                      </Badge>
                      {execution.workflow_name && (
                        <span className="text-xs text-muted-foreground">
                          {execution.workflow_name}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground text-right">
                      <div>
                        Agendado: {format(new Date(execution.scheduled_for), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </div>
                      {execution.sent_at && (
                        <div>
                          Enviado: {format(new Date(execution.sent_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium">Para:</span>
                      <span>{execution.phone}</span>
                      {execution.lead_name && (
                        <span className="text-muted-foreground">({execution.lead_name})</span>
                      )}
                    </div>

                    <div className="text-sm">
                      <p className="text-muted-foreground line-clamp-2">{execution.message}</p>
                    </div>

                    {execution.error_message && (
                      <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-800">
                        <strong>Erro:</strong> {execution.error_message}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}



