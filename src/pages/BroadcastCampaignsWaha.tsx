/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileText,
  Image as ImageIcon,
  Loader2,
  MessageSquareText,
  Pause,
  Play,
  Plus,
  RadioTower,
  RefreshCw,
  Save,
  Search,
  Send,
  TestTube2,
  Trash2,
  X,
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
import { ScrollArea } from "@/components/ui/scroll-area";
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
import { validateImageFile } from "@/lib/broadcastValidators";

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
  image_url?: string | null;
};

type ParsedContact = {
  phone: string;
  name: string;
  empresa: string;
};

type WahaTemplate = {
  id: string;
  name: string;
  description: string | null;
  custom_message: string;
  message_variations: string[];
  image_url?: string | null;
};

const BUCKET_ID = "whatsapp-workflow-media";
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

function WahaImageField({
  inputId,
  preview,
  uploading,
  disabled,
  onSelect,
  onRemove,
}: {
  inputId: string;
  preview: string | null;
  uploading: boolean;
  disabled?: boolean;
  onSelect: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={inputId}>Imagem / logo (opcional)</Label>
      {preview ? (
        <div className="relative">
          <img
            src={preview}
            alt="Preview da logo da campanha"
            className="h-48 w-full rounded-lg border object-cover"
          />
          <Button
            type="button"
            variant="destructive"
            size="sm"
            className="absolute right-2 top-2"
            onClick={onRemove}
            disabled={disabled || uploading}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div className="rounded-lg border-2 border-dashed p-6 text-center">
          <ImageIcon className="mx-auto mb-2 h-12 w-12 text-muted-foreground" />
          <Label htmlFor={inputId} className="cursor-pointer">
            <span className="text-sm text-muted-foreground">
              Clique para fazer upload de uma imagem
            </span>
            <Input
              id={inputId}
              type="file"
              accept={ALLOWED_IMAGE_TYPES.join(",")}
              onChange={onSelect}
              className="hidden"
              disabled={disabled || uploading}
            />
          </Label>
          <p className="mt-2 text-xs text-muted-foreground">
            JPEG, PNG ou WEBP (máx. 5MB). A logo será enviada junto com a mensagem,
            como nas campanhas Evolution.
          </p>
        </div>
      )}
      {uploading && (
        <p className="text-sm text-muted-foreground">Fazendo upload...</p>
      )}
    </div>
  );
}

type WahaValidationItem = {
  phone: string;
  exists: boolean;
  chatId: string;
  error?: string;
};

type WahaQueueLog = {
  id: string;
  campaign_id: string;
  session_id: string;
  phone: string;
  name: string | null;
  personalized_message: string;
  status: string;
  scheduled_for: string | null;
  sent_at: string | null;
  failed_at: string | null;
  error_message: string | null;
  failure_code: string | null;
  send_attempts: number;
  created_at: string;
  session?: {
    id: string;
    session_name: string;
    display_name: string | null;
  } | null;
};

function queueLogStatusLabel(status: string): string {
  if (status === "sent") return "Enviado";
  if (status === "failed") return "Falhou";
  if (status === "scheduled") return "Agendado";
  if (status === "cancelled") return "Cancelado";
  return "Pendente";
}

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
  const lines = value.split(/\r?\n/).filter((line) => line.trim());
  const firstParts = (lines[0] || "")
    .split(/[;,|\t]/)
    .map((part) => part.trim().toLowerCase());
  const hasHeader = firstParts.some((part) =>
    ["telefone", "phone", "celular", "whatsapp", "numero", "número"].includes(part)
  );
  const header = hasHeader ? firstParts : [];

  lines.slice(hasHeader ? 1 : 0).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    const parts = trimmed.split(/[;,|\t]/).map((part) => part.trim());
    const phoneHeaderIndex = header.findIndex((part) =>
      ["telefone", "phone", "celular", "whatsapp", "numero", "número"].includes(part)
    );
    const phoneCandidate = phoneHeaderIndex >= 0
      ? parts[phoneHeaderIndex]
      : parts.find((part) => part.replace(/\D/g, "").length >= 10);
    if (!phoneCandidate) return;
    const phone = normalizePhone(phoneCandidate);
    if (!phone) return;
    const nonPhoneParts = parts.filter((_, index) =>
      phoneHeaderIndex >= 0 ? index !== phoneHeaderIndex : parts[index] !== phoneCandidate
    );
    const nameHeaderIndex = header.findIndex((part) =>
      ["nome", "name", "cliente", "contato"].includes(part)
    );
    const companyHeaderIndex = header.findIndex((part) =>
      [
        "empresa",
        "company",
        "companhia",
        "nome_empresa",
        "nome da empresa",
        "razão social",
        "razao social",
      ].includes(part)
    );
    const name = nameHeaderIndex >= 0 ? parts[nameHeaderIndex] || "" : nonPhoneParts[0] || "";
    const empresa = companyHeaderIndex >= 0
      ? parts[companyHeaderIndex] || ""
      : nonPhoneParts[1] || "";
    if (!deduped.has(phone)) deduped.set(phone, { phone, name, empresa });
  });
  return [...deduped.values()];
}

