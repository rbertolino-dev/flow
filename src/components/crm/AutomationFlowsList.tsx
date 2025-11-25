import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAutomationFlows } from "@/hooks/useAutomationFlows";
import { AutomationFlow, FlowStatus } from "@/types/automationFlow";
import { Plus, Edit, Trash2, Play, Pause, Copy, Loader2, List } from "lucide-react";
import { AutomationFlowEditor } from "./AutomationFlowEditor";
import { FlowExecutionsPanel } from "./FlowExecutionsPanel";
import { FlowMetricsDashboard } from "./FlowMetricsDashboard";
import { FlowTestMode } from "./FlowTestMode";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent } from "@/components/ui/dialog";

export function AutomationFlowsList() {
  const { flows, loading, createFlow, updateFlow, deleteFlow, duplicateFlow } = useAutomationFlows();
  const [editingFlowId, setEditingFlowId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [activeTab, setActiveTab] = useState<"flows" | "executions" | "metrics">("flows");
  const [testingFlowId, setTestingFlowId] = useState<string | null>(null);

  const handleCreateFlow = async () => {
    const newFlowId = await createFlow("Novo Fluxo", "");
    if (newFlowId) {
      setIsCreating(true);
      setEditingFlowId(newFlowId);
    }
  };

  const handleToggleStatus = async (flow: AutomationFlow) => {
    const newStatus: FlowStatus = flow.status === "active" ? "paused" : "active";
    await updateFlow(flow.id, { status: newStatus });
  };

  const getStatusBadge = (status: FlowStatus) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-500">Ativo</Badge>;
      case "paused":
        return <Badge variant="secondary">Pausado</Badge>;
      case "draft":
        return <Badge variant="outline">Rascunho</Badge>;
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
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Fluxos de Automação</h1>
          <p className="text-muted-foreground">
            Crie jornadas visuais de automação para seus contatos
          </p>
        </div>
        {activeTab === "flows" && (
          <Button onClick={handleCreateFlow}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Fluxo
          </Button>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "flows" | "executions" | "metrics")}>
        <TabsList>
          <TabsTrigger value="flows">Fluxos</TabsTrigger>
          <TabsTrigger value="executions">Execuções</TabsTrigger>
          <TabsTrigger value="metrics">Métricas</TabsTrigger>
        </TabsList>

        <TabsContent value="flows" className="mt-6">

      {flows.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground mb-4">Nenhum fluxo criado ainda</p>
            <Button onClick={handleCreateFlow}>
              <Plus className="h-4 w-4 mr-2" />
              Criar Primeiro Fluxo
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {flows.map((flow) => (
            <Card key={flow.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{flow.name}</CardTitle>
                    {flow.description && (
                      <CardDescription className="mt-1">{flow.description}</CardDescription>
                    )}
                  </div>
                  {getStatusBadge(flow.status)}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="text-sm text-muted-foreground">
                    {flow.flowData.nodes.length} blocos • {flow.flowData.edges.length} conexões
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditingFlowId(flow.id)}
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Editar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleToggleStatus(flow)}
                    >
                      {flow.status === "active" ? (
                        <>
                          <Pause className="h-4 w-4 mr-2" />
                          Pausar
                        </>
                      ) : (
                        <>
                          <Play className="h-4 w-4 mr-2" />
                          Ativar
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setTestingFlowId(flow.id)}
                      title="Testar fluxo"
                    >
                      <Play className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => duplicateFlow(flow.id)}
                    >
                      <Copy className="h-4 w-4 mr-2" />
                      Duplicar
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="sm">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                          <AlertDialogDescription>
                            Tem certeza que deseja excluir o fluxo "{flow.name}"? Esta ação não pode ser desfeita.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteFlow(flow.id)}>
                            Excluir
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardContent>
            </Card>
          )          )}
        </div>
      )}
        </TabsContent>

        <TabsContent value="executions" className="mt-6">
          <FlowExecutionsPanel />
        </TabsContent>

        <TabsContent value="metrics" className="mt-6">
          <FlowMetricsDashboard />
        </TabsContent>
      </Tabs>

      {/* Dialog do Editor */}
      {(editingFlowId || isCreating) && (
        <Dialog open={true} onOpenChange={() => {
          setEditingFlowId(null);
          setIsCreating(false);
        }}>
          <DialogContent className="max-w-[95vw] h-[95vh] p-0">
            <AutomationFlowEditor
              flowId={editingFlowId || undefined}
              onClose={() => {
                setEditingFlowId(null);
                setIsCreating(false);
              }}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Dialog de Teste */}
      {testingFlowId && (
        <Dialog open={true} onOpenChange={() => setTestingFlowId(null)}>
          <DialogContent className="max-w-md">
            <FlowTestMode
              flow={flows.find(f => f.id === testingFlowId)!}
              onClose={() => setTestingFlowId(null)}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

