import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useOnboarding } from "@/hooks/useOnboarding";
import { BRAZILIAN_STATES } from "@/lib/brazilianStates";
import { Building2, MapPin, FileText, Briefcase } from "lucide-react";

interface OrganizationFormProps {
  onComplete: () => void;
  initialData?: {
    name?: string;
    company_profile?: string;
    state?: string;
    city?: string;
    tax_regime?: string;
    business_type?: string;
    expectations?: string;
  };
}

export function OrganizationForm({ onComplete, initialData }: OrganizationFormProps) {
  const { toast } = useToast();
  const { updateOrganizationData } = useOnboarding();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: initialData?.name || "",
    company_profile: initialData?.company_profile || "",
    state: initialData?.state || "",
    city: initialData?.city || "",
    tax_regime: initialData?.tax_regime || "",
    business_type: initialData?.business_type || "",
    expectations: initialData?.expectations || "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.company_profile || !formData.state || 
        !formData.city || !formData.tax_regime || !formData.business_type) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha todos os campos obrigatórios",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const success = await updateOrganizationData(formData);
      
      if (success) {
        toast({
          title: "Dados salvos!",
          description: "Informações da organização atualizadas com sucesso",
        });
        onComplete();
      }
    } catch (error: any) {
      toast({
        title: "Erro ao salvar",
        description: error.message || "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Nome da Organização *
          </Label>
          <Input
            id="name"
            placeholder="Ex: Minha Empresa LTDA"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="company_profile">Perfil da Empresa *</Label>
          <Select
            value={formData.company_profile}
            onValueChange={(value) => setFormData({ ...formData, company_profile: value })}
            required
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione o perfil da empresa" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="MEI">MEI - Microempreendedor Individual</SelectItem>
              <SelectItem value="ME">ME - Microempresa</SelectItem>
              <SelectItem value="EPP">EPP - Empresa de Pequeno Porte</SelectItem>
              <SelectItem value="EIRELI">EIRELI - Empresa Individual de Responsabilidade Limitada</SelectItem>
              <SelectItem value="LTDA">LTDA - Sociedade Limitada</SelectItem>
              <SelectItem value="SA">SA - Sociedade Anônima</SelectItem>
              <SelectItem value="Outro">Outro</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="state" className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Estado *
            </Label>
            <Select
              value={formData.state}
              onValueChange={(value) => setFormData({ ...formData, state: value })}
              required
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o estado" />
              </SelectTrigger>
              <SelectContent>
                {BRAZILIAN_STATES.map((state) => (
                  <SelectItem key={state.value} value={state.value}>
                    {state.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="city">Cidade *</Label>
            <Input
              id="city"
              placeholder="Digite a cidade"
              value={formData.city}
              onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              required
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="tax_regime">Regime Tributário *</Label>
          <Select
            value={formData.tax_regime}
            onValueChange={(value) => setFormData({ ...formData, tax_regime: value })}
            required
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione o regime tributário" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="MEI">MEI - Microempreendedor Individual</SelectItem>
              <SelectItem value="ME">ME - Microempresa</SelectItem>
              <SelectItem value="Simples Nacional">Simples Nacional</SelectItem>
              <SelectItem value="Lucro Presumido">Lucro Presumido</SelectItem>
              <SelectItem value="Lucro Real">Lucro Real</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="business_type" className="flex items-center gap-2">
            <Briefcase className="h-4 w-4" />
            Tipo de Negócio *
          </Label>
          <Select
            value={formData.business_type}
            onValueChange={(value) => setFormData({ ...formData, business_type: value })}
            required
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione o tipo de negócio" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="products_and_services">Produtos e Serviços</SelectItem>
              <SelectItem value="products_only">Apenas Produtos</SelectItem>
              <SelectItem value="services_only">Apenas Serviços</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="expectations" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            O que espera do sistema?
          </Label>
          <Textarea
            id="expectations"
            placeholder="Descreva suas expectativas e como o sistema pode ajudar sua empresa..."
            value={formData.expectations}
            onChange={(e) => setFormData({ ...formData, expectations: e.target.value })}
            rows={4}
            className="resize-none"
          />
          <p className="text-xs text-muted-foreground">
            Ex: Gerenciar leads, automatizar vendas, integrar com WhatsApp, etc.
          </p>
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4">
        <Button type="submit" disabled={loading} className="min-w-[120px]">
          {loading ? "Salvando..." : "Continuar"}
        </Button>
      </div>
    </form>
  );
}


