import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Phone, Calendar, Trash2, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface HistoryItem {
  id: string;
  lead_name: string;
  lead_phone: string;
  scheduled_for: string;
  completed_at: string | null;
  completed_by: string | null;
  status: string;
  priority: string | null;
  notes: string | null;
  call_notes: string | null;
  call_count: number;
  action: string;
  created_at: string;
}

export function CallQueueHistory() {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const { toast } = useToast();

  const fetchHistory = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('call_queue_history')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setHistory(data || []);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar histórico",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const handleClearHistory = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('call_queue_history')
        .delete()
        .eq('user_id', user.id);

      if (error) throw error;

      toast({
        title: "Histórico excluído",
        description: "Todo o histórico da fila de ligações foi removido",
      });

      setHistory([]);
      setDeleteDialogOpen(false);
    } catch (error: any) {
      toast({
        title: "Erro ao excluir histórico",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const actionLabels: Record<string, { label: string; color: string }> = {
    completed: { label: "Concluída", color: "bg-success" },
    deleted: { label: "Excluída", color: "bg-destructive" },
    rescheduled: { label: "Reagendada", color: "bg-warning" },
  };

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Histórico da Fila</h2>
          <p className="text-sm text-muted-foreground">{history.length} registro(s)</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchHistory}
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Atualizar
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setDeleteDialogOpen(true)}
            disabled={history.length === 0}
            className="gap-2"
          >
            <Trash2 className="h-4 w-4" />
            Limpar Histórico
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-3">
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              Carregando histórico...
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum registro no histórico
            </div>
          ) : (
            history.map((item) => (
              <Card key={item.id} className="p-4">
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <h3 className="font-medium">{item.lead_name}</h3>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                        <Phone className="h-3 w-3" />
                        {item.lead_phone}
                      </div>
                    </div>
                    <Badge
                      className={actionLabels[item.action]?.color || "bg-muted"}
                    >
                      {actionLabels[item.action]?.label || item.action}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    {format(new Date(item.created_at), "dd/MM/yyyy 'às' HH:mm", {
                      locale: ptBR,
                    })}
                  </div>

                  {item.completed_by && (
                    <div className="text-xs text-muted-foreground">
                      Concluído por: {item.completed_by}
                    </div>
                  )}

                  {item.call_notes && (
                    <div className="text-sm bg-muted/50 p-2 rounded-md">
                      <p className="text-xs text-muted-foreground mb-1">
                        Anotações da ligação:
                      </p>
                      {item.call_notes}
                    </div>
                  )}

                  {item.notes && (
                    <div className="text-sm bg-muted/50 p-2 rounded-md">
                      <p className="text-xs text-muted-foreground mb-1">Observações:</p>
                      {item.notes}
                    </div>
                  )}
                </div>
              </Card>
            ))
          )}
        </div>
      </ScrollArea>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tem certeza?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Todo o histórico da fila de ligações será
              excluído permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleClearHistory}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir Histórico
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
