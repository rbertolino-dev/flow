import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { FollowUpStepAutomation, AutomationActionType } from "@/types/followUp";
import { useFollowUpTemplates } from "@/hooks/useFollowUpTemplates";
import { usePipelineStages } from "@/hooks/usePipelineStages";
import { useTags } from "@/hooks/useTags";
import { useEvolutionConfigs } from "@/hooks/useEvolutionConfigs";
import { Plus, Trash2, Edit2, Zap, MessageSquare, Tag, ArrowRight, FileText, Phone, Edit } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

interface FollowUpAutomationConfigProps {
  stepId: string;
  automations: FollowUpStepAutomation[];
}

const actionTypeLabels: Record<AutomationActionType, { label: string; icon: any; description: string }> = {
  send_whatsapp: {
    label: "Enviar WhatsApp",
    icon: MessageSquare,
    description: "Envia mensagem WhatsApp automaticamente"
  },
  add_tag: {
    label: "Adicionar Tag",
    icon: Tag,
    description: "Adiciona uma tag ao lead"
  },
  move_stage: {
    label: "Mover para Etapa",
    icon: ArrowRight,
    description: "Move o lead para outra etapa do funil"
  },
  add_note: {
    label: "Adicionar Nota",
    icon: FileText,
    description: "Cria uma nota/atividade no lead"
  },
  add_to_call_queue: {
    label: "Adicionar à Fila",
    icon: Phone,
    description: "Adiciona o lead à fila de ligações"
  },
  update_field: {
    label: "Atualizar Campo",
    icon: Edit,
    description: "Atualiza um campo do lead"
  },
};

