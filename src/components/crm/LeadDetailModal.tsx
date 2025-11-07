import { Lead } from "@/types/lead";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Phone, Mail, Building2, Calendar, DollarSign, MessageSquare, PhoneCall, FileText, TrendingUp, Tag as TagIcon, Plus, X, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { useTags } from "@/hooks/useTags";
import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useCallQueue } from "@/hooks/useCallQueue";
import { useLeads } from "@/hooks/useLeads";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { buildCopyNumber, formatBrazilianPhone } from "@/lib/phoneUtils";

interface LeadDetailModalProps {
  lead: Lead;
  open: boolean;
  onClose: () => void;
}

const activityIcons = {
  whatsapp: MessageSquare,
  call: PhoneCall,
  note: FileText,
  status_change: TrendingUp,
};

const activityColors = {
  whatsapp: "text-success",
  call: "text-primary",
  note: "text-accent",
  status_change: "text-warning",
};

export function LeadDetailModal({ lead, open, onClose }: LeadDetailModalProps) {
  const { tags, addTagToLead, removeTagFromLead } = useTags();
  const { addToQueue } = useCallQueue();
  const { deleteLead } = useLeads();
  const { toast } = useToast();
  const [selectedTagId, setSelectedTagId] = useState<string>("");

  const handleDeleteLead = async () => {
    const success = await deleteLead(lead.id);
    if (success) {
      onClose();
    }
  };

  const handleAddTag = async () => {
    if (!selectedTagId) return;
    const success = await addTagToLead(lead.id, selectedTagId);
    if (success) {
      setSelectedTagId("");
      toast({
        title: "Etiqueta adicionada",
        description: "A etiqueta foi adicionada ao lead.",
      });
    }
  };

  const handleRemoveTag = async (tagId: string) => {
    await removeTagFromLead(lead.id, tagId);
    toast({
      title: "Etiqueta removida",
      description: "A etiqueta foi removida do lead.",
    });
  };

  const handleAddToCallQueue = async () => {
    const firstMessage = lead.activities
      .filter(a => a.type === 'whatsapp')
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())[0];

    const notes = firstMessage 
      ? `Primeira mensagem: "${firstMessage.content.substring(0, 100)}${firstMessage.content.length > 100 ? '...' : ''}"`
      : undefined;

    const success = await addToQueue({
      leadId: lead.id,
      leadName: lead.name,
      phone: lead.phone,
      priority: 'medium',
      notes,
      callCount: 0,
    });

    if (success) {
      toast({
        title: "Adicionado à fila",
        description: "O lead foi adicionado à fila de ligações.",
      });
    }
  };

  const availableTags = tags.filter(
    tag => !lead.tags?.some(lt => lt.id === tag.id)
  );

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] p-0">
        <DialogHeader className="p-6 pb-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <DialogTitle className="text-2xl mb-2">{lead.name}</DialogTitle>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">{lead.source}</Badge>
                <Badge variant="outline">{lead.status}</Badge>
              </div>
            </div>
            {lead.value && (
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Valor do Negócio</p>
                <p className="text-2xl font-bold text-primary">
                  {new Intl.NumberFormat("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  }).format(lead.value)}
                </p>
              </div>
            )}
          </div>
        </DialogHeader>

        <Separator />

        <ScrollArea className="max-h-[60vh]">
          <div className="p-6 space-y-6">
            {/* Contact Information */}
            <div className="space-y-3">
              <h3 className="font-semibold text-lg">Informações de Contato</h3>
              <div className="grid gap-3">
                <div className="flex items-center gap-3 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span>{formatBrazilianPhone(lead.phone)}</span>
                  <Button size="sm" variant="outline" className="ml-auto" onClick={() => {
                    const formatted = buildCopyNumber(lead.phone);
                    navigator.clipboard.writeText(formatted);
                    toast({
                      title: "Telefone copiado",
                      description: `${formatted} copiado para a área de transferência`,
                    });
                  }}>
                    Ligar
                  </Button>
                </div>
                {lead.email && (
                  <div className="flex items-center gap-3 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span>{lead.email}</span>
                  </div>
                )}
                {lead.company && (
                  <div className="flex items-center gap-3 text-sm">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span>{lead.company}</span>
                  </div>
                )}
                <div className="flex items-center gap-3 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>
                    Último contato: {format(lead.lastContact, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </span>
                </div>
              </div>
            </div>

            <Separator />

            {/* Additional Info */}
            <div className="space-y-3">
              <h3 className="font-semibold text-lg">Detalhes</h3>
              <div className="grid gap-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Responsável:</span>
                  <span className="font-medium">{lead.assignedTo}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Criado em:</span>
                  <span className="font-medium">
                    {format(lead.createdAt, "dd/MM/yyyy", { locale: ptBR })}
                  </span>
                </div>
              </div>
              {lead.notes && (
                <div className="mt-3 p-3 bg-muted rounded-md">
                  <p className="text-sm text-muted-foreground">Observações:</p>
                  <p className="text-sm mt-1">{lead.notes}</p>
                </div>
              )}
            </div>

            <Separator />

            {/* Tags Section */}
            <div className="space-y-3">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <TagIcon className="h-5 w-5" />
                Etiquetas
              </h3>
              <div className="space-y-3">
                {lead.tags && lead.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {lead.tags.map((tag) => (
                      <Badge
                        key={tag.id}
                        variant="outline"
                        style={{ 
                          backgroundColor: `${tag.color}20`, 
                          borderColor: tag.color,
                          color: tag.color 
                        }}
                        className="gap-1"
                      >
                        {tag.name}
                        <button
                          onClick={() => handleRemoveTag(tag.id)}
                          className="ml-1 hover:bg-white/20 rounded-full"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
                {availableTags.length > 0 && (
                  <div className="flex gap-2">
                    <Select value={selectedTagId} onValueChange={setSelectedTagId}>
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Selecione uma etiqueta" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableTags.map((tag) => (
                          <SelectItem key={tag.id} value={tag.id}>
                            <div className="flex items-center gap-2">
                              <div
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: tag.color }}
                              />
                              {tag.name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      onClick={handleAddTag}
                      disabled={!selectedTagId}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </div>

            <Separator />

            {/* Activity Timeline */}
            <div className="space-y-3">
              <h3 className="font-semibold text-lg">Histórico de Atividades</h3>
              <div className="space-y-4">
                {lead.activities.map((activity) => {
                  const Icon = activityIcons[activity.type];
                  const colorClass = activityColors[activity.type];

                  return (
                    <div key={activity.id} className="flex gap-3">
                      <div className={`mt-1 ${colorClass}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm">{activity.content}</p>
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                          <span>{format(activity.timestamp, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
                          <span>•</span>
                          <span>{activity.user}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </ScrollArea>

        <Separator />

        <div className="p-6 pt-4 flex gap-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm">
                <Trash2 className="h-4 w-4 mr-2" />
                Excluir
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir contato?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta ação não pode ser desfeita. O contato será removido do funil e da fila de ligações.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteLead} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Confirmar exclusão
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
          <Button variant="secondary" onClick={handleAddToCallQueue}>
            <PhoneCall className="h-4 w-4 mr-2" />
            Adicionar à Fila
          </Button>
          <Button className="flex-1">
            <MessageSquare className="h-4 w-4 mr-2" />
            Enviar WhatsApp
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
