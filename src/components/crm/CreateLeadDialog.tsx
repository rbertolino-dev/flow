import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { normalizePhone, isValidBrazilianPhone } from "@/lib/phoneUtils";
import { getUserOrganizationId } from "@/lib/organizationUtils";
import { Checkbox } from "@/components/ui/checkbox";

interface CreateLeadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLeadCreated: () => void;
  stages: Array<{ id: string; name: string; color: string }>;
}

export function CreateLeadDialog({ open, onOpenChange, onLeadCreated, stages }: CreateLeadDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [addToQueue, setAddToQueue] = useState(true);
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    company: "",
    value: "",
    stageId: stages[0]?.id || "",
    notes: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.phone) {
      toast({
        title: "Campos obrigatórios",
        description: "Nome e telefone são obrigatórios",
        variant: "destructive",
      });
      return;
    }

    if (!isValidBrazilianPhone(formData.phone)) {
      toast({
        title: "Telefone inválido",
        description: "Digite um telefone brasileiro válido com 10 ou 11 dígitos (ex: 11987654321 ou (11) 98765-4321)",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const organizationId = await getUserOrganizationId();
      if (!organizationId) throw new Error("Usuário não pertence a uma organização");

      const { data: leadId, error } = await supabase
        .rpc('create_lead_secure', {
          p_org_id: organizationId,
          p_name: formData.name,
          p_phone: normalizePhone(formData.phone),
          p_email: formData.email || null,
          p_company: formData.company || null,
          p_value: formData.value ? parseFloat(formData.value) : null,
          p_stage_id: formData.stageId || null,
          p_notes: formData.notes || null,
          p_source: 'manual',
        });

      if (error) throw error;

      // Opcionalmente adicionar à fila de ligações
      if (addToQueue && leadId) {
        const { error: queueError } = await supabase.rpc('add_to_call_queue_secure', {
          p_lead_id: leadId as string,
          p_scheduled_for: new Date().toISOString(),
          p_priority: 'medium',
          p_notes: null,
        });

        if (queueError) {
          const msg = (queueError.message || '').toLowerCase();
          if (msg.includes('já está na fila')) {
            toast({
              title: 'Lead já está na fila',
              description: 'Este lead já possui uma ligação pendente ou reagendada.',
            });
          } else {
            toast({
              title: 'Erro ao adicionar à fila',
              description: queueError.message,
              variant: 'destructive',
            });
          }
        } else {
          toast({
            title: 'Adicionado à fila',
            description: 'Lead adicionado à fila de ligações.',
          });
        }
      }

      toast({
        title: "Lead criado",
        description: "O lead foi adicionado ao funil com sucesso",
      });

      setFormData({
        name: "",
        phone: "",
        email: "",
        company: "",
        value: "",
        stageId: stages[0]?.id || "",
        notes: "",
      });

      onLeadCreated();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Erro ao criar lead",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Criar Novo Contato</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Nome completo"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Telefone *</Label>
            <Input
              id="phone"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="(11) 98765-4321 ou 11987654321"
              required
            />
            <p className="text-xs text-muted-foreground">
              Digite 10-11 dígitos (DDD + número)
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="email@exemplo.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="company">Empresa</Label>
            <Input
              id="company"
              value={formData.company}
              onChange={(e) => setFormData({ ...formData, company: e.target.value })}
              placeholder="Nome da empresa"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="value">Valor Estimado (R$)</Label>
            <Input
              id="value"
              type="number"
              step="0.01"
              value={formData.value}
              onChange={(e) => setFormData({ ...formData, value: e.target.value })}
              placeholder="0.00"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="stage">Etapa Inicial</Label>
            <Select value={formData.stageId} onValueChange={(value) => setFormData({ ...formData, stageId: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a etapa" />
              </SelectTrigger>
              <SelectContent>
                {stages.map((stage) => (
                  <SelectItem key={stage.id} value={stage.id}>
                    {stage.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Observações</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Informações adicionais..."
              rows={3}
            />
          </div>

          <div className="flex items-center gap-2">
            <Checkbox id="addToQueue" checked={addToQueue} onCheckedChange={(v) => setAddToQueue(Boolean(v))} />
            <Label htmlFor="addToQueue">Adicionar à fila de ligações</Label>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Criando..." : "Criar Lead"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
