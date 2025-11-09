import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, Send, Pause, Play, Trash2, Plus, FileText, CheckCircle2, XCircle, Clock, Loader2, Search, CalendarIcon, BarChart3 } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format as formatDate } from "date-fns";
import { ptBR } from "date-fns/locale";
import { WhatsAppNav } from "@/components/whatsapp/WhatsAppNav";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { CRMLayout } from "@/components/crm/CRMLayout";
import { getUserOrganizationId } from "@/lib/organizationUtils";
import { BroadcastPerformanceReport } from "@/components/crm/BroadcastPerformanceReport";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface Campaign {
  id: string;
  name: string;
  status: string;
  total_contacts: number;
  sent_count: number;
  failed_count: number;
  created_at: string;
  started_at?: string;
  instance_id: string;
}

export default function BroadcastCampaigns() {
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [logsDialogOpen, setLogsDialogOpen] = useState(false);
  const [selectedCampaignLogs, setSelectedCampaignLogs] = useState<any[]>([]);
  const [instances, setInstances] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [pastedList, setPastedList] = useState("");
  const [importMode, setImportMode] = useState<"csv" | "paste">("csv");
  const [logsSearchQuery, setLogsSearchQuery] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState<Date | undefined>(undefined);
  const [sentDateFilter, setSentDateFilter] = useState<Date | undefined>(undefined);
  const [dateFilterType, setDateFilterType] = useState<"created" | "sent">("created");
  const [instanceFilter, setInstanceFilter] = useState<string>("all");
  const { toast } = useToast();

  const handleViewChange = (view: "kanban" | "calls" | "contacts" | "settings" | "users" | "broadcast" | "whatsapp") => {
    if (view === "kanban") navigate('/');
    else if (view === "calls") navigate('/');
    else if (view === "contacts") navigate('/');
    else if (view === "settings") navigate('/settings');
    else if (view === "users") navigate('/users');
    else if (view === "whatsapp") navigate('/whatsapp');
    else if (view === "broadcast") navigate('/broadcast');
  };

  const [newCampaign, setNewCampaign] = useState({
    name: "",
    instanceId: "",
    templateId: "",
    customMessage: "",
    minDelay: 30,
    maxDelay: 60,
    scheduledStart: undefined as Date | undefined,
  });

  useEffect(() => {
    fetchCampaigns();
    fetchInstances();
    fetchTemplates();
  }, []);

  const fetchCampaigns = async () => {
    try {
      const orgId = await getUserOrganizationId();
      if (!orgId) {
        setCampaigns([]);
        return;
      }

      const { data, error } = await supabase
        .from("broadcast_campaigns")
        .select("*")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setCampaigns(data || []);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar campanhas",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchInstances = async () => {
    const orgId = await getUserOrganizationId();
    if (!orgId) {
      setInstances([]);
      return;
    }
    const { data } = await supabase.from("evolution_config").select("*").eq("organization_id", orgId);
    setInstances(data || []);
  };

  const fetchTemplates = async () => {
    const orgId = await getUserOrganizationId();
    if (!orgId) {
      setTemplates([]);
      return;
    }
    const { data } = await supabase.from("message_templates").select("*").eq("organization_id", orgId);
    setTemplates(data || []);
  };

  const parseCSV = (text: string): Array<{ phone: string; name?: string }> => {
    const lines = text.split("\n").filter((line) => line.trim());
    const contacts: Array<{ phone: string; name?: string }> = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const parts = line.split(/[,;]/);
      const phone = parts[0]?.trim().replace(/\D/g, "");
      const name = parts[1]?.trim();

      if (phone && phone.length >= 10) {
        contacts.push({ phone, name });
      }
    }

    return contacts;
  };

  const handleCreateCampaign = async () => {
    if (!newCampaign.name || !newCampaign.instanceId || (importMode === "csv" && !csvFile) || (importMode === "paste" && !pastedList.trim())) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha nome, instância e forneça uma lista de contatos",
        variant: "destructive",
      });
      return;
    }

    if (!newCampaign.customMessage && !newCampaign.templateId) {
      toast({
        title: "Mensagem obrigatória",
        description: "Escolha um template ou escreva uma mensagem personalizada",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);

      // Ler contatos
      let text: string;
      if (importMode === "csv" && csvFile) {
        text = await csvFile.text();
      } else {
        text = pastedList;
      }
      const contacts = parseCSV(text);

      if (contacts.length === 0) {
        throw new Error("Nenhum contato válido encontrado no arquivo CSV");
      }

      // Criar campanha
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Obter organização ativa do usuário
      const orgId = await getUserOrganizationId();
      if (!orgId) {
        throw new Error("Usuário não pertence a nenhuma organização");
      }


      const { data: campaign, error: campaignError } = await supabase
        .from("broadcast_campaigns")
        .insert({
          user_id: user.id,
          organization_id: orgId,
          name: newCampaign.name,
          instance_id: newCampaign.instanceId,
          message_template_id: newCampaign.templateId || null,
          custom_message: newCampaign.customMessage || null,
          min_delay_seconds: newCampaign.minDelay,
          max_delay_seconds: newCampaign.maxDelay,
          total_contacts: contacts.length,
          status: "draft",
        })
        .select()
        .single();

      if (campaignError) throw campaignError;

      // Inserir contatos na fila
      const queueItems = contacts.map((contact) => ({
        campaign_id: campaign.id,
        phone: contact.phone,
        name: contact.name,
        status: "pending",
      }));

      const { error: queueError } = await supabase
        .from("broadcast_queue")
        .insert(queueItems);

      if (queueError) throw queueError;

      toast({
        title: "Campanha criada!",
        description: `${contacts.length} contatos adicionados à fila`,
      });

      setCreateDialogOpen(false);
      setNewCampaign({
        name: "",
        instanceId: "",
        templateId: "",
        customMessage: "",
        minDelay: 30,
        maxDelay: 60,
        scheduledStart: undefined,
      });
      setCsvFile(null);
      setPastedList("");
      setImportMode("csv");
      fetchCampaigns();
    } catch (error: any) {
      toast({
        title: "Erro ao criar campanha",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleStartCampaign = async (campaignId: string) => {
    try {
      // Buscar itens pendentes
      const { data: queueItems, error: fetchError } = await supabase
        .from("broadcast_queue")
        .select("*")
        .eq("campaign_id", campaignId)
        .eq("status", "pending");

      if (fetchError) throw fetchError;

      if (!queueItems || queueItems.length === 0) {
        throw new Error("Nenhum contato pendente nesta campanha");
      }

      // Buscar configurações da campanha
      const { data: campaign, error: campaignError } = await supabase
        .from("broadcast_campaigns")
        .select("min_delay_seconds, max_delay_seconds")
        .eq("id", campaignId)
        .single();

      if (campaignError) throw campaignError;

      // Agendar cada item com delay aleatório
      const now = new Date();
      const updates = queueItems.map((item, index) => {
        const minDelay = campaign.min_delay_seconds * 1000;
        const maxDelay = campaign.max_delay_seconds * 1000;
        const randomDelay = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
        
        const scheduledTime = new Date(now.getTime() + (index * maxDelay) + randomDelay);

        return supabase
          .from("broadcast_queue")
          .update({
            status: "scheduled",
            scheduled_for: scheduledTime.toISOString(),
          })
          .eq("id", item.id);
      });

      await Promise.all(updates);

      // Atualizar status da campanha
      await supabase
        .from("broadcast_campaigns")
        .update({
          status: "running",
          started_at: new Date().toISOString(),
        })
        .eq("id", campaignId);

      toast({
        title: "Campanha iniciada!",
        description: `${queueItems.length} mensagens agendadas`,
      });

      fetchCampaigns();
    } catch (error: any) {
      toast({
        title: "Erro ao iniciar campanha",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handlePauseCampaign = async (campaignId: string) => {
    try {
      await supabase
        .from("broadcast_campaigns")
        .update({ status: "paused" })
        .eq("id", campaignId);

      toast({
        title: "Campanha pausada",
        description: "A campanha foi pausada com sucesso",
      });

      fetchCampaigns();
    } catch (error: any) {
      toast({
        title: "Erro ao pausar campanha",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleCancelCampaign = async (campaignId: string) => {
    try {
      // Cancelar todos os itens pendentes/agendados
      await supabase
        .from("broadcast_queue")
        .update({ status: "cancelled" })
        .eq("campaign_id", campaignId)
        .in("status", ["pending", "scheduled"]);

      // Atualizar status da campanha
      await supabase
        .from("broadcast_campaigns")
        .update({ 
          status: "cancelled",
          completed_at: new Date().toISOString()
        })
        .eq("id", campaignId);

      toast({
        title: "Campanha cancelada",
        description: "A campanha foi cancelada com sucesso",
      });

      fetchCampaigns();
    } catch (error: any) {
      toast({
        title: "Erro ao cancelar campanha",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleResumeCampaign = async (campaignId: string) => {
    try {
      await supabase
        .from("broadcast_campaigns")
        .update({ status: "running" })
        .eq("id", campaignId);

      toast({
        title: "Campanha retomada",
        description: "A campanha foi retomada com sucesso",
      });

      fetchCampaigns();
    } catch (error: any) {
      toast({
        title: "Erro ao retomar campanha",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleViewLogs = async (campaignId: string) => {
    try {
      const { data, error } = await supabase
        .from("broadcast_queue")
        .select("*")
        .eq("campaign_id", campaignId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      setSelectedCampaignLogs(data || []);
      setLogsDialogOpen(true);
    } catch (error: any) {
      toast({
        title: "Erro ao buscar logs",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      draft: { variant: "outline", label: "Rascunho" },
      running: { variant: "default", label: "Em execução" },
      paused: { variant: "secondary", label: "Pausada" },
      completed: { variant: "outline", label: "Concluída" },
      cancelled: { variant: "destructive", label: "Cancelada" },
    };

    const config = variants[status] || { variant: "outline", label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const filteredCampaigns = campaigns.filter((campaign) => {
    const matchesSearch = !searchQuery || campaign.name.toLowerCase().includes(searchQuery.toLowerCase());
    
    let matchesDate = true;
    if (dateFilterType === "created" && dateFilter) {
      matchesDate = new Date(campaign.created_at).toDateString() === dateFilter.toDateString();
    } else if (dateFilterType === "sent" && sentDateFilter) {
      if (campaign.started_at) {
        matchesDate = new Date(campaign.started_at).toDateString() === sentDateFilter.toDateString();
      } else {
        matchesDate = false;
      }
    }
    
    const matchesInstance = instanceFilter === "all" || campaign.instance_id === instanceFilter;
    
    return matchesSearch && matchesDate && matchesInstance;
  });

  if (loading && campaigns.length === 0) {
    return <div className="p-6">Carregando...</div>;
  }

  return (
    <AuthGuard>
      <CRMLayout activeView="broadcast" onViewChange={handleViewChange}>
        <div className="p-6">
          <Tabs defaultValue="campaigns" className="w-full">
            <TabsList className="mb-4">
              <TabsTrigger value="campaigns">Campanhas</TabsTrigger>
              <TabsTrigger value="reports">
                <BarChart3 className="h-4 w-4 mr-2" />
                Relatórios
              </TabsTrigger>
            </TabsList>

            <TabsContent value="campaigns">
              <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Disparo em Massa</CardTitle>
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Nova Campanha
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Criar Campanha de Disparo</DialogTitle>
                <DialogDescription>
                  Configure sua campanha de envio em massa
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome da Campanha *</Label>
                  <Input
                    id="name"
                    placeholder="Ex: Promoção Black Friday"
                    value={newCampaign.name}
                    onChange={(e) => setNewCampaign({ ...newCampaign, name: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="instance">Instância WhatsApp *</Label>
                  <Select
                    value={newCampaign.instanceId}
                    onValueChange={(value) =>
                      setNewCampaign({ ...newCampaign, instanceId: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a instância" />
                    </SelectTrigger>
                    <SelectContent>
                      {instances.map((instance) => (
                        <SelectItem key={instance.id} value={instance.id}>
                          {instance.instance_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="template">Template de Mensagem (opcional)</Label>
                  <Select
                    value={newCampaign.templateId}
                    onValueChange={(value) =>
                      setNewCampaign({ ...newCampaign, templateId: value, customMessage: "" })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um template" />
                    </SelectTrigger>
                    <SelectContent>
                      {templates.map((template) => (
                        <SelectItem key={template.id} value={template.id}>
                          {template.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="customMessage">Ou escreva uma mensagem personalizada *</Label>
                  <Textarea
                    id="customMessage"
                    placeholder="Use {nome} para personalizar. Ex: Olá {nome}, temos uma oferta especial!"
                    value={newCampaign.customMessage}
                    onChange={(e) =>
                      setNewCampaign({ ...newCampaign, customMessage: e.target.value, templateId: "" })
                    }
                    rows={4}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="minDelay">Delay Mínimo (segundos)</Label>
                    <Input
                      id="minDelay"
                      type="number"
                      min="10"
                      value={newCampaign.minDelay}
                      onChange={(e) =>
                        setNewCampaign({ ...newCampaign, minDelay: parseInt(e.target.value) })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="maxDelay">Delay Máximo (segundos)</Label>
                    <Input
                      id="maxDelay"
                      type="number"
                      min="10"
                      value={newCampaign.maxDelay}
                      onChange={(e) =>
                        setNewCampaign({ ...newCampaign, maxDelay: parseInt(e.target.value) })
                      }
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="scheduledStart">Agendar Início da Campanha (opcional)</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        id="scheduledStart"
                        variant="outline"
                        className="w-full justify-start text-left font-normal"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {newCampaign.scheduledStart ? (
                          formatDate(newCampaign.scheduledStart, "PPP 'às' HH:mm", { locale: ptBR })
                        ) : (
                          <span>Selecione data e hora</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={newCampaign.scheduledStart}
                        onSelect={(date) => setNewCampaign({ ...newCampaign, scheduledStart: date })}
                        initialFocus
                        locale={ptBR}
                      />
                      {newCampaign.scheduledStart && (
                        <div className="p-3 border-t">
                          <Label htmlFor="time" className="text-xs">Hora</Label>
                          <Input
                            id="time"
                            type="time"
                            value={formatDate(newCampaign.scheduledStart, "HH:mm")}
                            onChange={(e) => {
                              const [hours, minutes] = e.target.value.split(":");
                              const newDate = new Date(newCampaign.scheduledStart!);
                              newDate.setHours(parseInt(hours), parseInt(minutes));
                              setNewCampaign({ ...newCampaign, scheduledStart: newDate });
                            }}
                            className="mt-1"
                          />
                        </div>
                      )}
                    </PopoverContent>
                  </Popover>
                  <p className="text-xs text-muted-foreground">
                    Se não definir, a campanha iniciará imediatamente ao clicar em "Iniciar"
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Modo de Importação *</Label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant={importMode === "csv" ? "default" : "outline"}
                      className="flex-1"
                      onClick={() => setImportMode("csv")}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Upload CSV
                    </Button>
                    <Button
                      type="button"
                      variant={importMode === "paste" ? "default" : "outline"}
                      className="flex-1"
                      onClick={() => setImportMode("paste")}
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      Colar Lista
                    </Button>
                  </div>
                </div>

                {importMode === "csv" ? (
                  <div className="space-y-2">
                    <Label htmlFor="csv">Arquivo CSV com Contatos *</Label>
                    <Input
                      id="csv"
                      type="file"
                      accept=".csv,.txt"
                      onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Formato: telefone,nome (um por linha). Exemplo: 5511999999999,João Silva
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="pastedList">Lista de Contatos *</Label>
                    <Textarea
                      id="pastedList"
                      placeholder="Cole sua lista aqui (um por linha)&#10;Formato: telefone,nome ou apenas telefone&#10;Exemplo:&#10;5511999999999,João Silva&#10;5511888888888,Maria Santos&#10;5511777777777"
                      value={pastedList}
                      onChange={(e) => setPastedList(e.target.value)}
                      rows={8}
                      className="font-mono text-sm"
                    />
                    <p className="text-xs text-muted-foreground">
                      Formato aceito: telefone,nome (opcional). Um contato por linha.
                    </p>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleCreateCampaign} disabled={loading}>
                  Criar Campanha
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {/* Filtros */}
          <div className="mb-6 flex gap-4 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Buscar por nome da campanha..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <Select value={dateFilterType} onValueChange={(value: "created" | "sent") => setDateFilterType(value)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="created">Data de Criação</SelectItem>
                <SelectItem value="sent">Data de Envio</SelectItem>
              </SelectContent>
            </Select>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-[240px] justify-start">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateFilterType === "created" && dateFilter 
                    ? formatDate(dateFilter, "PPP", { locale: ptBR })
                    : dateFilterType === "sent" && sentDateFilter
                    ? formatDate(sentDateFilter, "PPP", { locale: ptBR })
                    : "Filtrar por data"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dateFilterType === "created" ? dateFilter : sentDateFilter}
                  onSelect={(date) => {
                    if (dateFilterType === "created") {
                      setDateFilter(date);
                    } else {
                      setSentDateFilter(date);
                    }
                  }}
                  initialFocus
                  locale={ptBR}
                />
                {((dateFilterType === "created" && dateFilter) || (dateFilterType === "sent" && sentDateFilter)) && (
                  <div className="p-3 border-t">
                    <Button
                      variant="ghost"
                      className="w-full"
                      onClick={() => {
                        if (dateFilterType === "created") {
                          setDateFilter(undefined);
                        } else {
                          setSentDateFilter(undefined);
                        }
                      }}
                    >
                      Limpar filtro
                    </Button>
                  </div>
                )}
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-4">
            {filteredCampaigns.map((campaign) => (
              <div
                key={campaign.id}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                  <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-medium">{campaign.name}</h3>
                    {getStatusBadge(campaign.status)}
                  </div>
                  <div className="flex gap-4 text-sm flex-wrap">
                    <span className="text-muted-foreground">Total: {campaign.total_contacts}</span>
                    <span className="flex items-center gap-1 text-success">
                      <CheckCircle2 className="h-3 w-3" />
                      Sucesso: {campaign.sent_count}
                    </span>
                    <span className="flex items-center gap-1 text-destructive">
                      <XCircle className="h-3 w-3" />
                      Falhas: {campaign.failed_count}
                    </span>
                  </div>
                  <div className="mt-2 mb-1">
                    <Badge variant="outline" className="font-semibold text-base">
                      {instances.find(i => i.id === campaign.instance_id)?.instance_name || 'N/A'}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 space-y-1">
                    <div>Criada em: {formatDate(new Date(campaign.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</div>
                    {campaign.started_at && (
                      <div>Enviada em: {formatDate(new Date(campaign.started_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</div>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  {campaign.status === "draft" && (
                    <Button
                      size="sm"
                      onClick={() => handleStartCampaign(campaign.id)}
                    >
                      <Play className="h-4 w-4 mr-1" />
                      Iniciar
                    </Button>
                  )}
                  {campaign.status === "running" && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handlePauseCampaign(campaign.id)}
                      >
                        <Pause className="h-4 w-4 mr-1" />
                        Pausar
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleCancelCampaign(campaign.id)}
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Cancelar
                      </Button>
                    </>
                  )}
                  {campaign.status === "paused" && (
                    <>
                      <Button
                        size="sm"
                        onClick={() => handleResumeCampaign(campaign.id)}
                      >
                        <Play className="h-4 w-4 mr-1" />
                        Retomar
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleCancelCampaign(campaign.id)}
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Cancelar
                      </Button>
                    </>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleViewLogs(campaign.id)}
                  >
                    <FileText className="h-4 w-4 mr-1" />
                    Logs
                  </Button>
                </div>
              </div>
            ))}
            {filteredCampaigns.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                {searchQuery || dateFilter ? "Nenhuma campanha encontrada com os filtros aplicados" : "Nenhuma campanha criada ainda"}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
            </TabsContent>

            <TabsContent value="reports">
              <BroadcastPerformanceReport 
                campaigns={campaigns} 
                instances={instances}
                dateFilter={sentDateFilter}
              />
            </TabsContent>
          </Tabs>

      <Dialog open={logsDialogOpen} onOpenChange={setLogsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Logs de Disparo</DialogTitle>
            <DialogDescription>
              Histórico detalhado de todos os disparos desta campanha
            </DialogDescription>
          </DialogHeader>
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Buscar por número de telefone..."
                value={logsSearchQuery}
                onChange={(e) => setLogsSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <ScrollArea className="h-[500px] pr-4">
            <div className="space-y-3">
              {selectedCampaignLogs
                .filter((log) => 
                  !logsSearchQuery || log.phone.includes(logsSearchQuery.replace(/\D/g, ""))
                )
                .map((log) => (
                <Card key={log.id} className={log.status === 'failed' ? 'border-destructive' : ''}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          {log.status === 'sent' && <CheckCircle2 className="h-4 w-4 text-success" />}
                          {log.status === 'failed' && <XCircle className="h-4 w-4 text-destructive" />}
                          {log.status === 'scheduled' && <Clock className="h-4 w-4 text-warning" />}
                          {log.status === 'pending' && <Loader2 className="h-4 w-4 text-muted-foreground" />}
                          <span className="font-medium">{log.phone}</span>
                          {log.name && <span className="text-muted-foreground">({log.name})</span>}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {log.status === 'scheduled' && log.scheduled_for && (
                            <span>Agendado para: {new Date(log.scheduled_for).toLocaleString()}</span>
                          )}
                          {log.status === 'sent' && log.sent_at && (
                            <span>Enviado em: {new Date(log.sent_at).toLocaleString()}</span>
                          )}
                          {log.status === 'pending' && <span>Aguardando processamento</span>}
                        </div>
                        {log.error_message && (
                          <div className="mt-2 p-3 bg-destructive/10 rounded-md">
                            <p className="text-sm font-medium text-destructive mb-1">Erro:</p>
                            <p className="text-sm text-destructive/90 font-mono whitespace-pre-wrap">
                              {log.error_message}
                            </p>
                          </div>
                        )}
                      </div>
                      <Badge variant={
                        log.status === 'sent' ? 'default' :
                        log.status === 'failed' ? 'destructive' :
                        log.status === 'scheduled' ? 'secondary' :
                        'outline'
                      }>
                        {log.status === 'sent' ? 'Enviado' :
                         log.status === 'failed' ? 'Falhou' :
                         log.status === 'scheduled' ? 'Agendado' :
                         'Pendente'}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {selectedCampaignLogs.filter((log) => 
                !logsSearchQuery || log.phone.includes(logsSearchQuery.replace(/\D/g, ""))
              ).length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  {logsSearchQuery ? 'Nenhum log encontrado para este número' : 'Nenhum log encontrado'}
                </div>
              )}
            </div>
        </ScrollArea>
        </DialogContent>
      </Dialog>
        </div>
      </CRMLayout>
    </AuthGuard>
  );
}
