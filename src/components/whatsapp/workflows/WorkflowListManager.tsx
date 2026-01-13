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
import { Plus, Trash2, Edit, Eye, Users, ArrowLeft, Edit2, Upload, FileText, Download } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import { parseCSVFile, generateCSVTemplate, type ParsedCSVContact } from "@/lib/csvParser";
import { broadcastLogger } from "@/lib/broadcastLogger";

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
  
  // Estados para edição completa do contato
  const [showEditContactDialog, setShowEditContactDialog] = useState(false);
  const [editingContactLeadId, setEditingContactLeadId] = useState<string | null>(null);
  const [editingContactName, setEditingContactName] = useState<string>("");
  const [editingContactPhone, setEditingContactPhone] = useState<string>("");
  const [editingContactEmail, setEditingContactEmail] = useState<string>("");
  const [editingContactCompany, setEditingContactCompany] = useState<string>("");
  const [editingContactCpfCnpj, setEditingContactCpfCnpj] = useState<string>("");
  const [editingContactNotes, setEditingContactNotes] = useState<string>("");
  
  // Estados para upload CSV
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvParseResult, setCsvParseResult] = useState<{
    contacts: ParsedCSVContact[];
    columns: string[];
    errors: string[];
  } | null>(null);
  const [isProcessingCSV, setIsProcessingCSV] = useState(false);

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
    setCsvFile(null);
    setCsvParseResult(null);
  };
  
  const handleProcessCSV = async (file: File) => {
    setIsProcessingCSV(true);
    try {
      const text = await file.text();
      const result = parseCSVFile(text, { hasHeader: true });
      setCsvParseResult(result);
      
      if (result.errors.length > 0) {
        toast({
          title: "CSV processado com avisos",
          description: `${result.contacts.length} contato(s) válido(s), ${result.errors.length} erro(s) encontrado(s)`,
          variant: "default",
        });
      } else {
        toast({
          title: "CSV processado com sucesso!",
          description: `${result.contacts.length} contato(s) encontrado(s)`,
        });
      }
    } catch (error: any) {
      toast({
        title: "Erro ao processar CSV",
        description: error.message || "Erro desconhecido",
        variant: "destructive",
      });
      setCsvParseResult(null);
    } finally {
      setIsProcessingCSV(false);
    }
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
              <CardContent>
                <Tabs defaultValue="manual" className="w-full">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="manual">Manual</TabsTrigger>
                    <TabsTrigger value="csv">Upload CSV</TabsTrigger>
                    <TabsTrigger value="lead">Do Funil</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="manual" className="space-y-3 mt-4">
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
                      <Plus className="h-4 w-4 mr-2" />
                      Adicionar Contato Manual
                    </Button>
                  </TabsContent>
                  
                  <TabsContent value="csv" className="space-y-3 mt-4">
                    <div className="space-y-2">
                      <Label>Upload de Arquivo CSV</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="file"
                          accept=".csv"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              setCsvFile(file);
                              handleProcessCSV(file);
                            }
                          }}
                          className="flex-1"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const template = generateCSVTemplate();
                            const blob = new Blob([template], { type: 'text/csv' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = 'template_lista_contatos.csv';
                            a.click();
                            URL.revokeObjectURL(url);
                          }}
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Template
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Formato: telefone, nome, empresa, nome_empresa, email, etc.
                      </p>
                    </div>
                    
                    {isProcessingCSV && (
                      <div className="text-sm text-muted-foreground">
                        Processando CSV...
                      </div>
                    )}
                    
                    {csvParseResult && (
                      <div className="space-y-2">
                        {csvParseResult.errors.length > 0 && (
                          <div className="p-3 bg-destructive/10 border border-destructive/20 rounded text-sm">
                            <p className="font-medium text-destructive mb-1">Erros encontrados:</p>
                            <ul className="list-disc list-inside space-y-1">
                              {csvParseResult.errors.slice(0, 5).map((error, i) => (
                                <li key={i} className="text-xs">{error}</li>
                              ))}
                              {csvParseResult.errors.length > 5 && (
                                <li className="text-xs">... e mais {csvParseResult.errors.length - 5} erro(s)</li>
                              )}
                            </ul>
                          </div>
                        )}
                        <div className="p-3 bg-muted rounded text-sm">
                          <p className="font-medium mb-1">
                            ✅ {csvParseResult.contacts.length} contato(s) processado(s)
                          </p>
                          {csvParseResult.columns.length > 0 && (
                            <p className="text-xs text-muted-foreground">
                              Colunas detectadas: {csvParseResult.columns.join(', ')}
                            </p>
                          )}
                        </div>
                        <Button
                          type="button"
                          onClick={() => {
                            const workflowContacts: WorkflowListContact[] = csvParseResult.contacts.map(contact => {
                              // Extrair campos customizados (todos exceto os campos padrão)
                              const customFields: Record<string, string> = {};
                              Object.entries(contact).forEach(([key, value]) => {
                                if (!['phone', 'name', 'empresa', 'nome_empresa', 'email', 'cpf', 'cnpj'].includes(key) && value) {
                                  customFields[key] = String(value);
                                }
                              });

                              return {
                                phone: contact.phone,
                                name: contact.name,
                                lead_id: undefined,
                                empresa: contact.empresa || null,
                                nome_empresa: contact.nome_empresa || null,
                                email: contact.email || null,
                                cpf: contact.cpf || null,
                                cnpj: contact.cnpj || null,
                                custom_fields: Object.keys(customFields).length > 0 ? customFields : null,
                              };
                            });
                            setContacts([...contacts, ...workflowContacts]);
                            setCsvFile(null);
                            setCsvParseResult(null);
                            toast({
                              title: "Contatos adicionados!",
                              description: `${workflowContacts.length} contato(s) do CSV foram adicionados à lista`,
                            });
                          }}
                          className="w-full"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Adicionar {csvParseResult.contacts.length} Contato(s) à Lista
                        </Button>
                      </div>
                    )}
                  </TabsContent>
                  
                  <TabsContent value="lead" className="space-y-3 mt-4">
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
                  </TabsContent>
                </Tabs>
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
                            {contact.lead_id && (
                              <Badge variant="secondary" className="text-xs mt-1">
                                Cliente do funil
                              </Badge>
                            )}
                          </div>
                          <div className="flex gap-1">
                            {contact.lead_id && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={async () => {
                                  try {
                                    // Buscar dados completos do lead
                                    const { data: leadData, error } = await supabase
                                      .from("leads")
                                      .select("id, name, phone, email, company, cpf_cnpj, notes")
                                      .eq("id", contact.lead_id)
                                      .maybeSingle();
                                    
                                    if (error) {
                                      console.error("Erro ao buscar lead:", error);
                                      toast({
                                        title: "Erro ao carregar dados",
                                        description: error.message || "Não foi possível carregar os dados do cliente.",
                                        variant: "destructive",
                                      });
                                      return;
                                    }
                                    
                                    if (leadData) {
                                      setEditingContactLeadId(leadData.id);
                                      setEditingContactName(leadData.name || "");
                                      setEditingContactPhone(leadData.phone || "");
                                      setEditingContactEmail(leadData.email || "");
                                      setEditingContactCompany(leadData.company || "");
                                      setEditingContactCpfCnpj(leadData.cpf_cnpj || "");
                                      setEditingContactNotes(leadData.notes || "");
                                      setShowEditContactDialog(true);
                                    } else {
                                      toast({
                                        title: "Cliente não encontrado",
                                        description: "Não foi possível encontrar os dados do cliente.",
                                        variant: "destructive",
                                      });
                                    }
                                  } catch (error: any) {
                                    console.error("Erro ao buscar lead:", error);
                                    toast({
                                      title: "Erro ao carregar dados",
                                      description: error.message || "Não foi possível carregar os dados do cliente.",
                                      variant: "destructive",
                                    });
                                  }
                                }}
                                title="Editar CPF/CNPJ"
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRemoveContact(contacts.indexOf(contact))}
                              title="Remover contato"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
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
                          className="flex items-center justify-between rounded-md border px-3 py-2"
                        >
                          <div className="flex-1">
                            <p className="text-sm font-medium">{contact.name || contact.phone}</p>
                            <p className="text-xs text-muted-foreground">{contact.phone}</p>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {contact.lead_id && (
                                <Badge variant="secondary" className="text-xs">
                                  Cliente do funil
                                </Badge>
                              )}
                              {contact.empresa && (
                                <Badge variant="outline" className="text-xs">
                                  Empresa: {contact.empresa}
                                </Badge>
                              )}
                              {contact.email && (
                                <Badge variant="outline" className="text-xs">
                                  Email
                                </Badge>
                              )}
                              {(contact.cpf || contact.cnpj) && (
                                <Badge variant="outline" className="text-xs">
                                  CPF/CNPJ
                                </Badge>
                              )}
                              {contact.custom_fields && Object.keys(contact.custom_fields).length > 0 && (
                                <Badge variant="outline" className="text-xs">
                                  {Object.keys(contact.custom_fields).length} campo(s) customizado(s)
                                </Badge>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-1 ml-2">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={async () => {
                                try {
                                  if (contact.lead_id) {
                                    // Buscar dados completos do lead
                                    const { data: leadData, error } = await supabase
                                      .from("leads")
                                      .select("id, name, phone, email, company, cpf_cnpj, notes")
                                      .eq("id", contact.lead_id)
                                      .maybeSingle();
                                    
                                    if (error) {
                                      broadcastLogger.logContactView('load', {
                                        contactId: contact.lead_id,
                                        leadId: contact.lead_id,
                                        phone: contact.phone,
                                        success: false,
                                        hasLeadData: false,
                                        error,
                                      });
                                      toast({
                                        title: "Erro ao carregar dados",
                                        description: error.message || "Não foi possível carregar os dados do cliente.",
                                        variant: "destructive",
                                      });
                                      return;
                                    }
                                    
                                    if (leadData) {
                                      broadcastLogger.logContactView('load', {
                                        contactId: contact.lead_id,
                                        leadId: contact.lead_id,
                                        phone: contact.phone,
                                        success: true,
                                        hasLeadData: true,
                                      });
                                      setEditingContactLeadId(leadData.id);
                                      setEditingContactName(leadData.name || "");
                                      setEditingContactPhone(leadData.phone || "");
                                      setEditingContactEmail(leadData.email || "");
                                      setEditingContactCompany(leadData.company || "");
                                      setEditingContactCpfCnpj(leadData.cpf_cnpj || "");
                                      setEditingContactNotes(leadData.notes || "");
                                      setShowEditContactDialog(true);
                                    } else {
                                      broadcastLogger.logContactView('load', {
                                        contactId: contact.lead_id,
                                        leadId: contact.lead_id,
                                        phone: contact.phone,
                                        success: false,
                                        hasLeadData: false,
                                        error: new Error('Lead não encontrado'),
                                      });
                                      toast({
                                        title: "Cliente não encontrado",
                                        description: "Não foi possível encontrar os dados do cliente.",
                                        variant: "destructive",
                                      });
                                    }
                                  } else {
                                    // Mostrar dados do contato (mesmo sem lead_id)
                                    const contactData = {
                                      name: contact.name || contact.phone,
                                      phone: contact.phone,
                                      email: contact.email ?? "Não informado",
                                      empresa: contact.empresa ?? "Não informado",
                                      nome_empresa: contact.nome_empresa ?? "Não informado",
                                      cpf: contact.cpf ?? "Não informado",
                                      cnpj: contact.cnpj ?? "Não informado",
                                      custom_fields: contact.custom_fields || {},
                                    };
                                    
                                    broadcastLogger.logContactView('view', {
                                      phone: contact.phone,
                                      success: true,
                                      hasLeadData: false,
                                    });
                                    
                                    // Criar mensagem com todos os dados
                                    const dataLines = [
                                      `Nome: ${contactData.name}`,
                                      `Telefone: ${contactData.phone}`,
                                      contactData.email !== "Não informado" ? `Email: ${contactData.email}` : null,
                                      contactData.empresa !== "Não informado" ? `Empresa: ${contactData.empresa}` : null,
                                      contactData.nome_empresa !== "Não informado" ? `Nome da Empresa: ${contactData.nome_empresa}` : null,
                                      contactData.cpf !== "Não informado" ? `CPF: ${contactData.cpf}` : null,
                                      contactData.cnpj !== "Não informado" ? `CNPJ: ${contactData.cnpj}` : null,
                                    ].filter(Boolean);
                                    
                                    const customFieldsText = contact.custom_fields && Object.keys(contact.custom_fields).length > 0
                                      ? '\n\nCampos customizados:\n' + Object.entries(contact.custom_fields)
                                          .map(([key, value]) => `${key}: ${value}`)
                                          .join('\n')
                                      : '';
                                    
                                    toast({
                                      title: "Dados do contato",
                                      description: (
                                        <div className="space-y-1 text-xs whitespace-pre-line">
                                          {dataLines.join('\n')}
                                          {customFieldsText}
                                        </div>
                                      ),
                                      duration: 10000,
                                    });
                                  }
                                } catch (error: any) {
                                  broadcastLogger.logContactView('view', {
                                    phone: contact.phone,
                                    success: false,
                                    hasLeadData: false,
                                    error,
                                  });
                                  toast({
                                    title: "Erro ao carregar dados",
                                    description: error.message || "Não foi possível carregar os dados.",
                                    variant: "destructive",
                                  });
                                }
                              }}
                              title="Ver dados do contato"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </div>
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

      {/* Dialog para editar informações completas do contato */}
      <Dialog open={showEditContactDialog} onOpenChange={setShowEditContactDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit2 className="h-5 w-5" />
              Editar Informações do Contato
            </DialogTitle>
            <p className="text-sm text-muted-foreground">
              Edite todas as informações do contato da lista
            </p>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="edit-contact-name">Nome *</Label>
              <Input
                id="edit-contact-name"
                placeholder="Nome completo"
                value={editingContactName}
                onChange={(e) => setEditingContactName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-contact-phone">Telefone *</Label>
              <Input
                id="edit-contact-phone"
                placeholder="(00) 00000-0000"
                value={editingContactPhone}
                onChange={(e) => {
                  // Remover caracteres não numéricos
                  const value = e.target.value.replace(/\D/g, "");
                  setEditingContactPhone(value);
                }}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-contact-email">Email</Label>
              <Input
                id="edit-contact-email"
                type="email"
                placeholder="email@exemplo.com"
                value={editingContactEmail}
                onChange={(e) => setEditingContactEmail(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-contact-company">Empresa</Label>
              <Input
                id="edit-contact-company"
                placeholder="Nome da empresa"
                value={editingContactCompany}
                onChange={(e) => setEditingContactCompany(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="edit-contact-cpf-cnpj">CPF/CNPJ</Label>
              <Input
                id="edit-contact-cpf-cnpj"
                placeholder="Digite o CPF ou CNPJ (apenas números)"
                value={editingContactCpfCnpj}
                onChange={(e) => {
                  // Remover caracteres não numéricos
                  const value = e.target.value.replace(/\D/g, "");
                  setEditingContactCpfCnpj(value);
                }}
                maxLength={18}
              />
              <p className="text-xs text-muted-foreground">
                CPF: 11 dígitos | CNPJ: 14 dígitos
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-contact-notes">Observações</Label>
              <Textarea
                id="edit-contact-notes"
                placeholder="Observações sobre o contato..."
                rows={3}
                value={editingContactNotes}
                onChange={(e) => setEditingContactNotes(e.target.value)}
              />
            </div>
          </div>

          <div className="flex gap-2 justify-end mt-6">
            <Button
              variant="outline"
              onClick={() => {
                setShowEditContactDialog(false);
                setEditingContactLeadId(null);
                setEditingContactName("");
                setEditingContactPhone("");
                setEditingContactEmail("");
                setEditingContactCompany("");
                setEditingContactCpfCnpj("");
                setEditingContactNotes("");
              }}
            >
              Cancelar
            </Button>
            <Button
              onClick={async () => {
                if (!editingContactLeadId) return;

                // Validações
                if (!editingContactName.trim()) {
                  toast({
                    title: "Nome obrigatório",
                    description: "O nome do cliente é obrigatório.",
                    variant: "destructive",
                  });
                  return;
                }

                if (!editingContactPhone.trim()) {
                  toast({
                    title: "Telefone obrigatório",
                    description: "O telefone do cliente é obrigatório.",
                    variant: "destructive",
                  });
                  return;
                }

                // Validar formato (CPF: 11 dígitos, CNPJ: 14 dígitos)
                if (editingContactCpfCnpj && editingContactCpfCnpj.length !== 11 && editingContactCpfCnpj.length !== 14) {
                  toast({
                    title: "CPF/CNPJ inválido",
                    description: "CPF deve ter 11 dígitos e CNPJ deve ter 14 dígitos.",
                    variant: "destructive",
                  });
                  return;
                }

                try {
                  const updates: any = {
                    name: editingContactName.trim(),
                    phone: editingContactPhone.replace(/\D/g, ""),
                    email: editingContactEmail.trim() || null,
                    company: editingContactCompany.trim() || null,
                    cpf_cnpj: editingContactCpfCnpj || null,
                    notes: editingContactNotes.trim() || null,
                  };

                  const { error } = await supabase
                    .from("leads")
                    .update(updates)
                    .eq("id", editingContactLeadId);

                  if (error) {
                    throw new Error(`Erro ao atualizar contato: ${error.message}`);
                  }

                  toast({
                    title: "Contato atualizado",
                    description: "As informações do contato foram atualizadas com sucesso.",
                  });

                  // Fechar dialog
                  setShowEditContactDialog(false);
                  setEditingContactLeadId(null);
                  setEditingContactName("");
                  setEditingContactPhone("");
                  setEditingContactEmail("");
                  setEditingContactCompany("");
                  setEditingContactCpfCnpj("");
                  setEditingContactNotes("");

                  // Disparar evento de refresh para atualizar em tempo real
                  window.dispatchEvent(new CustomEvent('data-refresh', {
                    detail: { type: 'update', entity: 'lead', leadId: editingContactLeadId }
                  }));
                } catch (error: any) {
                  console.error("Erro ao atualizar lead:", error);
                  toast({
                    title: "Erro ao atualizar",
                    description: error.message || "Erro desconhecido ao atualizar contato",
                    variant: "destructive",
                  });
                }
              }}
            >
              Salvar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
