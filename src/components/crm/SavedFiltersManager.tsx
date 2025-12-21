import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Bookmark, BookmarkCheck, X, Pencil } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AdvancedSearchFilters } from "./AdvancedSearchPanel";
import { useToast } from "@/hooks/use-toast";

interface SavedFilter {
  id: string;
  name: string;
  filters: AdvancedSearchFilters;
}

interface SavedFiltersManagerProps {
  onLoadFilter: (filters: AdvancedSearchFilters) => void;
  currentFilters: AdvancedSearchFilters;
}

const STORAGE_KEY = "crm_saved_filters";

export function SavedFiltersManager({
  onLoadFilter,
  currentFilters,
}: SavedFiltersManagerProps) {
  const { toast } = useToast();
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingFilter, setEditingFilter] = useState<SavedFilter | null>(null);
  const [filterName, setFilterName] = useState("");

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setSavedFilters(JSON.parse(stored));
      } catch (e) {
        console.error("Erro ao carregar filtros salvos:", e);
      }
    }
  }, []);

  const saveFilter = () => {
    if (!filterName.trim()) {
      toast({
        title: "Erro",
        description: "Digite um nome para o filtro",
        variant: "destructive",
      });
      return;
    }

    const newFilter: SavedFilter = {
      id: Date.now().toString(),
      name: filterName,
      filters: currentFilters,
    };

    const updated = [...savedFilters, newFilter];
    setSavedFilters(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    setFilterName("");
    setDialogOpen(false);
    toast({
      title: "Sucesso",
      description: "Filtro salvo com sucesso",
    });
  };

  const deleteFilter = (id: string) => {
    const updated = savedFilters.filter((f) => f.id !== id);
    setSavedFilters(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    toast({
      title: "Sucesso",
      description: "Filtro removido",
    });
  };

  const editFilter = (filter: SavedFilter) => {
    setEditingFilter(filter);
    setFilterName(filter.name);
    setEditDialogOpen(true);
  };

  const saveEditedFilter = () => {
    if (!filterName.trim() || !editingFilter) {
      toast({
        title: "Erro",
        description: "Digite um nome para o filtro",
        variant: "destructive",
      });
      return;
    }

    const updated = savedFilters.map((f) =>
      f.id === editingFilter.id
        ? { ...f, name: filterName, filters: currentFilters }
        : f
    );
    setSavedFilters(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    setFilterName("");
    setEditingFilter(null);
    setEditDialogOpen(false);
    toast({
      title: "Sucesso",
      description: "Filtro atualizado com sucesso",
    });
  };

  const loadFilter = (filter: SavedFilter) => {
    onLoadFilter(filter.filters);
    toast({
      title: "Filtro carregado",
      description: `Filtro "${filter.name}" aplicado`,
    });
  };

  if (savedFilters.length === 0 && !dialogOpen) {
    return (
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <Bookmark className="h-4 w-4 mr-2" />
            Salvar Filtros
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Salvar Filtro</DialogTitle>
            <DialogDescription>
              Salve a combinação atual de filtros para uso futuro
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="filter-name">Nome do Filtro</Label>
              <Input
                id="filter-name"
                placeholder="Ex: Leads de Hoje, Clientes VIP..."
                value={filterName}
                onChange={(e) => setFilterName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveFilter();
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={saveFilter}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {savedFilters.map((filter) => (
        <Badge
          key={filter.id}
          variant="outline"
          className="cursor-pointer hover:bg-primary/10 flex items-center gap-1"
          onClick={() => loadFilter(filter)}
        >
          <BookmarkCheck className="h-3 w-3" />
          {filter.name}
          <button
            onClick={(e) => {
              e.stopPropagation();
              editFilter(filter);
            }}
            className="ml-1 hover:text-primary"
            title="Editar filtro"
          >
            <Pencil className="h-3 w-3" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              deleteFilter(filter.id);
            }}
            className="ml-1 hover:text-destructive"
            title="Remover filtro"
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <Bookmark className="h-4 w-4 mr-2" />
            Salvar Filtros
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Salvar Filtro</DialogTitle>
            <DialogDescription>
              Salve a combinação atual de filtros para uso futuro
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="filter-name">Nome do Filtro</Label>
              <Input
                id="filter-name"
                placeholder="Ex: Leads de Hoje, Clientes VIP..."
                value={filterName}
                onChange={(e) => setFilterName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveFilter();
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={saveFilter}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Edição */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Filtro</DialogTitle>
            <DialogDescription>
              Edite o nome e os filtros salvos
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="edit-filter-name">Nome do Filtro</Label>
              <Input
                id="edit-filter-name"
                placeholder="Ex: Leads de Hoje, Clientes VIP..."
                value={filterName}
                onChange={(e) => setFilterName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveEditedFilter();
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setEditDialogOpen(false);
              setEditingFilter(null);
              setFilterName("");
            }}>
              Cancelar
            </Button>
            <Button onClick={saveEditedFilter}>Salvar Alterações</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

