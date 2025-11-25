import { useState, useCallback, useMemo, useEffect } from "react";
import {
  ReactFlow,
  Node,
  Edge,
  addEdge,
  Connection,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  MiniMap,
  NodeTypes,
  BackgroundVariant,
  Handle,
  Position,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AutomationFlow, FlowNode, FlowEdge, FlowStatus, FlowNodeType, TriggerConfig, ActionConfig, WaitConfig, ConditionConfig } from "@/types/automationFlow";
import { useAutomationFlows } from "@/hooks/useAutomationFlows";
import { useToast } from "@/hooks/use-toast";
import { TriggerNodeConfig } from "./flowNodes/TriggerNodeConfig";
import { ActionNodeConfig } from "./flowNodes/ActionNodeConfig";
import { WaitNodeConfig } from "./flowNodes/WaitNodeConfig";
import { ConditionNodeConfig } from "./flowNodes/ConditionNodeConfig";
import { validateFlow, validateNode } from "@/lib/flowValidator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { 
  Zap, 
  MessageSquare, 
  Tag, 
  ArrowRight, 
  Clock, 
  GitBranch, 
  Flag, 
  Plus, 
  Save, 
  Play, 
  Pause,
  Trash2,
  Copy,
} from "lucide-react";
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

interface AutomationFlowEditorProps {
  flowId?: string;
  onClose?: () => void;
  initialFlowData?: { nodes: FlowNode[]; edges: FlowEdge[] };
}

