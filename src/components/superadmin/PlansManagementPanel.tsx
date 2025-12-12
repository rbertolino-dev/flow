import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save, Plus, Edit, Trash2, Package, DollarSign } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Plan {
  id: string;
  name: string;
  description: string | null;
  max_leads: number | null;
  max_instances: number | null;
  max_users: number | null;
  max_broadcasts_per_month: number | null;
  max_scheduled_messages_per_month: number | null;
  max_storage_gb: number | null;
  price: number | null;
  billing_period: string;
  is_active: boolean;
  features: string[] | null;
  created_at: string;
  updated_at: string;
}

interface PlanFormData {
  name: string;
  description: string;
  max_leads: number | null;
  max_instances: number | null;
  max_users: number | null;
  max_broadcasts_per_month: number | null;
  max_scheduled_messages_per_month: number | null;
  max_storage_gb: number | null;
  price: number | null;
  billing_period: string;
  is_active: boolean;
  features: string[];
}

const AVAILABLE_FEATURES = [
  { value: 'leads', label: 'Leads', description: 'Gerenciamento de leads' },
  { value: 'evolution_instances', label: 'Instâncias WhatsApp', description: 'Conexão com WhatsApp' },
  { value: 'broadcast', label: 'Disparos', description: 'Campanhas de disparo em massa' },
  { value: 'scheduled_messages', label: 'Mensagens Agendadas', description: 'Agendar mensagens para envio futuro' },
  { value: 'agents', label: 'Agentes IA', description: 'Agentes inteligentes com OpenAI' },
  { value: 'form_builder', label: 'Formulários', description: 'Criar e gerenciar formulários' },
  { value: 'facebook_integration', label: 'Integração Facebook', description: 'Conectar com Facebook/Instagram' },
  { value: 'whatsapp_messages', label: 'Mensagens WhatsApp', description: 'Enviar e receber mensagens' },
  { value: 'call_queue', label: 'Fila de Chamadas', description: 'Gerenciar fila de ligações' },
  { value: 'reports', label: 'Relatórios', description: 'Acessar relatórios e análises' },
  { value: 'api_access', label: 'Acesso API', description: 'Integração via API' },
] as const;

