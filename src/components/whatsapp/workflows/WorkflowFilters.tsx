import type { WorkflowFilters, WorkflowList } from "@/types/workflows";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Filter, RefreshCw } from "lucide-react";

interface WorkflowFiltersProps {
  filters: WorkflowFilters;
  onChange: (next: WorkflowFilters) => void;
  availableTypes: string[];
  lists: WorkflowList[];
  onClear?: () => void;
}

export function WorkflowFilters({
  filters,
  onChange,
  availableTypes,
  lists,
  onClear,
}: WorkflowFiltersProps) {
  const update = (patch: Partial<WorkflowFilters>) => {
    onChange({ ...filters, ...patch });
  };

  return (
    <div className="grid gap-3 md:grid-cols-5">
      <div className="flex items-center gap-2">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium text-muted-foreground">
          Filtros
        </span>
      </div>

      <Select
        value={filters.status}
        onValueChange={(value) => update({ status: value as WorkflowFilters["status"] })}
      >
        <SelectTrigger>
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos os status</SelectItem>
          <SelectItem value="active">Ativos</SelectItem>
          <SelectItem value="paused">Pausados</SelectItem>
          <SelectItem value="completed">Concluídos</SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={filters.type}
        onValueChange={(value) => update({ type: value as WorkflowFilters["type"] })}
      >
        <SelectTrigger>
          <SelectValue placeholder="Tipo" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos os tipos</SelectItem>
          {availableTypes.map((type) => (
            <SelectItem key={type} value={type}>
              {capitalize(type)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filters.listId}
        onValueChange={(value) => update({ listId: value as WorkflowFilters["listId"] })}
      >
        <SelectTrigger>
          <SelectValue placeholder="Cliente / Lista" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos os destinatários</SelectItem>
          {lists.map((list) => (
            <SelectItem key={list.id} value={list.id}>
              {list.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Input
        placeholder="Buscar por nome..."
        value={filters.search}
        onChange={(event) => update({ search: event.target.value })}
      />

      <div className="flex justify-end md:col-span-5">
        <Button
          variant="ghost"
          size="sm"
          onClick={onClear}
          className="gap-2"
        >
          <RefreshCw className="h-4 w-4" />
          Limpar filtros
        </Button>
      </div>
    </div>
  );
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

