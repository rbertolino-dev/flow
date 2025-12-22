import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useFollowUpTemplates } from "@/hooks/useFollowUpTemplates";
import { FollowUpTemplate, FollowUpTemplateStep } from "@/types/followUp";
import { Plus, Trash2, Edit2, Info, GripVertical, CheckCircle2, Circle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { FollowUpAutomationConfig } from "./FollowUpAutomationConfig";
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

export function FollowUpTemplateManager() {
  const { templates, loading, createTemplate, updateTemplate, deleteTemplate, addStep, updateStep, deleteStep, refetch } = useFollowUpTemplates();
  const [open, setOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<FollowUpTemplate | null>(null);
  const [editingStep, setEditingStep] = useState<FollowUpTemplateStep | null>(null);
  const [templateName, setTemplateName] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");
  const [stepTitle, setStepTitle] = useState("");
  const [stepDescription, setStepDescription] = useState("");
  const [stepTip, setStepTip] = useState("");
  const [deletingTemplateId, setDeletingTemplateId] = useState<string | null>(null);
  const [deletingStepId, setDeletingStepId] = useState<string | null>(null);
  const { toast } = useToast();

  const handleCreateTemplate = async () => {
    if (!templateName.trim()) {
      toast({
        title: "Nome obrigatório",
        description: "Digite um nome para o template",
        variant: "destructive",
      });
      return;
    }

    const templateId = await createTemplate(templateName, templateDescription);
    if (templateId) {
      setTemplateName("");
      setTemplateDescription("");
      setEditingTemplate(null);
    }
  };

  const handleUpdateTemplate = async () => {
    if (!editingTemplate || !templateName.trim()) {
      return;
    }

    const success = await updateTemplate(editingTemplate.id, templateName, templateDescription);
    if (success) {
      setEditingTemplate(null);
      setTemplateName("");
      setTemplateDescription("");
    }
  };

  const handleEditTemplate = (template: FollowUpTemplate) => {
    setEditingTemplate(template);
    setTemplateName(template.name);
    setTemplateDescription(template.description || "");
  };

  const handleCancelEdit = () => {
    setEditingTemplate(null);
    setTemplateName("");
    setTemplateDescription("");
  };

  const handleAddStep = async (templateId: string) => {
    if (!stepTitle.trim()) {
      toast({
        title: "Título obrigatório",
        description: "Digite um título para a etapa",
        variant: "destructive",
      });
      return;
    }

    const success = await addStep(templateId, stepTitle, stepDescription, stepTip);
    if (success) {
      setStepTitle("");
      setStepDescription("");
      setStepTip("");
      setEditingStep(null);
      // Forçar refetch imediato para aparecer em tempo real
      await refetch();
    }
  };

  const handleUpdateStep = async () => {
    if (!editingStep || !stepTitle.trim()) {
      return;
    }

    // Validar que o step tem ID (não é um novo step)
    if (!editingStep.id) {
      toast({
        title: "Erro",
        description: "Etapa não encontrada. Por favor, recarregue a página.",
        variant: "destructive",
      });
      return;
    }

    const success = await updateStep(editingStep.id, stepTitle, stepDescription, stepTip);
    if (success) {
      setEditingStep(null);
      setStepTitle("");
      setStepDescription("");
      setStepTip("");
    }
  };

  const handleEditStep = (step: FollowUpTemplateStep) => {
    setEditingStep(step);
    setStepTitle(step.title);
    setStepDescription(step.description || "");
    setStepTip(step.tip || "");
  };

  const handleCancelEditStep = () => {
    setEditingStep(null);
    setStepTitle("");
    setStepDescription("");
    setStepTip("");
  };

  const handleDeleteTemplate = async () => {
    if (!deletingTemplateId) return;

    const success = await deleteTemplate(deletingTemplateId);
    if (success) {
      setDeletingTemplateId(null);
    }
  };

  const handleDeleteStep = async () => {
    if (!deletingStepId) return;

    const success = await deleteStep(deletingStepId);
    if (success) {
      setDeletingStepId(null);
    }
  };

  const handleToggleTemplateActive = async (template: FollowUpTemplate) => {
    const newActiveState = !template.isActive;
    // Atualizar no banco (o hook já atualiza o estado via realtime)
    await updateTemplate(template.id, template.name, template.description, newActiveState);
    // Forçar refetch para garantir atualização imediata
    await refetch();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <Plus className="h-4 w-4" />
            Templates de Follow-up
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Gerenciar Templates de Follow-up</DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Criar novo template */}
            {!editingTemplate && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">
                    {editingStep ? "Editar Etapa" : "Criar Novo Template"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {!editingStep ? (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="template-name">Nome do Template *</Label>
                        <Input
                          id="template-name"
                          value={templateName}
                          onChange={(e) => setTemplateName(e.target.value)}
                          placeholder="Ex: Follow-up Vendas Básico"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="template-description">Descrição</Label>
                        <Textarea
                          id="template-description"
                          value={templateDescription}
                          onChange={(e) => setTemplateDescription(e.target.value)}
                          placeholder="Descreva o propósito deste template"
                          rows={3}
                        />
                      </div>
                      <Button onClick={handleCreateTemplate} className="w-full">
                        <Plus className="h-4 w-4 mr-2" />
                        Criar Template
                      </Button>
                    </>
                  ) : (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="step-title">Título da Etapa *</Label>
                        <Input
                          id="step-title"
                          value={stepTitle}
                          onChange={(e) => setStepTitle(e.target.value)}
                          placeholder="Ex: Primeiro contato"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="step-description">Descrição</Label>
                        <Textarea
                          id="step-description"
                          value={stepDescription}
                          onChange={(e) => setStepDescription(e.target.value)}
                          placeholder="Descreva o que deve ser feito nesta etapa"
                          rows={2}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="step-tip">Dica/Exemplo</Label>
                        <Textarea
                          id="step-tip"
                          value={stepTip}
                          onChange={(e) => setStepTip(e.target.value)}
                          placeholder="Exemplo de mensagem ou dica para esta etapa"
                          rows={2}
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button onClick={handleUpdateStep} className="flex-1">
                          Salvar Etapa
                        </Button>
                        <Button variant="outline" onClick={handleCancelEditStep} className="flex-1">
                          Cancelar
                        </Button>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Editar template existente */}
            {editingTemplate && !editingStep && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Editar Template</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-template-name">Nome do Template *</Label>
                    <Input
                      id="edit-template-name"
                      value={templateName}
                      onChange={(e) => setTemplateName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-template-description">Descrição</Label>
                    <Textarea
                      id="edit-template-description"
                      value={templateDescription}
                      onChange={(e) => setTemplateDescription(e.target.value)}
                      rows={3}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={editingTemplate.isActive}
                      onCheckedChange={() => handleToggleTemplateActive(editingTemplate)}
                    />
                    <Label>Template ativo</Label>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleUpdateTemplate} className="flex-1">
                      Salvar Template
                    </Button>
                    <Button variant="outline" onClick={handleCancelEdit} className="flex-1">
                      Cancelar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Lista de templates */}
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Carregando templates...</div>
            ) : templates.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum template criado ainda. Crie seu primeiro template acima.
              </div>
            ) : (
              <div className="space-y-4">
                {templates.map((template) => (
                  <Card key={template.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <CardTitle className="text-lg">{template.name}</CardTitle>
                            {!template.isActive && (
                              <Badge variant="secondary">Inativo</Badge>
                            )}
                          </div>
                          {template.description && (
                            <CardDescription className="mt-1">{template.description}</CardDescription>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditTemplate(template)}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setDeletingTemplateId(template.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Lista de etapas */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-sm font-medium">Etapas do Template</Label>
                          {!editingStep && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setEditingStep({
                                  id: "",
                                  templateId: template.id,
                                  stepOrder: template.steps.length + 1,
                                  title: "",
                                  createdAt: new Date(),
                                });
                                setStepTitle("");
                                setStepDescription("");
                                setStepTip("");
                              }}
                            >
                              <Plus className="h-4 w-4 mr-2" />
                              Adicionar Etapa
                            </Button>
                          )}
                        </div>

                        {template.steps.length === 0 ? (
                          <p className="text-sm text-muted-foreground py-4 text-center">
                            Nenhuma etapa adicionada ainda
                          </p>
                        ) : (
                          <div className="space-y-2">
                            {template.steps.map((step, index) => (
                              <div key={step.id}>
                                <div
                                  className="flex items-start gap-3 p-3 border rounded-lg bg-muted/50"
                                >
                                  <div className="flex items-center gap-2 flex-1">
                                    <span className="text-sm font-medium text-muted-foreground w-6">
                                      {index + 1}.
                                    </span>
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2">
                                        <span className="font-medium">{step.title}</span>
                                        {step.tip && (
                                          <Popover>
                                            <PopoverTrigger asChild>
                                              <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                                                <Info className="h-3 w-3" />
                                              </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-80">
                                              <div className="space-y-2">
                                                <h4 className="font-medium text-sm">Dica</h4>
                                                <p className="text-sm text-muted-foreground">{step.tip}</p>
                                              </div>
                                            </PopoverContent>
                                          </Popover>
                                        )}
                                      </div>
                                      {step.description && (
                                        <p className="text-sm text-muted-foreground mt-1">{step.description}</p>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex gap-1">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleEditStep(step)}
                                    >
                                      <Edit2 className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => setDeletingStepId(step.id)}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>
                                 {/* Componente de automações expandido */}
                                 {step.id && (
                                   <div className="ml-9 mt-2">
                                     <FollowUpAutomationConfig
                                       stepId={step.id}
                                       templateId={template.id}
                                       automations={step.automations || []}
                                     />
                                   </div>
                                 )}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Formulário de adicionar/editar etapa */}
                        {editingStep && editingStep.templateId === template.id && (
                          <Card className="bg-primary/5 border-primary/20">
                            <CardContent className="pt-4 space-y-4">
                              <div className="space-y-2">
                                <Label htmlFor="new-step-title">Título da Etapa *</Label>
                                <Input
                                  id="new-step-title"
                                  value={stepTitle}
                                  onChange={(e) => setStepTitle(e.target.value)}
                                  placeholder="Ex: Primeiro contato"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="new-step-description">Descrição</Label>
                                <Textarea
                                  id="new-step-description"
                                  value={stepDescription}
                                  onChange={(e) => setStepDescription(e.target.value)}
                                  placeholder="Descreva o que deve ser feito nesta etapa"
                                  rows={2}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="new-step-tip">Dica/Exemplo</Label>
                                <Textarea
                                  id="new-step-tip"
                                  value={stepTip}
                                  onChange={(e) => setStepTip(e.target.value)}
                                  placeholder="Exemplo de mensagem ou dica para esta etapa"
                                  rows={2}
                                />
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  onClick={async () => {
                                    if (editingStep.id) {
                                      await handleUpdateStep();
                                    } else {
                                      await handleAddStep(template.id);
                                    }
                                  }}
                                  className="flex-1"
                                >
                                  {editingStep.id ? "Salvar" : "Adicionar"} Etapa
                                </Button>
                                <Button variant="outline" onClick={handleCancelEditStep} className="flex-1">
                                  Cancelar
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog de confirmação de exclusão de template */}
      <AlertDialog open={!!deletingTemplateId} onOpenChange={() => setDeletingTemplateId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este template? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteTemplate}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog de confirmação de exclusão de etapa */}
      <AlertDialog open={!!deletingStepId} onOpenChange={() => setDeletingStepId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta etapa? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteStep}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

