import { supabase } from "@/integrations/supabase/client";
import { processFlowExecution } from "./flowTriggerSystem";

/**
 * Processa execuções agendadas que estão aguardando
 * Esta função deve ser chamada periodicamente (ex: a cada minuto)
 */
export async function processScheduledExecutions(): Promise<void> {
  try {
    const now = new Date().toISOString();

    // Buscar execuções que estão aguardando e cujo tempo chegou
    const { data: waitingExecutions, error } = await (supabase as any)
      .from('flow_executions')
      .select('flow_id, lead_id, id')
      .eq('status', 'waiting')
      .lte('next_execution_at', now);

    if (error) {
      console.error('Erro ao buscar execuções agendadas:', error);
      return;
    }

    if (!waitingExecutions || waitingExecutions.length === 0) {
      return;
    }

    // Processar cada execução
    for (const execution of waitingExecutions) {
      try {
        await processFlowExecution(execution.flow_id, execution.lead_id);
      } catch (error) {
        console.error(`Erro ao processar execução ${execution.id}:`, error);
      }
    }
  } catch (error) {
    console.error('Erro no processador de execuções agendadas:', error);
  }
}

/**
 * Inicia o scheduler que processa execuções agendadas periodicamente
 */
export function startFlowScheduler(intervalMinutes: number = 1): () => void {
  // Processar imediatamente
  processScheduledExecutions();

  // Configurar intervalo
  const interval = setInterval(() => {
    processScheduledExecutions();
  }, intervalMinutes * 60 * 1000);

  // Retornar função para parar o scheduler
  return () => clearInterval(interval);
}

