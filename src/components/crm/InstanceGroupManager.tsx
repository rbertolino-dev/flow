import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Edit2, Users } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface InstanceGroup {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  instance_ids: string[];
  created_at: string;
  updated_at: string;
}

interface InstanceGroupManagerProps {
  organizationId: string;
  instances: Array<{ id: string; instance_name: string }>;
  onGroupSelect?: (group: InstanceGroup) => void;
}

export function InstanceGroupManager({
  organizationId,
  instances,
  onGroupSelect,
}: InstanceGroupManagerProps) {
  const [groups, setGroups] = useState<InstanceGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<InstanceGroup | null>(null);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    selectedInstanceIds: [] as string[],
  });

  useEffect(() => {
    if (organizationId) {
      fetchGroups();
    }
  }, [organizationId]);

  const fetchGroups = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("instance_groups")
        .select("*")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setGroups(data || []);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar grupos",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast({
        title: "Nome obrigatório",
        description: "Por favor, informe um nome para o grupo",
        variant: "destructive",
      });
      return;
    }

    if (formData.selectedInstanceIds.length === 0) {
      toast({
        title: "Instâncias obrigatórias",
        description: "Selecione pelo menos uma instância",
        variant: "destructive",
      });
      return;
    }

    try {
      const groupData = {
        organization_id: organizationId,
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        instance_ids: formData.selectedInstanceIds,
      };

      if (editingGroup) {
        const { error } = await supabase
          .from("instance_groups")
          .update(groupData)
          .eq("id", editingGroup.id);

        if (error) throw error;

        toast({
          title: "Grupo atualizado!",
          description: `O grupo "${formData.name}" foi atualizado com sucesso`,
        });
      } else {
        const { error } = await supabase
          .from("instance_groups")
          .insert(groupData);

        if (error) throw error;

        toast({
          title: "Grupo criado!",
          description: `O grupo "${formData.name}" foi criado com sucesso`,
        });
      }

      setDialogOpen(false);
      resetForm();
      fetchGroups();
    } catch (error: any) {
      toast({
        title: "Erro ao salvar grupo",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este grupo de instâncias?")) {
      return;
    }

    try {
      const { error } = await supabase
        .from("instance_groups")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Grupo excluído",
        description: "O grupo de instâncias foi excluído com sucesso",
      });

      fetchGroups();
    } catch (error: any) {
      toast({
        title: "Erro ao excluir grupo",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleEdit = (group: InstanceGroup) => {
    setEditingGroup(group);
    setFormData({
      name: group.name,
      description: group.description || "",
      selectedInstanceIds: group.instance_ids || [],
    });
    setDialogOpen(true);
  };

  const resetForm = () => {
    setEditingGroup(null);
    setFormData({
      name: "",
      description: "",
      selectedInstanceIds: [],
    });
  };

  const toggleInstance = (instanceId: string) => {
    setFormData((prev) => ({
      ...prev,
      selectedInstanceIds: prev.selectedInstanceIds.includes(instanceId)
        ? prev.selectedInstanceIds.filter((id) => id !== instanceId)
        : [...prev.selectedInstanceIds, instanceId],
    }));
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Users className="h-5 w-5" />
            Grupos de Instâncias
          </CardTitle>
          <Dialog
            open={dialogOpen}
            onOpenChange={(open) => {
              setDialogOpen(open);
              if (!open) resetForm();
            }}
          >
            <DialogTrigger asChild>
              <Button size="sm" onClick={() => resetForm()}>
                <Plus className="h-4 w-4 mr-2" />
                Novo Grupo
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingGroup ? "Editar Grupo" : "Novo Grupo de Instâncias"}
                </DialogTitle>
                <DialogDescription>
                  Agrupe instâncias para facilitar a seleção em campanhas
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome do Grupo *</Label>
                  <Input
                    id="name"
                    placeholder="Ex: Equipe Vendas, Instâncias Produção"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Descrição (opcional)</Label>
                  <Textarea
                    id="description"
                    placeholder="Descreva o propósito deste grupo..."
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Selecionar Instâncias *</Label>
                  <div className="grid gap-2 p-3 border rounded-lg bg-muted/5 max-h-64 overflow-y-auto">
                    {instances.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        Nenhuma instância disponível
                      </p>
                    ) : (
                      instances.map((instance) => (
                        <label
                          key={instance.id}
                          className="flex items-center gap-3 p-2 hover:bg-accent rounded-md cursor-pointer transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={formData.selectedInstanceIds.includes(
                              instance.id
                            )}
                            onChange={() => toggleInstance(instance.id)}
                            className="h-4 w-4"
                          />
                          <span className="text-sm flex-1">
                            {instance.instance_name}
                          </span>
                        </label>
                      ))
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {formData.selectedInstanceIds.length === 0
                      ? "Selecione pelo menos uma instância"
                      : `${formData.selectedInstanceIds.length} instância(s) selecionada(s)`}
                  </p>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleSave}>Salvar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">
            Carregando...
          </div>
        ) : groups.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Nenhum grupo criado. Crie um grupo para facilitar a seleção de
            instâncias em campanhas.
          </div>
        ) : (
          <div className="space-y-3">
            {groups.map((group) => {
              const groupInstances = instances.filter((inst) =>
                group.instance_ids.includes(inst.id)
              );

              return (
                <Card key={group.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-semibold">{group.name}</h3>
                          <Badge variant="outline">
                            {groupInstances.length} instância(s)
                          </Badge>
                        </div>
                        {group.description && (
                          <p className="text-sm text-muted-foreground mb-2">
                            {group.description}
                          </p>
                        )}
                        <div className="flex flex-wrap gap-2">
                          {groupInstances.map((instance) => (
                            <Badge
                              key={instance.id}
                              variant="secondary"
                              className="text-xs"
                            >
                              {instance.instance_name}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {onGroupSelect && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onGroupSelect(group)}
                          >
                            Usar
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(group)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDelete(group.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

