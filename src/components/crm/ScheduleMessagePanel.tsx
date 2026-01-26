import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Calendar, Clock, X, Trash2, Image as ImageIcon, Repeat, Link2 } from "lucide-react";
import { useScheduledMessages } from "@/hooks/useScheduledMessages";
import { useOrganizationFeatures } from "@/hooks/useOrganizationFeatures";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatInTimeZone } from "date-fns-tz";
import { Badge } from "@/components/ui/badge";
import { parseSaoPauloDateTime } from "@/lib/dateUtils";

interface ScheduleMessagePanelProps {
  leadId: string;
  leadPhone: string;
  instances: Array<{ id: string; instance_name: string; is_connected: boolean }>;
  onClose?: () => void;
}

export function ScheduleMessagePanel({ leadId, leadPhone, instances, onClose }: ScheduleMessagePanelProps) {
  const { scheduledMessages, scheduleMessage, cancelScheduledMessage, deleteScheduledMessage } = useScheduledMessages(leadId);
  const { hasFeature } = useOrganizationFeatures();
  const { toast } = useToast();
  
  const [instanceId, setInstanceId] = useState<string>("");
  const [message, setMessage] = useState<string>("");
  const [scheduledDate, setScheduledDate] = useState<string>("");
  const [scheduledTime, setScheduledTime] = useState<string>("");
  const [mediaUrl, setMediaUrl] = useState<string>("");
  const [mediaType, setMediaType] = useState<'image' | 'video' | 'document'>('image');
  const [isScheduling, setIsScheduling] = useState(false);
  
  // Campos de repetição
  const [repeatEnabled, setRepeatEnabled] = useState(false);
  const [repeatPeriod, setRepeatPeriod] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('monthly');
  const [repeatDuration, setRepeatDuration] = useState<number>(1); // Duração em dias/semanas/meses/anos
  
  // Campos de combo
  const [isCombo, setIsCombo] = useState(false);
  const [comboMessage, setComboMessage] = useState<string>("");
  const [comboDelayDays, setComboDelayDays] = useState<number>(1);
  const [comboMediaUrl, setComboMediaUrl] = useState<string>("");
  const [comboMediaType, setComboMediaType] = useState<'image' | 'video' | 'document'>('image');
  
  // Dialog de cancelamento
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelMessageId, setCancelMessageId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState<string>("");

  // Filtrar apenas instâncias conectadas
  const connectedInstances = useMemo(() => 
    instances.filter(i => i.is_connected === true),
    [instances]
  );

  // Função para formatar mensagens de erro de forma mais clara
  const formatErrorMessage = (errorMessage: string): string => {
    if (!errorMessage) return 'Erro desconhecido';

    // Tentar parsear JSON se for um erro do Evolution API
    try {
      // Verificar se contém "exists":false (número não existe no WhatsApp)
      if (errorMessage.includes('"exists":false') || errorMessage.includes("exists: false")) {
        // Tentar extrair número do erro
        const numberMatch = errorMessage.match(/"number":\s*"([^"]+)"/);
        const jidMatch = errorMessage.match(/"jid":\s*"([^"]+)"/);
        const number = numberMatch ? numberMatch[1] : (jidMatch ? jidMatch[1].split('@')[0] : 'número desconhecido');
        
        return `O número ${number} não existe no WhatsApp ou não está cadastrado. Verifique se o número está correto e se o contato tem WhatsApp ativo.`;
      }

      // Verificar se é erro 400 do Evolution API
      if (errorMessage.includes('Evolution API erro 400') || errorMessage.includes('Bad Request')) {
        return 'Erro na API do WhatsApp: Requisição inválida. Verifique se a instância está configurada corretamente.';
      }

      // Verificar se é erro de autenticação
      if (errorMessage.includes('401') || errorMessage.includes('Unauthorized') || errorMessage.includes('autenticação')) {
        return 'Erro de autenticação: A instância do WhatsApp não está autenticada. Verifique as configurações da instância.';
      }

      // Verificar se é erro de conexão
      if (errorMessage.includes('ECONNREFUSED') || errorMessage.includes('timeout') || errorMessage.includes('conexão')) {
        return 'Erro de conexão: Não foi possível conectar com a API do WhatsApp. Verifique se a instância está online.';
      }

      // Se for muito longo, tentar resumir
      if (errorMessage.length > 200) {
        // Tentar extrair parte relevante
        const jsonMatch = errorMessage.match(/\{[^}]+\}/);
        if (jsonMatch) {
          try {
            const errorData = JSON.parse(jsonMatch[0]);
            if (errorData.message) {
              return `Erro: ${errorData.message}`;
            }
          } catch {
            // Ignorar erro de parse
          }
        }
        return errorMessage.substring(0, 200) + '...';
      }
    } catch (e) {
      // Se der erro ao processar, retornar mensagem original
    }

    return errorMessage;
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
        mediaUrl: mediaUrl || undefined,
        mediaType: mediaUrl ? mediaType : undefined,
        repeatEnabled: repeatEnabled,
        repeatPeriod: repeatEnabled ? repeatPeriod : undefined,
        repeatDuration: repeatEnabled ? repeatDuration : undefined,
        isCombo: isCombo,
        comboMessage: isCombo ? comboMessage : undefined,
        comboDelayDays: isCombo ? comboDelayDays : undefined,
        comboMediaUrl: isCombo && comboMediaUrl ? comboMediaUrl : undefined,
        comboMediaType: isCombo && comboMediaUrl ? comboMediaType : undefined,
      });

      // Limpar formulário
      setMessage("");
      setScheduledDate("");
      setScheduledTime("");
      setMediaUrl("");
      setMediaType('image');
      setRepeatEnabled(false);
      setRepeatDuration(1);
      setIsCombo(false);
      setComboMessage("");
      setComboDelayDays(1);
      setComboMediaUrl("");
      setComboMediaType('image');
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

  // Mensagens que podem ser enviadas agora (agendadas para hoje ou passado)
  const now = new Date();
  const messagesToSendNow = pendingMessages.filter(msg => {
    const scheduledDate = new Date(msg.scheduled_for);
    return scheduledDate <= now;
  });

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

        {/* Mensagens que podem ser enviadas agora */}
        {messagesToSendNow.length > 0 && (
          <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <h4 className="font-medium text-sm mb-2 text-blue-900 dark:text-blue-100">
              Mensagens Prontas para Enviar ({messagesToSendNow.length})
            </h4>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {messagesToSendNow.map((msg) => (
                <div key={msg.id} className="p-2 bg-white dark:bg-gray-800 rounded border border-blue-200 dark:border-blue-700">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm whitespace-pre-wrap break-words">{msg.message}</p>
                      <span className="text-xs text-muted-foreground">
                        Agendada para: {formatInTimeZone(
                          new Date(msg.scheduled_for),
                          "America/Sao_Paulo",
                          "dd/MM/yyyy 'às' HH:mm",
                          { locale: ptBR }
                        )}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleCancelClick(msg.id)}
                      className="h-6 w-6"
                    >
                      <X className="h-3 w-3" />
                    </Button>
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
              <SelectContent>
                {connectedInstances.map((instance) => (
                  <SelectItem key={instance.id} value={instance.id}>
                    {instance.instance_name}
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
                min={new Date().toISOString().split('T')[0]}
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
                <Select value={repeatPeriod} onValueChange={(value) => setRepeatPeriod(value as any)}>
                  <SelectTrigger id="repeat-period">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
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
            disabled={!instanceId || !message.trim() || !scheduledDate || !scheduledTime || isScheduling}
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
                        {getStatusLabel(msg.status)}
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
                    {msg.error_message && (
                      <div className="text-xs text-red-600 mt-2 p-2 bg-red-50 dark:bg-red-900/20 rounded border border-red-200 dark:border-red-800">
                        <strong className="block mb-1">Erro:</strong>
                        {formatErrorMessage(msg.error_message)}
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
    </Card>
  );
}