export function PlansManagementPanel() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState<PlanFormData>({
    name: '',
    description: '',
    max_leads: null,
    max_instances: null,
    max_users: null,
    max_broadcasts_per_month: null,
    max_scheduled_messages_per_month: null,
    max_storage_gb: null,
    price: null,
    billing_period: 'monthly',
    is_active: true,
    features: [],
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      setLoading(true);
      // Buscar todos os planos ordenados por nome
      const { data, error } = await supabase
        .from('plans')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      
      // Map database response to Plan interface
      const mappedPlans: Plan[] = (data || []).map(item => ({
        id: item.id,
        name: item.name,
        description: item.description,
        max_leads: item.max_leads,
        max_instances: item.max_instances,
        max_users: item.max_users,
        max_broadcasts_per_month: item.max_broadcasts_per_month,
        max_scheduled_messages_per_month: item.max_scheduled_messages_per_month,
        max_storage_gb: item.max_storage_gb,
        price: item.price,
        billing_period: item.billing_period,
        is_active: item.is_active,
        features: Array.isArray(item.features) ? item.features as string[] : [],
        created_at: item.created_at,
        updated_at: item.updated_at,
      }));
      
      setPlans(mappedPlans);
    } catch (error: any) {
      console.error('Erro ao carregar planos:', error);
      toast({
        title: "Erro ao carregar planos",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (plan?: Plan) => {
    if (plan) {
      setEditingPlan(plan);
      setFormData({
        name: plan.name,
        description: plan.description || '',
        max_leads: plan.max_leads,
        max_instances: plan.max_instances,
        max_users: plan.max_users,
        max_broadcasts_per_month: plan.max_broadcasts_per_month,
        max_scheduled_messages_per_month: plan.max_scheduled_messages_per_month,
        max_storage_gb: plan.max_storage_gb,
        price: plan.price,
        billing_period: plan.billing_period,
        is_active: plan.is_active,
        features: plan.features || [],
      });
    } else {
      setEditingPlan(null);
      setFormData({
        name: '',
        description: '',
        max_leads: null,
        max_instances: null,
        max_users: null,
        max_broadcasts_per_month: null,
        max_scheduled_messages_per_month: null,
        max_storage_gb: null,
        price: null,
        billing_period: 'monthly',
        is_active: true,
        features: [],
      });
    }
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      const planData = {
        name: formData.name,
        description: formData.description || null,
        max_leads: formData.max_leads,
        max_instances: formData.max_instances,
        max_users: formData.max_users,
        max_broadcasts_per_month: formData.max_broadcasts_per_month,
        max_scheduled_messages_per_month: formData.max_scheduled_messages_per_month,
        max_storage_gb: formData.max_storage_gb,
        price: formData.price,
        billing_period: formData.billing_period,
        is_active: formData.is_active,
        features: formData.features,
      };

      if (editingPlan) {
        const { error } = await supabase
          .from('plans')
          .update(planData)
          .eq('id', editingPlan.id);

        if (error) throw error;
        toast({
          title: "Sucesso!",
          description: "Plano atualizado com sucesso",
        });
      } else {
        const { error } = await supabase
          .from('plans')
          .insert(planData);

        if (error) throw error;
        toast({
          title: "Sucesso!",
          description: "Plano criado com sucesso",
        });
      }

      setIsDialogOpen(false);
      await fetchPlans();
    } catch (error: any) {
      console.error('Erro ao salvar plano:', error);
      toast({
        title: "Erro ao salvar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (planId: string) => {
    if (!confirm('Tem certeza que deseja excluir este plano? Organizações associadas perderão o plano.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('plans')
        .delete()
        .eq('id', planId);

      if (error) throw error;

      toast({
        title: "Sucesso!",
        description: "Plano excluído com sucesso",
      });

      await fetchPlans();
    } catch (error: any) {
      console.error('Erro ao excluir plano:', error);
      toast({
        title: "Erro ao excluir",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const toggleFeature = (featureValue: string) => {
    setFormData(prev => {
      const currentFeatures = prev.features || [];
      const isEnabled = currentFeatures.includes(featureValue);
      
      return {
        ...prev,
        features: isEnabled
          ? currentFeatures.filter(f => f !== featureValue)
          : [...currentFeatures, featureValue],
      };
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Gerenciamento de Planos</h2>
          <p className="text-muted-foreground">
            Configure planos com limites pré-definidos para associar às organizações
          </p>
        </div>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Plano
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {plans.map((plan) => (
          <Card key={plan.id} className="relative">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Package className="h-5 w-5 text-primary" />
                    <CardTitle className="text-lg">{plan.name}</CardTitle>
                  </div>
                  {!plan.is_active && (
                    <Badge variant="secondary" className="mt-2">Inativo</Badge>
                  )}
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleOpenDialog(plan)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(plan.id)}
                    className="text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              {plan.description && (
                <CardDescription className="mt-2">{plan.description}</CardDescription>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Preços */}
              {plan.price && (
                <div className="flex items-center gap-2 text-sm">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <span>
                    R$ {plan.price.toFixed(2)}/{plan.billing_period === 'monthly' ? 'mês' : plan.billing_period === 'yearly' ? 'ano' : plan.billing_period}
                  </span>
                </div>
              )}

              {/* Limites */}
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Leads:</span>
                  <Badge variant="outline">
                    {plan.max_leads ?? '∞'}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Instâncias:</span>
                  <Badge variant="outline">
                    {plan.max_instances ?? '∞'}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Usuários:</span>
                  <Badge variant="outline">
                    {plan.max_users ?? '∞'}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Funcionalidades:</span>
                  <Badge variant="outline">
                    {plan.features?.length || 0}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Dialog de Edição/Criação */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingPlan ? 'Editar Plano' : 'Novo Plano'}
            </DialogTitle>
            <DialogDescription>
              Configure os limites e funcionalidades do plano
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Informações Básicas */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome do Plano *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Ex: Profissional"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Descrição</Label>
                <Textarea
                  id="description"
                  value={formData.description || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Descreva o plano..."
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="price">Preço (R$)</Label>
                  <Input
                    id="price"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.price ?? ''}
                    onChange={(e) => setFormData(prev => ({ 
                      ...prev, 
                      price: e.target.value ? parseFloat(e.target.value) : null 
                    }))}
                    placeholder="0.00"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="billing_period">Período de Cobrança</Label>
                  <Select 
                    value={formData.billing_period} 
                    onValueChange={(v) => setFormData(prev => ({ ...prev, billing_period: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Mensal</SelectItem>
                      <SelectItem value="yearly">Anual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: !!checked }))}
                />
                <Label htmlFor="is_active" className="cursor-pointer">
                  Plano ativo
                </Label>
              </div>
            </div>

            <Separator />

            {/* Limites */}
            <div className="space-y-4">
              <h3 className="font-semibold">Limites</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="max_leads">Limite de Leads</Label>
                  <Input
                    id="max_leads"
                    type="number"
                    min="0"
                    placeholder="Ilimitado"
                    value={formData.max_leads ?? ''}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      max_leads: e.target.value === '' ? null : parseInt(e.target.value) || null,
                    }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="max_instances">Limite de Instâncias</Label>
                  <Input
                    id="max_instances"
                    type="number"
                    min="0"
                    placeholder="Ilimitado"
                    value={formData.max_instances ?? ''}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      max_instances: e.target.value === '' ? null : parseInt(e.target.value) || null,
                    }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="max_users">Limite de Usuários</Label>
                  <Input
                    id="max_users"
                    type="number"
                    min="0"
                    placeholder="Ilimitado"
                    value={formData.max_users ?? ''}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      max_users: e.target.value === '' ? null : parseInt(e.target.value) || null,
                    }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="max_broadcasts">Disparos/Mês</Label>
                  <Input
                    id="max_broadcasts"
                    type="number"
                    min="0"
                    placeholder="Ilimitado"
                    value={formData.max_broadcasts_per_month ?? ''}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      max_broadcasts_per_month: e.target.value === '' ? null : parseInt(e.target.value) || null,
                    }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="max_scheduled">Agendadas/Mês</Label>
                  <Input
                    id="max_scheduled"
                    type="number"
                    min="0"
                    placeholder="Ilimitado"
                    value={formData.max_scheduled_messages_per_month ?? ''}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      max_scheduled_messages_per_month: e.target.value === '' ? null : parseInt(e.target.value) || null,
                    }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="max_storage">Storage (GB)</Label>
                  <Input
                    id="max_storage"
                    type="number"
                    min="0"
                    step="0.1"
                    placeholder="Ilimitado"
                    value={formData.max_storage_gb ?? ''}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      max_storage_gb: e.target.value === '' ? null : parseFloat(e.target.value) || null,
                    }))}
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* Funcionalidades */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Funcionalidades</h3>
                <Badge variant="outline">
                  {formData.features?.length || 0} / {AVAILABLE_FEATURES.length}
                </Badge>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-64 overflow-y-auto">
                {AVAILABLE_FEATURES.map((feature) => {
                  const isEnabled = formData.features?.includes(feature.value);
                  return (
                    <div
                      key={feature.value}
                      className="flex items-start space-x-2 p-2 rounded-lg border hover:bg-muted/50"
                    >
                      <Checkbox
                        id={`feature-${feature.value}`}
                        checked={isEnabled}
                        onCheckedChange={() => toggleFeature(feature.value)}
                      />
                      <div className="flex-1">
                        <Label
                          htmlFor={`feature-${feature.value}`}
                          className="text-sm font-medium cursor-pointer"
                        >
                          {feature.label}
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          {feature.description}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving || !formData.name}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  {editingPlan ? 'Salvar' : 'Criar'}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

