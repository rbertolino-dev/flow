import { useState } from "react";
import { WorkflowEnvio } from "@/types/workflows";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Edit, Pause, Play, Trash2, Users, Copy, Calendar } from "lucide-react";

interface WorkflowListTableProps {
  workflows: WorkflowEnvio[];
  isLoading: boolean;
  onEdit: (workflow: WorkflowEnvio) => void;
  onToggle: (workflow: WorkflowEnvio) => void;
  onDelete: (workflow: WorkflowEnvio) => void;
  onDuplicate?: (workflow: WorkflowEnvio) => void;
  onBulkToggle?: (workflowIds: string[], isActive: boolean) => void;
  onBulkDelete?: (workflowIds: string[]) => void;
}

export function WorkflowListTable({
  workflows,
  isLoading,
  onEdit,
  onToggle,
  onDelete,
  onDuplicate,
  onBulkToggle,
  onBulkDelete,
}: WorkflowListTableProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(workflows.map((w) => w.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    const newSelected = new Set(selectedIds);
    if (checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedIds(newSelected);
  };

  const handleBulkToggle = (isActive: boolean) => {
    if (onBulkToggle && selectedIds.size > 0) {
      onBulkToggle(Array.from(selectedIds), isActive);
      setSelectedIds(new Set());
    }
  };

  const handleBulkDelete = () => {
    if (onBulkDelete && selectedIds.size > 0) {
      if (window.confirm(`Excluir ${selectedIds.size} workflow(s) selecionado(s)?`)) {
        onBulkDelete(Array.from(selectedIds));
        setSelectedIds(new Set());
      }
    }
  };

  const allSelected = workflows.length > 0 && selectedIds.size === workflows.length;
  const someSelected = selectedIds.size > 0 && selectedIds.size < workflows.length;

  if (!workflows.length) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        Nenhum workflow recorrente cadastrado ainda.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {selectedIds.size > 0 && (onBulkToggle || onBulkDelete) && (
        <div className="flex items-center justify-between p-3 bg-muted rounded-lg border">
          <span className="text-sm font-medium">
            {selectedIds.size} workflow(s) selecionado(s)
          </span>
          <div className="flex gap-2">
            {onBulkToggle && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleBulkToggle(true)}
                >
                  <Play className="h-4 w-4 mr-2" />
                  Ativar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleBulkToggle(false)}
                >
                  <Pause className="h-4 w-4 mr-2" />
                  Pausar
                </Button>
              </>
            )}
            {onBulkDelete && (
              <Button
                variant="destructive"
                size="sm"
                onClick={handleBulkDelete}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Excluir
              </Button>
            )}
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-border">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow>
              {(onBulkToggle || onBulkDelete) && (
                <TableHead className="w-12">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={handleSelectAll}
                    ref={(el) => {
                      if (el) {
                        el.indeterminate = someSelected;
                      }
                    }}
                  />
                </TableHead>
              )}
              <TableHead>Workflow</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Periodicidade</TableHead>
              <TableHead>Destinatários</TableHead>
              <TableHead>
                <div className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Próximo envio
                </div>
              </TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {workflows.map((workflow) => {
              const isSelected = selectedIds.has(workflow.id);
              const nextRunDate = workflow.next_run_at ? new Date(workflow.next_run_at) : null;
              const isUpcoming = nextRunDate && nextRunDate > new Date();

              return (
                <TableRow key={workflow.id} className={isSelected ? "bg-muted/50" : ""}>
                  {(onBulkToggle || onBulkDelete) && (
                    <TableCell>
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={(checked) => handleSelectOne(workflow.id, checked as boolean)}
                      />
                    </TableCell>
                  )}
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{workflow.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {workflow.observations || workflow.list?.name || "Sem observações"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="capitalize">{workflow.workflow_type}</TableCell>
                  <TableCell>{formatPeriodicity(workflow)}</TableCell>
                  <TableCell>
                    {workflow.recipient_mode === "group" && workflow.group ? (
                      <Badge variant="secondary" className="gap-1">
                        <Users className="h-3 w-3" />
                        {workflow.group.group_name}
                      </Badge>
                    ) : workflow.recipient_mode === "single" ? (
                      <Badge variant="outline">Cliente individual</Badge>
                    ) : (
                      <Badge variant="outline">
                        {workflow.list?.contacts?.length ?? 0} contato(s)
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {nextRunDate ? (
                      <div className="flex flex-col">
                        <span className={isUpcoming ? "font-medium text-green-600" : ""}>
                          {format(nextRunDate, "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </span>
                        {isUpcoming && (
                          <span className="text-xs text-muted-foreground">
                            Em {formatDistanceToNow(nextRunDate, { locale: ptBR, addSuffix: true })}
                          </span>
                        )}
                      </div>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={workflow.is_active ? "default" : "outline"}>
                      {workflow.is_active ? "Ativo" : workflow.status === "completed" ? "Concluído" : "Pausado"}
                    </Badge>
                  </TableCell>
                  <TableCell className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => onEdit(workflow)}
                      title="Editar workflow"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    {onDuplicate && (
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => onDuplicate(workflow)}
                        title="Duplicar workflow"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => onToggle(workflow)}
                      title={workflow.is_active ? "Pausar" : "Reativar"}
                    >
                      {workflow.is_active ? (
                        <Pause className="h-4 w-4" />
                      ) : (
                        <Play className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={() => onDelete(workflow)}
                      title="Excluir workflow"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function formatPeriodicity(workflow: WorkflowEnvio) {
  switch (workflow.periodicity) {
    case "daily":
      return "Diário";
    case "weekly":
      return workflow.days_of_week?.length
        ? `Semanal (${workflow.days_of_week.map(localizeWeekday).join(", ")})`
        : "Semanal";
    case "biweekly":
      return "Quinzenal";
    case "monthly":
      return workflow.day_of_month
        ? `Todo dia ${workflow.day_of_month}`
        : "Mensal";
    case "custom":
      return `A cada ${workflow.custom_interval_value ?? 1} ${localizeUnit(
        workflow.custom_interval_unit,
      )}`;
    default:
      return workflow.periodicity;
  }
}

function localizeWeekday(value: string) {
  const map: Record<string, string> = {
    sunday: "Dom",
    monday: "Seg",
    tuesday: "Ter",
    wednesday: "Qua",
    thursday: "Qui",
    friday: "Sex",
    saturday: "Sáb",
  };
  return map[value as keyof typeof map] || value;
}

function localizeUnit(value: string | null | undefined) {
  const map: Record<string, string> = {
    day: "dia(s)",
    week: "semana(s)",
    month: "mês(es)",
  };
  if (!value) return "dia(s)";
  return map[value] || value;
}

