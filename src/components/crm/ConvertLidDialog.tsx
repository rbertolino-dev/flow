import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { normalizePhone, isValidBrazilianPhone, formatBrazilianPhone } from "@/lib/phoneUtils";
import { LidContact } from "@/hooks/useLidContacts";
import { getUserOrganizationId } from "@/lib/organizationUtils";

interface ConvertLidDialogProps {
  lidContact: LidContact | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConverted: () => void;
}

export function ConvertLidDialog({ lidContact, open, onOpenChange, onConverted }: ConvertLidDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [phone, setPhone] = useState("");

  const handleConvert = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!lidContact) return;

    if (!isValidBrazilianPhone(phone)) {
      toast({
        title: "Telefone inválido",
        description: "Digite um telefone brasileiro válido com 10 ou 11 dígitos",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const orgId = await getUserOrganizationId();
      if (!orgId) throw new Error("Usuário não pertence a uma organização");

      const normalizedPhone = normalizePhone(phone);

      // Verificar se já existe lead com este telefone na mesma organização
      const { data: existingLead } = await supabase
        .from('leads')
        .select('id, name')
        .eq('phone', normalizedPhone)
        .eq('organization_id', orgId)
        .maybeSingle();

      if (existingLead) {
        toast({
          title: "Telefone já cadastrado",
          description: `Este telefone já pertence ao lead "${existingLead.name}"`,
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      // Criar lead a partir do contato LID
      const { error: leadError } = await (supabase as any)
        .from('leads')
        .insert({
          user_id: user.id,
          organization_id: orgId,
          name: lidContact.name,
          phone: normalizedPhone,
          status: 'new',
          source: 'whatsapp_lid',
          assigned_to: user.email || 'Sistema',
          notes: `Convertido de LID: ${lidContact.lid}\n${lidContact.notes || ''}`,
          last_contact: lidContact.last_contact || new Date().toISOString(),
        });

      if (leadError) throw leadError;

      // Marcar LID como convertido (soft delete)
      await (supabase as any)
        .from('whatsapp_lid_contacts')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', lidContact.id);

      toast({
        title: "Lead criado com sucesso",
        description: `${lidContact.name} foi adicionado ao funil com o telefone ${formatBrazilianPhone(normalizedPhone)}`,
      });

      setPhone("");
      onConverted();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Erro ao converter contato",
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
          <DialogTitle>Converter para Lead</DialogTitle>
        </DialogHeader>
        {lidContact && (
          <form onSubmit={handleConvert} className="space-y-4">
            <div className="space-y-2">
              <Label>Contato LID</Label>
              <div className="p-3 bg-muted rounded-md">
                <p className="font-semibold">{lidContact.name}</p>
                <p className="text-sm text-muted-foreground">ID: {lidContact.lid}</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Telefone Brasileiro *</Label>
              <Input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(11) 98765-4321 ou 11987654321"
                required
              />
              <p className="text-xs text-muted-foreground">
                Digite o telefone brasileiro do contato (10-11 dígitos)
              </p>
            </div>

            <div className="p-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-md">
              <p className="text-sm text-amber-900 dark:text-amber-100">
                ℹ️ O contato LID será removido da lista após a conversão
              </p>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Convertendo..." : "Converter em Lead"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
