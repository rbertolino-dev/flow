import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAutomationFlows } from "@/hooks/useAutomationFlows";
import { AutomationFlow, FlowStatus } from "@/types/automationFlow";
import { Plus, Edit, Trash2, Play, Pause, Copy, Loader2, List, ArrowRight, Eye } from "lucide-react";
import { AutomationFlowEditor } from "./AutomationFlowEditor";
import { FlowExecutionsPanel } from "./FlowExecutionsPanel";
import { FlowMetricsDashboard } from "./FlowMetricsDashboard";
import { FlowTestMode } from "./FlowTestMode";
import { AutomationFlowPlaybookSelector, AutomationPlaybook } from "./AutomationFlowPlaybookSelector";
import { FlowActivationPreview } from "./FlowActivationPreview";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

export function AutomationFlowsList() {
  const { flows, loading, createFlow, updateFlow, deleteFlow, duplicateFlow } = useAutomationFlows();
  const [editingFlowId, setEditingFlowId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [activeTab, setActiveTab] = useState<"flows" | "executions" | "metrics">("flows");
  const [testingFlowId, setTestingFlowId] = useState<string | null>(null);
  const [showPlaybookSelector, setShowPlaybookSelector] = useState(false);
  const [selectedPlaybook, setSelectedPlaybook] = useState<AutomationPlaybook | null>(null);
  const [activationPreviewFlow, setActivationPreviewFlow] = useState<AutomationFlow | null>(null);

  const handleCreateFlow = async () => {
    setShowPlaybookSelector(true);
  };

  const handleSelectPlaybook = async (playbook: AutomationPlaybook) => {
    const flowName = playbook.id === "blank" ? "Novo Fluxo" : playbook.name;
    const flowDescription = playbook.id === "blank" ? "" : playbook.description;
    
    const newFlowId = await createFlow(flowName, flowDescription);
    if (newFlowId) {
      setSelectedPlaybook(playbook);
      setIsCreating(true);
      setEditingFlowId(newFlowId);
    }
  };

  const handleToggleStatus = async (flow: AutomationFlow) => {
    // Se estiver ativando o fluxo, mostrar preview primeiro
    if (flow.status !== "active") {
      setActivationPreviewFlow(flow);
    } else {
      // Se estiver pausando, fazer diretamente
      await updateFlow(flow.id, { status: "paused" });
    }
  };

  const handleConfirmActivation = async () => {
    if (activationPreviewFlow) {
      await updateFlow(activationPreviewFlow.id, { status: "active" });
      setActivationPreviewFlow(null);
    }
  };

  const getStatusBadge = (status: FlowStatus) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-600 hover:bg-green-700 text-white">Ativo</Badge>;
      case "paused":
        return <Badge className="bg-yellow-600 hover:bg-yellow-700 text-white">Pausado</Badge>;
      case "draft":
        return <Badge variant="outline" className="border-muted-foreground/50">Rascunho</Badge>;
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
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            Fluxos de Automação
          </h1>
          <p className="text-muted-foreground mt-1">
            Crie jornadas visuais de automação para seus contatos
          </p>
        </div>
        {activeTab === "flows" && (
          <Button onClick={handleCreateFlow} size="lg" className="gap-2">
            <Plus className="h-5 w-5" />
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {flows.map((flow) => (
            <Card key={flow.id} className="hover:shadow-lg transition-shadow duration-200 group">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg truncate group-hover:text-primary transition-colors">
                      {flow.name}
                    </CardTitle>
                    {flow.description && (
                      <CardDescription className="mt-1.5 line-clamp-2">
                        {flow.description}
                      </CardDescription>
                    )}
                  </div>
                  {getStatusBadge(flow.status)}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <List className="h-4 w-4" />
                    <span>{flow.flowData.nodes.length} blocos</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <ArrowRight className="h-4 w-4" />
                    <span>{flow.flowData.edges.length} conexões</span>
                  </div>
                </div>

                {/* Botão de Preview grande e destacado */}
                {flow.status !== "active" && flow.flowData.nodes.length > 0 && (
                  <Button
                    variant="default"
                    size="lg"
                    onClick={() => setActivationPreviewFlow(flow)}
                    className="w-full gap-2 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
                  >
                    <Eye className="h-5 w-5" />
                    Pré-visualizar Leads Afetados
                  </Button>
                )}

                <div className="flex gap-2 flex-wrap pt-2 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditingFlowId(flow.id)}
                    className="flex-1"
                  >
                    <Edit className="h-3.5 w-3.5 mr-1.5" />
                    Editar
                  </Button>
                  {flow.status !== "active" ? (
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => handleToggleStatus(flow)}
                      className="flex-1"
                    >
                      <Play className="h-3.5 w-3.5 mr-1.5" />
                      Ativar
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleToggleStatus(flow)}
                      className="flex-1"
                    >
                      <Pause className="h-3.5 w-3.5 mr-1.5" />
                      Pausar
                    </Button>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setTestingFlowId(flow.id)}
                    title="Testar fluxo"
                    className="flex-1"
                  >
                    <Play className="h-3.5 w-3.5 mr-1.5" />
                    Testar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => duplicateFlow(flow.id)}
                    className="flex-1"
                  >
                    <Copy className="h-3.5 w-3.5 mr-1.5" />
                    Duplicar
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="sm" className="text-destructive hover:bg-destructive hover:text-destructive-foreground">
                        <Trash2 className="h-3.5 w-3.5" />
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
                        <AlertDialogAction onClick={() => deleteFlow(flow.id)} className="bg-destructive hover:bg-destructive/90">
                          Excluir
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          ))}
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

      {/* Dialog de Seleção de Playbook */}
      <AutomationFlowPlaybookSelector
        open={showPlaybookSelector}
        onClose={() => setShowPlaybookSelector(false)}
        onSelectPlaybook={handleSelectPlaybook}
      />

      {/* Dialog do Editor */}
      {(editingFlowId || isCreating) && (
        <Dialog open={true} onOpenChange={() => {
          setEditingFlowId(null);
          setIsCreating(false);
          setSelectedPlaybook(null);
        }}>
          <DialogContent className="max-w-[95vw] h-[95vh] p-0">
            <AutomationFlowEditor
              flowId={editingFlowId || undefined}
              initialFlowData={selectedPlaybook?.flowData}
              onClose={() => {
                setEditingFlowId(null);
                setIsCreating(false);
                setSelectedPlaybook(null);
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

      {/* Dialog de Preview de Ativação */}
      {activationPreviewFlow && (
        <Dialog open={true} onOpenChange={() => setActivationPreviewFlow(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Pré-visualização de Ativação</DialogTitle>
              <DialogDescription>
                Revise os leads que serão afetados antes de ativar o fluxo "{activationPreviewFlow.name}"
              </DialogDescription>
            </DialogHeader>
            
            <FlowActivationPreview flow={activationPreviewFlow} />

            <div className="flex justify-end gap-3 mt-4">
              <Button
                variant="outline"
                onClick={() => setActivationPreviewFlow(null)}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleConfirmActivation}
                className="gap-2"
              >
                <Play className="h-4 w-4" />
                Confirmar e Ativar
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

