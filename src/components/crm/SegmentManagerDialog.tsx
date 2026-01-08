import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useActiveOrganization } from "@/hooks/useActiveOrganization";
import { Plus, Edit2, Trash2 } from "lucide-react";
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

interface SegmentManagerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate?: () => void;
}

const DEFAULT_SEGMENTS = [
  "Monitoramento e alarmes",
  "Assistência técnica - Brasil",
  "Provedor - Brasil",
  "LATAM CAPPI - Provedor",
];

export function SegmentManagerDialog({
  open,
  onOpenChange,
  onUpdate,
}: SegmentManagerDialogProps) {
  const { toast } = useToast();
  const { activeOrgId } = useActiveOrganization();
  const [loading, setLoading] = useState(false);
  const [segments, setSegments] = useState<string[]>([]);
  const [newSegmentName, setNewSegmentName] = useState("");
  const [editingSegment, setEditingSegment] = useState<string | null>(null);
  const [editSegmentName, setEditSegmentName] = useState("");
  const [deletingSegment, setDeletingSegment] = useState<string | null>(null);

  // Carregar segmentos existentes
  useEffect(() => {
    if (open && activeOrgId) {
      fetchSegments();
    }
  }, [open, activeOrgId]);

  const fetchSegments = async () => {
    try {
      const { data, error } = await supabase
        .from("evolution_config")
        .select("segment")
        .eq("organization_id", activeOrgId)
        .not("segment", "is", null);

      if (error) throw error;

      // Coletar segmentos únicos
      const uniqueSegments = new Set<string>();
      data?.forEach((item) => {
        if (item.segment) {
          uniqueSegments.add(item.segment);
        }
      });

      // Adicionar segmentos padrão que não estão no banco
      DEFAULT_SEGMENTS.forEach((seg) => uniqueSegments.add(seg));

      setSegments(Array.from(uniqueSegments).sort());
    } catch (error: any) {
      console.error("Erro ao buscar segmentos:", error);
      // Em caso de erro, usar apenas os padrões
      setSegments([...DEFAULT_SEGMENTS]);
    }
  };

  const handleCreateSegment = async () => {
    if (!newSegmentName.trim()) {
      toast({
        title: "Nome obrigatório",
        description: "Digite um nome para o segmento",
        variant: "destructive",
      });
      return;
    }

    if (segments.includes(newSegmentName.trim())) {
      toast({
        title: "Segmento já existe",
        description: "Este segmento já está cadastrado",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // Adicionar à lista local (não precisa salvar no banco, pois segmentos são apenas strings)
      setSegments((prev) => [...prev, newSegmentName.trim()].sort());
      setNewSegmentName("");
      toast({
        title: "✅ Sucesso",
        description: "Segmento criado com sucesso",
      });
      if (onUpdate) {
        onUpdate();
      }
    } catch (error: any) {
      console.error("Erro ao criar segmento:", error);
      toast({
        title: "Erro",
        description: error.message || "Não foi possível criar o segmento",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleStartEdit = (segment: string) => {
    setEditingSegment(segment);
    setEditSegmentName(segment);
  };

  const handleSaveEdit = async () => {
    if (!editSegmentName.trim()) {
      toast({
        title: "Nome obrigatório",
        description: "Digite um nome para o segmento",
        variant: "destructive",
      });
      return;
    }

    if (editSegmentName.trim() !== editingSegment && segments.includes(editSegmentName.trim())) {
      toast({
        title: "Segmento já existe",
        description: "Este segmento já está cadastrado",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const oldName = editingSegment!;
      const newName = editSegmentName.trim();

      // Atualizar no banco de dados
      if (activeOrgId) {
        const { error } = await supabase
          .from("evolution_config")
          .update({ segment: newName })
          .eq("organization_id", activeOrgId)
          .eq("segment", oldName);

        if (error) throw error;
      }

      // Atualizar lista local
      setSegments((prev) =>
        prev.map((s) => (s === oldName ? newName : s)).sort()
      );
      setEditingSegment(null);
      setEditSegmentName("");

      toast({
        title: "✅ Sucesso",
        description: "Segmento atualizado com sucesso",
      });
      if (onUpdate) {
        onUpdate();
      }
    } catch (error: any) {
      console.error("Erro ao editar segmento:", error);
      toast({
        title: "Erro",
        description: error.message || "Não foi possível editar o segmento",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSegment = async () => {
    if (!deletingSegment || !activeOrgId) return;

    setLoading(true);
    try {
      // Verificar se há instâncias usando este segmento
      const { data: instances, error: checkError } = await supabase
        .from("evolution_config")
        .select("id")
        .eq("organization_id", activeOrgId)
        .eq("segment", deletingSegment)
        .limit(1);

      if (checkError) throw checkError;

      if (instances && instances.length > 0) {
        // Remover segmento das instâncias
        const { error: updateError } = await supabase
          .from("evolution_config")
          .update({ segment: null })
          .eq("organization_id", activeOrgId)
          .eq("segment", deletingSegment);

        if (updateError) throw updateError;
      }

      // Remover da lista local (não remover se for padrão)
      if (!DEFAULT_SEGMENTS.includes(deletingSegment)) {
        setSegments((prev) => prev.filter((s) => s !== deletingSegment));
      }

      setDeletingSegment(null);
      toast({
        title: "✅ Sucesso",
        description: "Segmento removido com sucesso",
      });
      if (onUpdate) {
        onUpdate();
      }
    } catch (error: any) {
      console.error("Erro ao deletar segmento:", error);
      toast({
        title: "Erro",
        description: error.message || "Não foi possível deletar o segmento",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">
              Gerenciar Segmentos
            </DialogTitle>
            <DialogDescription>
              Crie, edite ou remova segmentos para organizar suas instâncias
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            {/* Criar Novo Segmento */}
            <div className="space-y-2 p-4 border rounded-lg bg-muted/50">
              <Label htmlFor="new-segment">Criar Novo Segmento</Label>
              <div className="flex gap-2">
                <Input
                  id="new-segment"
                  value={newSegmentName}
                  onChange={(e) => setNewSegmentName(e.target.value)}
                  placeholder="Digite o nome do segmento..."
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleCreateSegment();
                    }
                  }}
                />
                <Button onClick={handleCreateSegment} disabled={loading}>
                  <Plus className="h-4 w-4 mr-2" />
                  Criar
                </Button>
              </div>
            </div>

            {/* Lista de Segmentos */}
            <div className="space-y-2">
              <Label>Segmentos Existentes ({segments.length})</Label>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {segments.map((segment) => (
                  <div
                    key={segment}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    {editingSegment === segment ? (
                      <div className="flex items-center gap-2 flex-1">
                        <Input
                          value={editSegmentName}
                          onChange={(e) => setEditSegmentName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleSaveEdit();
                            } else if (e.key === "Escape") {
                              setEditingSegment(null);
                              setEditSegmentName("");
                            }
                          }}
                          className="flex-1"
                          autoFocus
                        />
                        <Button
                          size="sm"
                          onClick={handleSaveEdit}
                          disabled={loading}
                        >
                          Salvar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditingSegment(null);
                            setEditSegmentName("");
                          }}
                        >
                          Cancelar
                        </Button>
                      </div>
                    ) : (
                      <>
                        <span className="font-medium flex-1">{segment}</span>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleStartEdit(segment)}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          {!DEFAULT_SEGMENTS.includes(segment) && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setDeletingSegment(segment)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Botões de Ação */}
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Fechar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog de Confirmação de Exclusão */}
      <AlertDialog
        open={deletingSegment !== null}
        onOpenChange={(open) => !open && setDeletingSegment(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover o segmento "{deletingSegment}"?
              Todas as instâncias que usam este segmento terão o segmento removido.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSegment}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

