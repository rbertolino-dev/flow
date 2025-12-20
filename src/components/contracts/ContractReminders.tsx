import { useState } from 'react';
import { useContractReminders } from '@/hooks/useContractReminders';
import { ContractReminder, ReminderType, ReminderSentVia } from '@/types/contract';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, Trash2, Bell, CheckCircle2, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ContractRemindersProps {
  contractId: string;
}

const REMINDER_TYPES: { value: ReminderType; label: string }[] = [
  { value: 'signature_due', label: 'Assinatura Pendente' },
  { value: 'expiration_approaching', label: 'Vencimento Próximo' },
  { value: 'follow_up', label: 'Follow-up' },
  { value: 'custom', label: 'Personalizado' },
];

const SENT_VIA_OPTIONS: { value: ReminderSentVia; label: string }[] = [
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'email', label: 'E-mail' },
  { value: 'sms', label: 'SMS' },
  { value: 'system', label: 'Sistema' },
];

export function ContractReminders({ contractId }: ContractRemindersProps) {
  const { reminders, loading, createReminder, updateReminder, deleteReminder } = useContractReminders(contractId);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingReminder, setEditingReminder] = useState<ContractReminder | null>(null);
  const [formData, setFormData] = useState({
    reminder_type: 'follow_up' as ReminderType,
    scheduled_at: '',
    message: '',
    sent_via: 'whatsapp' as ReminderSentVia,
  });

  const handleOpenDialog = (reminder?: ContractReminder) => {
    if (reminder) {
      setEditingReminder(reminder);
      setFormData({
        reminder_type: reminder.reminder_type,
        scheduled_at: reminder.scheduled_at ? new Date(reminder.scheduled_at).toISOString().slice(0, 16) : '',
        message: reminder.message || '',
        sent_via: reminder.sent_via || 'whatsapp',
      });
    } else {
      setEditingReminder(null);
      setFormData({
        reminder_type: 'follow_up',
        scheduled_at: '',
        message: '',
        sent_via: 'whatsapp',
      });
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingReminder(null);
    setFormData({
      reminder_type: 'follow_up',
      scheduled_at: '',
      message: '',
      sent_via: 'whatsapp',
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.scheduled_at) {
      return;
    }

    try {
      const scheduledAt = new Date(formData.scheduled_at).toISOString();
      
      if (editingReminder) {
        await updateReminder(editingReminder.id, {
          reminder_type: formData.reminder_type,
          scheduled_at: scheduledAt,
          message: formData.message || undefined,
          sent_via: formData.sent_via,
        });
      } else {
        await createReminder({
          contract_id: contractId,
          reminder_type: formData.reminder_type,
          scheduled_at: scheduledAt,
          message: formData.message || undefined,
          sent_via: formData.sent_via,
        });
      }
      handleCloseDialog();
    } catch (error) {
      // Erro já tratado no hook
    }
  };

  const handleDelete = async (reminder: ContractReminder) => {
    if (!confirm(`Tem certeza que deseja remover este lembrete?`)) {
      return;
    }

    try {
      await deleteReminder(reminder.id);
    } catch (error) {
      // Erro já tratado no hook
    }
  };

  const getReminderTypeLabel = (type: ReminderType) => {
    return REMINDER_TYPES.find(t => t.value === type)?.label || type;
  };

  const getSentViaLabel = (via: ReminderSentVia) => {
    return SENT_VIA_OPTIONS.find(v => v.value === via)?.label || via;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Bell className="w-5 h-5" />
            Lembretes Automáticos
          </h3>
          <p className="text-sm text-muted-foreground">
            Configure lembretes automáticos para este contrato
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={() => handleOpenDialog()}>
              <Plus className="w-4 h-4 mr-2" />
              Novo Lembrete
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingReminder ? 'Editar Lembrete' : 'Novo Lembrete'}
              </DialogTitle>
              <DialogDescription>
                Configure quando e como o lembrete será enviado
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="reminder_type">Tipo de Lembrete *</Label>
                  <select
                    id="reminder_type"
                    value={formData.reminder_type}
                    onChange={(e) => setFormData({ ...formData, reminder_type: e.target.value as ReminderType })}
                    className="w-full px-3 py-2 border rounded-md"
                    required
                  >
                    {REMINDER_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="scheduled_at">Data e Hora *</Label>
                  <Input
                    id="scheduled_at"
                    type="datetime-local"
                    value={formData.scheduled_at}
                    onChange={(e) => setFormData({ ...formData, scheduled_at: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sent_via">Enviar Via *</Label>
                  <select
                    id="sent_via"
                    value={formData.sent_via}
                    onChange={(e) => setFormData({ ...formData, sent_via: e.target.value as ReminderSentVia })}
                    className="w-full px-3 py-2 border rounded-md"
                    required
                  >
                    {SENT_VIA_OPTIONS.map((via) => (
                      <option key={via.value} value={via.value}>
                        {via.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="message">Mensagem (opcional)</Label>
                  <Textarea
                    id="message"
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    placeholder="Mensagem personalizada do lembrete..."
                    rows={4}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={handleCloseDialog}>
                  Cancelar
                </Button>
                <Button type="submit">
                  {editingReminder ? 'Salvar Alterações' : 'Criar Lembrete'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="text-center py-4 text-muted-foreground">Carregando lembretes...</div>
      ) : reminders.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground border rounded-lg">
          Nenhum lembrete configurado. Clique em "Novo Lembrete" para criar um.
        </div>
      ) : (
        <div className="space-y-2">
          {reminders.map((reminder) => {
            const isPast = new Date(reminder.scheduled_at) < new Date();
            const isSent = reminder.sent_at !== null;

            return (
              <div
                key={reminder.id}
                className="border rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant={isSent ? 'default' : isPast ? 'destructive' : 'secondary'}>
                        {getReminderTypeLabel(reminder.reminder_type)}
                      </Badge>
                      <Badge variant="outline">
                        {getSentViaLabel(reminder.sent_via)}
                      </Badge>
                      {isSent && (
                        <Badge variant="outline" className="gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          Enviado
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm font-medium mb-1">
                      {format(new Date(reminder.scheduled_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </p>
                    {reminder.message && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {reminder.message}
                      </p>
                    )}
                    {reminder.sent_at && (
                      <p className="text-xs text-muted-foreground mt-2">
                        Enviado em: {format(new Date(reminder.sent_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-1">
                    {!isSent && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenDialog(reminder)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(reminder)}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}





