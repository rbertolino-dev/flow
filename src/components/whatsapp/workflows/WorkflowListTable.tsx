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
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Edit, Pause, Play, Trash2, Users } from "lucide-react";

interface WorkflowListTableProps {
  workflows: WorkflowEnvio[];
  isLoading: boolean;
  onEdit: (workflow: WorkflowEnvio) => void;
  onToggle: (workflow: WorkflowEnvio) => void;
  onDelete: (workflow: WorkflowEnvio) => void;
}

export function WorkflowListTable({
  workflows,
  isLoading,
  onEdit,
  onToggle,
  onDelete,
}: WorkflowListTableProps) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  if (!workflows.length) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        Nenhum workflow recorrente cadastrado ainda.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <Table>
        <TableHeader className="bg-muted/40">
          <TableRow>
            <TableHead>Workflow</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Periodicidade</TableHead>
            <TableHead>Destinatários</TableHead>
            <TableHead>Próximo envio</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {workflows.map((workflow) => (
            <TableRow key={workflow.id}>
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
                {workflow.next_run_at
                  ? format(new Date(workflow.next_run_at), "dd/MM/yyyy HH:mm", { locale: ptBR })
                  : "—"}
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
          ))}
        </TableBody>
      </Table>
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

