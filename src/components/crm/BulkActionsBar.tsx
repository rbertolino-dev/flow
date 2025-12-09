import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import {
  Move,
  Tag,
  Archive,
  Download,
  Trash2,
  X,
  CheckSquare,
  Square,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface BulkActionsBarProps {
  selectedIds: Set<string>;
  onClearSelection: () => void;
  onMoveToStage?: (leadIds: string[], stageId: string) => Promise<void>;
  onAddTag?: (leadIds: string[], tagId: string) => Promise<void>;
  onExport?: (leadIds: string[]) => Promise<void>;
  onArchive?: (leadIds: string[]) => Promise<void>;
  onDelete?: (leadIds: string[]) => Promise<void>;
  stages: Array<{ id: string; name: string }>;
  tags: Array<{ id: string; name: string }>;
  totalCount: number;
  onSelectAll?: () => void;
  onDeselectAll?: () => void;
}

export function BulkActionsBar({
  selectedIds,
  onClearSelection,
  onMoveToStage,
  onAddTag,
  onExport,
  onArchive,
  onDelete,
  stages,
  tags,
  totalCount,
  onSelectAll,
  onDeselectAll,
}: BulkActionsBarProps) {
  const { toast } = useToast();
  const [selectedStageId, setSelectedStageId] = useState<string>("");
  const [selectedTagId, setSelectedTagId] = useState<string>("");
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const selectedCount = selectedIds.size;
  const allSelected = selectedCount === totalCount && totalCount > 0;

  const handleMoveToStage = async () => {
    if (!selectedStageId || !onMoveToStage) return;
    setIsProcessing(true);
    try {
      await onMoveToStage(Array.from(selectedIds), selectedStageId);
      toast({
        title: "Sucesso",
        description: `${selectedCount} lead(s) movido(s) para a etapa selecionada`,
      });
      setSelectedStageId("");
      onClearSelection();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Erro ao mover leads",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAddTag = async () => {
    if (!selectedTagId || !onAddTag) return;
    setIsProcessing(true);
    try {
      await onAddTag(Array.from(selectedIds), selectedTagId);
      toast({
        title: "Sucesso",
        description: `Tag adicionada a ${selectedCount} lead(s)`,
      });
      setSelectedTagId("");
      onClearSelection();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Erro ao adicionar tag",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExport = async () => {
    if (!onExport) return;
    setIsProcessing(true);
    try {
      await onExport(Array.from(selectedIds));
      toast({
        title: "Sucesso",
        description: `${selectedCount} lead(s) exportado(s)`,
      });
      onClearSelection();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Erro ao exportar leads",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleArchive = async () => {
    if (!onArchive) return;
    setIsProcessing(true);
    try {
      await onArchive(Array.from(selectedIds));
      toast({
        title: "Sucesso",
        description: `${selectedCount} lead(s) arquivado(s)`,
      });
      onClearSelection();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Erro ao arquivar leads",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    setIsProcessing(true);
    try {
      await onDelete(Array.from(selectedIds));
      toast({
        title: "Sucesso",
        description: `${selectedCount} lead(s) excluído(s)`,
      });
      setShowDeleteDialog(false);
      onClearSelection();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Erro ao excluir leads",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  if (selectedCount === 0) return null;

  return (
    <>
      <div className="mb-4 p-3 bg-primary/10 border border-primary/20 rounded-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Badge variant="default" className="text-sm">
              {selectedCount} selecionado(s)
            </Badge>
            {onSelectAll && onDeselectAll && (
              <Button
                variant="ghost"
                size="sm"
                onClick={allSelected ? onDeselectAll : onSelectAll}
                className="h-8"
              >
                {allSelected ? (
                  <>
                    <CheckSquare className="h-4 w-4 mr-1" />
                    Desmarcar todos
                  </>
                ) : (
                  <>
                    <Square className="h-4 w-4 mr-1" />
                    Selecionar todos
                  </>
                )}
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {onMoveToStage && (
              <div className="flex items-center gap-2">
                <Select
                  value={selectedStageId}
                  onValueChange={setSelectedStageId}
                  disabled={isProcessing}
                >
                  <SelectTrigger className="w-[180px] h-8">
                    <SelectValue placeholder="Mover para etapa" />
                  </SelectTrigger>
                  <SelectContent>
                    {stages.map((stage) => (
                      <SelectItem key={stage.id} value={stage.id}>
                        {stage.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleMoveToStage}
                  disabled={!selectedStageId || isProcessing}
                  className="h-8"
                >
                  <Move className="h-4 w-4 mr-1" />
                  Mover
                </Button>
              </div>
            )}
            {onAddTag && (
              <div className="flex items-center gap-2">
                <Select
                  value={selectedTagId}
                  onValueChange={setSelectedTagId}
                  disabled={isProcessing}
                >
                  <SelectTrigger className="w-[150px] h-8">
                    <SelectValue placeholder="Adicionar tag" />
                  </SelectTrigger>
                  <SelectContent>
                    {tags.map((tag) => (
                      <SelectItem key={tag.id} value={tag.id}>
                        {tag.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleAddTag}
                  disabled={!selectedTagId || isProcessing}
                  className="h-8"
                >
                  <Tag className="h-4 w-4 mr-1" />
                  Adicionar
                </Button>
              </div>
            )}
            {onExport && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleExport}
                disabled={isProcessing}
                className="h-8"
              >
                <Download className="h-4 w-4 mr-1" />
                Exportar
              </Button>
            )}
            {onArchive && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleArchive}
                disabled={isProcessing}
                className="h-8"
              >
                <Archive className="h-4 w-4 mr-1" />
                Arquivar
              </Button>
            )}
            {onDelete && (
              <Button
                size="sm"
                variant="destructive"
                onClick={() => setShowDeleteDialog(true)}
                disabled={isProcessing}
                className="h-8"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Excluir
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={onClearSelection}
              disabled={isProcessing}
              className="h-8"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir {selectedCount} lead(s) selecionado(s)?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

