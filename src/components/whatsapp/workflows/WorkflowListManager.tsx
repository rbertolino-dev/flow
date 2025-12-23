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
import { Plus, Trash2, Edit, Eye, Users, ArrowLeft } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

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
  const [view, setView] = useState<"main" | "create" | "edit" | "view">("main");
  const [selectedList, setSelectedList] = useState<WorkflowList | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [defaultInstance, setDefaultInstance] = useState<string | undefined>();
  const [selectedLeadId, setSelectedLeadId] = useState<string>("");
  const [manualName, setManualName] = useState("");
  const [manualPhone, setManualPhone] = useState("");
  const [contacts, setContacts] = useState<WorkflowListContact[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [searchContact, setSearchContact] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    if (!open) {
      resetForm();
      setView("main");
    }
  }, [open]);

  const resetForm = () => {
    setName("");
    setDescription("");
    setContacts([]);
    setDefaultInstance(undefined);
    setSelectedLeadId("");
    setManualName("");
    setManualPhone("");
    setSelectedList(null);
    setSearchContact("");
  };

  const selectedLead = useMemo(
    () => leadOptions.find((lead) => lead.id === selectedLeadId),
    [leadOptions, selectedLeadId],
  );

  const filteredContacts = useMemo(() => {
    if (!searchContact.trim()) return contacts;
    const search = searchContact.toLowerCase();
    return contacts.filter(
      (c) =>
        c.name?.toLowerCase().includes(search) ||
        c.phone.includes(search)
    );
  }, [contacts, searchContact]);

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
    if (!manualPhone || !manualPhone.trim()) {
      toast({
        title: "Telefone obrigatório",
        description: "Por favor, insira um número de telefone",
        variant: "destructive",
      });
      return;
    }
    
    const sanitizedPhone = manualPhone.replace(/\D/g, "");
    
    // Validação melhorada com feedback
    if (sanitizedPhone.length < 10) {
      toast({
        title: "Telefone inválido",
        description: "O telefone deve ter pelo menos 10 dígitos",
        variant: "destructive",
      });
      return;
    }
    
    // Verificar se já existe
    const exists = contacts.some((c) => {
      const existingPhone = c.phone.replace(/\D/g, "");
      return existingPhone === sanitizedPhone;
    });
    
    if (exists) {
      toast({
        title: "Contato já existe",
        description: "Este telefone já está na lista de contatos",
        variant: "destructive",
      });
      return;
    }
    
    // Adicionar contato
    const contactName = manualName?.trim() || sanitizedPhone;
    setContacts((prev) => [
      ...prev,
      {
        lead_id: null,
        phone: sanitizedPhone,
        name: contactName,
        variables: {},
      },
    ]);
    
    toast({
      title: "Contato adicionado",
      description: `${contactName} foi adicionado à lista`,
    });
    
    // Limpar campos
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
        id: selectedList?.id,
        name: name.trim(),
        description,
        default_instance_id: defaultInstance,
        contacts,
      });
      resetForm();
      setView("main");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (listId: string) => {
    if (!confirm("Tem certeza que deseja excluir esta lista?")) return;
    await onDeleteList(listId);
  };

  const handleEditList = (list: WorkflowList) => {
    setSelectedList(list);
    setName(list.name);
    setDescription(list.description || "");
    setDefaultInstance(list.default_instance_id || undefined);
    setContacts([...list.contacts]);
    setView("edit");
  };

  const handleViewList = (list: WorkflowList) => {
    setSelectedList(list);
    setView("view");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {view !== "main" && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  resetForm();
                  setView("main");
                }}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            {view === "main" && "Gerenciar Listas de Contatos"}
            {view === "create" && "Nova Lista"}
            {view === "edit" && "Editar Lista"}
            {view === "view" && "Visualizar Lista"}
          </DialogTitle>
        </DialogHeader>

        {/* VIEW MAIN - Lista de todas as listas */}
        {view === "main" && (
          <div className="space-y-4">
            <Button
              onClick={() => setView("create")}
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-2" />
              Criar Nova Lista
            </Button>

            <ScrollArea className="h-[500px]">
              {lists.length === 0 ? (
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-sm text-muted-foreground text-center">
                      Nenhuma lista cadastrada ainda.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {lists.map((list) => (
                    <Card key={list.id}>
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <CardTitle className="text-base">{list.name}</CardTitle>
                            <CardDescription className="text-xs mt-1">
                              {list.description || "Sem descrição"}
                            </CardDescription>
                          </div>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleViewList(list)}
                              title="Visualizar contatos"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEditList(list)}
                              title="Editar lista"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(list.id)}
                              title="Excluir lista"
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="pb-3">
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            <span>{list.contacts.length} contato(s)</span>
                          </div>
                          {list.default_instance_id && (
                            <Badge variant="outline" className="text-xs">
                              Instância padrão
                            </Badge>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        )}

        {/* VIEW CREATE/EDIT - Formulário */}
        {(view === "create" || view === "edit") && (
          <div className="space-y-4">
            <Input
              placeholder="Nome da lista"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <Textarea
              placeholder="Descrição (opcional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
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

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Adicionar Contatos</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Adicionar por Lead */}
                <div className="flex gap-2">
                  <Select
                    value={selectedLeadId}
                    onValueChange={setSelectedLeadId}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Escolher cliente do funil" />
                    </SelectTrigger>
                    <SelectContent>
                      {leadOptions.map((lead) => (
                        <SelectItem key={lead.id} value={lead.id}>
                          {lead.name} • {lead.phone}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleAddLead}
                    disabled={!selectedLeadId}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>

                {/* Adicionar Manual */}
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    placeholder="Telefone"
                    value={manualPhone}
                    onChange={(e) => setManualPhone(e.target.value)}
                  />
                  <Input
                    placeholder="Nome (opcional)"
                    value={manualName}
                    onChange={(e) => setManualName(e.target.value)}
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleAddManual}
                  disabled={!manualPhone}
                  className="w-full"
                >
                  Adicionar Contato Manual
                </Button>
              </CardContent>
            </Card>

            {/* Lista de Contatos */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">
                  Contatos ({contacts.length})
                </CardTitle>
                {contacts.length > 5 && (
                  <Input
                    placeholder="Buscar contato..."
                    value={searchContact}
                    onChange={(e) => setSearchContact(e.target.value)}
                    className="mt-2"
                  />
                )}
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[200px]">
                  {filteredContacts.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      {searchContact ? "Nenhum contato encontrado" : "Nenhum contato adicionado"}
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {filteredContacts.map((contact, index) => (
                        <div
                          key={`${contact.phone}-${index}`}
                          className="flex items-center justify-between rounded-md border px-3 py-2"
                        >
                          <div className="flex-1">
                            <p className="text-sm font-medium">{contact.name || contact.phone}</p>
                            <p className="text-xs text-muted-foreground">{contact.phone}</p>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveContact(contacts.indexOf(contact))}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  resetForm();
                  setView("main");
                }}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSave}
                disabled={!name.trim() || contacts.length === 0 || isSaving}
                className="flex-1"
              >
                {isSaving ? "Salvando..." : view === "edit" ? "Atualizar" : "Salvar"}
              </Button>
            </div>
          </div>
        )}

        {/* VIEW - Visualizar lista */}
        {view === "view" && selectedList && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>{selectedList.name}</CardTitle>
                <CardDescription>
                  {selectedList.description || "Sem descrição"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-1">
                    <Users className="h-4 w-4" />
                    <span>{selectedList.contacts.length} contato(s)</span>
                  </div>
                  {selectedList.default_instance_id && (
                    <Badge variant="outline">
                      Instância: {instances.find(i => i.id === selectedList.default_instance_id)?.instance_name}
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Contatos</CardTitle>
                {selectedList.contacts.length > 5 && (
                  <Input
                    placeholder="Buscar contato..."
                    value={searchContact}
                    onChange={(e) => setSearchContact(e.target.value)}
                    className="mt-2"
                  />
                )}
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[350px]">
                  <div className="space-y-2">
                    {selectedList.contacts
                      .filter(c => 
                        !searchContact || 
                        c.name?.toLowerCase().includes(searchContact.toLowerCase()) ||
                        c.phone.includes(searchContact)
                      )
                      .map((contact, index) => (
                        <div
                          key={`${contact.phone}-${index}`}
                          className="rounded-md border px-3 py-2"
                        >
                          <p className="text-sm font-medium">{contact.name || contact.phone}</p>
                          <p className="text-xs text-muted-foreground">{contact.phone}</p>
                          {contact.lead_id && (
                            <Badge variant="secondary" className="text-xs mt-1">
                              Cliente do funil
                            </Badge>
                          )}
                        </div>
                      ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setSearchContact("");
                  setView("main");
                }}
                className="flex-1"
              >
                Voltar
              </Button>
              <Button
                onClick={() => handleEditList(selectedList)}
                className="flex-1"
              >
                <Edit className="h-4 w-4 mr-2" />
                Editar Lista
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
