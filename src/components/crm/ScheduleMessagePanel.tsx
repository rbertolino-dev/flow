import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, Clock, Send, X, Trash2, Image as ImageIcon } from "lucide-react";
import { useScheduledMessages } from "@/hooks/useScheduledMessages";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";

interface ScheduleMessagePanelProps {
  leadId: string;
  leadPhone: string;
  instances: Array<{ id: string; instance_name: string; is_connected: boolean }>;
  onClose?: () => void;
}

export function ScheduleMessagePanel({ leadId, leadPhone, instances, onClose }: ScheduleMessagePanelProps) {
  const { scheduledMessages, scheduleMessage, cancelScheduledMessage, deleteScheduledMessage } = useScheduledMessages(leadId);
  
  const [instanceId, setInstanceId] = useState<string>("");
  const [message, setMessage] = useState<string>("");
  const [scheduledDate, setScheduledDate] = useState<string>("");
  const [scheduledTime, setScheduledTime] = useState<string>("");
  const [mediaUrl, setMediaUrl] = useState<string>("");
  const [mediaType, setMediaType] = useState<'image' | 'video' | 'document'>('image');
  const [isScheduling, setIsScheduling] = useState(false);

  // Filtrar apenas instâncias conectadas
  const connectedInstances = useMemo(() => 
    instances.filter(i => i.is_connected === true),
    [instances]
  );

  const handleSchedule = async () => {
    if (!instanceId || !message.trim() || !scheduledDate || !scheduledTime) {
      return;
    }

    setIsScheduling(true);
    try {
      const scheduledFor = new Date(`${scheduledDate}T${scheduledTime}`);
      await scheduleMessage({
        leadId,
        instanceId,
        phone: leadPhone,
        message,
        scheduledFor,
        mediaUrl: mediaUrl || undefined,
        mediaType: mediaUrl ? mediaType : undefined,
      });

      // Limpar formulário
      setMessage("");
      setScheduledDate("");
      setScheduledTime("");
      setMediaUrl("");
      setMediaType('image');
    } finally {
      setIsScheduling(false);
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

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-lg flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Agendar Mensagem
        </h3>
        {onClose && (
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="space-y-3">
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
            rows={3}
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

        <div className="border-t pt-4">
          <Label className="flex items-center gap-2 mb-2">
            <ImageIcon className="h-4 w-4" />
            Mídia (Opcional)
          </Label>
          
          <div className="space-y-3">
            <div>
              <Label htmlFor="schedule-media-type" className="text-sm">Tipo de Mídia</Label>
              <Select
                value={mediaType}
                onValueChange={(value) => setMediaType(value as 'image' | 'video' | 'document')}
              >
                <SelectTrigger id="schedule-media-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="image">Imagem</SelectItem>
                  <SelectItem value="video">Vídeo</SelectItem>
                  <SelectItem value="document">Documento</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="schedule-media-url" className="text-sm">URL da Mídia</Label>
              <Input
                id="schedule-media-url"
                placeholder="https://exemplo.com/imagem.jpg"
                value={mediaUrl}
                onChange={(e) => setMediaUrl(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Insira a URL pública da imagem, vídeo ou documento
              </p>
            </div>
          </div>
        </div>

        <Button
          onClick={handleSchedule}
          disabled={!instanceId || !message.trim() || !scheduledDate || !scheduledTime || isScheduling}
          className="w-full"
        >
          <Clock className="h-4 w-4 mr-2" />
          {isScheduling ? 'Agendando...' : 'Agendar Mensagem'}
        </Button>
      </div>

      {/* Mensagens Agendadas (Pendentes) */}
      {pendingMessages.length > 0 && (
        <div className="space-y-2 border-t pt-4">
          <h4 className="font-medium text-sm">Mensagens Agendadas ({pendingMessages.length})</h4>
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
                        {format(new Date(msg.scheduled_for), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap break-words">{msg.message}</p>
                    {msg.media_url && (
                      <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                        <ImageIcon className="h-3 w-3" />
                        <span>{msg.media_type}: {msg.media_url}</span>
                      </div>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => cancelScheduledMessage(msg.id)}
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
        <div className="space-y-2 border-t pt-4">
          <h4 className="font-medium text-sm">Histórico ({historyMessages.length})</h4>
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
                        {format(new Date(msg.scheduled_for), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap break-words">{msg.message}</p>
                    {msg.media_url && (
                      <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                        <ImageIcon className="h-3 w-3" />
                        <span>{msg.media_type}: {msg.media_url}</span>
                      </div>
                    )}
                    {msg.error_message && (
                      <p className="text-xs text-red-600 mt-1">Erro: {msg.error_message}</p>
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
    </Card>
  );
}