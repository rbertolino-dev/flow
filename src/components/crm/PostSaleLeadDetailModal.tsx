import { PostSaleLead } from "@/types/postSaleLead";
import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Phone, Mail, Building2, Calendar, DollarSign, MessageSquare, Tag as TagIcon } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useTags } from "@/hooks/useTags";
import { usePostSaleLeads } from "@/hooks/usePostSaleLeads";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { buildCopyNumber, formatBrazilianPhone } from "@/lib/phoneUtils";
import { usePostSaleStages } from "@/hooks/usePostSaleStages";

interface PostSaleLeadDetailModalProps {
  lead: PostSaleLead;
  open: boolean;
  onClose: () => void;
  onUpdated?: () => void;
}

export function PostSaleLeadDetailModal({ lead, open, onClose, onUpdated }: PostSaleLeadDetailModalProps) {
  const { tags } = useTags();
  const { updateLead, deleteLead } = usePostSaleLeads();
  const { stages } = usePostSaleStages();
  const { toast } = useToast();
  const [notes, setNotes] = useState(lead.notes || "");
  const [isSaving, setIsSaving] = useState(false);

  const handleSaveNotes = async () => {
    setIsSaving(true);
    try {
      await updateLead(lead.id, { notes });
      toast({
        title: "Observações salvas",
        description: "As observações foram atualizadas com sucesso.",
      });
      onUpdated?.();
    } catch (error: any) {
      toast({
        title: "Erro ao salvar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (confirm(`Tem certeza que deseja excluir ${lead.name}?`)) {
      const success = await deleteLead(lead.id);
      if (success) {
        onClose();
        onUpdated?.();
      }
    }
  };

  const handleWhatsAppClick = () => {
    const formatted = buildCopyNumber(lead.phone);
    window.open(`https://wa.me/${formatted}`, '_blank');
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl sm:text-2xl truncate">{lead.name}</DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-120px)] pr-4">
          <div className="space-y-4">
            {/* Informações de Contato */}
            <div className="space-y-3">
              <h3 className="font-semibold text-lg">Informações de Contato</h3>
              <div className="grid gap-2 text-sm">
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Telefone:</span>
                  <span className="font-medium">{formatBrazilianPhone(lead.phone)}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleWhatsAppClick}
                    className="ml-auto"
                  >
                    <MessageSquare className="h-4 w-4 mr-2" />
                    WhatsApp
                  </Button>
                </div>
                {lead.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Email:</span>
                    <span className="font-medium">{lead.email}</span>
                  </div>
                )}
                {lead.company && (
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Empresa:</span>
                    <span className="font-medium">{lead.company}</span>
                  </div>
                )}
                {lead.value && (
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Valor:</span>
                    <span className="font-medium">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(lead.value)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <Separator />

            {/* Etiquetas */}
            {lead.tags && lead.tags.length > 0 && (
              <>
                <div className="space-y-3">
                  <h3 className="font-semibold text-lg flex items-center gap-2">
                    <TagIcon className="h-5 w-5" />
                    Etiquetas
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {lead.tags.map((tag) => (
                      <Badge
                        key={tag.id}
                        variant="outline"
                        style={{
                          backgroundColor: `${tag.color}20`,
                          borderColor: tag.color,
                          color: tag.color,
                        }}
                      >
                        {tag.name}
                      </Badge>
                    ))}
                  </div>
                </div>
                <Separator />
              </>
            )}

            {/* Observações */}
            <div className="space-y-3">
              <h3 className="font-semibold text-lg">Observações</h3>
              <div className="space-y-2">
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Adicione observações sobre este cliente..."
                  rows={4}
                />
                <Button onClick={handleSaveNotes} disabled={isSaving} size="sm">
                  {isSaving ? "Salvando..." : "Salvar Observações"}
                </Button>
              </div>
            </div>

            <Separator />

            {/* Informações Adicionais */}
            <div className="space-y-3">
              <h3 className="font-semibold text-lg">Informações Adicionais</h3>
              <div className="grid gap-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Criado em:</span>
                  <span className="font-medium">
                    {format(lead.createdAt, "dd/MM/yyyy", { locale: ptBR })}
                  </span>
                </div>
                {lead.transferredAt && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Transferido em:</span>
                    <span className="font-medium">
                      {format(lead.transferredAt, "dd/MM/yyyy", { locale: ptBR })}
                    </span>
                  </div>
                )}
                {lead.source && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Origem:</span>
                    <span className="font-medium">{lead.source === 'transferido' ? 'Transferido do Funil de Vendas' : 'Manual'}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Botão de Excluir */}
            <Separator />
            <div className="flex justify-end">
              <Button variant="destructive" onClick={handleDelete} size="sm">
                Excluir Cliente
              </Button>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

