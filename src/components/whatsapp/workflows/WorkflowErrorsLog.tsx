import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useWorkflowErrors } from "@/hooks/useWorkflowErrors";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, XCircle, MessageSquare, CheckCircle2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

export function WorkflowErrorsLog() {
  const { errors, isLoading } = useWorkflowErrors(100);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Logs de Erros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (errors.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            Logs de Erros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-sm text-muted-foreground">
            <CheckCircle2 className="h-12 w-12 mx-auto mb-4 opacity-20 text-green-500" />
            <p>Nenhum erro encontrado! 🎉</p>
            <p className="text-xs mt-2">Todos os workflows estão funcionando corretamente.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <XCircle className="h-5 w-5 text-red-500" />
          Logs de Erros
          <Badge variant="destructive" className="ml-2">
            {errors.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[500px]">
          <div className="space-y-3">
            {errors.map((error) => (
              <div
                key={error.id}
                className="p-4 border border-red-200 rounded-lg bg-red-50/50 hover:bg-red-50 transition-colors"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <XCircle className="h-4 w-4 text-red-500" />
                    <Badge variant="destructive">Falhou</Badge>
                    {error.workflow_name && (
                      <span className="text-xs font-medium">
                        {error.workflow_name}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground text-right">
                    {format(new Date(error.scheduled_for), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-medium">Para:</span>
                    <span>{error.phone}</span>
                    {error.lead_name && (
                      <span className="text-muted-foreground">({error.lead_name})</span>
                    )}
                  </div>

                  <div className="p-2 bg-white border border-red-200 rounded text-sm">
                    <p className="text-muted-foreground line-clamp-2 mb-2">{error.message}</p>
                    <div className="mt-2 pt-2 border-t border-red-200">
                      <strong className="text-red-800">Erro:</strong>
                      <p className="text-red-700 mt-1">{error.error_message}</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

