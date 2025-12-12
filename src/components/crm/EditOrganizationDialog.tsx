import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Building2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface EditOrganizationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  onSuccess?: () => void;
}

const STATES = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA",
  "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN",
  "RS", "RO", "RR", "SC", "SP", "SE", "TO"
];

const TAX_REGIMES = [
  { value: "simples", label: "Simples Nacional" },
  { value: "lucro_presumido", label: "Lucro Presumido" },
  { value: "lucro_real", label: "Lucro Real" },
  { value: "mei", label: "MEI" },
];

const BUSINESS_TYPES = [
  { value: "comercio", label: "Comércio" },
  { value: "servicos", label: "Serviços" },
  { value: "industria", label: "Indústria" },
  { value: "misto", label: "Misto" },
];

export function EditOrganizationDialog({
  open,
  onOpenChange,
  organizationId,
  onSuccess,
}: EditOrganizationDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [formData, setFormData] = useState({
    name: "",
    company_profile: "",
    state: "",
    city: "",
    tax_regime: "",
    business_type: "",
  });

  useEffect(() => {
    if (open && organizationId) {
      fetchOrganization();
    }
  }, [open, organizationId]);

  const fetchOrganization = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("organizations")
        .select("name, company_profile, state, city, tax_regime, business_type")
        .eq("id", organizationId)
        .single();

      if (error) throw error;

      setFormData({
        name: data.name || "",
        company_profile: data.company_profile || "",
        state: data.state || "",
        city: data.city || "",
        tax_regime: data.tax_regime || "",
        business_type: data.business_type || "",
      });
    } catch (error: any) {
      console.error("Erro ao carregar organização:", error);
      toast({
        title: "Erro ao carregar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast({
        title: "Nome obrigatório",
        description: "O nome da organização não pode estar vazio.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from("organizations")
        .update({
          name: formData.name.trim(),
          company_profile: formData.company_profile || null,
          state: formData.state || null,
          city: formData.city || null,
          tax_regime: formData.tax_regime || null,
          business_type: formData.business_type || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", organizationId);

      if (error) throw error;

      toast({
        title: "Organização atualizada",
        description: "As informações foram salvas com sucesso.",
      });

      onSuccess?.();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Erro ao salvar organização:", error);
      toast({
        title: "Erro ao salvar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Editar Organização
          </DialogTitle>
          <DialogDescription>
            Atualize as informações da sua organização
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome da Organização *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Nome da empresa"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="company_profile">Perfil da Empresa</Label>
              <Textarea
                id="company_profile"
                value={formData.company_profile}
                onChange={(e) => setFormData({ ...formData, company_profile: e.target.value })}
                placeholder="Descreva brevemente sua empresa..."
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="state">Estado</Label>
                <Select
                  value={formData.state}
                  onValueChange={(value) => setFormData({ ...formData, state: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {STATES.map((state) => (
                      <SelectItem key={state} value={state}>
                        {state}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="city">Cidade</Label>
                <Input
                  id="city"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  placeholder="Sua cidade"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="tax_regime">Regime Tributário</Label>
                <Select
                  value={formData.tax_regime}
                  onValueChange={(value) => setFormData({ ...formData, tax_regime: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {TAX_REGIMES.map((regime) => (
                      <SelectItem key={regime.value} value={regime.value}>
                        {regime.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="business_type">Tipo de Negócio</Label>
                <Select
                  value={formData.business_type}
                  onValueChange={(value) => setFormData({ ...formData, business_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {BUSINESS_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={loading || saving}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              "Salvar"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