function personalizeMessage(message: string, contact: ParsedContact): string {
  const replacements: Record<string, string> = {
    nome: contact.name,
    name: contact.name,
    empresa: contact.empresa,
    nome_empresa: contact.empresa,
    telefone: contact.phone,
    phone: contact.phone,
  };
  return message.replace(/\{\{?(\w+)\}?\}/gi, (_, key: string) =>
    replacements[key.toLowerCase()] ?? ""
  );
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
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [simulationDialogOpen, setSimulationDialogOpen] = useState(false);
  const [validationResult, setValidationResult] = useState<WahaValidation | null>(null);
  const [form, setForm] = useState({
    name: "",
    message: "",
    messageVariations: [] as string[],
    contacts: "",
    templateId: "",
    method: "single" as SendingMethod,
    sessionIds: [] as string[],
    minDelay: 30,
    maxDelay: 60,
    imageUrl: "" as string,
  });
  const [templateForm, setTemplateForm] = useState({
    name: "",
    description: "",
    message: "",
    messageVariations: [] as string[],
    imageUrl: "" as string,
  });
  const [campaignImagePreview, setCampaignImagePreview] = useState<string | null>(null);
  const [templateImagePreview, setTemplateImagePreview] = useState<string | null>(null);
  const [uploadingCampaignImage, setUploadingCampaignImage] = useState(false);
  const [uploadingTemplateImage, setUploadingTemplateImage] = useState(false);
  const [logsDialogOpen, setLogsDialogOpen] = useState(false);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsCampaignName, setLogsCampaignName] = useState("");
  const [selectedCampaignLogs, setSelectedCampaignLogs] = useState<WahaQueueLog[]>([]);
  const [logsSearchQuery, setLogsSearchQuery] = useState("");
  const [logsSessionFilter, setLogsSessionFilter] = useState("all");
  const [logsSortOrder, setLogsSortOrder] = useState<"asc" | "desc">("asc");
  const messagesToUse = useMemo(() => {
    const variations = form.messageVariations
      .map((message) => message.trim())
      .filter(Boolean);
    if (variations.length > 0) return variations;
    return form.message.trim() ? [form.message.trim()] : [];
  }, [form.message, form.messageVariations]);
  const templateMessagesToUse = useMemo(() => {
    const variations = templateForm.messageVariations
      .map((message) => message.trim())
      .filter(Boolean);
    if (variations.length > 0) return variations;
    return templateForm.message.trim() ? [templateForm.message.trim()] : [];
  }, [templateForm.message, templateForm.messageVariations]);

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

  const uploadWahaImage = async (
    file: File,
    folder: "broadcast-waha-campaigns" | "broadcast-waha-templates",
  ): Promise<string | null> => {
    if (!activeOrgId) {
      toast({ title: "Organização não encontrada", variant: "destructive" });
      return null;
    }
    const validation = validateImageFile(file);
    if (!validation.valid) {
      toast({
        title: "Arquivo inválido",
        description: validation.error || "Arquivo não é válido",
        variant: "destructive",
      });
      return null;
    }
    const fileExt = file.name.split(".").pop();
    const filePath = `${activeOrgId}/${folder}/${crypto.randomUUID()}-${Date.now()}.${fileExt}`;
    const { error: uploadError } = await supabase.storage
      .from(BUCKET_ID)
      .upload(filePath, file, { upsert: false, cacheControl: "86400" });
    if (uploadError) throw uploadError;
    const { data } = supabase.storage.from(BUCKET_ID).getPublicUrl(filePath);
    return data.publicUrl;
  };

  const handleCampaignImageSelect = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const localPreview = URL.createObjectURL(file);
    setCampaignImagePreview(localPreview);
    setUploadingCampaignImage(true);
    try {
      const publicUrl = await uploadWahaImage(file, "broadcast-waha-campaigns");
      if (!publicUrl) {
        setCampaignImagePreview(null);
        return;
      }
      patchForm({ imageUrl: publicUrl }, false);
      setCampaignImagePreview(publicUrl);
      toast({ title: "Upload concluído", description: "Imagem carregada com sucesso" });
    } catch (error) {
      setCampaignImagePreview(null);
      patchForm({ imageUrl: "" }, false);
      toast({
        title: "Erro no upload",
        description: error instanceof Error ? error.message : "Falha ao fazer upload",
        variant: "destructive",
      });
    } finally {
      setUploadingCampaignImage(false);
    }
  };

  const handleTemplateImageSelect = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const localPreview = URL.createObjectURL(file);
    setTemplateImagePreview(localPreview);
    setUploadingTemplateImage(true);
    try {
      const publicUrl = await uploadWahaImage(file, "broadcast-waha-templates");
      if (!publicUrl) {
        setTemplateImagePreview(null);
        return;
      }
      setTemplateForm((current) => ({ ...current, imageUrl: publicUrl }));
      setTemplateImagePreview(publicUrl);
      toast({ title: "Upload concluído", description: "Imagem carregada com sucesso" });
    } catch (error) {
      setTemplateImagePreview(null);
      setTemplateForm((current) => ({ ...current, imageUrl: "" }));
      toast({
        title: "Erro no upload",
        description: error instanceof Error ? error.message : "Falha ao fazer upload",
        variant: "destructive",
      });
    } finally {
      setUploadingTemplateImage(false);
    }
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
      messageVariations: [],
      contacts: "",
      templateId: "",
      method: "single",
      sessionIds: [],
      minDelay: 30,
      maxDelay: 60,
      imageUrl: "",
    });
    setCampaignImagePreview(null);
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
    const variations = Array.isArray(template.message_variations)
      ? template.message_variations.map((message) => message.trim()).filter(Boolean)
      : [];
    patchForm({
      templateId: template.id,
      message: variations.length > 0 ? "" : template.custom_message,
      messageVariations: variations,
      imageUrl: template.image_url || "",
    });
    setCampaignImagePreview(template.image_url || null);
    toast({
      title: "Template WAHA carregado",
      description: `${variations.length || 1} mensagem(ns) carregada(s). Revise contatos e sessões.`,
    });
  };

  const resetTemplateForm = () => {
    setTemplateForm({
      name: "",
      description: "",
      message: "",
      messageVariations: [],
      imageUrl: "",
    });
    setTemplateImagePreview(null);
  };

  const appendTemplateTag = (tag: "{nome}" | "{empresa}") => {
    setTemplateForm((current) => ({
      ...current,
      message: `${current.message}${current.message ? " " : ""}${tag}`,
    }));
  };

  const appendCampaignTag = (tag: "{nome}" | "{empresa}") => {
    patchForm({
      message: `${form.message}${form.message ? " " : ""}${tag}`,
      templateId: "",
    });
  };

  const saveTemplate = async () => {
    if (
      !activeOrgId ||
      !templateForm.name.trim() ||
      templateMessagesToUse.length === 0
    ) {
      toast({
        title: "Informe nome e pelo menos uma mensagem para salvar o template",
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
        name: templateForm.name.trim(),
        description: templateForm.description.trim() || null,
        custom_message: templateForm.message.trim() || templateMessagesToUse[0],
        message_variations: templateForm.messageVariations
          .map((message) => message.trim())
          .filter(Boolean),
        image_url: templateForm.imageUrl.trim() || null,
        updated_at: new Date().toISOString(),
      }, { onConflict: "organization_id,name" });
      if (error) throw error;
      await fetchData();
      setTemplateDialogOpen(false);
      resetTemplateForm();
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
      previews: messagesToUse.map((message, index) => ({
        index,
        message: validContacts[0]
          ? personalizeMessage(message, validContacts[0])
          : message,
      })),
    };
  }, [
    form.contacts,
    form.maxDelay,
    form.method,
    form.minDelay,
    form.sessionIds,
    messagesToUse,
    sessions,
    validationResult,
  ]);

  const createCampaign = async () => {
    if (!activeOrgId) return;
    const contacts = parseContacts(form.contacts);
    if (!form.name.trim() || messagesToUse.length === 0) {
      toast({
        title: "Preencha o nome e adicione pelo menos uma mensagem",
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
      const requiredTags = new Set(
        messagesToUse.flatMap((message) =>
          [...message.matchAll(/\{\{?(\w+)\}?\}/gi)].map((match) =>
            match[1].toLowerCase()
          )
        ),
      );
      const supportedTags = new Set([
        "nome",
        "name",
        "empresa",
        "nome_empresa",
        "telefone",
        "phone",
      ]);
      const unsupportedTags = [...requiredTags].filter((tag) => !supportedTags.has(tag));
      if (unsupportedTags.length > 0) {
        throw new Error(`Tags não suportadas: ${unsupportedTags.join(", ")}`);
      }
      const missingName = validContacts.filter((contact) => !contact.name.trim()).length;
      if (
        missingName > 0 &&
        (requiredTags.has("nome") || requiredTags.has("name"))
      ) {
        throw new Error(`${missingName} contato(s) sem nome para preencher a tag {nome}`);
      }
      const missingCompany = validContacts.filter((contact) => !contact.empresa.trim()).length;
      if (
        missingCompany > 0 &&
        (requiredTags.has("empresa") || requiredTags.has("nome_empresa"))
      ) {
        throw new Error(
          `${missingCompany} contato(s) sem empresa para preencher a tag {empresa}`,
        );
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
          custom_message: form.message.trim() || messagesToUse[0],
          message_variations: form.messageVariations
            .map((message) => message.trim())
            .filter(Boolean),
          sending_method: form.method,
          session_id: form.sessionIds[0],
          session_ids: form.sessionIds,
          min_delay_seconds: form.minDelay,
          max_delay_seconds: form.maxDelay,
          total_contacts: queueCount,
          status: "draft",
          image_url: form.imageUrl.trim() || null,
        })
        .select("id")
        .single();
      if (campaignError) throw campaignError;

      const queueRows: Record<string, unknown>[] = [];
      if (form.method === "separate") {
        form.sessionIds.forEach((sessionId) => {
          validContacts.forEach((contact, index) => {
            const selectedMessage = messagesToUse[index % messagesToUse.length];
            queueRows.push({
              campaign_id: campaign.id,
              organization_id: activeOrgId,
              session_id: sessionId,
              phone: contact.phone,
              chat_id: validByPhone.get(contact.phone),
              name: contact.name || null,
              personalized_message: personalizeMessage(selectedMessage, contact),
              status: "pending",
            });
          });
        });
      } else {
        validContacts.forEach((contact, index) => {
          const selectedMessage = messagesToUse[index % messagesToUse.length];
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
            personalized_message: personalizeMessage(selectedMessage, contact),
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

  const handleViewLogs = async (campaign: WahaCampaign) => {
    setLogsLoading(true);
    setLogsCampaignName(campaign.name);
    setLogsSearchQuery("");
    setLogsSessionFilter("all");
    setLogsSortOrder("asc");
    try {
      const { data, error } = await db
        .from("broadcast_queue_waha")
        .select(`
          id,
          campaign_id,
          session_id,
          phone,
          name,
          personalized_message,
          status,
          scheduled_for,
          sent_at,
          failed_at,
          error_message,
          failure_code,
          send_attempts,
          created_at,
          session:waha_config!session_id(id, session_name, display_name)
        `)
        .eq("campaign_id", campaign.id)
        .eq("organization_id", activeOrgId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const rows = ((data || []) as WahaQueueLog[]).map((row) => ({
        ...row,
        session: Array.isArray(row.session) ? row.session[0] : row.session,
      }));
      setSelectedCampaignLogs(rows);
      setLogsDialogOpen(true);
    } catch (error) {
      console.error("Erro ao buscar logs WAHA:", error);
      toast({
        title: "Erro ao buscar logs",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setLogsLoading(false);
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
              <CardHeader className="flex flex-row items-center justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <MessageSquareText className="h-5 w-5" />
                    Templates WAHA
                  </CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Cadastre mensagens e variações antes de criar uma campanha.
                  </p>
                </div>
                <Button
                  type="button"
                  onClick={() => {
                    resetTemplateForm();
                    setTemplateDialogOpen(true);
                  }}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Novo template WAHA
                </Button>
              </CardHeader>
              <CardContent>
                {templates.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Nenhum template WAHA salvo. Clique em “Novo template WAHA” para
                    cadastrar o primeiro.
                  </p>
                ) : (
                  <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                    {templates.map((template) => (
                      <div key={template.id} className="rounded-md border p-3">
                        {template.image_url && (
                          <img
                            src={template.image_url}
                            alt={`Logo do template ${template.name}`}
                            className="mb-3 h-24 w-full rounded-md border object-cover"
                          />
                        )}
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <strong>{template.name}</strong>
                            {template.description && (
                              <p className="mt-1 text-xs text-muted-foreground">
                                {template.description}
                              </p>
                            )}
                            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                              {template.message_variations?.[0] || template.custom_message}
                            </p>
                          </div>
                          <Badge variant="secondary">
                            {template.message_variations?.length || 1} variação(ões)
                          </Badge>
                        </div>
                        {template.image_url && (
                          <Badge variant="outline" className="mt-2 text-xs">
                            Com logo
                          </Badge>
                        )}
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
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex min-w-0 flex-1 gap-3">
                        {campaign.image_url && (
                          <img
                            src={campaign.image_url}
                            alt={`Logo da campanha ${campaign.name}`}
                            className="h-16 w-16 shrink-0 rounded-md border object-cover"
                          />
                        )}
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h2 className="font-semibold">{campaign.name}</h2>
                            {statusBadge(campaign.status)}
                            <Badge variant="outline">{campaign.sending_method}</Badge>
                            {campaign.image_url && (
                              <Badge variant="outline">Com logo</Badge>
                            )}
                          </div>
                          <p className="mt-1 text-sm text-muted-foreground">
                            Total {campaign.total_contacts} · Enviadas {campaign.sent_count} ·
                            Falhas {campaign.failed_count}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
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
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => void handleViewLogs(campaign)}
                          disabled={logsLoading}
                        >
                          {logsLoading
                            ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            : <FileText className="mr-2 h-4 w-4" />}
                          Logs
                        </Button>
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

        <Dialog
          open={templateDialogOpen}
          onOpenChange={(open) => {
            setTemplateDialogOpen(open);
            if (!open && !savingTemplate) resetTemplateForm();
          }}
        >
          <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Novo template WAHA</DialogTitle>
              <DialogDescription>
                O template contém somente mensagens e variações. Método, sessões e
                intervalos são definidos separadamente em cada campanha.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="waha-template-name">Nome do template</Label>
                <Input
                  id="waha-template-name"
                  value={templateForm.name}
                  onChange={(event) =>
                    setTemplateForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="waha-template-description">Descrição (opcional)</Label>
                <Input
                  id="waha-template-description"
                  value={templateForm.description}
                  onChange={(event) =>
                    setTemplateForm((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
                Configurações de envio não fazem parte do template. Elas serão escolhidas
                somente ao criar a campanha WAHA.
              </div>

              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Label htmlFor="waha-template-message">Mensagem do template</Label>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => appendTemplateTag("{nome}")}
                    >
                      Inserir {"{nome}"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => appendTemplateTag("{empresa}")}
                    >
                      Inserir {"{empresa}"}
                    </Button>
                    {templateForm.messageVariations.length === 0 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={!templateForm.message.trim()}
                      onClick={() =>
                        setTemplateForm((current) => ({
                          ...current,
                          messageVariations: [current.message.trim()],
                          message: "",
                        }))
                      }
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Adicionar variações
                    </Button>
                    )}
                  </div>
                </div>

                {templateForm.messageVariations.length === 0 ? (
                  <Textarea
                    id="waha-template-message"
                    rows={5}
                    placeholder="Use {nome} e {telefone} para personalizar."
                    value={templateForm.message}
                    onChange={(event) =>
                      setTemplateForm((current) => ({
                        ...current,
                        message: event.target.value,
                      }))
                    }
                  />
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      {templateForm.messageVariations.length} variação(ões) cadastrada(s).
                    </p>
                    {templateForm.messageVariations.map((message, index) => (
                      <div key={index} className="flex gap-2">
                        <div className="flex-1 space-y-1">
                          <Label htmlFor={`waha-template-variation-${index}`}>
                            Variação {index + 1}
                          </Label>
                          <Textarea
                            id={`waha-template-variation-${index}`}
                            rows={3}
                            value={message}
                            onChange={(event) =>
                              setTemplateForm((current) => {
                                const variations = [...current.messageVariations];
                                variations[index] = event.target.value;
                                return { ...current, messageVariations: variations };
                              })
                            }
                          />
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={`Remover variação ${index + 1} do template`}
                          onClick={() =>
                            setTemplateForm((current) => ({
                              ...current,
                              messageVariations: current.messageVariations.filter(
                                (_, variationIndex) => variationIndex !== index,
                              ),
                            }))
                          }
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <Textarea
                      id="waha-template-message"
                      rows={3}
                      placeholder="Adicionar nova variação..."
                      value={templateForm.message}
                      onChange={(event) =>
                        setTemplateForm((current) => ({
                          ...current,
                          message: event.target.value,
                        }))
                      }
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={!templateForm.message.trim()}
                        onClick={() =>
                          setTemplateForm((current) => ({
                            ...current,
                            messageVariations: [
                              ...current.messageVariations,
                              current.message.trim(),
                            ],
                            message: "",
                          }))
                        }
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Adicionar variação
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setTemplateForm((current) => ({
                            ...current,
                            messageVariations: [],
                            message: current.messageVariations[0] || "",
                          }))
                        }
                      >
                        Voltar para mensagem única
                      </Button>
                    </div>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  Tags disponíveis: {"{nome}"} e {"{empresa}"}. Os dados serão lidos
                  da lista de contatos da campanha.
                </p>
              </div>
              <WahaImageField
                inputId="waha-template-image"
                preview={templateImagePreview}
                uploading={uploadingTemplateImage}
                disabled={savingTemplate}
                onSelect={(event) => void handleTemplateImageSelect(event)}
                onRemove={() => {
                  setTemplateForm((current) => ({ ...current, imageUrl: "" }));
                  setTemplateImagePreview(null);
                }}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={savingTemplate}
                onClick={() => setTemplateDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                disabled={
                  savingTemplate ||
                  !templateForm.name.trim() ||
                  templateMessagesToUse.length === 0
                }
                onClick={() => void saveTemplate()}
              >
                {savingTemplate
                  ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  : <Save className="mr-2 h-4 w-4" />}
                Salvar template WAHA
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

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
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="waha-template">Template WAHA (opcional)</Label>
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    className="h-auto p-0"
                    onClick={() => {
                      resetTemplateForm();
                      setTemplateDialogOpen(true);
                    }}
                  >
                    Criar novo template
                  </Button>
                </div>
                <Select
                  value={form.templateId || "none"}
                  onValueChange={(value) => {
                    if (value === "none") {
                      patchForm({
                        templateId: "",
                        message: "",
                        messageVariations: [],
                        imageUrl: "",
                      });
                      setCampaignImagePreview(null);
                    } else {
                      applyTemplate(value);
                    }
                  }}
                >
                  <SelectTrigger id="waha-template">
                    <SelectValue placeholder="Selecione um template" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem template — escrever manualmente</SelectItem>
                    {templates.map((template) => (
                      <SelectItem key={template.id} value={template.id}>
                        {template.name} · {template.message_variations?.length || 1} mensagem(ns)
                        {template.image_url ? " · com logo" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {templates.length === 0 && (
                  <p className="text-xs text-amber-600">
                    Nenhum template cadastrado. Crie um antes ou escreva a mensagem manualmente.
                  </p>
                )}
              </div>
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
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Label htmlFor="waha-message">Mensagem personalizada</Label>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => appendCampaignTag("{nome}")}
                    >
                      Inserir {"{nome}"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => appendCampaignTag("{empresa}")}
                    >
                      Inserir {"{empresa}"}
                    </Button>
                    {form.messageVariations.length === 0 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={!form.message.trim()}
                      onClick={() =>
                        patchForm({
                          messageVariations: [form.message.trim()],
                          message: "",
                          templateId: "",
                        })
                      }
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Adicionar variações
                    </Button>
                    )}
                  </div>
                </div>

                {form.messageVariations.length === 0 ? (
                  <Textarea
                    id="waha-message"
                    rows={5}
                    placeholder="Use {nome} para personalizar. Ex: Olá {nome}, tudo bem?"
                    value={form.message}
                    onChange={(event) =>
                      patchForm({ message: event.target.value, templateId: "" })
                    }
                  />
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      {form.messageVariations.length} variação(ões). A fila alternará entre
                      elas sequencialmente, como no Disparador 2 Evolution.
                    </p>
                    {form.messageVariations.map((message, index) => (
                      <div key={index} className="flex gap-2">
                        <div className="flex-1 rounded-md border bg-muted/50 p-3">
                          <p className="mb-1 text-xs font-medium text-muted-foreground">
                            Variação {index + 1}
                          </p>
                          <p className="whitespace-pre-wrap text-sm">{message}</p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={`Remover variação ${index + 1}`}
                          onClick={() =>
                            patchForm({
                              messageVariations: form.messageVariations.filter(
                                (_, variationIndex) => variationIndex !== index,
                              ),
                              templateId: "",
                            })
                          }
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <Textarea
                      id="waha-message"
                      rows={3}
                      placeholder="Adicionar nova variação de mensagem..."
                      value={form.message}
                      onChange={(event) => patchForm({ message: event.target.value })}
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={!form.message.trim()}
                        onClick={() =>
                          patchForm({
                            messageVariations: [
                              ...form.messageVariations,
                              form.message.trim(),
                            ],
                            message: "",
                            templateId: "",
                          })
                        }
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Adicionar variação
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          patchForm({
                            messageVariations: [],
                            message: form.messageVariations[0] || "",
                            templateId: "",
                          })
                        }
                      >
                        Voltar para mensagem única
                      </Button>
                    </div>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  Tags disponíveis: {"{nome}"} e {"{empresa}"}.
                </p>
              </div>
              <WahaImageField
                inputId="waha-campaign-image"
                preview={campaignImagePreview}
                uploading={uploadingCampaignImage}
                disabled={saving}
                onSelect={(event) => void handleCampaignImageSelect(event)}
                onRemove={() => {
                  patchForm({ imageUrl: "" }, false);
                  setCampaignImagePreview(null);
                }}
              />
              <div className="space-y-2">
                <Label htmlFor="waha-contacts">Contatos</Label>
                <Textarea
                  id="waha-contacts"
                  rows={7}
                  placeholder={
                    "Nome;Empresa;Telefone\nJoão;Empresa ABC;5511999999999\nMaria;Empresa XYZ;5511888888888"
                  }
                  value={form.contacts}
                  onChange={(event) =>
                    patchForm({ contacts: event.target.value })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Use as colunas Nome;Empresa;Telefone para preencher as tags. Até 500
                  números; duplicados são removidos automaticamente.
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
                  <p className="mb-2 text-sm font-medium">
                    Prévia das variações personalizadas
                  </p>
                  {form.imageUrl && (
                    <img
                      src={form.imageUrl}
                      alt="Preview da logo que será enviada"
                      className="mb-3 h-40 w-full rounded-md border object-cover"
                    />
                  )}
                  <div className="space-y-2">
                    {simulation.previews.map((preview) => (
                      <div
                        key={preview.index}
                        className="whitespace-pre-wrap rounded bg-green-50 p-3 text-sm"
                      >
                        <span className="mb-1 block text-xs font-medium text-green-800">
                          Variação {preview.index + 1}
                        </span>
                        {preview.message}
                      </div>
                    ))}
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

        <Dialog
          open={logsDialogOpen}
          onOpenChange={(open) => {
            setLogsDialogOpen(open);
            if (!open) {
              setSelectedCampaignLogs([]);
              setLogsSearchQuery("");
              setLogsSessionFilter("all");
              setLogsCampaignName("");
            }
          }}
        >
          <DialogContent className="max-h-[80vh] max-w-4xl">
            <DialogHeader>
              <DialogTitle>Logs de Disparo</DialogTitle>
              <DialogDescription>
                Histórico detalhado de todos os disparos
                {logsCampaignName ? ` da campanha "${logsCampaignName}"` : " desta campanha"}
              </DialogDescription>
            </DialogHeader>
            {(() => {
              const totals = {
                inserted: selectedCampaignLogs.length,
                sent: selectedCampaignLogs.filter((log) => log.status === "sent").length,
                failed: selectedCampaignLogs.filter((log) => log.status === "failed").length,
                pending: selectedCampaignLogs.filter((log) => log.status === "pending").length,
                scheduled: selectedCampaignLogs.filter((log) => log.status === "scheduled").length,
                cancelled: selectedCampaignLogs.filter((log) => log.status === "cancelled").length,
              };
              const sessionOptions = [
                ...new Map(
                  selectedCampaignLogs
                    .map((log) => log.session)
                    .filter((session): session is NonNullable<WahaQueueLog["session"]> => !!session)
                    .map((session) => [session.id, session]),
                ).values(),
              ];
              const filteredLogs = selectedCampaignLogs
                .filter((log) => {
                  const matchesPhone = !logsSearchQuery
                    || log.phone.includes(logsSearchQuery.replace(/\D/g, ""));
                  const logSessionId = log.session_id || log.session?.id;
                  const matchesSession = logsSessionFilter === "all"
                    || logSessionId === logsSessionFilter;
                  return matchesPhone && matchesSession;
                })
                .sort((a, b) => {
                  const dateA = a.scheduled_for
                    ? new Date(a.scheduled_for).getTime()
                    : new Date(a.created_at).getTime();
                  const dateB = b.scheduled_for
                    ? new Date(b.scheduled_for).getTime()
                    : new Date(b.created_at).getTime();
                  return logsSortOrder === "asc" ? dateA - dateB : dateB - dateA;
                });
              const campaign = campaigns.find((item) => item.id === selectedCampaignLogs[0]?.campaign_id);
              const minDelay = campaign?.min_delay_seconds ?? 30;
              const maxDelay = campaign?.max_delay_seconds ?? 60;
              const avgDelay = (minDelay + maxDelay) / 2;
              const sortedByTime = [...filteredLogs].sort((a, b) => {
                const dateA = a.scheduled_for
                  ? new Date(a.scheduled_for).getTime()
                  : new Date(a.created_at).getTime();
                const dateB = b.scheduled_for
                  ? new Date(b.scheduled_for).getTime()
                  : new Date(b.created_at).getTime();
                return dateA - dateB;
              });
              const startTime = sortedByTime[0]?.scheduled_for
                ? new Date(sortedByTime[0].scheduled_for)
                : sortedByTime[0]
                  ? new Date(sortedByTime[0].created_at)
                  : null;
              const estimatedDuration = filteredLogs.length * avgDelay * 1000;
              const endTime = startTime
                ? new Date(startTime.getTime() + estimatedDuration)
                : null;

              return (
                <>
                  <div className="mb-2 grid grid-cols-2 gap-3 rounded-md border bg-muted/40 p-3 text-sm sm:grid-cols-4">
                    <div>
                      <div className="text-xs text-muted-foreground">Total na fila</div>
                      <div className="font-semibold">{totals.inserted.toLocaleString("pt-BR")}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Enviados / Falhas</div>
                      <div className="font-semibold">
                        {totals.sent.toLocaleString("pt-BR")} / {totals.failed.toLocaleString("pt-BR")}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Pend. / Agend.</div>
                      <div className="font-semibold">
                        {totals.pending.toLocaleString("pt-BR")} / {totals.scheduled.toLocaleString("pt-BR")}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Cancelados</div>
                      <div className="font-semibold">{totals.cancelled.toLocaleString("pt-BR")}</div>
                    </div>
                  </div>
                  <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        type="text"
                        placeholder="Buscar por número de telefone..."
                        value={logsSearchQuery}
                        onChange={(event) => setLogsSearchQuery(event.target.value)}
                        className="pl-10"
                      />
                    </div>
                    <div>
                      <Label>Filtrar por sessão</Label>
                      <Select value={logsSessionFilter} onValueChange={setLogsSessionFilter}>
                        <SelectTrigger>
                          <SelectValue placeholder="Todas as sessões" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todas as sessões</SelectItem>
                          {sessionOptions.map((session) => (
                            <SelectItem key={session.id} value={session.id}>
                              {session.display_name || session.session_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Ordenar por horário</Label>
                      <Select
                        value={logsSortOrder}
                        onValueChange={(value) => setLogsSortOrder(value as "asc" | "desc")}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="asc">Mais antigas primeiro</SelectItem>
                          <SelectItem value="desc">Mais recentes primeiro</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <ScrollArea className="h-[500px] pr-4">
                    <div className="space-y-3">
                      {startTime && endTime && filteredLogs.length > 0 && (
                        <div className="mb-4 space-y-2 rounded-lg bg-muted p-4">
                          <div className="flex items-center gap-2 text-sm">
                            <Clock className="h-4 w-4" />
                            <span className="font-medium">Estimativa de horário:</span>
                          </div>
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="text-muted-foreground">Início:</span>
                              <span className="ml-2 font-medium">
                                {startTime.toLocaleString("pt-BR")}
                              </span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Fim estimado:</span>
                              <span className="ml-2 font-medium">
                                {endTime.toLocaleString("pt-BR")}
                              </span>
                            </div>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Duração estimada: {Math.round(estimatedDuration / 1000 / 60)} minutos
                            ({filteredLogs.length} mensagens × {avgDelay}s de delay médio)
                          </div>
                        </div>
                      )}
                      {filteredLogs.map((log) => (
                        <Card
                          key={log.id}
                          className={log.status === "failed" ? "border-destructive" : ""}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1 space-y-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  {log.status === "sent" && (
                                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                                  )}
                                  {log.status === "failed" && (
                                    <XCircle className="h-4 w-4 text-destructive" />
                                  )}
                                  {log.status === "scheduled" && (
                                    <Clock className="h-4 w-4 text-amber-500" />
                                  )}
                                  {log.status === "pending" && (
                                    <Loader2 className="h-4 w-4 text-muted-foreground" />
                                  )}
                                  <span className="font-medium">{log.phone}</span>
                                  {log.name && (
                                    <span className="text-muted-foreground">({log.name})</span>
                                  )}
                                  {log.session && (
                                    <Badge variant="outline" className="text-xs">
                                      {log.session.display_name || log.session.session_name}
                                    </Badge>
                                  )}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  {log.status === "scheduled" && log.scheduled_for && (
                                    <span>
                                      Agendado para: {new Date(log.scheduled_for).toLocaleString("pt-BR")}
                                    </span>
                                  )}
                                  {log.status === "sent" && log.sent_at && (
                                    <span>
                                      Enviado em: {new Date(log.sent_at).toLocaleString("pt-BR")}
                                    </span>
                                  )}
                                  {log.status === "failed" && log.failed_at && (
                                    <span>
                                      Falhou em: {new Date(log.failed_at).toLocaleString("pt-BR")}
                                    </span>
                                  )}
                                  {log.status === "pending" && (
                                    <span>Aguardando processamento</span>
                                  )}
                                  {log.status === "cancelled" && (
                                    <span>Cancelado</span>
                                  )}
                                </div>
                                {log.personalized_message && (
                                  <p className="line-clamp-2 text-sm text-muted-foreground">
                                    {log.personalized_message}
                                  </p>
                                )}
                                {log.error_message && (
                                  <div className="mt-2 rounded-md bg-destructive/10 p-3">
                                    <p className="mb-1 text-sm font-medium text-destructive">Erro:</p>
                                    <p className="whitespace-pre-wrap font-mono text-sm text-destructive/90">
                                      {log.error_message}
                                      {log.failure_code ? ` (${log.failure_code})` : ""}
                                    </p>
                                  </div>
                                )}
                              </div>
                              <Badge
                                variant={
                                  log.status === "sent" ? "default"
                                  : log.status === "failed" ? "destructive"
                                  : log.status === "scheduled" ? "secondary"
                                  : "outline"
                                }
                              >
                                {queueLogStatusLabel(log.status)}
                              </Badge>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                      {filteredLogs.length === 0 && (
                        <div className="py-8 text-center text-muted-foreground">
                          {logsSearchQuery
                            ? "Nenhum log encontrado para este número"
                            : "Nenhum log encontrado"}
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </>
              );
            })()}
          </DialogContent>
        </Dialog>
      </CRMLayout>
    </AuthGuard>
  );
}