export function FollowUpAutomationConfig({ stepId, automations }: FollowUpAutomationConfigProps) {
  const { addAutomation, updateAutomation, deleteAutomation } = useFollowUpTemplates();
  const { stages } = usePipelineStages();
  const { tags } = useTags();
  const { configs } = useEvolutionConfigs();
  const [editingAutomation, setEditingAutomation] = useState<FollowUpStepAutomation | null>(null);
  const [actionType, setActionType] = useState<AutomationActionType>("send_whatsapp");
  const [actionConfig, setActionConfig] = useState<Record<string, any>>({});
  const [deletingAutomationId, setDeletingAutomationId] = useState<string | null>(null);

  const handleAddAutomation = () => {
    setEditingAutomation(null);
    setActionType("send_whatsapp");
    setActionConfig({});
  };

  const handleEditAutomation = (automation: FollowUpStepAutomation) => {
    setEditingAutomation(automation);
    setActionType(automation.actionType);
    setActionConfig(automation.actionConfig);
  };

  const handleSaveAutomation = async () => {
    if (editingAutomation) {
      await updateAutomation(editingAutomation.id, actionType, actionConfig);
    } else {
      await addAutomation(stepId, actionType, actionConfig);
    }
    setEditingAutomation(null);
    setActionType("send_whatsapp");
    setActionConfig({});
  };

  const handleDeleteAutomation = async () => {
    if (!deletingAutomationId) return;
    await deleteAutomation(deletingAutomationId);
    setDeletingAutomationId(null);
  };

  const renderActionConfig = () => {
    switch (actionType) {
      case 'send_whatsapp':
        return (
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Instância WhatsApp</Label>
              <Select
                value={actionConfig.instance_id || ""}
                onValueChange={(value) => setActionConfig({ ...actionConfig, instance_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a instância" />
                </SelectTrigger>
                <SelectContent>
                  {configs?.filter(c => c.is_connected).map((config) => (
                    <SelectItem key={config.id} value={config.id}>
                      {config.instance_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Mensagem *</Label>
              <Textarea
                value={actionConfig.message || ""}
                onChange={(e) => setActionConfig({ ...actionConfig, message: e.target.value })}
                placeholder="Digite a mensagem que será enviada..."
                rows={4}
              />
            </div>
          </div>
        );

      case 'add_tag':
        return (
          <div className="space-y-2">
            <Label>Tag *</Label>
            <Select
              value={actionConfig.tag_id || ""}
              onValueChange={(value) => setActionConfig({ ...actionConfig, tag_id: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione a tag" />
              </SelectTrigger>
              <SelectContent>
                {tags.map((tag) => (
                  <SelectItem key={tag.id} value={tag.id}>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: tag.color }} />
                      {tag.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );

      case 'move_stage':
        return (
          <div className="space-y-2">
            <Label>Etapa de Destino *</Label>
            <Select
              value={actionConfig.stage_id || ""}
              onValueChange={(value) => setActionConfig({ ...actionConfig, stage_id: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione a etapa" />
              </SelectTrigger>
              <SelectContent>
                {stages.map((stage) => (
                  <SelectItem key={stage.id} value={stage.id}>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: stage.color }} />
                      {stage.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );

      case 'add_note':
        return (
          <div className="space-y-2">
            <Label>Conteúdo da Nota *</Label>
            <Textarea
              value={actionConfig.content || ""}
              onChange={(e) => setActionConfig({ ...actionConfig, content: e.target.value })}
              placeholder="Digite o conteúdo da nota..."
              rows={3}
            />
          </div>
        );

      case 'add_to_call_queue':
        return (
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Prioridade</Label>
              <Select
                value={actionConfig.priority || "medium"}
                onValueChange={(value) => setActionConfig({ ...actionConfig, priority: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">Alta</SelectItem>
                  <SelectItem value="medium">Média</SelectItem>
                  <SelectItem value="low">Baixa</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {actionConfig.notes && (
              <div className="space-y-2">
                <Label>Notas (opcional)</Label>
                <Textarea
                  value={actionConfig.notes || ""}
                  onChange={(e) => setActionConfig({ ...actionConfig, notes: e.target.value })}
                  placeholder="Notas para a ligação..."
                  rows={2}
                />
              </div>
            )}
          </div>
        );

      case 'update_field':
        return (
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Campo</Label>
              <Select
                value={actionConfig.field || ""}
                onValueChange={(value) => setActionConfig({ ...actionConfig, field: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o campo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="assigned_to">Responsável</SelectItem>
                  <SelectItem value="value">Valor</SelectItem>
                  <SelectItem value="source">Origem</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Valor *</Label>
              <Input
                value={actionConfig.value || ""}
                onChange={(e) => setActionConfig({ ...actionConfig, value: e.target.value })}
                placeholder="Digite o novo valor..."
              />
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Automações
          </Label>
          {!editingAutomation && (
            <Button variant="outline" size="sm" onClick={handleAddAutomation}>
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Automação
            </Button>
          )}
        </div>

        {/* Lista de automações */}
        {automations.length > 0 && (
          <div className="space-y-2">
            {automations.map((automation) => {
              const actionInfo = actionTypeLabels[automation.actionType];
              const Icon = actionInfo.icon;

              return (
                <Card key={automation.id} className="bg-muted/50">
                  <CardContent className="pt-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4" />
                          <span className="font-medium text-sm">{actionInfo.label}</span>
                          {!automation.isActive && (
                            <Badge variant="secondary" className="text-xs">Inativa</Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{actionInfo.description}</p>
                        {/* Mostrar resumo da configuração */}
                        <div className="mt-2 text-xs text-muted-foreground">
                          {automation.actionType === 'send_whatsapp' && (
                            <span className="line-clamp-1">
                              {automation.actionConfig.message?.substring(0, 50)}...
                            </span>
                          )}
                          {automation.actionType === 'add_tag' && (
                            <span>
                              Tag: {tags.find(t => t.id === automation.actionConfig.tag_id)?.name || 'N/A'}
                            </span>
                          )}
                          {automation.actionType === 'move_stage' && (
                            <span>
                              Etapa: {stages.find(s => s.id === automation.actionConfig.stage_id)?.name || 'N/A'}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditAutomation(automation)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeletingAutomationId(automation.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Formulário de adicionar/editar automação */}
        {editingAutomation !== null && (
          <Card className="bg-primary/5 border-primary/20">
            <CardHeader>
              <CardTitle className="text-sm">
                {editingAutomation ? "Editar Automação" : "Nova Automação"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Tipo de Ação *</Label>
                <Select value={actionType} onValueChange={(value) => {
                  setActionType(value as AutomationActionType);
                  setActionConfig({}); // Resetar config ao mudar tipo
                }}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(actionTypeLabels).map(([type, info]) => {
                      const Icon = info.icon;
                      return (
                        <SelectItem key={type} value={type}>
                          <div className="flex items-center gap-2">
                            <Icon className="h-4 w-4" />
                            {info.label}
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              {renderActionConfig()}

              <div className="flex gap-2">
                <Button onClick={handleSaveAutomation} className="flex-1">
                  {editingAutomation ? "Salvar" : "Adicionar"} Automação
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setEditingAutomation(null);
                    setActionType("send_whatsapp");
                    setActionConfig({});
                  }}
                  className="flex-1"
                >
                  Cancelar
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Dialog de confirmação de exclusão */}
      <AlertDialog open={!!deletingAutomationId} onOpenChange={() => setDeletingAutomationId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta automação? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteAutomation}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