// Componentes de nós customizados
const TriggerNode = ({ data }: { data: any }) => {
  const getTriggerLabel = () => {
    const config = data.config as TriggerConfig;
    if (!config?.triggerType) return data.label;
    
    const labels: Record<string, string> = {
      lead_created: "Lead Criado",
      tag_added: "Tag Adicionada",
      tag_removed: "Tag Removida",
      stage_changed: "Estágio Mudou",
      field_changed: "Campo Mudou",
      date_trigger: "Data Específica",
      relative_date: "Data Relativa",
    };
    return labels[config.triggerType] || data.label;
  };

  return (
    <div className="px-4 py-3 shadow-md rounded-md bg-yellow-50 dark:bg-yellow-950 border-2 border-yellow-400 dark:border-yellow-600 min-w-[150px]">
      <div className="flex items-center gap-2">
        <Zap className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
        <div className="font-semibold text-sm">{getTriggerLabel()}</div>
      </div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
};

const ActionNode = ({ data }: { data: any }) => {
  const getActionLabel = () => {
    const config = data.config as ActionConfig;
    if (!config?.actionType) return data.label;
    
    const labels: Record<string, string> = {
      send_whatsapp: "Enviar WhatsApp",
      send_whatsapp_template: "Template WhatsApp",
      add_tag: "Adicionar Tag",
      remove_tag: "Remover Tag",
      move_stage: "Mover Etapa",
      add_note: "Adicionar Nota",
      add_to_call_queue: "Adicionar à Fila",
      remove_from_call_queue: "Remover da Fila",
      update_field: "Atualizar Campo",
      update_value: "Atualizar Valor",
      apply_template: "Aplicar Template",
      create_reminder: "Criar Lembrete",
    };
    return labels[config.actionType] || data.label;
  };

  return (
    <div className="px-4 py-3 shadow-md rounded-md bg-blue-50 dark:bg-blue-950 border-2 border-blue-400 dark:border-blue-600 min-w-[150px]">
      <Handle type="target" position={Position.Top} />
      <div className="flex items-center gap-2">
        <MessageSquare className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        <div className="font-semibold text-sm">{getActionLabel()}</div>
      </div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
};

const WaitNode = ({ data }: { data: any }) => {
  const getWaitLabel = () => {
    const config = data.config as WaitConfig;
    if (!config?.waitType) return data.label;
    
    if (config.waitType === 'delay' && config.delay_value && config.delay_unit) {
      const unit = config.delay_unit === 'minutes' ? 'min' : config.delay_unit === 'hours' ? 'h' : 'dias';
      return `Aguardar ${config.delay_value} ${unit}`;
    }
    if (config.waitType === 'until_date' && config.date) {
      return "Aguardar até Data";
    }
    if (config.waitType === 'until_field' && config.field) {
      return "Aguardar Campo";
    }
    return data.label;
  };

  return (
    <div className="px-4 py-3 shadow-md rounded-md bg-purple-50 dark:bg-purple-950 border-2 border-purple-400 dark:border-purple-600 min-w-[150px]">
      <Handle type="target" position={Position.Top} />
      <div className="flex items-center gap-2">
        <Clock className="h-4 w-4 text-purple-600 dark:text-purple-400" />
        <div className="font-semibold text-sm">{getWaitLabel()}</div>
      </div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
};

const ConditionNode = ({ data }: { data: any }) => {
  return (
    <div className="px-4 py-3 shadow-md rounded-md bg-green-50 dark:bg-green-950 border-2 border-green-400 dark:border-green-600 min-w-[150px] relative">
      <Handle type="target" position={Position.Top} />
      <div className="flex items-center gap-2">
        <GitBranch className="h-4 w-4 text-green-600 dark:text-green-400" />
        <div className="font-semibold text-sm">{data.label}</div>
      </div>
      <div className="flex justify-between mt-2 relative">
        <div className="flex flex-col items-center">
          <Handle type="source" position={Position.Bottom} id="yes" style={{ background: '#22c55e' }} />
          <span className="text-xs text-green-600 dark:text-green-400 mt-1">Sim</span>
        </div>
        <div className="flex flex-col items-center">
          <Handle type="source" position={Position.Bottom} id="no" style={{ background: '#ef4444' }} />
          <span className="text-xs text-red-600 dark:text-red-400 mt-1">Não</span>
        </div>
      </div>
    </div>
  );
};

const EndNode = ({ data }: { data: any }) => (
  <div className="px-4 py-3 shadow-md rounded-md bg-gray-50 dark:bg-gray-800 border-2 border-gray-400 dark:border-gray-600 min-w-[150px]">
    <Handle type="target" position={Position.Top} />
    <div className="flex items-center gap-2">
      <Flag className="h-4 w-4 text-gray-600 dark:text-gray-400" />
      <div className="font-semibold text-sm">{data.label}</div>
    </div>
  </div>
);

const nodeTypes: NodeTypes = {
  trigger: TriggerNode,
  action: ActionNode,
  wait: WaitNode,
  condition: ConditionNode,
  end: EndNode,
};

export function AutomationFlowEditor({ flowId, onClose, initialFlowData }: AutomationFlowEditorProps) {
  const { flows, loading, createFlow, updateFlow, deleteFlow, duplicateFlow } = useAutomationFlows();
  const { toast } = useToast();
  const [flowName, setFlowName] = useState("");
  const [flowDescription, setFlowDescription] = useState("");
  const [flowStatus, setFlowStatus] = useState<FlowStatus>("draft");
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [validation, setValidation] = useState<{ isValid: boolean; errors: string[]; warnings: string[] } | null>(null);

  // Buscar fluxo existente ou criar novo
  const currentFlow = useMemo(() => {
    if (flowId) {
      return flows.find(f => f.id === flowId);
    }
    return null;
  }, [flowId, flows]);

  // Inicializar nodes e edges do React Flow
  const initialNodes: Node[] = useMemo(() => {
    if (initialFlowData?.nodes && !currentFlow) {
      // Usar dados do playbook se for um novo fluxo
      return initialFlowData.nodes.map((node: FlowNode) => ({
        id: node.id,
        type: node.type,
        position: node.position,
        data: node.data,
      }));
    }
    if (currentFlow?.flowData.nodes) {
      return currentFlow.flowData.nodes.map((node: FlowNode) => ({
        id: node.id,
        type: node.type,
        position: node.position,
        data: node.data,
      }));
    }
    return [];
  }, [currentFlow, initialFlowData]);

  const initialEdges: Edge[] = useMemo(() => {
    if (initialFlowData?.edges && !currentFlow) {
      // Usar dados do playbook se for um novo fluxo
      return initialFlowData.edges.map((edge: FlowEdge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        sourceHandle: edge.sourceHandle,
        targetHandle: edge.targetHandle,
      }));
    }
    if (currentFlow?.flowData.edges) {
      return currentFlow.flowData.edges.map((edge: FlowEdge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        sourceHandle: edge.sourceHandle,
        targetHandle: edge.targetHandle,
      }));
    }
    return [];
  }, [currentFlow, initialFlowData]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Atualizar quando o fluxo mudar
  useEffect(() => {
    if (currentFlow) {
      setFlowName(currentFlow.name);
      setFlowDescription(currentFlow.description || "");
      setFlowStatus(currentFlow.status);
    } else {
      setFlowName("");
      setFlowDescription("");
      setFlowStatus("draft");
    }
  }, [currentFlow]);

  // Aplicar dados iniciais do playbook quando disponível
  useEffect(() => {
    if (initialFlowData && !currentFlow) {
      setNodes(initialFlowData.nodes.map((node: FlowNode) => ({
        id: node.id,
        type: node.type,
        position: node.position,
        data: node.data,
      })));
      setEdges(initialFlowData.edges.map((edge: FlowEdge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        sourceHandle: edge.sourceHandle,
        targetHandle: edge.targetHandle,
      })));
    }
  }, [initialFlowData, currentFlow, setNodes, setEdges]);

  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) => addEdge(params, eds));
    },
    [setEdges]
  );

  // Validar fluxo quando nodes ou edges mudarem
  useEffect(() => {
      const flowData = {
        nodes: nodes.map(node => ({
          id: node.id,
          type: node.type as FlowNodeType,
          position: node.position,
          data: {
            label: node.data.label as string,
            config: node.data.config || {},
          },
        })),
        edges: edges.map(edge => ({
          id: edge.id,
          source: edge.source,
          target: edge.target,
          sourceHandle: edge.sourceHandle || '',
          targetHandle: edge.targetHandle || '',
        })),
      };

    const validationResult = validateFlow(flowData);
    setValidation(validationResult);
  }, [nodes, edges]);

  const handleSave = async () => {
    if (!flowName.trim()) {
      return;
    }

    setIsSaving(true);

    try {
      const flowData = {
        nodes: nodes.map(node => ({
          id: node.id,
          type: node.type as FlowNodeType,
          position: node.position,
          data: {
            label: node.data.label as string,
            config: node.data.config || {},
          },
        })),
        edges: edges.map(edge => ({
          id: edge.id,
          source: edge.source,
          target: edge.target,
          sourceHandle: edge.sourceHandle || '',
          targetHandle: edge.targetHandle || '',
        })),
      };

      // Validar antes de salvar
      const validationResult = validateFlow(flowData);
      if (!validationResult.isValid && validationResult.errors.length > 0) {
        toast({
          title: "Erro de validação",
          description: validationResult.errors[0],
          variant: "destructive",
        });
        setIsSaving(false);
        return;
      }

      if (currentFlow) {
        await updateFlow(currentFlow.id, {
          name: flowName,
          description: flowDescription,
          status: flowStatus,
          flowData,
        });
      } else {
        const newFlowId = await createFlow(flowName, flowDescription);
        if (newFlowId) {
          await updateFlow(newFlowId, { flowData });
        }
      }
    } catch (error) {
      console.error("Erro ao salvar:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddNode = (type: FlowNodeType) => {
    const getDefaultLabel = (nodeType: FlowNodeType): string => {
      switch (nodeType) {
        case 'trigger':
          return 'Lead Criado';
        case 'action':
          return 'Nova Ação';
        case 'wait':
          return 'Aguardar Tempo';
        case 'condition':
          return 'Condição';
        case 'end':
          return 'Fim do Fluxo';
        default:
          return `Novo ${nodeType}`;
      }
    };

    const getDefaultConfig = (nodeType: FlowNodeType): any => {
      switch (nodeType) {
        case 'trigger':
          return { triggerType: 'lead_created' };
        case 'action':
          return { actionType: 'send_whatsapp' };
        case 'wait':
          return { waitType: 'delay', delay_value: 1, delay_unit: 'hours' };
        case 'condition':
          return { operator: 'equals', field: 'value' };
        default:
          return {};
      }
    };

    const newNode: Node = {
      id: `${type}-${Date.now()}`,
      type,
      position: { x: Math.random() * 400 + 100, y: Math.random() * 400 + 100 },
      data: {
        label: getDefaultLabel(type),
        config: getDefaultConfig(type),
      },
    };
    setNodes((nds) => [...nds, newNode]);
    setSelectedNode(newNode);
  };

  const handleDeleteNode = (nodeId: string) => {
    setNodes((nds) => nds.filter((n) => n.id !== nodeId));
    setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
    if (selectedNode?.id === nodeId) {
      setSelectedNode(null);
    }
  };

  if (loading && !currentFlow) {
    return <div className="p-8 text-center">Carregando...</div>;
  }

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="border-b p-4 bg-background">
        {/* Validações */}
        {validation && (
          <div className="mb-4 space-y-2">
            {validation.errors.length > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Erros de Validação</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc list-inside space-y-1">
                    {validation.errors.map((error, index) => (
                      <li key={index}>{error}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
            {validation.warnings.length > 0 && validation.errors.length === 0 && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Avisos</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc list-inside space-y-1">
                    {validation.warnings.map((warning, index) => (
                      <li key={index}>{warning}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
            {validation.isValid && validation.warnings.length === 0 && (
              <Alert className="border-green-500 bg-green-50 dark:bg-green-950">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertTitle className="text-green-800 dark:text-green-200">Fluxo Válido</AlertTitle>
                <AlertDescription className="text-green-700 dark:text-green-300">
                  O fluxo está configurado corretamente e pronto para ser ativado.
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        <div className="flex items-center justify-between mb-4">
          <div className="flex-1 space-y-2">
            <Input
              placeholder="Nome do Fluxo"
              value={flowName}
              onChange={(e) => setFlowName(e.target.value)}
              className="text-lg font-semibold"
            />
            <Textarea
              placeholder="Descrição (ex.: Nutrir leads do formulário site)"
              value={flowDescription}
              onChange={(e) => setFlowDescription(e.target.value)}
              rows={1}
              className="text-sm"
            />
          </div>
          <div className="flex items-center gap-2 ml-4">
            <Select value={flowStatus} onValueChange={(value) => setFlowStatus(value as FlowStatus)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Rascunho</SelectItem>
                <SelectItem value="active">Ativo</SelectItem>
                <SelectItem value="paused">Pausado</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={handleSave} disabled={isSaving || !flowName.trim()}>
              <Save className="h-4 w-4 mr-2" />
              {isSaving ? "Salvando..." : "Salvar"}
            </Button>
            {onClose && (
              <Button variant="outline" onClick={onClose}>
                Fechar
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar - Biblioteca de Blocos */}
        <div className="w-64 border-r bg-muted/30 p-4 overflow-y-auto">
          <h3 className="font-semibold mb-4">Biblioteca de Blocos</h3>
          
          <div className="space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground mb-2 block">GATILHOS</Label>
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start"
                onClick={() => handleAddNode("trigger")}
              >
                <Zap className="h-4 w-4 mr-2" />
                Lead Criado
              </Button>
            </div>

            <Separator />

            <div>
              <Label className="text-xs text-muted-foreground mb-2 block">AÇÕES</Label>
              <div className="space-y-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => handleAddNode("action")}
                >
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Enviar WhatsApp
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => handleAddNode("action")}
                >
                  <Tag className="h-4 w-4 mr-2" />
                  Adicionar Tag
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => handleAddNode("action")}
                >
                  <ArrowRight className="h-4 w-4 mr-2" />
                  Mover Etapa
                </Button>
              </div>
            </div>

            <Separator />

            <div>
              <Label className="text-xs text-muted-foreground mb-2 block">ESPERAS</Label>
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start"
                onClick={() => handleAddNode("wait")}
              >
                <Clock className="h-4 w-4 mr-2" />
                Aguardar Tempo
              </Button>
            </div>

            <Separator />

            <div>
              <Label className="text-xs text-muted-foreground mb-2 block">CONDIÇÕES</Label>
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start"
                onClick={() => handleAddNode("condition")}
              >
                <GitBranch className="h-4 w-4 mr-2" />
                Se/Então
              </Button>
            </div>

            <Separator />

            <div>
              <Label className="text-xs text-muted-foreground mb-2 block">FINAIS</Label>
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start"
                onClick={() => handleAddNode("end")}
              >
                <Flag className="h-4 w-4 mr-2" />
                Fim do Fluxo
              </Button>
            </div>
          </div>
        </div>

        {/* Canvas */}
        <div className="flex-1 relative">
          <ReactFlow
            nodes={nodes.map(node => {
              // Adicionar validação visual aos nós
              const nodeValidation = validateNode(node as FlowNode);
              return {
                ...node,
                className: nodeValidation.isValid ? '' : 'ring-2 ring-red-500',
              };
            })}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={(_, node) => setSelectedNode(node)}
            nodeTypes={nodeTypes}
            fitView
            minZoom={0.2}
            maxZoom={2}
            defaultViewport={{ x: 0, y: 0, zoom: 1 }}
            deleteKeyCode={["Backspace", "Delete"]}
            onNodesDelete={(nodesToDelete) => {
              nodesToDelete.forEach(node => handleDeleteNode(node.id));
            }}
          >
            <Controls showInteractive={false} />
            <MiniMap 
              nodeColor={(node) => {
                if (node.type === 'trigger') return '#fbbf24';
                if (node.type === 'action') return '#3b82f6';
                if (node.type === 'wait') return '#a855f7';
                if (node.type === 'condition') return '#22c55e';
                return '#6b7280';
              }}
              maskColor="rgba(0, 0, 0, 0.1)"
            />
            <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
          </ReactFlow>
        </div>

        {/* Painel de Propriedades */}
        <div className="w-80 border-l bg-background p-4 overflow-y-auto">
          <h3 className="font-semibold mb-4">Propriedades</h3>
          
          {selectedNode ? (
            <ScrollArea className="h-full">
              <div className="space-y-4 pr-4">
                <div>
                  <Label>Nome do Bloco</Label>
                  <Input
                    value={selectedNode.data.label as string}
                    onChange={(e) => {
                      const newLabel = e.target.value;
                      setNodes((nds) =>
                        nds.map((n) =>
                          n.id === selectedNode.id
                            ? { ...n, data: { ...n.data, label: newLabel } }
                            : n
                        )
                      );
                      setSelectedNode({
                        ...selectedNode,
                        data: { ...selectedNode.data, label: newLabel },
                      });
                    }}
                  />
                </div>

                <div>
                  <Label>Tipo</Label>
                  <Input value={selectedNode.type} disabled />
                </div>

                <Separator />

                {/* Configurações específicas por tipo de nó */}
                {selectedNode.type === 'trigger' && (
                  <TriggerNodeConfig
                    config={(selectedNode.data.config || { triggerType: 'lead_created' }) as TriggerConfig}
                    onConfigChange={(newConfig) => {
                      setNodes((nds) =>
                        nds.map((n) =>
                          n.id === selectedNode.id
                            ? { ...n, data: { ...n.data, config: newConfig } }
                            : n
                        )
                      );
                      setSelectedNode({
                        ...selectedNode,
                        data: { ...selectedNode.data, config: newConfig },
                      });
                    }}
                  />
                )}

                {selectedNode.type === 'action' && (
                  <ActionNodeConfig
                    config={(selectedNode.data.config || { actionType: 'send_whatsapp' }) as ActionConfig}
                    onConfigChange={(newConfig) => {
                      setNodes((nds) =>
                        nds.map((n) =>
                          n.id === selectedNode.id
                            ? { ...n, data: { ...n.data, config: newConfig } }
                            : n
                        )
                      );
                      setSelectedNode({
                        ...selectedNode,
                        data: { ...selectedNode.data, config: newConfig },
                      });
                    }}
                  />
                )}

                {selectedNode.type === 'wait' && (
                  <WaitNodeConfig
                    config={(selectedNode.data.config || { waitType: 'delay' }) as WaitConfig}
                    onConfigChange={(newConfig) => {
                      setNodes((nds) =>
                        nds.map((n) =>
                          n.id === selectedNode.id
                            ? { ...n, data: { ...n.data, config: newConfig } }
                            : n
                        )
                      );
                      setSelectedNode({
                        ...selectedNode,
                        data: { ...selectedNode.data, config: newConfig },
                      });
                    }}
                  />
                )}

                {selectedNode.type === 'condition' && (
                  <ConditionNodeConfig
                    config={(selectedNode.data.config || { operator: 'equals' }) as ConditionConfig}
                    onConfigChange={(newConfig) => {
                      setNodes((nds) =>
                        nds.map((n) =>
                          n.id === selectedNode.id
                            ? { ...n, data: { ...n.data, config: newConfig } }
                            : n
                        )
                      );
                      setSelectedNode({
                        ...selectedNode,
                        data: { ...selectedNode.data, config: newConfig },
                      });
                    }}
                  />
                )}

                {selectedNode.type === 'end' && (
                  <div className="p-3 bg-muted rounded-md text-sm text-muted-foreground">
                    Este bloco marca o fim do fluxo. Quando um contato chegar aqui, a execução será finalizada.
                  </div>
                )}

                {/* Validação do nó selecionado */}
                {(() => {
                  const nodeValidation = validateNode(selectedNode as FlowNode);
                  if (!nodeValidation.isValid) {
                    return (
                      <Alert variant="destructive" className="mt-4">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Erros neste bloco</AlertTitle>
                        <AlertDescription>
                          <ul className="list-disc list-inside space-y-1">
                            {nodeValidation.errors.map((error, index) => (
                              <li key={index} className="text-xs">{error}</li>
                            ))}
                          </ul>
                        </AlertDescription>
                      </Alert>
                    );
                  }
                  return null;
                })()}

                <Separator />

                <div className="flex gap-2">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      handleDeleteNode(selectedNode.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Excluir Bloco
                  </Button>
                </div>
              </div>
            </ScrollArea>
          ) : (
            <div className="text-sm text-muted-foreground text-center py-8">
              Selecione um bloco para editar suas propriedades
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

