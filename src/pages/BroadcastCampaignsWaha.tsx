/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Loader2,
  MessageSquareText,
  Pause,
  Play,
  Plus,
  RadioTower,
  RefreshCw,
  Save,
  Send,
  TestTube2,
  Trash2,
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

type WahaTemplate = {
  id: string;
  name: string;
  description: string | null;
  custom_message: string;
  sending_method: SendingMethod;
  min_delay_seconds: number;
  max_delay_seconds: number;
};

type WahaValidationItem = {
  phone: string;
  exists: boolean;
  chatId: string;
  error?: string;
};

type WahaValidation = {
  results: WahaValidationItem[];
  valid: number;
  invalid: number;
  total: number;
  formatted: number;
  formattingInvalid: number;
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
  const [templates, setTemplates] = useState<WahaTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [validatingContacts, setValidatingContacts] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [simulationDialogOpen, setSimulationDialogOpen] = useState(false);
  const [validationResult, setValidationResult] = useState<WahaValidation | null>(null);
  const [form, setForm] = useState({
    name: "",
    message: "",
    contacts: "",
    templateId: "",
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
      setTemplates([]);
      setLoading(false);
      return;
    }
    try {
      const [sessionsResult, campaignsResult, templatesResult] = await Promise.all([
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
        db
          .from("broadcast_templates_waha")
          .select("*")
          .eq("organization_id", activeOrgId)
          .order("name"),
      ]);
      if (sessionsResult.error) throw sessionsResult.error;
      if (campaignsResult.error) throw campaignsResult.error;
      if (templatesResult.error) throw templatesResult.error;
      setSessions((sessionsResult.data || []) as WahaSession[]);
      setCampaigns((campaignsResult.data || []) as WahaCampaign[]);
      setTemplates((templatesResult.data || []) as WahaTemplate[]);
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

  const patchForm = (
    patch: Partial<typeof form>,
    invalidateValidation = true,
  ) => {
    setForm((current) => ({ ...current, ...patch }));
    if (invalidateValidation) setValidationResult(null);
  };

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
    setValidationResult(null);
  };

  const resetForm = () => {
    setForm({
      name: "",
      message: "",
      contacts: "",
      templateId: "",
      method: "single",
      sessionIds: [],
      minDelay: 30,
      maxDelay: 60,
    });
    setValidationResult(null);
    setSimulationDialogOpen(false);
  };

  const validateContacts = async (): Promise<WahaValidation | null> => {
    if (!activeOrgId) return null;
    const rawTotal = form.contacts.split(/\r?\n/).filter((line) => line.trim()).length;
    const contacts = parseContacts(form.contacts);
    if (contacts.length === 0) {
      toast({
        title: "Nenhum telefone com formato válido",
        description: "Use uma linha por contato: Nome;5511999999999",
        variant: "destructive",
      });
      return null;
    }
    if (form.sessionIds.length === 0) {
      toast({ title: "Selecione uma sessão WAHA", variant: "destructive" });
      return null;
    }
    if (form.method === "single" && form.sessionIds.length !== 1) {
      toast({ title: "Envio único exige exatamente uma sessão", variant: "destructive" });
      return null;
    }
    if (form.method === "rotate" && form.sessionIds.length < 2) {
      toast({ title: "Rotação exige pelo menos duas sessões", variant: "destructive" });
      return null;
    }

    setValidatingContacts(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "validate-broadcast-whatsapp-waha",
        {
          body: {
            organizationId: activeOrgId,
            sessionIds: form.sessionIds,
            phones: contacts.map((contact) => contact.phone),
          },
        },
      );
      if (error) throw error;
      const results = (data?.results || []) as WahaValidationItem[];
      const summary: WahaValidation = {
        results,
        valid: results.filter((item) => item.exists).length,
        invalid: results.filter((item) => !item.exists).length,
        total: rawTotal,
        formatted: contacts.length,
        formattingInvalid: Math.max(0, rawTotal - contacts.length),
      };
      setValidationResult(summary);
      toast({
        title: "Validação WhatsApp concluída",
        description: `${summary.valid} válido(s), ${summary.invalid} sem WhatsApp e ${summary.formattingInvalid} com formato inválido.`,
        variant: summary.valid > 0 ? "default" : "destructive",
      });
      return summary;
    } catch (error) {
      console.error("Erro ao validar contatos WAHA:", error);
      setValidationResult(null);
      toast({
        title: "Falha ao validar WhatsApp",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
      return null;
    } finally {
      setValidatingContacts(false);
    }
  };

  const applyTemplate = (templateId: string) => {
    const template = templates.find((item) => item.id === templateId);
    if (!template) return;
    patchForm({
      templateId: template.id,
      name: template.name,
      message: template.custom_message,
      method: template.sending_method,
      minDelay: template.min_delay_seconds,
      maxDelay: template.max_delay_seconds,
      sessionIds: template.sending_method === "single"
        ? form.sessionIds.slice(0, 1)
        : form.sessionIds,
    });
    toast({
      title: "Template WAHA carregado",
      description: `Revise contatos e sessões antes de validar.`,
    });
  };

  const saveCurrentAsTemplate = async () => {
    if (!activeOrgId || !form.name.trim() || !form.message.trim()) {
      toast({
        title: "Informe nome e mensagem para salvar o template",
        variant: "destructive",
      });
      return;
    }
    setSavingTemplate(true);
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw userError ?? new Error("Usuário não autenticado");
      const { error } = await db.from("broadcast_templates_waha").upsert({
        organization_id: activeOrgId,
        user_id: user.id,
        name: form.name.trim(),
        custom_message: form.message.trim(),
        sending_method: form.method,
        min_delay_seconds: form.minDelay,
        max_delay_seconds: form.maxDelay,
        updated_at: new Date().toISOString(),
      }, { onConflict: "organization_id,name" });
      if (error) throw error;
      await fetchData();
      toast({ title: "Template WAHA salvo" });
    } catch (error) {
      console.error("Erro ao salvar template WAHA:", error);
      toast({
        title: "Erro ao salvar template",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setSavingTemplate(false);
    }
  };

  const deleteTemplate = async (templateId: string) => {
    try {
      const { error } = await db
        .from("broadcast_templates_waha")
        .delete()
        .eq("id", templateId)
        .eq("organization_id", activeOrgId);
      if (error) throw error;
      if (form.templateId === templateId) patchForm({ templateId: "" });
      await fetchData();
      toast({ title: "Template WAHA excluído" });
    } catch (error) {
      console.error("Erro ao excluir template WAHA:", error);
      toast({ title: "Erro ao excluir template", variant: "destructive" });
    }
  };

  const simulation = useMemo(() => {
    if (!validationResult) return null;
    const contacts = parseContacts(form.contacts);
    const validPhones = new Set(
      validationResult.results.filter((item) => item.exists).map((item) => normalizePhone(item.phone)),
    );
    const validContacts = contacts.filter((contact) => validPhones.has(contact.phone));
    const distribution = new Map<string, number>();
    form.sessionIds.forEach((sessionId) => distribution.set(sessionId, 0));
    if (form.method === "separate") {
      form.sessionIds.forEach((sessionId) => distribution.set(sessionId, validContacts.length));
    } else {
      validContacts.forEach((_, index) => {
        const sessionId = form.method === "rotate"
          ? form.sessionIds[index % form.sessionIds.length]
          : form.sessionIds[0];
        if (sessionId) distribution.set(sessionId, (distribution.get(sessionId) ?? 0) + 1);
      });
    }
    const averageDelay = (form.minDelay + form.maxDelay) / 2;
    const largestSessionQueue = Math.max(0, ...distribution.values());
    const estimatedSeconds = largestSessionQueue * averageDelay;
    return {
      validContacts,
      queueCount: form.method === "separate"
        ? validContacts.length * form.sessionIds.length
        : validContacts.length,
      estimatedSeconds,
      distribution: [...distribution.entries()].map(([sessionId, count]) => ({
        session: sessions.find((item) => item.id === sessionId),
        count,
      })),
      preview: validContacts[0]
        ? personalizeMessage(form.message, validContacts[0])
        : form.message,
    };
  }, [
    form.contacts,
    form.maxDelay,
    form.message,
    form.method,
    form.minDelay,
    form.sessionIds,
    sessions,
    validationResult,
  ]);

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

      const validation = validationResult ?? await validateContacts();
      if (!validation) throw new Error("Valide os contatos antes de criar a campanha");
      const validByPhone = new Map<string, string>();
      validation.results.forEach(
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

            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <MessageSquareText className="h-5 w-5" />
                  Templates WAHA
                </CardTitle>
              </CardHeader>
              <CardContent>
                {templates.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Nenhum template WAHA salvo. Abra uma nova campanha, preencha a mensagem
                    e clique em “Salvar como template”.
                  </p>
                ) : (
                  <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                    {templates.map((template) => (
                      <div key={template.id} className="rounded-md border p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <strong>{template.name}</strong>
                            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                              {template.custom_message}
                            </p>
                          </div>
                          <Badge variant="outline">{template.sending_method}</Badge>
                        </div>
                        <div className="mt-3 flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              applyTemplate(template.id);
                              setDialogOpen(true);
                            }}
                          >
                            Usar template
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            aria-label={`Excluir template ${template.name}`}
                            onClick={() => void deleteTemplate(template.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
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
              {templates.length > 0 && (
                <div className="space-y-2">
                  <Label htmlFor="waha-template">Template WAHA (opcional)</Label>
                  <Select
                    value={form.templateId || "none"}
                    onValueChange={(value) => {
                      if (value === "none") patchForm({ templateId: "" });
                      else applyTemplate(value);
                    }}
                  >
                    <SelectTrigger id="waha-template">
                      <SelectValue placeholder="Selecione um template" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sem template</SelectItem>
                      {templates.map((template) => (
                        <SelectItem key={template.id} value={template.id}>
                          {template.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="waha-name">Nome da campanha</Label>
                <Input
                  id="waha-name"
                  value={form.name}
                  onChange={(event) =>
                    patchForm({ name: event.target.value }, false)
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="waha-method">Método de envio</Label>
                <Select
                  value={form.method}
                  onValueChange={(method: SendingMethod) =>
                    patchForm({
                      method,
                      sessionIds: method === "single"
                        ? form.sessionIds.slice(0, 1)
                        : form.sessionIds,
                    })
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
                      patchForm({
                        minDelay: Number(event.target.value),
                      })
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
                      patchForm({
                        maxDelay: Number(event.target.value),
                      })
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
                    patchForm({ message: event.target.value })
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
                    patchForm({ contacts: event.target.value })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Até 500 números por campanha. Duplicados são removidos automaticamente.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={validatingContacts || saving || form.sessionIds.length === 0}
                  onClick={() => void validateContacts()}
                >
                  {validatingContacts
                    ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    : <CheckCircle2 className="mr-2 h-4 w-4" />}
                  Checar e validar WhatsApp
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={!validationResult || validationResult.valid === 0}
                  onClick={() => setSimulationDialogOpen(true)}
                >
                  <TestTube2 className="mr-2 h-4 w-4" />
                  Simular envio
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={savingTemplate || !form.name.trim() || !form.message.trim()}
                  onClick={() => void saveCurrentAsTemplate()}
                >
                  {savingTemplate
                    ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    : <Save className="mr-2 h-4 w-4" />}
                  Salvar como template
                </Button>
              </div>

              {validatingContacts && (
                <div className="rounded-md border bg-muted/40 p-3 text-sm">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Validando números diretamente na sessão WAHA…
                  </div>
                </div>
              )}

              {validationResult && !validatingContacts && (
                <div className="space-y-3 rounded-md border p-3">
                  <div className="grid grid-cols-2 gap-2 text-center text-xs sm:grid-cols-4">
                    <div className="rounded bg-muted p-2">
                      <strong className="block text-base">{validationResult.total}</strong>
                      Informados
                    </div>
                    <div className="rounded bg-muted p-2">
                      <strong className="block text-base">{validationResult.formatted}</strong>
                      Formato válido
                    </div>
                    <div className="rounded bg-green-50 p-2 text-green-700">
                      <strong className="block text-base">{validationResult.valid}</strong>
                      Com WhatsApp
                    </div>
                    <div className="rounded bg-red-50 p-2 text-red-700">
                      <strong className="block text-base">
                        {validationResult.invalid + validationResult.formattingInvalid}
                      </strong>
                      Inválidos
                    </div>
                  </div>
                  {validationResult.results.some((item) => !item.exists) && (
                    <div>
                      <p className="mb-1 text-xs font-medium">Números sem WhatsApp:</p>
                      <div className="flex max-h-24 flex-wrap gap-1 overflow-y-auto">
                        {validationResult.results
                          .filter((item) => !item.exists)
                          .map((item) => (
                            <Badge key={item.phone} variant="destructive">
                              {item.phone}
                            </Badge>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Fechar
              </Button>
              <Button
                disabled={saving || validatingContacts || !validationResult?.valid}
                onClick={() => void createCampaign()}
              >
                {saving
                  ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  : <Send className="mr-2 h-4 w-4" />}
                Criar campanha
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={simulationDialogOpen} onOpenChange={setSimulationDialogOpen}>
          <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Simulação do envio WAHA</DialogTitle>
              <DialogDescription>
                Esta simulação não envia mensagens nem grava a campanha.
              </DialogDescription>
            </DialogHeader>
            {simulation && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Card>
                    <CardContent className="p-3 text-center">
                      <strong className="block text-xl">{validationResult?.total ?? 0}</strong>
                      <span className="text-xs text-muted-foreground">Informados</span>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-3 text-center">
                      <strong className="block text-xl text-green-600">
                        {simulation.validContacts.length}
                      </strong>
                      <span className="text-xs text-muted-foreground">Com WhatsApp</span>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-3 text-center">
                      <strong className="block text-xl">{simulation.queueCount}</strong>
                      <span className="text-xs text-muted-foreground">Mensagens na fila</span>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-3 text-center">
                      <strong className="block text-xl">
                        {Math.max(1, Math.ceil(simulation.estimatedSeconds / 60))} min
                      </strong>
                      <span className="text-xs text-muted-foreground">Estimativa</span>
                    </CardContent>
                  </Card>
                </div>

                <div className="rounded-md border p-3">
                  <p className="mb-2 text-sm font-medium">Distribuição por sessão</p>
                  <div className="space-y-2">
                    {simulation.distribution.map((item) => (
                      <div
                        key={item.session?.id ?? "unknown"}
                        className="flex items-center justify-between rounded bg-muted px-3 py-2 text-sm"
                      >
                        <span>{item.session?.display_name || item.session?.session_name || "Sessão"}</span>
                        <Badge variant="outline">{item.count} mensagem(ns)</Badge>
                      </div>
                    ))}
                  </div>
                </div>

                {form.method === "separate" && (
                  <div className="flex gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    No método separado, cada sessão enviará para toda a lista. Por isso o
                    volume total é multiplicado pelo número de sessões.
                  </div>
                )}

                <div className="rounded-md border p-3">
                  <p className="mb-2 text-sm font-medium">Prévia personalizada</p>
                  <div className="whitespace-pre-wrap rounded bg-green-50 p-3 text-sm">
                    {simulation.preview}
                  </div>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setSimulationDialogOpen(false)}
              >
                Voltar e ajustar
              </Button>
              <Button
                type="button"
                onClick={() => setSimulationDialogOpen(false)}
              >
                Simulação aprovada
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CRMLayout>
    </AuthGuard>
  );
}
