import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, Edit2, Loader2, Save, Unlock, X } from "lucide-react";
import { useActiveOrganization } from "@/hooks/useActiveOrganization";
import { InstanceConnectionMonthStats } from "@/components/crm/InstanceConnectionMonthStats";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { unstuckEvolutionInstance } from "@/lib/unstuckEvolutionInstance";
import { fetchEvolutionConnectionStateByConfigId } from "@/lib/evolutionConnectionStateProxy";
import { extractConnectionState } from "@/lib/evolutionStatus";

interface Instance {
  id: string;
  instance_name: string;
  api_url: string;
  api_key: string | null;
  is_connected: boolean | null;
  reserve_agent_name?: string | null;
  guideline?: string | null;
  daily_dispatch_limit?: number | null;
  total_dispatch_limit?: number | null;
  segment?: string | null;
  segment_start_date?: string | null;
  segment_end_date?: string | null;
  is_titular?: boolean | null;
}

interface InstanceDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  instance: Instance | null;
  onUpdate?: () => void;
}

const SEGMENTS = [
  "Monitoramento e alarmes",
  "Assistência técnica - Brasil",
  "Provedor - Brasil",
  "LATAM CAPPI - Provedor",
];

export function InstanceDetailDialog({
  open,
  onOpenChange,
  instance,
  onUpdate,
}: InstanceDetailDialogProps) {
  const { toast } = useToast();
  const { activeOrgId } = useActiveOrganization();
  const [loading, setLoading] = useState(false);
  const [editingGuideline, setEditingGuideline] = useState(false);
  const [availableReserveAgents, setAvailableReserveAgents] = useState<string[]>([]);

  const [reserveAgentName, setReserveAgentName] = useState<string>("");
  const [guideline, setGuideline] = useState<string>("");
  const [dailyDispatchLimit, setDailyDispatchLimit] = useState<string>("");
  const [totalDispatchLimit, setTotalDispatchLimit] = useState<string>("");
  const [segment, setSegment] = useState<string>("");
  const [segmentStartDate, setSegmentStartDate] = useState<Date | undefined>(undefined);
  const [segmentEndDate, setSegmentEndDate] = useState<Date | undefined>(undefined);
  const [confirmUnstuckOpen, setConfirmUnstuckOpen] = useState(false);
  const [unstucking, setUnstucking] = useState(false);
  const [unstuckQr, setUnstuckQr] = useState<string | null>(null);
  const [unstuckChatwootOk, setUnstuckChatwootOk] = useState<boolean | null>(null);
  const [didUnstuck, setDidUnstuck] = useState(false);
  const [reconnectedAfterUnstuck, setReconnectedAfterUnstuck] = useState(false);

  useEffect(() => {
    if (instance && open) {
      setReserveAgentName(instance.reserve_agent_name || "");
      setGuideline(instance.guideline || "ok");
      setDailyDispatchLimit(instance.daily_dispatch_limit?.toString() || "");
      setTotalDispatchLimit(instance.total_dispatch_limit?.toString() || "");
      setSegment(instance.segment || "");
      setSegmentStartDate(
        instance.segment_start_date ? new Date(instance.segment_start_date) : undefined
      );
      setSegmentEndDate(
        instance.segment_end_date ? new Date(instance.segment_end_date) : undefined
      );
      setEditingGuideline(false);
      setConfirmUnstuckOpen(false);
      setUnstucking(false);
      setUnstuckQr(null);
      setUnstuckChatwootOk(null);
      setDidUnstuck(false);
      setReconnectedAfterUnstuck(false);
    }
  }, [instance, open]);

  useEffect(() => {
    if (open && activeOrgId) {
      fetchAvailableReserveAgents();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- carrega ao abrir o dialog
  }, [open, activeOrgId]);

  const fetchAvailableReserveAgents = async () => {
    try {
      const { data: instances, error } = await supabase
        .from("evolution_config")
        .select("instance_name, is_titular, reserve_agent_name")
        .eq("organization_id", activeOrgId);

      if (error) throw error;

      const titularAgents = new Set<string>();
      instances?.forEach((inst) => {
        if (inst.is_titular && inst.instance_name) {
          titularAgents.add(inst.instance_name);
        }
      });

      const reserveAgents = new Set<string>();
      instances?.forEach((inst) => {
        if (!inst.is_titular && inst.instance_name) {
          reserveAgents.add(inst.instance_name);
        }
        if (inst.reserve_agent_name && !titularAgents.has(inst.reserve_agent_name)) {
          reserveAgents.add(inst.reserve_agent_name);
        }
      });

      setAvailableReserveAgents(Array.from(reserveAgents).sort());
    } catch (error: unknown) {
      console.error("Erro ao buscar agentes disponíveis:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar agentes disponíveis",
        variant: "destructive",
      });
    }
  };

  const handleSave = async () => {
    if (!instance || !activeOrgId) return;

    setLoading(true);
    try {
      const updateData = {
        reserve_agent_name: reserveAgentName || null,
        guideline: guideline || "ok",
        daily_dispatch_limit: dailyDispatchLimit ? parseInt(dailyDispatchLimit) : null,
        total_dispatch_limit: totalDispatchLimit ? parseInt(totalDispatchLimit) : null,
        segment: segment || null,
        segment_start_date: segmentStartDate ? format(segmentStartDate, "yyyy-MM-dd") : null,
        segment_end_date: segmentEndDate ? format(segmentEndDate, "yyyy-MM-dd") : null,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from("evolution_config")
        .update(updateData)
        .eq("id", instance.id)
        .eq("organization_id", activeOrgId);

      if (error) throw error;

      toast({
        title: "✅ Sucesso",
        description: "Informações da instância atualizadas com sucesso",
      });

      setEditingGuideline(false);
      if (onUpdate) {
        onUpdate();
      }
    } catch (error: unknown) {
      console.error("Erro ao salvar:", error);
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Não foi possível salvar as alterações",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUnstuck = async () => {
    if (!instance) return;
    setConfirmUnstuckOpen(false);
    setUnstucking(true);
    setUnstuckQr(null);
    try {
      const result = await unstuckEvolutionInstance(instance.id);
      if (!result.success) {
        throw new Error(result.error || "Falha ao destravar a instância");
      }
      setDidUnstuck(true);
      setUnstuckQr(result.qrCode);
      setUnstuckChatwootOk(result.chatwootRestored ?? null);
      toast({
        title: "Instância destravada",
        description: result.chatwootRestored
          ? "Chatwoot restaurado. Escaneie o QR Code para conectar."
          : "Escaneie o QR Code para conectar. Confira o Chatwoot se as mensagens não chegarem.",
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Não foi possível destravar a instância";
      console.error("Erro ao destravar instância:", error);
      toast({
        title: "Erro ao destravar",
        description: message,
        variant: "destructive",
      });
    } finally {
      setUnstucking(false);
    }
  };

  const handleDialogOpenChange = (next: boolean) => {
    if (unstucking) return;
    onOpenChange(next);
    if (!next && didUnstuck && onUpdate) {
      onUpdate();
    }
  };

  useEffect(() => {
    if (!open || !instance || !didUnstuck || !unstuckQr) return;
    let cancelled = false;
    const tick = async () => {
      const state = await fetchEvolutionConnectionStateByConfigId(instance.id);
      if (cancelled) return;
      if (extractConnectionState(state.body) === true) {
        toast({
          title: "Conectado",
          description: `${instance.instance_name} conectou após o QR.`,
        });
        setUnstuckQr(null);
        setReconnectedAfterUnstuck(true);
      }
    };
    const interval = setInterval(tick, 5000);
    void tick();
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [open, instance, didUnstuck, unstuckQr, toast]);

  if (!instance) return null;

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent
        className="max-w-2xl max-h-[90vh] overflow-y-auto"
        onPointerDownOutside={(e) => {
          if (unstucking) e.preventDefault();
        }}
        onEscapeKeyDown={(e) => {
          if (unstucking) e.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">
            Detalhes da Instância: {instance.instance_name}
          </DialogTitle>
          <DialogDescription>
            Gerencie as informações e configurações desta instância
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">Status agora:</span>
            <Badge variant={instance.is_connected ? "default" : "secondary"}>
              {instance.is_connected ? "Conectado" : "Desconectado"}
            </Badge>
            {didUnstuck && !reconnectedAfterUnstuck && (
              <Badge variant="outline">Aguardando QR</Badge>
            )}
          </div>

          {unstucking && (
            <Alert>
              <Loader2 className="h-4 w-4 animate-spin" />
              <AlertDescription>
                Destravando <strong>{instance.instance_name}</strong>: backup, exclusão e recriação na Evolution.
                Isso pode levar até um minuto.
              </AlertDescription>
            </Alert>
          )}

          {unstuckQr && (
            <div className="rounded-md border bg-muted/40 p-4 space-y-3 text-center">
              <p className="text-sm font-medium">Escaneie o QR Code no WhatsApp desta instância</p>
              <img
                src={unstuckQr}
                alt={`QR Code ${instance.instance_name}`}
                className="mx-auto h-52 w-52 rounded bg-white p-2"
              />
              {unstuckChatwootOk === false && (
                <p className="text-xs text-amber-700">
                  A instância foi recriada, mas o Chatwoot pode precisar ser conferido.
                </p>
              )}
            </div>
          )}

          {didUnstuck && !unstuckQr && !unstucking && !reconnectedAfterUnstuck && (
            <Alert>
              <AlertDescription>
                Instância recriada. Use Reconectar se o QR não aparecer.
              </AlertDescription>
            </Alert>
          )}

          <InstanceConnectionMonthStats instanceId={instance.id} enabled={open} />

          <div className="space-y-2">
            <Label htmlFor="reserve-agent">Agente Reserva</Label>
            <Select value={reserveAgentName} onValueChange={setReserveAgentName}>
              <SelectTrigger id="reserve-agent">
                <SelectValue placeholder="Selecione um agente reserva" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Nenhum</SelectItem>
                {availableReserveAgents.map((agent) => (
                  <SelectItem key={agent} value={agent}>
                    {agent}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Apenas agentes que não estão vinculados como titulares de outras instâncias
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="guideline">Diretriz</Label>
              {!editingGuideline ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditingGuideline(true)}
                >
                  <Edit2 className="h-4 w-4 mr-1" />
                  Editar
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEditingGuideline(false);
                      setGuideline(instance.guideline || "ok");
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEditingGuideline(false);
                      handleSave();
                    }}
                  >
                    <Save className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
            {editingGuideline ? (
              <Textarea
                id="guideline"
                value={guideline}
                onChange={(e) => setGuideline(e.target.value)}
                placeholder="Digite a diretriz..."
                rows={3}
              />
            ) : (
              <div className="p-3 bg-muted rounded-md">
                <p className="text-sm">{guideline || "ok"}</p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="daily-limit">Total de Disparos por Dia</Label>
              <Input
                id="daily-limit"
                type="number"
                min="0"
                value={dailyDispatchLimit}
                onChange={(e) => setDailyDispatchLimit(e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="total-limit">Total de Limite de Disparo</Label>
              <Input
                id="total-limit"
                type="number"
                min="0"
                value={totalDispatchLimit}
                onChange={(e) => setTotalDispatchLimit(e.target.value)}
                placeholder="0"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="segment">Segmento</Label>
            <Select value={segment} onValueChange={setSegment}>
              <SelectTrigger id="segment">
                <SelectValue placeholder="Selecione o segmento" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Nenhum</SelectItem>
                {SEGMENTS.map((seg) => (
                  <SelectItem key={seg} value={seg}>
                    {seg}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Data de Início do Segmento</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {segmentStartDate ? (
                      format(segmentStartDate, "dd/MM/yyyy", { locale: ptBR })
                    ) : (
                      <span className="text-muted-foreground">Selecione a data</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={segmentStartDate}
                    onSelect={setSegmentStartDate}
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label>Data de Fim do Segmento</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {segmentEndDate ? (
                      format(segmentEndDate, "dd/MM/yyyy", { locale: ptBR })
                    ) : (
                      <span className="text-muted-foreground">Selecione a data</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={segmentEndDate}
                    onSelect={setSegmentEndDate}
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {confirmUnstuckOpen && (
            <Alert variant="destructive">
              <AlertDescription className="space-y-3">
                <p>
                  Destravar <strong>{instance.instance_name}</strong> apaga a sessão do WhatsApp
                  só desta instância na Evolution, recria com o mesmo nome e restaura o Chatwoot.
                  Depois será preciso escanear o QR Code.
                  {instance.is_connected ? " A conexão atual será encerrada." : ""}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setConfirmUnstuckOpen(false)}
                    disabled={unstucking}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={handleUnstuck}
                    disabled={unstucking}
                  >
                    {unstucking ? "Destravando..." : "Sim, destravar esta instância"}
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          )}

          <div className="flex flex-wrap justify-between gap-2 pt-4 border-t">
            <Button
              type="button"
              variant="destructive"
              onClick={() => setConfirmUnstuckOpen(true)}
              disabled={loading || unstucking}
            >
              {unstucking ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Unlock className="h-4 w-4 mr-2" />
              )}
              Destravar instância
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => handleDialogOpenChange(false)} disabled={unstucking}>
                Fechar
              </Button>
              <Button onClick={handleSave} disabled={loading || unstucking}>
                {loading ? "Salvando..." : "Salvar Alterações"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
