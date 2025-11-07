import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Upload, Send, Pause, Play, Trash2, Plus } from "lucide-react";
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
}

export default function BroadcastCampaigns() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [instances, setInstances] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const { toast } = useToast();

  const [newCampaign, setNewCampaign] = useState({
    name: "",
    instanceId: "",
    templateId: "",
    customMessage: "",
    minDelay: 30,
    maxDelay: 60,
  });

  useEffect(() => {
    fetchCampaigns();
    fetchInstances();
    fetchTemplates();
  }, []);

  const fetchCampaigns = async () => {
    try {
      const { data, error } = await supabase
        .from("broadcast_campaigns")
        .select("*")
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
    const { data } = await supabase.from("evolution_config").select("*");
    setInstances(data || []);
  };

  const fetchTemplates = async () => {
    const { data } = await supabase.from("message_templates").select("*");
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
    if (!newCampaign.name || !newCampaign.instanceId || !csvFile) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha nome, instância e upload de arquivo CSV",
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

      // Ler arquivo CSV
      const text = await csvFile.text();
      const contacts = parseCSV(text);

      if (contacts.length === 0) {
        throw new Error("Nenhum contato válido encontrado no arquivo CSV");
      }

      // Criar campanha
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { data: campaign, error: campaignError } = await supabase
        .from("broadcast_campaigns")
        .insert({
          user_id: user.id,
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
      });
      setCsvFile(null);
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

  if (loading && campaigns.length === 0) {
    return <div className="p-6">Carregando...</div>;
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
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
            <DialogContent className="max-w-2xl">
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
          <div className="space-y-4">
            {campaigns.map((campaign) => (
              <div
                key={campaign.id}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-medium">{campaign.name}</h3>
                    {getStatusBadge(campaign.status)}
                  </div>
                  <div className="flex gap-4 text-sm text-muted-foreground">
                    <span>Total: {campaign.total_contacts}</span>
                    <span>Enviados: {campaign.sent_count}</span>
                    <span>Falhas: {campaign.failed_count}</span>
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
                </div>
              </div>
            ))}
            {campaigns.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                Nenhuma campanha criada ainda
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}