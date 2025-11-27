import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useWorkflowLists } from "@/hooks/useWorkflowLists";
import { Plus, List, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Lead } from "@/types/lead";

interface AddLeadToListDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: Lead;
}

export function AddLeadToListDialog({
  open,
  onOpenChange,
  lead,
}: AddLeadToListDialogProps) {
  const { lists, saveList, refetch } = useWorkflowLists();
  const { toast } = useToast();
  const [newListName, setNewListName] = useState("");
  const [isCreatingList, setIsCreatingList] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Identificar listas que já contêm este lead
  const leadLists = useMemo(() => {
    return lists.filter((list) =>
      list.contacts.some(
        (c) => c.lead_id === lead.id || c.phone === lead.phone
      )
    );
  }, [lists, lead.id, lead.phone]);

  const isLeadInList = (listId: string) => {
    return leadLists.some((l) => l.id === listId);
  };

  const handleCreateList = async () => {
    if (!newListName.trim()) {
      toast({
        title: "Nome obrigatório",
        description: "Digite um nome para a nova lista",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      await saveList({
        name: newListName.trim(),
        contacts: [
          {
            lead_id: lead.id,
            phone: lead.phone,
            name: lead.name,
            variables: {},
          },
        ],
      });

      toast({
        title: "Lista criada",
        description: `Lista "${newListName}" criada com ${lead.name}`,
      });

      setNewListName("");
      setIsCreatingList(false);
      await refetch();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Erro ao criar lista",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddToExistingList = async (listId: string) => {
    setIsSaving(true);
    try {
      const list = lists.find((l) => l.id === listId);
      if (!list) throw new Error("Lista não encontrada");

      // Verificar se o lead já está na lista
      const leadExists = list.contacts.some(
        (c) => c.lead_id === lead.id || c.phone === lead.phone
      );

      if (leadExists) {
        toast({
          title: "Lead já está na lista",
          description: `${lead.name} já está em "${list.name}"`,
          variant: "destructive",
        });
        return;
      }

      // Adicionar lead à lista existente
      const updatedContacts = [
        ...list.contacts,
        {
          lead_id: lead.id,
          phone: lead.phone,
          name: lead.name,
          variables: {},
        },
      ];

      await saveList({
        id: listId,
        name: list.name,
        description: list.description || undefined,
        default_instance_id: list.default_instance_id || undefined,
        contacts: updatedContacts,
      });

      toast({
        title: "Lead adicionado",
        description: `${lead.name} adicionado à lista "${list.name}"`,
      });

      await refetch();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Erro ao adicionar à lista",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Adicionar "{lead.name}" a uma lista</DialogTitle>
        </DialogHeader>

        {!isCreatingList ? (
          <div className="space-y-4">
            <Button
              onClick={() => setIsCreatingList(true)}
              variant="outline"
              className="w-full gap-2"
            >
              <Plus className="h-4 w-4" />
              Criar nova lista
            </Button>

            <div>
              <Label className="text-sm text-muted-foreground">
                Ou adicionar a uma lista existente:
              </Label>
              <ScrollArea className="mt-2 max-h-60">
                {lists.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nenhuma lista disponível
                  </p>
                ) : (
                  <div className="space-y-2">
                    {lists.map((list) => {
                      const isInList = isLeadInList(list.id);
                      return (
                        <Button
                          key={list.id}
                          onClick={() => handleAddToExistingList(list.id)}
                          variant={isInList ? "secondary" : "outline"}
                          className="w-full justify-start gap-2"
                          disabled={isSaving || isInList}
                        >
                          {isInList ? (
                            <Check className="h-4 w-4 text-green-600" />
                          ) : (
                            <List className="h-4 w-4" />
                          )}
                          <div className="flex-1 text-left">
                            <div className="flex items-center gap-2">
                              <p className="font-medium">{list.name}</p>
                              {isInList && (
                                <Badge variant="secondary" className="text-xs">
                                  Já está na lista
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {list.contacts.length} contato(s)
                            </p>
                          </div>
                        </Button>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <Label>Nome da nova lista</Label>
              <Input
                placeholder="Ex: Clientes VIP"
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !isSaving) {
                    handleCreateList();
                  }
                }}
              />
            </div>

            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setIsCreatingList(false);
                  setNewListName("");
                }}
                disabled={isSaving}
              >
                Voltar
              </Button>
              <Button onClick={handleCreateList} disabled={isSaving}>
                {isSaving ? "Criando..." : "Criar lista"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
