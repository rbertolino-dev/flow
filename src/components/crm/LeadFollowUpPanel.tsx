import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useLeadFollowUps } from "@/hooks/useLeadFollowUps";
import { useFollowUpTemplates } from "@/hooks/useFollowUpTemplates";
import { LeadFollowUp, LeadFollowUpStep } from "@/types/followUp";
import { Plus, Info, Trash2, CheckCircle2, Circle } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface LeadFollowUpPanelProps {
  leadId: string;
  compact?: boolean;
}

export function LeadFollowUpPanel({ leadId, compact = false }: LeadFollowUpPanelProps) {
  const { followUps, loading, applyTemplate, toggleStepCompletion, removeFollowUp } = useLeadFollowUps(leadId);
  const { templates, loading: templatesLoading } = useFollowUpTemplates();
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [removingFollowUpId, setRemovingFollowUpId] = useState<string | null>(null);

  const activeTemplates = templates.filter(t => t.isActive);

  const handleApplyTemplate = async () => {
    if (!selectedTemplateId) return;

    const success = await applyTemplate(selectedTemplateId);
    if (success) {
      setSelectedTemplateId("");
    }
  };

  const handleRemoveFollowUp = async () => {
    if (!removingFollowUpId) return;

    const success = await removeFollowUp(removingFollowUpId);
    if (success) {
      setRemovingFollowUpId(null);
    }
  };

  const getProgress = (followUp: LeadFollowUp) => {
    const completed = followUp.steps.filter(s => s.completed).length;
    const total = followUp.steps.length;
    return total > 0 ? Math.round((completed / total) * 100) : 0;
  };

  if (loading || templatesLoading) {
    return (
      <Card>
        <CardContent className="py-4">
          <p className="text-sm text-muted-foreground text-center">Carregando follow-ups...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Follow-up</CardTitle>
              <CardDescription className="text-xs">
                Processo de abordagem do lead
              </CardDescription>
            </div>
            {activeTemplates.length > 0 && (
              <div className="flex items-center gap-2">
                <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                  <SelectTrigger className="w-[180px] h-8 text-xs">
                    <SelectValue placeholder="Aplicar template" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeTemplates.map((template) => (
                      <SelectItem key={template.id} value={template.id}>
                        {template.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  onClick={handleApplyTemplate}
                  disabled={!selectedTemplateId}
                  className="h-8"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Aplicar
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {followUps.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-sm text-muted-foreground mb-3">
                Nenhum follow-up aplicado ainda
              </p>
              {activeTemplates.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Crie templates de follow-up nas configurações
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Selecione um template acima para aplicar
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {followUps.map((followUp) => {
                const progress = getProgress(followUp);
                const allCompleted = followUp.steps.length > 0 && followUp.steps.every(s => s.completed);

                return (
                  <Card key={followUp.id} className="bg-muted/30">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <CardTitle className="text-sm font-medium">{followUp.templateName}</CardTitle>
                            {allCompleted && (
                              <Badge variant="default" className="text-xs">
                                Concluído
                              </Badge>
                            )}
                          </div>
                          <CardDescription className="text-xs mt-1">
                            Iniciado em {format(followUp.startedAt, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                          </CardDescription>
                          {progress > 0 && (
                            <div className="mt-2">
                              <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                                <span>Progresso</span>
                                <span>{progress}%</span>
                              </div>
                              <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
                                <div
                                  className="bg-primary h-full transition-all duration-300"
                                  style={{ width: `${progress}%` }}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setRemovingFollowUpId(followUp.id)}
                          className="h-6 w-6 p-0"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="space-y-2">
                        {followUp.steps.length === 0 ? (
                          <p className="text-xs text-muted-foreground py-2">
                            Nenhuma etapa definida neste template
                          </p>
                        ) : (
                          followUp.steps.map((step, index) => (
                            <div
                              key={step.stepId}
                              className={`flex items-start gap-2 p-2 rounded-lg border transition-colors ${
                                step.completed
                                  ? "bg-primary/5 border-primary/20"
                                  : "bg-background border-border"
                              }`}
                            >
                              <Checkbox
                                checked={step.completed}
                                onCheckedChange={(checked) =>
                                  toggleStepCompletion(followUp.id, step.stepId, !!checked)
                                }
                                className="mt-0.5"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-medium text-muted-foreground w-4">
                                    {index + 1}.
                                  </span>
                                  <span
                                    className={`text-sm font-medium ${
                                      step.completed ? "line-through text-muted-foreground" : ""
                                    }`}
                                  >
                                    {step.title}
                                  </span>
                                  {step.tip && (
                                    <Popover>
                                      <PopoverTrigger asChild>
                                        <Button variant="ghost" size="sm" className="h-5 w-5 p-0">
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
                                  <p className="text-xs text-muted-foreground mt-1 ml-6">
                                    {step.description}
                                  </p>
                                )}
                                {step.completed && step.completedAt && (
                                  <p className="text-xs text-muted-foreground mt-1 ml-6">
                                    Concluído em {format(step.completedAt, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                                  </p>
                                )}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog de confirmação de remoção */}
      <AlertDialog open={!!removingFollowUpId} onOpenChange={() => setRemovingFollowUpId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover Follow-up</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover este follow-up do lead? O histórico de conclusões será mantido.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemoveFollowUp}>Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

