import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useLeads } from "@/hooks/useLeads";
import { processFlowExecution } from "@/lib/flowTriggerSystem";
import { Loader2, Play, CheckCircle2, X, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AutomationFlow } from "@/types/automationFlow";
import { supabase } from "@/integrations/supabase/client";
import { getUserOrganizationId } from "@/lib/organizationUtils";

interface FlowTestModeProps {
  flow: AutomationFlow;
  onClose: () => void;
}

export function FlowTestMode({ flow, onClose }: FlowTestModeProps) {
  const { leads } = useLeads();
  const { toast } = useToast();
  const [selectedLeadId, setSelectedLeadId] = useState<string>("");
  const [isRunning, setIsRunning] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    executionId?: string;
  } | null>(null);

  const handleTest = async () => {
    if (!selectedLeadId) {
      toast({
        title: "Selecione um lead",
        description: "Escolha um lead para testar o fluxo",
        variant: "destructive",
      });
      return;
    }

    setIsRunning(true);
    setTestResult(null);

    try {
      // Criar execução de teste manualmente
      const { data: { user } } = await supabase.auth.getUser();
      const organizationId = await getUserOrganizationId();
      
      if (!organizationId || !user) {
        throw new Error("Erro ao obter dados do usuário");
      }

      // Encontrar primeiro nó de gatilho
      const triggerNode = flow.flowData.nodes.find(node => node.type === 'trigger');
      if (!triggerNode) {
        throw new Error("O fluxo não possui um gatilho para iniciar");
      }

      // Criar execução manual
      const { data: execution, error: execError } = await (supabase as any)
        .from('flow_executions')
        .insert({
          flow_id: flow.id,
          lead_id: selectedLeadId,
          organization_id: organizationId,
          current_node_id: triggerNode.id,
          status: 'running',
          execution_data: { isTest: true },
          created_by: user.id,
        })
        .select()
        .single();

      if (execError) throw execError;

      // Processar execução
      await processFlowExecution(flow.id, selectedLeadId);

      setTestResult({
        success: true,
        message: "Fluxo executado com sucesso! Verifique as ações executadas no lead.",
        executionId: execution.id,
      });

      toast({
        title: "Teste concluído",
        description: "O fluxo foi executado. Verifique o resultado no lead selecionado.",
      });
    } catch (error: any) {
      setTestResult({
        success: false,
        message: error.message || "Erro ao executar teste",
      });

      toast({
        title: "Erro no teste",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Modo de Teste</CardTitle>
        <CardDescription>
          Execute este fluxo manualmente em um lead para testar
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Selecione um Lead para Testar</Label>
          <Select value={selectedLeadId} onValueChange={setSelectedLeadId}>
            <SelectTrigger>
              <SelectValue placeholder="Escolha um lead" />
            </SelectTrigger>
            <SelectContent>
              {leads.slice(0, 50).map((lead) => (
                <SelectItem key={lead.id} value={lead.id}>
                  {lead.name} - {lead.phone}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {testResult && (
          <div className={`p-4 rounded-md border ${
            testResult.success 
              ? 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800' 
              : 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800'
          }`}>
            <div className="flex items-start gap-2">
              {testResult.success ? (
                <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5" />
              )}
              <div className="flex-1">
                <p className={`font-medium ${
                  testResult.success 
                    ? 'text-green-800 dark:text-green-200' 
                    : 'text-red-800 dark:text-red-200'
                }`}>
                  {testResult.success ? 'Teste Concluído' : 'Erro no Teste'}
                </p>
                <p className={`text-sm mt-1 ${
                  testResult.success 
                    ? 'text-green-700 dark:text-green-300' 
                    : 'text-red-700 dark:text-red-300'
                }`}>
                  {testResult.message}
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <Button
            onClick={handleTest}
            disabled={!selectedLeadId || isRunning}
            className="flex-1"
          >
            {isRunning ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Executando...
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Executar Teste
              </>
            )}
          </Button>
          <Button variant="outline" onClick={onClose}>
            <X className="h-4 w-4 mr-2" />
            Fechar
          </Button>
        </div>

        <div className="p-3 bg-muted rounded-md text-sm text-muted-foreground">
          💡 O modo de teste executa o fluxo imediatamente no lead selecionado. 
          Use para validar se o fluxo está funcionando corretamente antes de ativá-lo.
        </div>
      </CardContent>
    </Card>
  );
}

