import { useState } from "react";
import { useTags } from "@/hooks/useTags";
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
import { Tag, Plus, Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

export function TagManager() {
  const { tags, createTag, updateTag, deleteTag } = useTags();
  const [open, setOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<string | null>(null);
  const [deletingTag, setDeletingTag] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: "", color: "#10b981" });

  const handleSubmit = async () => {
    if (!formData.name.trim()) return;

    if (editingTag) {
      await updateTag(editingTag, formData.name, formData.color);
    } else {
      await createTag(formData.name, formData.color);
    }

    setFormData({ name: "", color: "#10b981" });
    setEditingTag(null);
    setOpen(false);
  };

  const handleEdit = (tag: { id: string; name: string; color: string }) => {
    setEditingTag(tag.id);
    setFormData({ name: tag.name, color: tag.color });
    setOpen(true);
  };

  const handleDelete = async () => {
    if (deletingTag) {
      await deleteTag(deletingTag);
      setDeletingTag(null);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <Tag className="h-4 w-4 mr-2" />
            Gerenciar Etiquetas
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Gerenciar Etiquetas</DialogTitle>
            <DialogDescription>
              Crie, edite ou exclua etiquetas para organizar seus leads.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Lista de etiquetas existentes */}
            <div>
              <h4 className="text-sm font-medium mb-3">Etiquetas Existentes</h4>
              {tags.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma etiqueta criada ainda.</p>
              ) : (
                <div className="space-y-2">
                  {tags.map((tag) => (
                    <Card key={tag.id} className="p-3">
                      <div className="flex items-center gap-3">
                        <Badge
                          style={{
                            backgroundColor: `${tag.color}20`,
                            borderColor: tag.color,
                            color: tag.color,
                          }}
                          className="flex-shrink-0"
                        >
                          {tag.name}
                        </Badge>
                        <div className="ml-auto flex gap-2">
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(tag)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => setDeletingTag(tag.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            {/* Formulário para criar/editar */}
            <div className="border-t pt-4">
              <h4 className="text-sm font-medium mb-3">
                {editingTag ? "Editar Etiqueta" : "Nova Etiqueta"}
              </h4>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="tag-name">Nome da Etiqueta</Label>
                  <Input
                    id="tag-name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ex: Cliente VIP"
                  />
                </div>
                <div>
                  <Label htmlFor="tag-color">Cor</Label>
                  <div className="flex gap-2">
                    <Input
                      id="tag-color"
                      type="color"
                      value={formData.color}
                      onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                      className="w-20 h-10"
                    />
                    <Input
                      value={formData.color}
                      onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                      placeholder="#10b981"
                      className="flex-1"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleSubmit} className="flex-1">
                    <Plus className="h-4 w-4 mr-2" />
                    {editingTag ? "Salvar Alterações" : "Criar Etiqueta"}
                  </Button>
                  {editingTag && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setEditingTag(null);
                        setFormData({ name: "", color: "#10b981" });
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

      <AlertDialog open={!!deletingTag} onOpenChange={() => setDeletingTag(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir esta etiqueta?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A etiqueta será removida de todos os leads que a possuem.
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

