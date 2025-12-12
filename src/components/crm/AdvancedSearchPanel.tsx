import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Search, X, Filter, Calendar } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export interface AdvancedSearchFilters {
  name?: string;
  phone?: string;
  email?: string;
  company?: string;
  notes?: string;
  stageId?: string;
  tagId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  source?: string;
  hasValue?: boolean;
  minValue?: number;
  maxValue?: number;
}

interface AdvancedSearchPanelProps {
  filters: AdvancedSearchFilters;
  onChange: (filters: AdvancedSearchFilters) => void;
  stages: Array<{ id: string; name: string }>;
  tags: Array<{ id: string; name: string }>;
  onClear: () => void;
}

export function AdvancedSearchPanel({
  filters,
  onChange,
  stages,
  tags,
  onClear,
}: AdvancedSearchPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const updateFilter = (key: keyof AdvancedSearchFilters, value: any) => {
    onChange({ ...filters, [key]: value });
  };

  const activeFiltersCount = Object.values(filters).filter(
    (v) => v !== undefined && v !== null && v !== ""
  ).length;

  return (
    <Card className="mb-4">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Search className="h-4 w-4" />
            Busca Avançada
            {activeFiltersCount > 0 && (
              <Badge variant="secondary">{activeFiltersCount} filtro(s)</Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            {activeFiltersCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onClear}
                className="h-8"
              >
                <X className="h-4 w-4 mr-1" />
                Limpar
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="h-8"
            >
              <Filter className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Busca Rápida */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <Label htmlFor="search-name">Nome</Label>
              <Input
                id="search-name"
                placeholder="Buscar por nome..."
                value={filters.name || ""}
                onChange={(e) => updateFilter("name", e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="search-phone">Telefone</Label>
              <Input
                id="search-phone"
                placeholder="Buscar por telefone..."
                value={filters.phone || ""}
                onChange={(e) => updateFilter("phone", e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="search-email">Email</Label>
              <Input
                id="search-email"
                placeholder="Buscar por email..."
                value={filters.email || ""}
                onChange={(e) => updateFilter("email", e.target.value)}
              />
            </div>
          </div>

          {/* Filtros Expandidos */}
          {isExpanded && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-3 border-t">
              <div>
                <Label htmlFor="search-company">Empresa</Label>
                <Input
                  id="search-company"
                  placeholder="Buscar por empresa..."
                  value={filters.company || ""}
                  onChange={(e) => updateFilter("company", e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="search-notes">Notas</Label>
                <Input
                  id="search-notes"
                  placeholder="Buscar em notas..."
                  value={filters.notes || ""}
                  onChange={(e) => updateFilter("notes", e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="search-stage">Etapa</Label>
                <Select
                  value={filters.stageId || "all"}
                  onValueChange={(value) =>
                    updateFilter("stageId", value === "all" ? undefined : value)
                  }
                >
                  <SelectTrigger id="search-stage">
                    <SelectValue placeholder="Todas as etapas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as etapas</SelectItem>
                    {stages.map((stage) => (
                      <SelectItem key={stage.id} value={stage.id}>
                        {stage.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="search-tag">Tag</Label>
                <Select
                  value={filters.tagId || "all"}
                  onValueChange={(value) =>
                    updateFilter("tagId", value === "all" ? undefined : value)
                  }
                >
                  <SelectTrigger id="search-tag">
                    <SelectValue placeholder="Todas as tags" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as tags</SelectItem>
                    {tags.map((tag) => (
                      <SelectItem key={tag.id} value={tag.id}>
                        {tag.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="search-source">Origem</Label>
                <Input
                  id="search-source"
                  placeholder="Filtrar por origem..."
                  value={filters.source || ""}
                  onChange={(e) => updateFilter("source", e.target.value)}
                />
              </div>
              <div>
                <Label>Valor</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    placeholder="Mín"
                    value={filters.minValue || ""}
                    onChange={(e) =>
                      updateFilter("minValue", e.target.value ? Number(e.target.value) : undefined)
                    }
                  />
                  <Input
                    type="number"
                    placeholder="Máx"
                    value={filters.maxValue || ""}
                    onChange={(e) =>
                      updateFilter("maxValue", e.target.value ? Number(e.target.value) : undefined)
                    }
                  />
                </div>
              </div>
              <div>
                <Label>Data de Criação</Label>
                <div className="flex gap-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left font-normal">
                        <Calendar className="mr-2 h-4 w-4" />
                        {filters.dateFrom
                          ? format(filters.dateFrom, "dd/MM/yyyy", { locale: ptBR })
                          : "De"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <CalendarComponent
                        mode="single"
                        selected={filters.dateFrom}
                        onSelect={(date) => updateFilter("dateFrom", date)}
                        locale={ptBR}
                      />
                    </PopoverContent>
                  </Popover>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left font-normal">
                        <Calendar className="mr-2 h-4 w-4" />
                        {filters.dateTo
                          ? format(filters.dateTo, "dd/MM/yyyy", { locale: ptBR })
                          : "Até"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <CalendarComponent
                        mode="single"
                        selected={filters.dateTo}
                        onSelect={(date) => updateFilter("dateTo", date)}
                        locale={ptBR}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}



