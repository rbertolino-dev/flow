import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useOnboarding } from "@/hooks/useOnboarding";
import { usePipelineStages } from "@/hooks/usePipelineStages";
import { GripVertical, Plus, X, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface PipelineStepProps {
  onComplete: () => void;
  businessType?: string;
}

interface StageItem {
  id: string;
  name: string;
  color: string;
}

function SortableStageItem({ stage, onDelete }: { stage: StageItem; onDelete: () => void }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: stage.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <Card ref={setNodeRef} style={style} className="mb-2">
      <CardContent className="p-3 flex items-center justify-between">
        <div className="flex items-center gap-3 flex-1">
          <div
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing"
          >
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </div>
          <div
            className="w-4 h-4 rounded-full"
            style={{ backgroundColor: stage.color }}
          />
          <span className="font-medium">{stage.name}</span>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onDelete}
          className="h-8 w-8"
        >
          <X className="h-4 w-4" />
        </Button>
      </CardContent>
    </Card>
  );
}

const DEFAULT_STAGES: Record<string, Array<{ name: string; color: string }>> = {
  products_and_services: [
    { name: "Novo Lead", color: "#10b981" },
    { name: "Contato Feito", color: "#3b82f6" },
    { name: "Apresentação", color: "#8b5cf6" },
    { name: "Proposta Enviada", color: "#f59e0b" },
    { name: "Negociação", color: "#ec4899" },
    { name: "Fechado", color: "#22c55e" },
  ],
  products_only: [
    { name: "Novo Lead", color: "#10b981" },
    { name: "Interesse", color: "#3b82f6" },
    { name: "Orçamento", color: "#8b5cf6" },
    { name: "Aprovação", color: "#f59e0b" },
    { name: "Pedido", color: "#ec4899" },
    { name: "Vendido", color: "#22c55e" },
  ],
  services_only: [
    { name: "Novo Lead", color: "#10b981" },
    { name: "Qualificação", color: "#3b82f6" },
    { name: "Apresentação", color: "#8b5cf6" },
    { name: "Proposta", color: "#f59e0b" },
    { name: "Aprovação", color: "#ec4899" },
    { name: "Contratado", color: "#22c55e" },
  ],
};

export function PipelineStep({ onComplete, businessType }: PipelineStepProps) {
  const { toast } = useToast();
  const { markStepAsComplete } = useOnboarding();
  const { stages, createStage, refetch: fetchStages } = usePipelineStages();
  const [localStages, setLocalStages] = useState<StageItem[]>([]);
  const [newStageName, setNewStageName] = useState("");
  const [newStageColor, setNewStageColor] = useState("#3b82f6");
  const [loading, setLoading] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    // Carregar estágios existentes
    if (stages.length > 0) {
      setLocalStages(
        stages.map((s) => ({
          id: s.id,
          name: s.name,
          color: s.color,
        }))
      );
    } else if (businessType && DEFAULT_STAGES[businessType]) {
      // Sugerir estágios padrão baseados no tipo de negócio
      setLocalStages(
        DEFAULT_STAGES[businessType].map((s, index) => ({
          id: `temp-${index}`,
          name: s.name,
          color: s.color,
        }))
      );
    }
  }, [stages, businessType]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = localStages.findIndex((s) => s.id === active.id);
      const newIndex = localStages.findIndex((s) => s.id === over.id);
      const reordered = arrayMove(localStages, oldIndex, newIndex);
      setLocalStages(reordered);
    }
  };

  const handleAddStage = () => {
    if (!newStageName.trim()) {
      toast({
        title: "Nome obrigatório",
        description: "Digite um nome para a etapa",
        variant: "destructive",
      });
      return;
    }

    const newStage: StageItem = {
      id: `temp-${Date.now()}`,
      name: newStageName.trim(),
      color: newStageColor,
    };

    setLocalStages([...localStages, newStage]);
    setNewStageName("");
    setNewStageColor("#3b82f6");
  };

  const handleRemoveStage = (id: string) => {
    setLocalStages(localStages.filter((s) => s.id !== id));
  };

  const handleUseDefaults = () => {
    if (businessType && DEFAULT_STAGES[businessType]) {
      setLocalStages(
        DEFAULT_STAGES[businessType].map((s, index) => ({
          id: `temp-${index}`,
          name: s.name,
          color: s.color,
        }))
      );
      toast({
        title: "Etapas padrão aplicadas",
        description: "Você pode personalizar conforme necessário",
      });
    }
  };

  const handleContinue = async () => {
    if (localStages.length < 3) {
      toast({
        title: "Mínimo de etapas",
        description: "Crie pelo menos 3 etapas para o funil",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      // Criar todas as etapas
      for (let i = 0; i < localStages.length; i++) {
        const stage = localStages[i];
        // Se já existe (não é temp), pular
        if (!stage.id.startsWith('temp-')) {
          continue;
        }
        await createStage(stage.name, stage.color);
      }

      // Aguardar um pouco para garantir que as etapas foram criadas
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Recarregar estágios
      await fetchStages();

      // Marcar etapa como completa
      await markStepAsComplete('pipeline');

      toast({
        title: "Funil configurado!",
        description: `${localStages.length} etapa(s) criada(s) com sucesso`,
      });

      onComplete();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Erro ao criar etapas",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="space-y-2">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Configure o Funil de Vendas
        </h3>
        <p className="text-sm text-muted-foreground">
          Crie as etapas do seu funil de vendas. Você precisa de pelo menos 3 etapas.
        </p>
      </div>

      {businessType && DEFAULT_STAGES[businessType] && localStages.length === 0 && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4">
            <p className="text-sm mb-3">
              Sugerimos as seguintes etapas baseadas no seu tipo de negócio:
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={handleUseDefaults}
              className="w-full"
            >
              Usar Etapas Sugeridas
            </Button>
          </CardContent>
        </Card>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={localStages.map((s) => s.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {localStages.map((stage) => (
              <SortableStageItem
                key={stage.id}
                stage={stage}
                onDelete={() => handleRemoveStage(stage.id)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-[1fr_auto_auto] gap-3">
            <div className="space-y-2">
              <Label htmlFor="stageName">Nome da Etapa</Label>
              <Input
                id="stageName"
                placeholder="Ex: Novo Lead"
                value={newStageName}
                onChange={(e) => setNewStageName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddStage();
                  }
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="stageColor">Cor</Label>
              <Input
                id="stageColor"
                type="color"
                value={newStageColor}
                onChange={(e) => setNewStageColor(e.target.value)}
                className="h-10 w-20"
              />
            </div>
            <div className="flex items-end">
              <Button
                type="button"
                onClick={handleAddStage}
                disabled={!newStageName.trim()}
              >
                <Plus className="h-4 w-4 mr-2" />
                Adicionar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3 pt-4">
        <Button
          type="button"
          onClick={handleContinue}
          disabled={loading || localStages.length < 3}
          className="min-w-[120px]"
        >
          {loading ? "Salvando..." : "Continuar"}
        </Button>
      </div>

      {localStages.length < 3 && (
        <p className="text-sm text-muted-foreground text-center">
          Adicione pelo menos {3 - localStages.length} etapa(s) para continuar
        </p>
      )}
    </div>
  );
}

