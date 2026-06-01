import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Calendar, Clock, X, Trash2, Image as ImageIcon, Repeat, Link2, Send, Loader2, CalendarClock, AlertCircle } from "lucide-react";
import { useScheduledMessages, type ScheduledMessage } from "@/hooks/useScheduledMessages";
import { useOrganizationFeatures } from "@/hooks/useOrganizationFeatures";
import { useToast } from "@/hooks/use-toast";
import { ptBR } from "date-fns/locale";
import { formatInTimeZone } from "date-fns-tz";
import { Badge } from "@/components/ui/badge";
import { getTodaySaoPauloISODate, parseSaoPauloDateTime } from "@/lib/dateUtils";
import { formatScheduledMessageError } from "@/lib/scheduledMessageErrors";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
interface ScheduleMessagePanelProps {
  leadId: string;
  leadPhone: string;
  instances: Array<{ id: string; instance_name: string; is_connected: boolean }>;
  onClose?: () => void;
}

export function ScheduleMessagePanel({ leadId, leadPhone, instances, onClose }: ScheduleMessagePanelProps) {
  const {
    scheduledMessages,
    scheduleMessage,
    cancelScheduledMessage,
    deleteScheduledMessage,
    retryFailedScheduledMessage,
    isRetryingFailed,
    requeueFailedScheduledMessage,
    isRequeuingFailed,
  } = useScheduledMessages(leadId);
  const { hasFeature, loading: featuresLoading } = useOrganizationFeatures();
  const canSchedule = hasFeature("scheduled_messages");
  const { toast } = useToast();
  
  const [instanceId, setInstanceId] = useState<string>("");
  const [message, setMessage] = useState<string>("");
  const [scheduledDate, setScheduledDate] = useState<string>("");
  const [scheduledTime, setScheduledTime] = useState<string>("");
  const [isScheduling, setIsScheduling] = useState(false);
  
  // Campos de repetição
  const [repeatEnabled, setRepeatEnabled] = useState(false);
  const [repeatPeriod, setRepeatPeriod] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('monthly');
  const [repeatDuration, setRepeatDuration] = useState<number>(1); // Duração em dias/semanas/meses/anos
  
  // Campos de combo
  const [isCombo, setIsCombo] = useState(false);
  const [comboMessage, setComboMessage] = useState<string>("");
  const [comboDelayDays, setComboDelayDays] = useState<number>(1);
  
  // Dialog de cancelamento
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelMessageId, setCancelMessageId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState<string>("");
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [rescheduleTarget, setRescheduleTarget] = useState<ScheduledMessage | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleTime, setRescheduleTime] = useState("");

  const openRescheduleDialog = (msg: ScheduledMessage) => {
    const d = new Date();
    d.setMinutes(d.getMinutes() + 15);
    setRescheduleDate(formatInTimeZone(d, "America/Sao_Paulo", "yyyy-MM-dd"));
    setRescheduleTime(formatInTimeZone(d, "America/Sao_Paulo", "HH:mm"));
    setRescheduleTarget(msg);
    setRescheduleOpen(true);
  };

  const handleConfirmReschedule = async () => {
    if (!rescheduleTarget || !rescheduleDate || !rescheduleTime) return;
    try {
      const scheduledFor = parseSaoPauloDateTime(rescheduleDate, rescheduleTime);
      await requeueFailedScheduledMessage({
        messageId: rescheduleTarget.id,
        scheduledFor,
        fromStatus: rescheduleTarget.status === 'pending' ? 'pending' : 'failed',
      });
      setRescheduleOpen(false);
      setRescheduleTarget(null);
    } catch {
      // toast no hook
    }
  };

  const handleSchedule = async () => {
    // Validar feature habilitada
    if (!hasFeature('scheduled_messages')) {
      toast({
        title: "Funcionalidade não disponível",
        description: "A funcionalidade de mensagens agendadas não está habilitada para sua organização.",
        variant: "destructive",
      });
      return;
    }

    if (!instanceId || !message.trim() || !scheduledDate || !scheduledTime) {
      return;
    }

    // Validar combo
    if (isCombo && !comboMessage.trim()) {
      toast({
        title: "Mensagem combo incompleta",
        description: "Preencha a mensagem da segunda parte do combo.",
        variant: "destructive",
      });
      return;
    }

    // ✅ CORREÇÃO: Permitir agendamento para "agora" ou até 5 minutos no passado
    // Isso permite que mensagens sejam agendadas para envio imediato
    // O process-scheduled-messages já filtra por scheduled_for <= NOW()
    const scheduledFor = parseSaoPauloDateTime(scheduledDate, scheduledTime);
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
    
    if (scheduledFor < fiveMinutesAgo) {
      toast({
        title: "Data/hora inválida",
        description: "A data e hora de agendamento não pode ser mais de 5 minutos no passado.",
        variant: "destructive",
      });
      return;
    }

    setIsScheduling(true);
    try {
      await scheduleMessage({
        leadId,
        instanceId,
        phone: leadPhone,
        message,
        scheduledFor,
        repeatEnabled: repeatEnabled,
        repeatPeriod: repeatEnabled ? repeatPeriod : undefined,
        repeatDuration: repeatEnabled ? repeatDuration : undefined,
        isCombo: isCombo,
        comboMessage: isCombo ? comboMessage : undefined,
        comboDelayDays: isCombo ? comboDelayDays : undefined,
      });

      // Limpar formulário
      setMessage("");
      setScheduledDate("");
      setScheduledTime("");
      setRepeatEnabled(false);
      setRepeatDuration(1);
      setIsCombo(false);
      setComboMessage("");
      setComboDelayDays(1);
    } finally {
      setIsScheduling(false);
    }
  };

  const handleCancelClick = (messageId: string) => {
    setCancelMessageId(messageId);
    setCancelReason("");
    setCancelDialogOpen(true);
  };

  const handleConfirmCancel = async () => {
    if (!cancelMessageId) return;

    try {
      await cancelScheduledMessage(cancelMessageId, cancelReason || undefined);
      setCancelDialogOpen(false);
      setCancelMessageId(null);
      setCancelReason("");
    } catch (error) {
      // Erro já tratado no hook
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-500';
      case 'sent': return 'bg-green-500';
      case 'failed': return 'bg-red-500';
      case 'cancelled': return 'bg-gray-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending': return 'Pendente';
      case 'sent': return 'Enviada';
      case 'failed': return 'Falhou';
      case 'cancelled': return 'Cancelada';
      default: return status;
    }
  };

  const pendingMessages = scheduledMessages.filter(m => m.status === 'pending');
  const historyMessages = scheduledMessages.filter(m => m.status !== 'pending');

  const now = new Date();
  const minDateSaoPaulo = getTodaySaoPauloISODate(now);
  const isPendingOverdue = (msg: ScheduledMessage) =>
    msg.status === 'pending' && new Date(msg.scheduled_for) <= now;

  const messagesToSendNow = pendingMessages.filter(isPendingOverdue);

  return (
    <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-xl flex items-center gap-2">
            <Calendar className="h-6 w-6" />
            Agenda
          </h3>
          {onClose && (
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {!featuresLoading && !canSchedule && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Agendamento não liberado no plano</AlertTitle>
            <AlertDescription>
              A organização ativa não inclui a funcionalidade <strong>Mensagens agendadas</strong>{" "}
              (<code className="text-xs">scheduled_messages</code>). Um administrador precisa habilitar nos
              limites da organização (Super Admin) ou ajustar o plano. Enquanto isso, o envio agendado não
              será salvo.
            </AlertDescription>
          </Alert>
        )}

        {/* Mensagens que podem ser enviadas agora */}
        {messagesToSendNow.length > 0 && (
          <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
            <h4 className="font-medium text-sm mb-1 text-amber-900 dark:text-amber-100">
              Horário já passou ({messagesToSendNow.length})
            </h4>
            <p className="text-xs text-amber-800/90 dark:text-amber-200/90 mb-3">
              O envio automático pode não ter ocorrido. Você pode enviar agora ou reprogramar outra data.
            </p>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {messagesToSendNow.map((msg) => (
                <div key={msg.id} className="p-2 bg-white dark:bg-gray-800 rounded border border-amber-200 dark:border-amber-700">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm whitespace-pre-wrap break-words">{msg.message}</p>
                      <span className="text-xs text-muted-foreground">
                        Programada para: {formatInTimeZone(
                          new Date(msg.scheduled_for),
                          "America/Sao_Paulo",
                          "dd/MM/yyyy 'às' HH:mm",
                          { locale: ptBR }
                        )}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <Button
                        type="button"
                        size="sm"
                        disabled={isRetryingFailed || isRequeuingFailed}
                        onClick={() => void retryFailedScheduledMessage(msg)}
                      >
                        {isRetryingFailed ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <Send className="h-4 w-4 mr-2" />
                        )}
                        Enviar agora
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={isRetryingFailed || isRequeuingFailed}
                        onClick={() => openRescheduleDialog(msg)}
                      >
                        <CalendarClock className="h-4 w-4 mr-2" />
                        Reprogramar
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleCancelClick(msg.id)}
                        className="h-8 w-8"
                        title="Cancelar agendamento"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <Label htmlFor="schedule-instance">Instância Evolution</Label>
            <Select value={instanceId} onValueChange={setInstanceId}>
              <SelectTrigger id="schedule-instance">
                <SelectValue placeholder="Selecione uma instância" />
              </SelectTrigger>
              <SelectContent className="z-[200]">
                {instances.map((instance) => (
                  <SelectItem key={instance.id} value={instance.id}>
                    {instance.instance_name}
                    {!instance.is_connected ? " (desconectada)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="schedule-message">Mensagem</Label>
            <Textarea
              id="schedule-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Digite a mensagem..."
              rows={4}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="schedule-date">Data</Label>
              <Input
                id="schedule-date"
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                min={minDateSaoPaulo}
              />
            </div>
            <div>
              <Label htmlFor="schedule-time">Hora</Label>
              <Input
                id="schedule-time"
                type="time"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
              />
            </div>
          </div>

        {/* Repetição */}
        <div className="border-t pt-4 space-y-3">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="repeat-enabled"
              checked={repeatEnabled}
              onCheckedChange={(checked) => setRepeatEnabled(checked as boolean)}
            />
            <Label htmlFor="repeat-enabled" className="flex items-center gap-2 cursor-pointer">
              <Repeat className="h-4 w-4" />
              Repetir mensagem
            </Label>
          </div>

          {repeatEnabled && (
            <div className="space-y-3 pl-6 border-l-2">
              <div>
                <Label htmlFor="repeat-period">Período de Repetição</Label>
                <Select
                  value={repeatPeriod}
                  onValueChange={(value: 'daily' | 'weekly' | 'monthly' | 'yearly') => setRepeatPeriod(value)}
                >
                  <SelectTrigger id="repeat-period">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="z-[200]">
                    <SelectItem value="daily">Diariamente</SelectItem>
                    <SelectItem value="weekly">Semanalmente</SelectItem>
                    <SelectItem value="monthly">Mensalmente (mesmo dia do mês)</SelectItem>
                    <SelectItem value="yearly">Anualmente</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="repeat-duration">
                  {repeatPeriod === 'daily' && 'Repetir por quantos dias?'}
                  {repeatPeriod === 'weekly' && 'Repetir por quantas semanas?'}
                  {repeatPeriod === 'monthly' && 'Repetir por quantos meses?'}
                  {repeatPeriod === 'yearly' && 'Repetir por quantos anos?'}
                </Label>
                <Input
                  id="repeat-duration"
                  type="number"
                  min="1"
                  max={repeatPeriod === 'daily' ? 365 : repeatPeriod === 'weekly' ? 52 : repeatPeriod === 'monthly' ? 24 : 10}
                  value={repeatDuration}
                  onChange={(e) => setRepeatDuration(parseInt(e.target.value) || 1)}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {repeatPeriod === 'daily' && 'A mensagem será enviada diariamente pelo período especificado'}
                  {repeatPeriod === 'weekly' && 'A mensagem será enviada semanalmente pelo período especificado'}
                  {repeatPeriod === 'monthly' && 'A mensagem será enviada mensalmente no mesmo dia do mês pelo período especificado'}
                  {repeatPeriod === 'yearly' && 'A mensagem será enviada anualmente no mesmo dia pelo período especificado'}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Mensagem Combo */}
        <div className="border-t pt-4 space-y-3">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="is-combo"
              checked={isCombo}
              onCheckedChange={(checked) => setIsCombo(checked as boolean)}
            />
            <Label htmlFor="is-combo" className="flex items-center gap-2 cursor-pointer">
              <Link2 className="h-4 w-4" />
              Mensagem em Combo
            </Label>
          </div>

          {isCombo && (
            <div className="space-y-3 pl-6 border-l-2">
              <div>
                <Label htmlFor="combo-message">Segunda Mensagem</Label>
                <Textarea
                  id="combo-message"
                  value={comboMessage}
                  onChange={(e) => setComboMessage(e.target.value)}
                  placeholder="Digite a segunda mensagem do combo..."
                  rows={3}
                />
              </div>

              <div>
                <Label htmlFor="combo-delay-days">Enviar após quantos dias?</Label>
                <Input
                  id="combo-delay-days"
                  type="number"
                  min="1"
                  value={comboDelayDays}
                  onChange={(e) => setComboDelayDays(parseInt(e.target.value) || 1)}
                />
              </div>

            </div>
          )}
        </div>

          <Button
            onClick={handleSchedule}
            disabled={
              !canSchedule ||
              featuresLoading ||
              !instanceId ||
              !message.trim() ||
              !scheduledDate ||
              !scheduledTime ||
              isScheduling
            }
            className="w-full"
            size="lg"
          >
            <Clock className="h-5 w-5 mr-2" />
            {isScheduling ? 'Agendando...' : 'Agendar Mensagem'}
          </Button>
        </div>

        {/* Mensagens Agendadas (Pendentes) */}
        {pendingMessages.length > 0 && (
          <div className="space-y-2 border-t pt-4 mt-6">
            <h4 className="font-medium text-base">Mensagens Agendadas ({pendingMessages.length})</h4>
          <div className="space-y-2">
            {pendingMessages.map((msg) => (
              <div key={msg.id} className="p-3 border rounded-lg bg-muted/50">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className={`${getStatusColor(msg.status)} text-white`}>
                        {isPendingOverdue(msg) ? 'Pendente (atrasada)' : getStatusLabel(msg.status)}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatInTimeZone(
                          new Date(msg.scheduled_for),
                          "America/Sao_Paulo",
                          "dd/MM/yyyy 'às' HH:mm",
                          { locale: ptBR }
                        )}
                      </span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap break-words">{msg.message}</p>
                    {msg.media_url && (
                      <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                        <ImageIcon className="h-3 w-3" />
                        <span>{msg.media_type}: {msg.media_url}</span>
                      </div>
                    )}
                    {msg.repeat_enabled && (
                      <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                        <Repeat className="h-3 w-3" />
                        <span>
                          Repetição: {msg.repeat_period === 'daily' ? 'Diária' : 
                                     msg.repeat_period === 'weekly' ? 'Semanal' :
                                     msg.repeat_period === 'monthly' ? 'Mensal' :
                                     msg.repeat_period === 'yearly' ? 'Anual' : ''}
                          {msg.repeat_count && ` (${msg.repeat_count}x)`}
                        </span>
                      </div>
                    )}
                    {msg.is_combo_message && (
                      <div className="mt-2 flex items-center gap-2 text-xs text-blue-600">
                        <Link2 className="h-3 w-3" />
                        <span>Mensagem combo (após {msg.combo_delay_days} dia{msg.combo_delay_days !== 1 ? 's' : ''})</span>
                      </div>
                    )}
                    {msg.parent_message_id && !msg.is_combo_message && (
                      <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                        <Repeat className="h-3 w-3" />
                        <span>Mensagem repetida</span>
                      </div>
                    )}
                    {msg.cancel_reason && (
                      <div className="mt-2 text-xs text-red-600">
                        <strong>Motivo do cancelamento:</strong> {msg.cancel_reason}
                      </div>
                    )}
                    {isPendingOverdue(msg) && (
                      <div className="mt-3 space-y-2">
                        <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800">
                          <AlertCircle className="h-4 w-4 text-amber-700 dark:text-amber-300" />
                          <AlertTitle className="text-amber-900 dark:text-amber-100">
                            Horário já passou
                          </AlertTitle>
                          <AlertDescription className="text-amber-900/90 dark:text-amber-100/90">
                            Se a mensagem não foi enviada, use enviar agora ou reprograme para outro horário.
                          </AlertDescription>
                        </Alert>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            size="sm"
                            disabled={isRetryingFailed || isRequeuingFailed}
                            onClick={() => void retryFailedScheduledMessage(msg)}
                          >
                            {isRetryingFailed ? (
                              <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            ) : (
                              <Send className="h-4 w-4 mr-2" />
                            )}
                            Enviar agora
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={isRetryingFailed || isRequeuingFailed}
                            onClick={() => openRescheduleDialog(msg)}
                          >
                            <CalendarClock className="h-4 w-4 mr-2" />
                            Reprogramar
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleCancelClick(msg.id)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

        {/* Histórico */}
        {historyMessages.length > 0 && (
          <div className="space-y-2 border-t pt-4 mt-6">
            <h4 className="font-medium text-base">Histórico ({historyMessages.length})</h4>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {historyMessages.map((msg) => (
              <div key={msg.id} className="p-3 border rounded-lg">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className={`${getStatusColor(msg.status)} text-white`}>
                        {getStatusLabel(msg.status)}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatInTimeZone(
                          new Date(msg.scheduled_for),
                          "America/Sao_Paulo",
                          "dd/MM/yyyy HH:mm",
                          { locale: ptBR }
                        )}
                      </span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap break-words">{msg.message}</p>
                    {msg.media_url && (
                      <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                        <ImageIcon className="h-3 w-3" />
                        <span>{msg.media_type}: {msg.media_url}</span>
                      </div>
                    )}
                    {msg.repeat_enabled && (
                      <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                        <Repeat className="h-3 w-3" />
                        <span>
                          Repetição: {msg.repeat_period === 'daily' ? 'Diária' : 
                                     msg.repeat_period === 'weekly' ? 'Semanal' :
                                     msg.repeat_period === 'monthly' ? 'Mensal' :
                                     msg.repeat_period === 'yearly' ? 'Anual' : ''}
                          {msg.repeat_count && ` (${msg.repeat_count}x)`}
                        </span>
                      </div>
                    )}
                    {msg.is_combo_message && (
                      <div className="mt-2 flex items-center gap-2 text-xs text-blue-600">
                        <Link2 className="h-3 w-3" />
                        <span>Mensagem combo (após {msg.combo_delay_days} dia{msg.combo_delay_days !== 1 ? 's' : ''})</span>
                      </div>
                    )}
                    {msg.parent_message_id && !msg.is_combo_message && (
                      <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                        <Repeat className="h-3 w-3" />
                        <span>Mensagem repetida</span>
                      </div>
                    )}
                    {msg.cancel_reason && (
                      <div className="mt-2 text-xs text-red-600">
                        <strong>Motivo do cancelamento:</strong> {msg.cancel_reason}
                      </div>
                    )}
                    {msg.status === "failed" && (
                      <div className="mt-3 space-y-3">
                        <Alert variant="destructive">
                          <AlertCircle className="h-4 w-4" />
                          <AlertTitle>Envio automático falhou</AlertTitle>
                          <AlertDescription>
                            <p className="mb-2">
                              {formatScheduledMessageError(msg.error_message)}
                            </p>
                            <p className="text-xs opacity-90">
                              Instância:{" "}
                              {(() => {
                                const inst = instances.find((i) => i.id === msg.instance_id);
                                if (!inst) return msg.instance_id;
                                return (
                                  <>
                                    {inst.instance_name}
                                    {!inst.is_connected
                                      ? " (desconectada — reconecte em Configurações antes de reenviar)"
                                      : ""}
                                  </>
                                );
                              })()}
                            </p>
                          </AlertDescription>
                        </Alert>
                        {msg.error_message ? (
                          <details className="text-xs text-muted-foreground rounded-md border border-border p-2 bg-muted/30">
                            <summary className="cursor-pointer select-none font-medium text-foreground">
                              Detalhes técnicos do erro
                            </summary>
                            <pre className="mt-2 whitespace-pre-wrap break-all text-[11px] leading-relaxed max-h-40 overflow-y-auto">
                              {msg.error_message}
                            </pre>
                          </details>
                        ) : null}
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            size="sm"
                            disabled={isRetryingFailed || isRequeuingFailed}
                            onClick={() => void retryFailedScheduledMessage(msg)}
                          >
                            {isRetryingFailed ? (
                              <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            ) : (
                              <Send className="h-4 w-4 mr-2" />
                            )}
                            Enviar agora
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={isRetryingFailed || isRequeuingFailed}
                            onClick={() => openRescheduleDialog(msg)}
                          >
                            <CalendarClock className="h-4 w-4 mr-2" />
                            Reagendar
                          </Button>
                        </div>
                      </div>
                    )}
                    {msg.status !== "failed" && msg.error_message && (
                      <div className="text-xs text-red-600 mt-2 p-2 bg-red-50 dark:bg-red-900/20 rounded border border-red-200 dark:border-red-800">
                        <strong className="block mb-1">Erro:</strong>
                        {formatScheduledMessageError(msg.error_message)}
                      </div>
                    )}
                  </div>
                  {msg.status === 'cancelled' && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteScheduledMessage(msg.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Dialog de Cancelamento */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent aria-describedby="cancel-dialog-description">
          <DialogHeader>
            <DialogTitle>Cancelar Mensagem Agendada</DialogTitle>
            <DialogDescription id="cancel-dialog-description">
              Deseja cancelar esta mensagem agendada? Você pode informar um motivo (opcional).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="cancel-reason">Motivo do Cancelamento (Opcional)</Label>
              <Textarea
                id="cancel-reason"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Ex: Cliente solicitou cancelamento..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelDialogOpen(false)}>
              Não Cancelar
            </Button>
            <Button variant="destructive" onClick={handleConfirmCancel}>
              Confirmar Cancelamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={rescheduleOpen}
        onOpenChange={(open) => {
          setRescheduleOpen(open);
          if (!open) setRescheduleTarget(null);
        }}
      >
        <DialogContent aria-describedby="reschedule-dialog-description">
          <DialogHeader>
            <DialogTitle>
              {rescheduleTarget?.status === 'pending' ? 'Reprogramar envio' : 'Reagendar envio'}
            </DialogTitle>
            <DialogDescription id="reschedule-dialog-description">
              {rescheduleTarget?.status === 'pending'
                ? 'Escolha nova data e hora (fuso de São Paulo). A mensagem continuará pendente até esse horário.'
                : 'Escolha nova data e hora no fuso de São Paulo. O processador tentará o envio automático nesse horário.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-2">
            <div className="space-y-2">
              <Label htmlFor="reschedule-date">Data</Label>
              <Input
                id="reschedule-date"
                type="date"
                value={rescheduleDate}
                onChange={(e) => setRescheduleDate(e.target.value)}
                min={minDateSaoPaulo}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reschedule-time">Hora</Label>
              <Input
                id="reschedule-time"
                type="time"
                value={rescheduleTime}
                onChange={(e) => setRescheduleTime(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" type="button" onClick={() => setRescheduleOpen(false)}>
              Voltar
            </Button>
            <Button
              type="button"
              onClick={() => void handleConfirmReschedule()}
              disabled={!rescheduleDate || !rescheduleTime || isRequeuingFailed}
            >
              {isRequeuingFailed ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Confirmar reagendamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}