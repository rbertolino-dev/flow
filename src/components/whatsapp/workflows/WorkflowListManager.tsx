import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  WorkflowList,
  WorkflowListContact,
  LeadOption,
} from "@/types/workflows";
import { EvolutionConfig } from "@/hooks/useEvolutionConfigs";
import { Plus, Trash2 } from "lucide-react";

interface WorkflowListManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lists: WorkflowList[];
  leadOptions: LeadOption[];
  instances: EvolutionConfig[];
  onSaveList: (payload: {
    id?: string;
    name: string;
    description?: string;
    default_instance_id?: string;
    contacts: WorkflowListContact[];
  }) => Promise<any>;
  onDeleteList: (listId: string) => Promise<any>;
}

export function WorkflowListManager({
  open,
  onOpenChange,
  lists,
  leadOptions,
  instances,
  onSaveList,
  onDeleteList,
}: WorkflowListManagerProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [defaultInstance, setDefaultInstance] = useState<string | undefined>();
  const [selectedLeadId, setSelectedLeadId] = useState<string>("");
  const [manualName, setManualName] = useState("");
  const [manualPhone, setManualPhone] = useState("");
  const [contacts, setContacts] = useState<WorkflowListContact[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      setName("");
      setDescription("");
      setContacts([]);
      setDefaultInstance(undefined);
      setSelectedLeadId("");
      setManualName("");
      setManualPhone("");
    }
  }, [open]);

  const selectedLead = useMemo(
    () => leadOptions.find((lead) => lead.id === selectedLeadId),
    [leadOptions, selectedLeadId],
  );

  const handleAddLead = () => {
    if (!selectedLead) return;
    const exists = contacts.some((contact) => contact.lead_id === selectedLead.id);
    if (exists) return;
    setContacts((prev) => [
      ...prev,
      {
        lead_id: selectedLead.id,
        name: selectedLead.name,
        phone: selectedLead.phone,
        variables: {},
      },
    ]);
    setSelectedLeadId("");
  };

  const handleAddManual = () => {
    if (!manualPhone) return;
    const sanitizedPhone = manualPhone.replace(/\D/g, "");
    if (sanitizedPhone.length < 10) return;
    setContacts((prev) => [
      ...prev,
      {
        lead_id: null,
        phone: sanitizedPhone,
        name: manualName || sanitizedPhone,
        variables: {},
      },
    ]);
    setManualName("");
    setManualPhone("");
  };

  const handleRemoveContact = (index: number) => {
    setContacts((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSave = async () => {
    if (!name.trim() || contacts.length === 0) return;
    try {
      setIsSaving(true);
      await onSaveList({
        name: name.trim(),
        description,
        default_instance_id: defaultInstance,
        contacts,
      });
      onOpenChange(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (listId: string) => {
    await onDeleteList(listId);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Gerenciar listas de destinatários</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="create" className="mt-4">
          <TabsList className="grid grid-cols-2">
            <TabsTrigger value="create">Nova lista</TabsTrigger>
            <TabsTrigger value="existing">Listas existentes</TabsTrigger>
          </TabsList>

          <TabsContent value="create" className="mt-4 space-y-4">
            <Input
              placeholder="Nome da lista"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
            <Textarea
              placeholder="Descrição (opcional)"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />

            <Select
              value={defaultInstance}
              onValueChange={(value) => setDefaultInstance(value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Instância padrão (opcional)" />
              </SelectTrigger>
              <SelectContent>
                {instances.map((instance) => (
                  <SelectItem key={instance.id} value={instance.id}>
                    {instance.instance_name} {instance.is_connected ? "🟢" : "🔴"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="rounded-lg border p-3 space-y-3">
              <div className="flex flex-col gap-2 md:flex-row md:items-end">
                <div className="flex-1">
                  <label className="text-xs text-muted-foreground">
                    Adicionar cliente (lead)
                  </label>
                  <Select
                    value={selectedLeadId}
                    onValueChange={setSelectedLeadId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Escolha um cliente" />
                    </SelectTrigger>
                    <SelectContent>
                      {leadOptions.map((lead) => (
                        <SelectItem key={lead.id} value={lead.id}>
                          {lead.name} • {lead.phone}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  className="gap-2"
                  onClick={handleAddLead}
                >
                  <Plus className="h-4 w-4" />
                  Adicionar
                </Button>
              </div>

              <div className="grid gap-2 md:grid-cols-2">
                <div>
                  <label className="text-xs text-muted-foreground">
                    Contato manual (telefone)
                  </label>
                  <Input
                    placeholder="5511999999999"
                    value={manualPhone}
                    onChange={(event) => setManualPhone(event.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">
                    Nome (opcional)
                  </label>
                  <Input
                    placeholder="Nome do contato"
                    value={manualName}
                    onChange={(event) => setManualName(event.target.value)}
                  />
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={handleAddManual}
              >
                Registrar contato manual
              </Button>
            </div>

            <ScrollArea className="max-h-60 rounded-lg border p-3">
              {contacts.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhum contato adicionado ainda.
                </p>
              ) : (
                <div className="space-y-2">
                  {contacts.map((contact, index) => (
                    <div
                      key={`${contact.phone}-${index}`}
                      className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                    >
                      <div>
                        <p className="font-medium">{contact.name}</p>
                        <p className="text-xs text-muted-foreground">{contact.phone}</p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveContact(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>

            <Button
              onClick={handleSave}
              disabled={!name.trim() || contacts.length === 0 || isSaving}
              className="w-full"
            >
              Salvar lista
            </Button>
          </TabsContent>

          <TabsContent value="existing" className="mt-4">
            <ScrollArea className="max-h-80 space-y-2">
              {lists.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhuma lista cadastrada ainda.
                </p>
              ) : (
                lists.map((list) => (
                  <div
                    key={list.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div>
                      <p className="font-medium">{list.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {list.contacts.length} contato(s)
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {list.default_instance_id && (
                        <Badge variant="outline">Instância padrão</Badge>
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(list.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

