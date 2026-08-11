/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Loader2,
  Pause,
  Play,
  Plus,
  RadioTower,
  RefreshCw,
  Send,
  XCircle,
} from "lucide-react";

import { AuthGuard } from "@/components/auth/AuthGuard";
import { BroadcastProviderSwitcher } from "@/components/crm/BroadcastProviderSwitcher";
import { CRMLayout, CRMView } from "@/components/crm/CRMLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useActiveOrganization } from "@/hooks/useActiveOrganization";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

type SendingMethod = "single" | "rotate" | "separate";

type WahaSession = {
  id: string;
  session_name: string;
  display_name: string | null;
  phone_number: string | null;
  engine: string;
  status: string;
  is_connected: boolean;
  last_synced_at: string | null;
};

type WahaCampaign = {
  id: string;
  name: string;
  sending_method: SendingMethod;
  status: string;
  total_contacts: number;
  sent_count: number;
  failed_count: number;
  cancelled_count: number;
  min_delay_seconds: number;
  max_delay_seconds: number;
  created_at: string;
};

type ParsedContact = {
  phone: string;
  name: string;
};

const db = supabase as any;

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("55")) return digits;
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits;
}

function parseContacts(value: string): ParsedContact[] {
  const deduped = new Map<string, ParsedContact>();
  value.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    const parts = trimmed.split(/[;,|\t]/).map((part) => part.trim());
    const phoneCandidate = parts.find((part) => part.replace(/\D/g, "").length >= 10);
    if (!phoneCandidate) return;
    const phone = normalizePhone(phoneCandidate);
    if (!phone) return;
    const name = parts.find((part) => part !== phoneCandidate) ?? "";
    if (!deduped.has(phone)) deduped.set(phone, { phone, name });
  });
  return [...deduped.values()];
}

function personalizeMessage(message: string, contact: ParsedContact): string {
  return message
    .replace(/\{\{?nome\}?\}/gi, contact.name)
    .replace(/\{\{?telefone\}?\}/gi, contact.phone);
}

