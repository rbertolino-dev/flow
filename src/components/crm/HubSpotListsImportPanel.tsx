import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useHubSpotConfigs } from "@/hooks/useHubSpotConfigs";
import { useWorkflowLists } from "@/hooks/useWorkflowLists";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, RefreshCw, Upload, List, CheckCircle2, AlertCircle, Plus, Trash2, Edit3, Send, Database, Eye, Users } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface HubSpotList {
  id: string;
  name: string;
  size: number;
  dynamic: boolean;
  created_at: string;
  updated_at: string;
}

interface FieldMapping {
  hubspot_field: string;
  system_field: string;
  default_value?: string;
}

interface PreviewContact {
  id: string;
  properties: Record<string, any>;
}

const SYSTEM_FIELDS: { value: string; label: string }[] = [
  { value: 'name', label: 'Nome' },
  { value: 'phone', label: 'Telefone' },
  { value: 'email', label: 'E-mail' },
  { value: 'company', label: 'Empresa' },
  { value: 'status', label: 'Status' },
  { value: 'value', label: 'Valor' },
  { value: 'notes', label: 'Observações' },
];

const HUBSPOT_FIELDS: { value: string; label: string }[] = [
  { value: 'firstname', label: 'Primeiro Nome' },
  { value: 'lastname', label: 'Sobrenome' },
  { value: 'email', label: 'E-mail' },
  { value: 'phone', label: 'Telefone' },
  { value: 'company', label: 'Empresa' },
  { value: 'lifecyclestage', label: 'Lifecycle Stage' },
  { value: 'jobtitle', label: 'Cargo' },
  { value: 'website', label: 'Website' },
  { value: 'city', label: 'Cidade' },
  { value: 'state', label: 'Estado' },
  { value: 'country', label: 'País' },
];

