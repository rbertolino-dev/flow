import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { isValidBrazilianPhone, normalizeCep, normalizePhone } from "@/lib/phoneUtils";
import { BRAZILIAN_UFS, normalizeUf } from "@/lib/brazilianUfs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const emptyForm = {
  name: "",
  phone: "",
  email: "",
  company: "",
  cpfCnpj: "",
  birthDate: "",
  notes: "",
  address: "",
  addressNumber: "",
  neighborhood: "",
  city: "",
  uf: "",
  postalCode: "",
};

interface PosCreateClientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  onCreated: (client: { id: string; name: string; phone: string }) => void;
}

export function PosCreateClientDialog({
  open,
  onOpenChange,
  organizationId,
  onCreated,
}: PosCreateClientDialogProps) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    if (!open) {
      setForm(emptyForm);
      setExpanded(false);
    }
  }, [open]);

  const setField = (field: keyof typeof emptyForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleCreate = async () => {
    if (!form.name.trim() || !form.phone.trim()) {
      toast({ title: "Informe nome e telefone", variant: "destructive" });
      return;
    }
    if (!isValidBrazilianPhone(form.phone)) {
      toast({
        title: "Telefone inválido",
        description: "Use DDD + número, com 10 ou 11 dígitos.",
        variant: "destructive",
      });
      return;
    }

    const cpfCnpjClean = form.cpfCnpj.replace(/\D/g, "");
    if (cpfCnpjClean && cpfCnpjClean.length !== 11 && cpfCnpjClean.length !== 14) {
      toast({
        title: "CPF ou CNPJ inválido",
        description: "Informe 11 dígitos (CPF) ou 14 (CNPJ), ou deixe em branco.",
        variant: "destructive",
      });
      return;
    }
    const cepDigits = normalizeCep(form.postalCode);

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      const { data, error } = await supabase
        .from("leads")
        .insert({
          name: form.name.trim(),
          phone: normalizePhone(form.phone.trim()),
          email: form.email.trim() || null,
          company: form.company.trim() || null,
          notes: form.notes.trim() || null,
          organization_id: organizationId,
          user_id: user.id,
          status: "novo",
          source: "PDV",
        })
        .select("id, name, phone")
        .single();
      if (error || !data) throw error || new Error("Erro ao criar cliente");

    const extra: Record<string, string> = {};
    if (cpfCnpjClean) extra.cpf_cnpj = cpfCnpjClean;
    if (form.birthDate.trim()) extra.birth_date = form.birthDate.trim();
    if (form.address.trim()) extra.address = form.address.trim();
    if (form.addressNumber.trim()) extra.address_number = form.addressNumber.trim();
    if (form.neighborhood.trim()) extra.neighborhood = form.neighborhood.trim();
    if (form.city.trim()) extra.city = form.city.trim();
    const uf = normalizeUf(form.uf);
    if (uf) extra.uf = uf;
    if (cepDigits.length === 8) extra.postal_code = cepDigits;
    else if (cepDigits.length > 0) {
      toast({
        title: "CEP não salvo",
        description: "Use 8 dígitos para gravar o CEP. Os demais dados foram salvos.",
      });
    }

    if (Object.keys(extra).length > 0) {
      const { error: extraError } = await supabase
        .from("leads")
        .update(extra as never)
        .eq("id", data.id)
        .eq("organization_id", organizationId);
      if (extraError) {
        toast({
          title: "Cliente criado com os dados básicos",
          description: "Nome, telefone e e-mail foram salvos. Os dados extras não puderam ser gravados.",
          variant: "destructive",
        });
      }
    }

      onCreated({ id: data.id, name: data.name, phone: data.phone });
      onOpenChange(false);
      toast({ title: "Cliente criado" });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Erro ao criar cliente";
      toast({ title: "Erro ao criar cliente", description: message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="px-6 pt-6">
          <DialogTitle>Novo cliente</DialogTitle>
          <DialogDescription>
            Nome e telefone bastam para a venda. Os demais dados podem ser preenchidos agora.
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-6 py-4">
          <div className="space-y-1">
            <Label>Nome *</Label>
            <Input value={form.name} onChange={(e) => setField("name", e.target.value)} autoFocus />
          </div>
          <div className="space-y-1">
            <Label>Telefone *</Label>
            <Input
              value={form.phone}
              onChange={(e) => setField("phone", e.target.value)}
              placeholder="(11) 98765-4321"
            />
          </div>
          <div className="space-y-1">
            <Label>E-mail</Label>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setField("email", e.target.value)}
            />
          </div>

          <Button
            type="button"
            variant="ghost"
            className="h-9 w-full justify-between px-2"
            onClick={() => setExpanded((current) => !current)}
          >
            {expanded ? "Menos informações" : "Mais informações"}
            <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`} />
          </Button>

          {expanded && (
            <div className="space-y-3 border-t pt-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label>Empresa</Label>
                  <Input value={form.company} onChange={(e) => setField("company", e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>CPF ou CNPJ</Label>
                  <Input
                    value={form.cpfCnpj}
                    onChange={(e) => setField("cpfCnpj", e.target.value)}
                    placeholder="Somente números"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label>Data de nascimento</Label>
                <Input
                  type="date"
                  value={form.birthDate}
                  onChange={(e) => setField("birthDate", e.target.value)}
                />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="space-y-1 sm:col-span-2">
                  <Label>Rua</Label>
                  <Input value={form.address} onChange={(e) => setField("address", e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Número</Label>
                  <Input
                    value={form.addressNumber}
                    onChange={(e) => setField("addressNumber", e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label>Bairro</Label>
                  <Input
                    value={form.neighborhood}
                    onChange={(e) => setField("neighborhood", e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Cidade</Label>
                  <Input value={form.city} onChange={(e) => setField("city", e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label>UF</Label>
                  <Select
                    value={form.uf || "__none__"}
                    onValueChange={(value) => setField("uf", value === "__none__" ? "" : value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="UF" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Não informar</SelectItem>
                      {BRAZILIAN_UFS.map((uf) => (
                        <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>CEP</Label>
                  <Input
                    value={form.postalCode}
                    onChange={(e) => setField("postalCode", e.target.value)}
                    placeholder="00000-000"
                    maxLength={9}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label>Observações</Label>
                <Textarea
                  value={form.notes}
                  onChange={(e) => setField("notes", e.target.value)}
                  rows={3}
                />
              </div>
            </div>
          )}
        </div>
        <DialogFooter className="border-t px-6 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleCreate} disabled={saving}>{saving ? "Salvando..." : "Criar cliente"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