function randomDelay(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function statusBadge(status: string) {
  if (status === "completed") return <Badge className="bg-green-600">Concluída</Badge>;
  if (status === "running") return <Badge className="bg-blue-600">Em execução</Badge>;
  if (status === "paused") return <Badge variant="secondary">Pausada</Badge>;
  if (status === "cancelled") return <Badge variant="destructive">Cancelada</Badge>;
  return <Badge variant="outline">Rascunho</Badge>;
}

export default function BroadcastCampaignsWaha() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { activeOrgId } = useActiveOrganization();
  const [sessions, setSessions] = useState<WahaSession[]>([]);
  const [campaigns, setCampaigns] = useState<WahaCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    message: "",
    contacts: "",
    method: "single" as SendingMethod,
    sessionIds: [] as string[],
    minDelay: 30,
    maxDelay: 60,
  });

  const handleViewChange = (view: CRMView) => {
    if (view === "kanban" || view === "calls") navigate("/");
    else if (view === "settings") navigate("/settings");
    else if (view === "broadcast") navigate("/broadcast");
  };

  const fetchData = useCallback(async () => {
    if (!activeOrgId) {
      setSessions([]);
      setCampaigns([]);
      setLoading(false);
      return;
    }
    try {
      const [sessionsResult, campaignsResult] = await Promise.all([
        db
          .from("waha_config")
          .select("id,session_name,display_name,phone_number,engine,status,is_connected,last_synced_at")
          .eq("organization_id", activeOrgId)
          .order("session_name"),
        db
          .from("broadcast_campaigns_waha")
          .select("*")
          .eq("organization_id", activeOrgId)
          .order("created_at", { ascending: false })
          .limit(100),
      ]);
      if (sessionsResult.error) throw sessionsResult.error;
      if (campaignsResult.error) throw campaignsResult.error;
      setSessions((sessionsResult.data || []) as WahaSession[]);
      setCampaigns((campaignsResult.data || []) as WahaCampaign[]);
    } catch (error) {
      console.error("Erro ao carregar disparador WAHA:", error);
      toast({
        title: "Erro ao carregar WAHA",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [activeOrgId, toast]);

  useEffect(() => {
    void fetchData();
    const interval = window.setInterval(() => void fetchData(), 15000);
    return () => window.clearInterval(interval);
  }, [fetchData]);

  const connectedSessions = useMemo(
    () => sessions.filter((session) => session.is_connected && session.status === "WORKING"),
    [sessions],
  );

  const syncSessions = async () => {
    if (!activeOrgId) return;
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "sync-waha-connection-batch",
        { body: { organizationId: activeOrgId } },
      );
      if (error) throw error;
      await fetchData();
      toast({
        title: "Sessões WAHA sincronizadas",
        description: `${data?.connected ?? 0} sessão(ões) conectada(s).`,
      });
    } catch (error) {
      console.error("Erro ao sincronizar WAHA:", error);
      toast({
        title: "Falha na sincronização",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setSyncing(false);
    }
  };

  const toggleSession = (sessionId: string) => {
    setForm((current) => {
      const selected = current.sessionIds.includes(sessionId);
      const nextIds = selected
        ? current.sessionIds.filter((id) => id !== sessionId)
        : [...current.sessionIds, sessionId];
      return {
        ...current,
        sessionIds: current.method === "single" && !selected
          ? [sessionId]
          : nextIds,
      };
    });
  };

  const resetForm = () => {
    setForm({
      name: "",
      message: "",
      contacts: "",
      method: "single",
      sessionIds: [],
      minDelay: 30,
      maxDelay: 60,
    });
  };

  const createCampaign = async () => {
    if (!activeOrgId) return;
    const contacts = parseContacts(form.contacts);
    if (!form.name.trim() || !form.message.trim()) {
      toast({
        title: "Preencha nome e mensagem",
        variant: "destructive",
      });
      return;
    }
    if (contacts.length === 0) {
      toast({
        title: "Nenhum telefone válido",
        description: "Use uma linha por contato: Nome;5511999999999",
        variant: "destructive",
      });
      return;
    }
    if (form.sessionIds.length === 0) {
      toast({ title: "Selecione uma sessão WAHA", variant: "destructive" });
      return;
    }
    if (form.method === "single" && form.sessionIds.length !== 1) {
      toast({ title: "Envio único exige exatamente uma sessão", variant: "destructive" });
      return;
    }
    if (form.method === "rotate" && form.sessionIds.length < 2) {
      toast({ title: "Rotação exige pelo menos duas sessões", variant: "destructive" });
      return;
    }
    if (
      form.minDelay < 5 ||
      form.maxDelay < form.minDelay ||
      form.maxDelay > 3600
    ) {
      toast({ title: "Intervalo de envio inválido", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw userError ?? new Error("Usuário não autenticado");

      const { data: validation, error: validationError } =
        await supabase.functions.invoke("validate-broadcast-whatsapp-waha", {
          body: {
            organizationId: activeOrgId,
            sessionIds: form.sessionIds,
            phones: contacts.map((contact) => contact.phone),
          },
        });
      if (validationError) throw validationError;
      const validByPhone = new Map<string, string>();
      (validation?.results || []).forEach(
        (item: { phone: string; exists: boolean; chatId: string }) => {
          if (item.exists) validByPhone.set(normalizePhone(item.phone), item.chatId);
        },
      );
      const validContacts = contacts.filter((contact) => validByPhone.has(contact.phone));
      if (validContacts.length === 0) {
        throw new Error("Nenhum contato possui WhatsApp válido");
      }

      const queueCount = form.method === "separate"
        ? validContacts.length * form.sessionIds.length
        : validContacts.length;
      const { data: campaign, error: campaignError } = await db
        .from("broadcast_campaigns_waha")
        .insert({
          organization_id: activeOrgId,
          user_id: user.id,
          name: form.name.trim(),
          custom_message: form.message.trim(),
          sending_method: form.method,
          session_id: form.sessionIds[0],
          session_ids: form.sessionIds,
          min_delay_seconds: form.minDelay,
          max_delay_seconds: form.maxDelay,
          total_contacts: queueCount,
          status: "draft",
        })
        .select("id")
        .single();
      if (campaignError) throw campaignError;

      const queueRows: Record<string, unknown>[] = [];
      if (form.method === "separate") {
        form.sessionIds.forEach((sessionId) => {
          validContacts.forEach((contact) => {
            queueRows.push({
              campaign_id: campaign.id,
              organization_id: activeOrgId,
              session_id: sessionId,
              phone: contact.phone,
              chat_id: validByPhone.get(contact.phone),
              name: contact.name || null,
              personalized_message: personalizeMessage(form.message, contact),
              status: "pending",
            });
          });
        });
      } else {
        validContacts.forEach((contact, index) => {
          const sessionId = form.method === "rotate"
            ? form.sessionIds[index % form.sessionIds.length]
            : form.sessionIds[0];
          queueRows.push({
            campaign_id: campaign.id,
            organization_id: activeOrgId,
            session_id: sessionId,
            phone: contact.phone,
            chat_id: validByPhone.get(contact.phone),
            name: contact.name || null,
            personalized_message: personalizeMessage(form.message, contact),
            status: "pending",
          });
        });
      }

      for (let index = 0; index < queueRows.length; index += 200) {
        const { error: queueError } = await db
          .from("broadcast_queue_waha")
          .insert(queueRows.slice(index, index + 200));
        if (queueError) throw queueError;
      }

      const invalidCount = contacts.length - validContacts.length;
      toast({
        title: "Campanha WAHA criada",
        description: `${validContacts.length} contato(s) válido(s)${
          invalidCount ? `; ${invalidCount} inválido(s) removido(s)` : ""
        }. Revise e clique em iniciar.`,
      });
      setDialogOpen(false);
      resetForm();
      await fetchData();
    } catch (error) {
      console.error("Erro ao criar campanha WAHA:", error);
      toast({
        title: "Erro ao criar campanha WAHA",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const startCampaign = async (campaign: WahaCampaign) => {
    try {
      const { data: queue, error: queueError } = await db
        .from("broadcast_queue_waha")
        .select("id,session_id")
        .eq("campaign_id", campaign.id)
        .eq("status", "pending")
        .order("created_at");
      if (queueError) throw queueError;
      if (!queue?.length) throw new Error("A campanha não possui itens pendentes");

      const cursorBySession = new Map<string, number>();
      const now = Date.now();
      const updates = queue.map((item: { id: string; session_id: string }) => {
        const previous = cursorBySession.get(item.session_id) ?? now;
        const scheduled = previous + randomDelay(
          campaign.min_delay_seconds,
          campaign.max_delay_seconds,
        ) * 1000;
        cursorBySession.set(item.session_id, scheduled);
        return db
          .from("broadcast_queue_waha")
          .update({
            status: "scheduled",
            scheduled_for: new Date(scheduled).toISOString(),
            processing_lock_until: null,
          })
          .eq("id", item.id)
          .eq("status", "pending");
      });
      for (let index = 0; index < updates.length; index += 25) {
        const results = await Promise.all(updates.slice(index, index + 25));
        const failed = results.find((result) => result.error);
        if (failed?.error) throw failed.error;
      }
      const { error: campaignError } = await db
        .from("broadcast_campaigns_waha")
        .update({
          status: "running",
          started_at: new Date().toISOString(),
          completed_at: null,
        })
        .eq("id", campaign.id);
      if (campaignError) throw campaignError;
      await fetchData();
      toast({ title: "Campanha WAHA iniciada" });
    } catch (error) {
      console.error("Erro ao iniciar campanha WAHA:", error);
      toast({
        title: "Falha ao iniciar campanha",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    }
  };

  const pauseCampaign = async (campaignId: string) => {
    try {
      const { error: queueError } = await db
        .from("broadcast_queue_waha")
        .update({ status: "pending", scheduled_for: null, processing_lock_until: null })
        .eq("campaign_id", campaignId)
        .eq("status", "scheduled");
      if (queueError) throw queueError;
      const { error } = await db
        .from("broadcast_campaigns_waha")
        .update({ status: "paused" })
        .eq("id", campaignId);
      if (error) throw error;
      await fetchData();
      toast({ title: "Campanha WAHA pausada" });
    } catch (error) {
      console.error("Erro ao pausar campanha WAHA:", error);
      toast({ title: "Erro ao pausar campanha", variant: "destructive" });
    }
  };

  const cancelCampaign = async (campaignId: string) => {
    try {
      const { error: queueError } = await db
        .from("broadcast_queue_waha")
        .update({ status: "cancelled", processing_lock_until: null })
        .eq("campaign_id", campaignId)
        .in("status", ["pending", "scheduled"]);
      if (queueError) throw queueError;
      const { error } = await db
        .from("broadcast_campaigns_waha")
        .update({ status: "cancelled", completed_at: new Date().toISOString() })
        .eq("id", campaignId);
      if (error) throw error;
      await fetchData();
      toast({ title: "Campanha WAHA cancelada" });
    } catch (error) {
      console.error("Erro ao cancelar campanha WAHA:", error);
      toast({ title: "Erro ao cancelar campanha", variant: "destructive" });
    }
  };

  return (
    <AuthGuard>
      <CRMLayout activeView="broadcast-2" onViewChange={handleViewChange}>
        <div className="h-full overflow-y-auto">
          <div className="p-4 pb-20 md:p-6 md:pb-6">
            <BroadcastProviderSwitcher
              provider="waha"
              onChange={(provider) => {
                if (provider === "evolution") navigate("/broadcast-2");
              }}
            />

            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="flex items-center gap-2 text-2xl font-bold">
                  <RadioTower className="h-6 w-6" />
                  Disparador WAHA
                </h1>
                <p className="text-sm text-muted-foreground">
                  Fluxo GOWS isolado das campanhas e instâncias Evolution.
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={syncing || !activeOrgId}
                  onClick={() => void syncSessions()}
                >
                  {syncing
                    ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    : <RefreshCw className="mr-2 h-4 w-4" />}
                  Sincronizar sessões
                </Button>
                <Button
                  type="button"
                  disabled={connectedSessions.length === 0}
                  onClick={() => setDialogOpen(true)}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Nova campanha WAHA
                </Button>
              </div>
            </div>

            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="text-lg">Sessões WAHA GOWS</CardTitle>
              </CardHeader>
              <CardContent>
                {sessions.length === 0 ? (
                  <div className="flex items-start gap-2 rounded-md border border-dashed p-4 text-sm">
                    <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-500" />
                    <p>
                      Nenhuma sessão encontrada. Crie e conecte a sessão no dashboard WAHA,
                      depois clique em “Sincronizar sessões”.
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {sessions.map((session) => (
                      <div key={session.id} className="rounded-md border p-3">
                        <div className="flex items-center justify-between gap-2">
                          <strong>{session.display_name || session.session_name}</strong>
                          <Badge variant={session.is_connected ? "default" : "destructive"}>
                            {session.status}
                          </Badge>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {session.phone_number || "Telefone não informado"} · {session.engine}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="space-y-3">
              {loading ? (
                <div className="flex items-center justify-center p-10">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : campaigns.length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center text-muted-foreground">
                    Nenhuma campanha WAHA criada nesta organização.
                  </CardContent>
                </Card>
              ) : campaigns.map((campaign) => (
                <Card key={campaign.id}>
                  <CardContent className="p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="font-semibold">{campaign.name}</h2>
                          {statusBadge(campaign.status)}
                          <Badge variant="outline">{campaign.sending_method}</Badge>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Total {campaign.total_contacts} · Enviadas {campaign.sent_count} ·
                          Falhas {campaign.failed_count}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        {(campaign.status === "draft" || campaign.status === "paused") && (
                          <Button
                            size="sm"
                            onClick={() => void startCampaign(campaign)}
                          >
                            <Play className="mr-2 h-4 w-4" />
                            Iniciar
                          </Button>
                        )}
                        {campaign.status === "running" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => void pauseCampaign(campaign.id)}
                          >
                            <Pause className="mr-2 h-4 w-4" />
                            Pausar
                          </Button>
                        )}
                        {!["completed", "cancelled"].includes(campaign.status) && (
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => void cancelCampaign(campaign.id)}
                          >
                            <XCircle className="mr-2 h-4 w-4" />
                            Cancelar
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                      <div className="rounded bg-muted p-2">
                        <CheckCircle2 className="mx-auto mb-1 h-4 w-4 text-green-600" />
                        {campaign.sent_count} enviadas
                      </div>
                      <div className="rounded bg-muted p-2">
                        <XCircle className="mx-auto mb-1 h-4 w-4 text-red-600" />
                        {campaign.failed_count} falhas
                      </div>
                      <div className="rounded bg-muted p-2">
                        <Clock className="mx-auto mb-1 h-4 w-4" />
                        {campaign.min_delay_seconds}–{campaign.max_delay_seconds}s
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Nova campanha WAHA</DialogTitle>
              <DialogDescription>
                Os contatos serão validados pela WAHA antes de entrar na fila isolada.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="waha-name">Nome da campanha</Label>
                <Input
                  id="waha-name"
                  value={form.name}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, name: event.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="waha-method">Método de envio</Label>
                <Select
                  value={form.method}
                  onValueChange={(method: SendingMethod) =>
                    setForm((current) => ({
                      ...current,
                      method,
                      sessionIds: method === "single"
                        ? current.sessionIds.slice(0, 1)
                        : current.sessionIds,
                    }))
                  }
                >
                  <SelectTrigger id="waha-method">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="single">Único — uma sessão</SelectItem>
                    <SelectItem value="rotate">Rotacionado — alterna sessões</SelectItem>
                    <SelectItem value="separate">Separado — toda lista por sessão</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Sessões conectadas</Label>
                <div className="grid gap-2 rounded-md border p-3 sm:grid-cols-2">
                  {connectedSessions.map((session) => (
                    <label
                      key={session.id}
                      className="flex cursor-pointer items-center gap-2 text-sm"
                    >
                      <Checkbox
                        checked={form.sessionIds.includes(session.id)}
                        onCheckedChange={() => toggleSession(session.id)}
                      />
                      {session.display_name || session.session_name}
                    </label>
                  ))}
                </div>
                {form.method === "rotate" && connectedSessions.length < 2 && (
                  <p className="text-xs text-amber-600">
                    O modo rotacionado precisa de duas ou mais sessões disponíveis.
                  </p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="waha-min-delay">Intervalo mínimo (segundos)</Label>
                  <Input
                    id="waha-min-delay"
                    type="number"
                    min={5}
                    value={form.minDelay}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        minDelay: Number(event.target.value),
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="waha-max-delay">Intervalo máximo (segundos)</Label>
                  <Input
                    id="waha-max-delay"
                    type="number"
                    min={5}
                    value={form.maxDelay}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        maxDelay: Number(event.target.value),
                      }))
                    }
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="waha-message">Mensagem</Label>
                <Textarea
                  id="waha-message"
                  rows={5}
                  placeholder="Olá, {nome}! ..."
                  value={form.message}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, message: event.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="waha-contacts">Contatos</Label>
                <Textarea
                  id="waha-contacts"
                  rows={7}
                  placeholder={"João;5511999999999\nMaria;5511888888888"}
                  value={form.contacts}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, contacts: event.target.value }))
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Até 500 números por campanha. Duplicados são removidos automaticamente.
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Fechar
              </Button>
              <Button disabled={saving} onClick={() => void createCampaign()}>
                {saving
                  ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  : <Send className="mr-2 h-4 w-4" />}
                Validar e criar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CRMLayout>
    </AuthGuard>
  );
}
