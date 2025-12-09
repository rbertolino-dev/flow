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
import { Loader2, Save, AlertCircle, CheckCircle2, Users, Smartphone, Settings, Package, Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";

interface OrganizationLimits {
  id?: string;
  organization_id: string;
  max_leads: number | null;
  max_instances: number | null;
  max_users: number | null;
  max_broadcasts_per_month: number | null;
  max_scheduled_messages_per_month: number | null;
  max_storage_gb: number | null;
  current_leads_count?: number;
  current_instances_count?: number;
  current_users_count?: number;
  plan_id?: string | null;
}

interface OrganizationLimitsPanelProps {
  organizationId: string;
  organizationName: string;
  onUpdate?: () => void;
}

const AVAILABLE_FEATURES = [
  { value: 'leads', label: 'Leads', description: 'Gerenciamento de leads' },
  { value: 'evolution_instances', label: 'Instâncias Evolution', description: 'Conexão com WhatsApp via Evolution API' },
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

export function OrganizationLimitsPanel({ 
  organizationId, 
  organizationName,
  onUpdate 
}: OrganizationLimitsPanelProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [limits, setLimits] = useState<OrganizationLimits>({
    organization_id: organizationId,
    max_leads: null,
    max_instances: null,
    max_users: null,
    max_broadcasts_per_month: null,
    max_scheduled_messages_per_month: null,
    max_storage_gb: null,
  });
  const [currentCounts, setCurrentCounts] = useState({
    leads: 0,
    instances: 0,
    users: 0,
  });
  const [planName, setPlanName] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchLimits();
  }, [organizationId]);

  const fetchLimits = async () => {
    try {
      setLoading(true);
      
      // Buscar limites da organização
      const { data: limitsData, error: limitsError } = await supabase
        .from('organization_limits')
        .select('*')
        .eq('organization_id', organizationId)
        .maybeSingle();

      if (limitsError && limitsError.code !== 'PGRST116') {
        throw limitsError;
      }

      if (limitsData) {
        setLimits({
          id: limitsData.id,
          organization_id: limitsData.organization_id,
          max_leads: limitsData.max_leads,
          max_instances: limitsData.max_instances,
          max_users: limitsData.max_users,
          max_broadcasts_per_month: limitsData.max_broadcasts_per_month,
          max_scheduled_messages_per_month: limitsData.max_scheduled_messages_per_month,
          max_storage_gb: limitsData.max_storage_gb,
          plan_id: limitsData.plan_id,
          current_leads_count: limitsData.current_leads_count || 0,
          current_instances_count: limitsData.current_instances_count || 0,
          current_users_count: limitsData.current_users_count || 0,
        });
        
        setCurrentCounts({
          leads: limitsData.current_leads_count || 0,
          instances: limitsData.current_instances_count || 0,
          users: limitsData.current_users_count || 0,
        });

        // Buscar nome do plano se existir
        if (limitsData.plan_id) {
          const { data: planData } = await supabase
            .from('plans')
            .select('name')
            .eq('id', limitsData.plan_id)
            .single();
          setPlanName(planData?.name || null);
        }
      } else {
        // Se não há limites configurados, buscar contadores diretamente
        const { count: leadsCount } = await supabase
          .from('leads')
          .select('*', { count: 'exact', head: true })
          .eq('organization_id', organizationId)
          .is('deleted_at', null);

        const { count: evoCount } = await supabase
          .from('evolution_config')
          .select('*', { count: 'exact', head: true })
          .eq('organization_id', organizationId);

        const { count: usersCount } = await supabase
          .from('organization_members')
          .select('*', { count: 'exact', head: true })
          .eq('organization_id', organizationId);

        setCurrentCounts({
          leads: leadsCount || 0,
          instances: evoCount || 0,
          users: usersCount || 0,
        });
      }
    } catch (error: any) {
      console.error('Erro ao carregar limites:', error);
      toast({
        title: "Erro ao carregar configurações",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      const limitsToSave = {
        organization_id: organizationId,
        max_leads: limits.max_leads,
        max_instances: limits.max_instances,
        max_users: limits.max_users,
        max_broadcasts_per_month: limits.max_broadcasts_per_month,
        max_scheduled_messages_per_month: limits.max_scheduled_messages_per_month,
        max_storage_gb: limits.max_storage_gb,
      };

      const { error } = await supabase
        .from('organization_limits')
        .upsert(limitsToSave, {
          onConflict: 'organization_id',
        });

      if (error) throw error;

      toast({
        title: "Sucesso!",
        description: "Limites atualizados com sucesso",
      });

      if (onUpdate) {
        onUpdate();
      }
      
      await fetchLimits();
    } catch (error: any) {
      console.error('Erro ao salvar limites:', error);
      toast({
        title: "Erro ao salvar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const getLimitStatus = (current: number, max: number | null): { status: string; color: "default" | "destructive" | "secondary" | "outline" } => {
    if (max === null) return { status: 'unlimited', color: 'default' };
    const percentage = (current / max) * 100;
    if (percentage >= 100) return { status: 'exceeded', color: 'destructive' };
    if (percentage >= 80) return { status: 'warning', color: 'default' };
    return { status: 'ok', color: 'secondary' };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const leadsStatus = getLimitStatus(currentCounts.leads, limits.max_leads);
  const instancesStatus = getLimitStatus(currentCounts.instances, limits.max_instances);

  return (
    <div className="space-y-6">
      {/* Informações do Plano */}
      {planName && (
        <Alert>
          <Package className="h-4 w-4" />
          <AlertDescription>
            <strong>Plano Atual:</strong> {planName}
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary" />
            <CardTitle>Limites Customizados</CardTitle>
          </div>
          <CardDescription>
            Configure limites customizados para {organizationName}. 
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Limites Numéricos */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Limites Numéricos</h3>
            
            {/* Limite de Leads */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="max_leads" className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Limite de Leads
                </Label>
                <Badge variant={leadsStatus.color}>
                  {currentCounts.leads} / {limits.max_leads ?? '∞'}
                </Badge>
              </div>
              <Input
                id="max_leads"
                type="number"
                min="0"
                placeholder="Ilimitado (deixe em branco)"
                value={limits.max_leads ?? ''}
                onChange={(e) => setLimits(prev => ({
                  ...prev,
                  max_leads: e.target.value === '' ? null : parseInt(e.target.value) || null,
                }))}
              />
              {leadsStatus.status === 'exceeded' && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Limite de leads excedido! A organização não pode criar novos leads.
                  </AlertDescription>
                </Alert>
              )}
            </div>

            <Separator />

            {/* Limite de Instâncias */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="max_instances" className="flex items-center gap-2">
                  <Smartphone className="h-4 w-4" />
                  Limite de Instâncias Evolution
                </Label>
                <Badge variant={instancesStatus.color}>
                  {currentCounts.instances} / {limits.max_instances ?? '∞'}
                </Badge>
              </div>
              <Input
                id="max_instances"
                type="number"
                min="0"
                placeholder="Ilimitado (deixe em branco)"
                value={limits.max_instances ?? ''}
                onChange={(e) => setLimits(prev => ({
                  ...prev,
                  max_instances: e.target.value === '' ? null : parseInt(e.target.value) || null,
                }))}
              />
            </div>

            <Separator />

            {/* Limite de Usuários */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="max_users" className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Limite de Usuários
                </Label>
                <Badge variant="secondary">
                  {currentCounts.users} / {limits.max_users ?? '∞'}
                </Badge>
              </div>
              <Input
                id="max_users"
                type="number"
                min="0"
                placeholder="Ilimitado (deixe em branco)"
                value={limits.max_users ?? ''}
                onChange={(e) => setLimits(prev => ({
                  ...prev,
                  max_users: e.target.value === '' ? null : parseInt(e.target.value) || null,
                }))}
              />
            </div>

            <Separator />

            {/* Limite de Broadcasts por mês */}
            <div className="space-y-2">
              <Label htmlFor="max_broadcasts">Limite de Disparos por Mês</Label>
              <Input
                id="max_broadcasts"
                type="number"
                min="0"
                placeholder="Ilimitado (deixe em branco)"
                value={limits.max_broadcasts_per_month ?? ''}
                onChange={(e) => setLimits(prev => ({
                  ...prev,
                  max_broadcasts_per_month: e.target.value === '' ? null : parseInt(e.target.value) || null,
                }))}
              />
            </div>

            <Separator />

            {/* Limite de Mensagens Agendadas por mês */}
            <div className="space-y-2">
              <Label htmlFor="max_scheduled">Limite de Mensagens Agendadas por Mês</Label>
              <Input
                id="max_scheduled"
                type="number"
                min="0"
                placeholder="Ilimitado (deixe em branco)"
                value={limits.max_scheduled_messages_per_month ?? ''}
                onChange={(e) => setLimits(prev => ({
                  ...prev,
                  max_scheduled_messages_per_month: e.target.value === '' ? null : parseInt(e.target.value) || null,
                }))}
              />
            </div>

            <Separator />

            {/* Limite de Storage */}
            <div className="space-y-2">
              <Label htmlFor="max_storage">Limite de Armazenamento (GB)</Label>
              <Input
                id="max_storage"
                type="number"
                min="0"
                step="0.1"
                placeholder="Ilimitado (deixe em branco)"
                value={limits.max_storage_gb ?? ''}
                onChange={(e) => setLimits(prev => ({
                  ...prev,
                  max_storage_gb: e.target.value === '' ? null : parseFloat(e.target.value) || null,
                }))}
              />
            </div>
          </div>

          {/* Botão Salvar */}
          <div className="flex justify-end gap-2 pt-4">
            <Button
              onClick={handleSave}
              disabled={saving}
              className="min-w-[120px]"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Salvar Configurações
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