export function HubSpotListsImportPanel() {
  const { toast } = useToast();
  const { config: hubspotConfig } = useHubSpotConfigs();
  const { lists, saveList, refetch: refetchLists } = useWorkflowLists();
  const [hubspotLists, setHubspotLists] = useState<HubSpotList[]>([]);
  const [isLoadingLists, setIsLoadingLists] = useState(false);
  const [selectedListId, setSelectedListId] = useState("");
  const [selectedList, setSelectedList] = useState<HubSpotList | null>(null);
  const [fieldMappings, setFieldMappings] = useState<FieldMapping[]>([
    { hubspot_field: 'firstname', system_field: 'name' },
    { hubspot_field: 'phone', system_field: 'phone' },
  ]);
  const [importTo, setImportTo] = useState<'crm' | 'campaign_list' | 'both'>('both');
  const [campaignListId, setCampaignListId] = useState("");
  const [newListName, setNewListName] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  
  // Preview state
  const [previewContacts, setPreviewContacts] = useState<PreviewContact[]>([]);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // Buscar listas do HubSpot
  const fetchHubSpotLists = async () => {
    if (!hubspotConfig) {
      toast({
        title: "Configuração não encontrada",
        description: "Configure o HubSpot primeiro",
        variant: "destructive",
      });
      return;
    }

    setIsLoadingLists(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Não autenticado");

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/hubspot-list-lists`,
        {
          method: 'POST',
          headers: {
            "Authorization": `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ count: 250 }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erro ao buscar listas");
      }

      const data = await response.json();
      setHubspotLists(data.lists || []);
    } catch (error: any) {
      toast({
        title: "Erro ao buscar listas",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoadingLists(false);
    }
  };

  // Quando selecionar uma lista
  useEffect(() => {
    if (selectedListId) {
      const list = hubspotLists.find(l => l.id === selectedListId);
      setSelectedList(list || null);
      // Preencher nome da nova lista com nome da lista do HubSpot
      if (list && !newListName) {
        setNewListName(list.name);
      }
      // Limpar preview quando mudar de lista
      setPreviewContacts([]);
      setShowPreview(false);
    }
  }, [selectedListId, hubspotLists]);

  // Buscar preview dos contatos da lista
  const fetchPreviewContacts = async () => {
    if (!selectedListId || !hubspotConfig) return;

    setIsLoadingPreview(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Não autenticado");

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/hubspot-get-list-contacts`,
        {
          method: 'POST',
          headers: {
            "Authorization": `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ 
            list_id: selectedListId,
            count: 100,
            properties: ['firstname', 'lastname', 'email', 'phone', 'mobilephone', 'company', 'lifecyclestage']
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erro ao buscar contatos");
      }

      const data = await response.json();
      setPreviewContacts(data.contacts || []);
      setShowPreview(true);

      if (data.contacts?.length === 0) {
        toast({
          title: "Lista vazia",
          description: "Nenhum contato encontrado nesta lista do HubSpot",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Contatos carregados",
          description: `${data.contacts.length} contatos encontrados${data.has_more ? ' (mais contatos disponíveis)' : ''}`,
        });
      }
    } catch (error: any) {
      toast({
        title: "Erro ao buscar contatos",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const handleAddMapping = () => {
    setFieldMappings([...fieldMappings, { hubspot_field: '', system_field: 'name' }]);
  };

  const handleRemoveMapping = (index: number) => {
    setFieldMappings(fieldMappings.filter((_, i) => i !== index));
  };

  const handleMappingChange = (index: number, field: keyof FieldMapping, value: string) => {
    const updated = [...fieldMappings];
    updated[index] = { ...updated[index], [field]: value };
    setFieldMappings(updated);
  };

  const handleImport = async () => {
    if (!selectedListId || !selectedList) {
      toast({
        title: "Lista não selecionada",
        description: "Selecione uma lista do HubSpot",
        variant: "destructive",
      });
      return;
    }

    // Validar mapeamentos obrigatórios
    const hasName = fieldMappings.some(m => m.system_field === 'name' && m.hubspot_field);
    const hasPhoneOrEmail = fieldMappings.some(m => 
      (m.system_field === 'phone' || m.system_field === 'email') && m.hubspot_field
    );

    if (!hasName || !hasPhoneOrEmail) {
      toast({
        title: "Mapeamento incompleto",
        description: "É necessário mapear pelo menos: Nome e Telefone ou E-mail",
        variant: "destructive",
      });
      return;
    }

    // Validar lista de campanha se necessário
    if ((importTo === 'campaign_list' || importTo === 'both') && !campaignListId && !newListName) {
      toast({
        title: "Lista de campanha necessária",
        description: "Selecione uma lista existente ou crie uma nova",
        variant: "destructive",
      });
      return;
    }

    setIsImporting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Não autenticado");

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/hubspot-import-list`,
        {
          method: 'POST',
          headers: {
            "Authorization": `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            list_id: selectedListId,
            list_name: selectedList.name,
            field_mappings: fieldMappings,
            import_to: importTo,
            campaign_list_id: campaignListId || undefined,
            campaign_list_name: newListName || undefined,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erro ao importar lista");
      }

      const result = await response.json();
      setImportResult(result);

      toast({
        title: "Importação concluída",
        description: `Criados: ${result.stats.created}, Atualizados: ${result.stats.updated}, Adicionados à lista: ${result.stats.added_to_list}`,
      });

      // Atualizar listas se criou nova
      if (result.list_id) {
        await refetchLists();
      }

    } catch (error: any) {
      toast({
        title: "Erro na importação",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <List className="h-5 w-5 text-orange-500" />
              <CardTitle>Importar Listas do HubSpot</CardTitle>
            </div>
            <CardDescription>
              Importe listas de contatos do HubSpot para o CRM ou campanhas
            </CardDescription>
          </div>
          <Button onClick={fetchHubSpotLists} disabled={isLoadingLists || !hubspotConfig}>
            {isLoadingLists ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Carregando...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Buscar Listas
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {!hubspotConfig ? (
          <Alert>
            <AlertDescription>
              Configure o HubSpot primeiro em Configurações &gt; Integrações
            </AlertDescription>
          </Alert>
        ) : (
          <>
            {/* Seleção de Lista */}
            <div className="space-y-2">
              <Label>Lista do HubSpot</Label>
              <Select value={selectedListId} onValueChange={setSelectedListId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma lista do HubSpot" />
                </SelectTrigger>
                <SelectContent>
                  {hubspotLists.length === 0 ? (
                    <SelectItem value="none" disabled>
                      Nenhuma lista encontrada. Clique em "Buscar Listas"
                    </SelectItem>
                  ) : (
                    hubspotLists.map((list) => (
                      <SelectItem key={list.id} value={list.id}>
                        {list.name} ({list.size} contatos)
                        {list.dynamic && <Badge variant="outline" className="ml-2">Dinâmica</Badge>}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {selectedList && (
                <div className="flex gap-2 items-center mt-2">
                  <p className="text-xs text-muted-foreground flex-1">
                    {selectedList.size} contatos • {selectedList.dynamic ? 'Lista dinâmica' : 'Lista estática'}
                  </p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={fetchPreviewContacts}
                    disabled={isLoadingPreview}
                  >
                    {isLoadingPreview ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Carregando...
                      </>
                    ) : (
                      <>
                        <Eye className="h-4 w-4 mr-2" />
                        Pré-visualizar Contatos
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>

            {/* Preview dos Contatos */}
            {showPreview && previewContacts.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Pré-visualização ({previewContacts.length} contatos)
                  </Label>
                  <Button variant="ghost" size="sm" onClick={() => setShowPreview(false)}>
                    Ocultar
                  </Button>
                </div>
                <ScrollArea className="h-64 border rounded-md">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>E-mail</TableHead>
                        <TableHead>Telefone</TableHead>
                        <TableHead>Empresa</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {previewContacts.map((contact) => (
                        <TableRow key={contact.id}>
                          <TableCell className="font-medium">
                            {[contact.properties.firstname, contact.properties.lastname].filter(Boolean).join(' ') || '-'}
                          </TableCell>
                          <TableCell>{contact.properties.email || '-'}</TableCell>
                          <TableCell>{contact.properties.phone || contact.properties.mobilephone || '-'}</TableCell>
                          <TableCell>{contact.properties.company || '-'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
                {previewContacts.some(c => !c.properties.phone && !c.properties.mobilephone && !c.properties.email) && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Alguns contatos não possuem telefone ou e-mail e serão ignorados na importação.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}

            {selectedList && (
              <>
                {/* Mapeamento de Campos */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label>Mapeamento de Campos</Label>
                    <Button variant="outline" size="sm" onClick={handleAddMapping}>
                      <Plus className="h-4 w-4 mr-2" />
                      Adicionar Campo
                    </Button>
                  </div>

                  <div className="space-y-3">
                    {fieldMappings.map((mapping, index) => (
                      <div key={index} className="flex gap-2 items-end">
                        <div className="flex-1">
                          <Label className="text-xs">Campo HubSpot</Label>
                          <Select
                            value={mapping.hubspot_field}
                            onValueChange={(value) => handleMappingChange(index, 'hubspot_field', value)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione campo HubSpot" />
                            </SelectTrigger>
                            <SelectContent>
                              {HUBSPOT_FIELDS.map((field) => (
                                <SelectItem key={field.value} value={field.value}>
                                  {field.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex-1">
                          <Label className="text-xs">Campo Sistema</Label>
                          <Select
                            value={mapping.system_field}
                            onValueChange={(value) => handleMappingChange(index, 'system_field', value)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Campo no sistema" />
                            </SelectTrigger>
                            <SelectContent>
                              {SYSTEM_FIELDS.map((field) => (
                                <SelectItem key={field.value} value={field.value}>
                                  {field.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        {fieldMappings.length > 1 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveMapping(index)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Onde Importar */}
                <div className="space-y-4">
                  <Label>Onde Importar</Label>
                  <RadioGroup value={importTo} onValueChange={(value: any) => setImportTo(value)}>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="crm" id="crm" />
                      <Label htmlFor="crm" className="flex items-center gap-2 cursor-pointer">
                        <Database className="h-4 w-4" />
                        Apenas CRM
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="campaign_list" id="campaign_list" />
                      <Label htmlFor="campaign_list" className="flex items-center gap-2 cursor-pointer">
                        <Send className="h-4 w-4" />
                        Apenas Lista de Campanha
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="both" id="both" />
                      <Label htmlFor="both" className="flex items-center gap-2 cursor-pointer">
                        <List className="h-4 w-4" />
                        CRM + Lista de Campanha
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

                {/* Lista de Campanha (se necessário) */}
                {(importTo === 'campaign_list' || importTo === 'both') && (
                  <div className="space-y-4">
                    <Label>Lista de Campanha</Label>
                    <Tabs defaultValue="existing">
                      <TabsList>
                        <TabsTrigger value="existing">Lista Existente</TabsTrigger>
                        <TabsTrigger value="new">Nova Lista</TabsTrigger>
                      </TabsList>
                      <TabsContent value="existing">
                        <Select value={campaignListId} onValueChange={setCampaignListId}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione uma lista existente" />
                          </SelectTrigger>
                          <SelectContent>
                            {lists.map((list) => (
                              <SelectItem key={list.id} value={list.id}>
                                {list.name} ({list.contacts.length} contatos)
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TabsContent>
                      <TabsContent value="new">
                        <Input
                          placeholder="Nome da nova lista"
                          value={newListName}
                          onChange={(e) => setNewListName(e.target.value)}
                        />
                      </TabsContent>
                    </Tabs>
                  </div>
                )}

                {/* Botão Importar */}
                <Button
                  onClick={handleImport}
                  disabled={isImporting}
                  className="w-full"
                  size="lg"
                >
                  {isImporting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Importando...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Importar Lista
                    </>
                  )}
                </Button>

                {/* Resultado */}
                {importResult && (
                  <Alert>
                    <CheckCircle2 className="h-4 w-4" />
                    <AlertDescription>
                      <div className="space-y-1">
                        <p><strong>Importação concluída!</strong></p>
                        <p>Criados: {importResult.stats.created}</p>
                        <p>Atualizados: {importResult.stats.updated}</p>
                        <p>Adicionados à lista: {importResult.stats.added_to_list}</p>
                        {importResult.list_id && (
                          <p>Lista criada/atualizada: {importResult.list_id}</p>
                        )}
                      </div>
                    </AlertDescription>
                  </Alert>
                )}
              </>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}


