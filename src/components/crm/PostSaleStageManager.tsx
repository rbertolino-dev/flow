import { useState } from "react";
import { usePostSaleStages } from "@/hooks/usePostSaleStages";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { Settings, Plus, Pencil, Trash2, GripVertical } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
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
import { PostSaleStage } from "@/types/postSaleLead";

interface SortableStageItemProps {
  stage: PostSaleStage;
  onEdit: () => void;
  onDelete: () => void;
  isFirstStage: boolean;
}

function SortableStageItem({ stage, onEdit, onDelete, isFirstStage }: SortableStageItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: stage.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <Card ref={setNodeRef} style={style} className="p-3">
      <div className="flex items-center gap-3">
        <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
          <GripVertical className="h-5 w-5 text-muted-foreground" />
        </div>
        <Badge
          style={{
            backgroundColor: `${stage.color}20`,
            borderColor: stage.color,
            color: stage.color,
          }}
          className="flex-shrink-0"
        >
          {stage.name}
        </Badge>
        {isFirstStage && (
          <span className="text-xs text-muted-foreground">(Etapa inicial - não pode ser excluída)</span>
        )}
        <div className="ml-auto flex gap-2">
          <Button variant="ghost" size="icon" onClick={onEdit}>
            <Pencil className="h-4 w-4" />
          </Button>
          {!isFirstStage && (
            <Button variant="ghost" size="icon" onClick={onDelete}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

export function PostSaleStageManager() {
  const { stages, createStage, updateStage, deleteStage, reorderStages } = usePostSaleStages();
  const [open, setOpen] = useState(false);
  const [editingStage, setEditingStage] = useState<string | null>(null);
  const [deletingStage, setDeletingStage] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: "", color: "#3b82f6" });

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = stages.findIndex((s) => s.id === active.id);
      const newIndex = stages.findIndex((s) => s.id === over.id);
      const reordered = arrayMove(stages, oldIndex, newIndex);
      reorderStages(reordered);
    }
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) return;

    if (editingStage) {
      await updateStage(editingStage, formData.name, formData.color);
    } else {
      await createStage(formData.name, formData.color);
    }

    setFormData({ name: "", color: "#3b82f6" });
    setEditingStage(null);
    setOpen(false);
  };

  const handleEdit = (stage: PostSaleStage) => {
    setEditingStage(stage.id);
    setFormData({ name: stage.name, color: stage.color });
    setOpen(true);
  };

  const handleDelete = async () => {
    if (deletingStage) {
      await deleteStage(deletingStage);
      setDeletingStage(null);
    }
  };

  const sortedStages = [...stages].sort((a, b) => a.position - b.position);

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <Settings className="h-4 w-4 mr-2" />
            Gerenciar Etapas
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Gerenciar Etapas do Funil de Pós-Venda</DialogTitle>
            <DialogDescription>
              Arraste para reordenar, edite ou exclua etapas do funil de pós-venda.
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center justify-between mb-2">
            <div className="text-xs text-muted-foreground">Arraste para reordenar</div>
          </div>

          <div className="space-y-4">
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={sortedStages.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {sortedStages.map((stage) => (
                    <SortableStageItem
                      key={stage.id}
                      stage={stage}
                      onEdit={() => handleEdit(stage)}
                      onDelete={() => setDeletingStage(stage.id)}
                      isFirstStage={stage.position === 0}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>

            <div className="border-t pt-4">
              <h4 className="text-sm font-medium mb-3">
                {editingStage ? "Editar Etapa" : "Nova Etapa"}
              </h4>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="stage-name">Nome da Etapa</Label>
                  <Input
                    id="stage-name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ex: Ativação"
                  />
                </div>
                <div>
                  <Label htmlFor="stage-color">Cor</Label>
                  <div className="flex gap-2">
                    <Input
                      id="stage-color"
                      type="color"
                      value={formData.color}
                      onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                      className="w-20 h-10"
                    />
                    <Input
                      value={formData.color}
                      onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                      placeholder="#3b82f6"
                      className="flex-1"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleSubmit} className="flex-1">
                    <Plus className="h-4 w-4 mr-2" />
                    {editingStage ? "Salvar Alterações" : "Adicionar Etapa"}
                  </Button>
                  {editingStage && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setEditingStage(null);
                        setFormData({ name: "", color: "#3b82f6" });
                      }}
                    >
                      Cancelar
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingStage} onOpenChange={() => setDeletingStage(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir esta etapa?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Os clientes desta etapa serão movidos para a primeira etapa disponível. 
              A primeira etapa não pode ser excluída.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

