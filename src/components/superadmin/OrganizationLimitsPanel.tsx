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
  max_evolution_instances: number | null;
  enabled_features: string[];
  notes: string | null;
  current_leads_count?: number;
  current_evolution_instances_count?: number;
  plan_name?: string | null;
  has_custom_limits?: boolean;
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
    max_evolution_instances: null,
    enabled_features: [],
    notes: null,
  });
  const [currentCounts, setCurrentCounts] = useState({
    leads: 0,
    evolutionInstances: 0,
  });
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

      if (limitsError && limitsError.code !== 'PGRST116') { // PGRST116 = not found
        throw limitsError;
      }

      // Buscar contadores atuais usando a função RPC
      const { data: countsData, error: countsError } = await supabase
        .rpc('get_organization_limits', { _org_id: organizationId });

      if (countsError) throw countsError;

      if (limitsData) {
        setLimits({
          ...limitsData,
          enabled_features: limitsData.enabled_features || [],
        });
      }

      if (countsData && countsData.length > 0) {
        const counts = countsData[0];
        setCurrentCounts({
          leads: Number(counts.current_leads_count) || 0,
          evolutionInstances: Number(counts.current_evolution_instances_count) || 0,
        });
        
        // Atualizar informações do plano (sempre, mesmo sem limites customizados)
        setLimits(prev => ({
          ...prev,
          plan_name: counts.plan_name || null,
          has_custom_limits: counts.has_custom_limits || false,
        }));
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

        setCurrentCounts({
          leads: leadsCount || 0,
          evolutionInstances: evoCount || 0,
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
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const limitsToSave = {
        organization_id: organizationId,
        max_leads: limits.max_leads || null,
        max_evolution_instances: limits.max_evolution_instances || null,
        enabled_features: limits.enabled_features,
        notes: limits.notes || null,
        updated_by: user.id,
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

  const toggleFeature = (featureValue: string) => {
    setLimits(prev => {
      const currentFeatures = prev.enabled_features || [];
      const isEnabled = currentFeatures.includes(featureValue);
      
      return {
        ...prev,
        enabled_features: isEnabled
          ? currentFeatures.filter(f => f !== featureValue)
          : [...currentFeatures, featureValue],
      };
    });
  };

  const getLimitStatus = (current: number, max: number | null) => {
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
  const evoStatus = getLimitStatus(currentCounts.evolutionInstances, limits.max_evolution_instances);

  return (
    <div className="space-y-6">
      {/* Informações do Plano */}
      {limits.plan_name && (
        <Alert>
          <Package className="h-4 w-4" />
          <AlertDescription>
            <strong>Plano Atual:</strong> {limits.plan_name}
            {limits.has_custom_limits && (
              <span className="ml-2 text-xs text-muted-foreground">
                (Limites customizados sobrescrevem o plano)
              </span>
            )}
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
            {limits.plan_name && ' Estes limites sobrescrevem os limites do plano.'}
            {!limits.plan_name && ' Se nenhum plano estiver associado, estes serão os limites aplicados.'}
          </CardDescription>
          {limits.plan_name && !limits.has_custom_limits && (
            <Alert className="mt-4">
              <Info className="h-4 w-4" />
              <AlertDescription className="text-sm">
                Esta organização está usando os limites do plano <strong>{limits.plan_name}</strong>. 
                Configure limites customizados abaixo para sobrescrever o plano.
              </AlertDescription>
            </Alert>
          )}
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
              {leadsStatus.status === 'warning' && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Aproximando-se do limite de leads ({Math.round((currentCounts.leads / (limits.max_leads || 1)) * 100)}%).
                  </AlertDescription>
                </Alert>
              )}
            </div>

            <Separator />

            {/* Limite de Instâncias Evolution */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="max_evolution_instances" className="flex items-center gap-2">
                  <Smartphone className="h-4 w-4" />
                  Limite de Instâncias Evolution
                </Label>
                <Badge variant={evoStatus.color}>
                  {currentCounts.evolutionInstances} / {limits.max_evolution_instances ?? '∞'}
                </Badge>
              </div>
              <Input
                id="max_evolution_instances"
                type="number"
                min="0"
                placeholder="Ilimitado (deixe em branco)"
                value={limits.max_evolution_instances ?? ''}
                onChange={(e) => setLimits(prev => ({
                  ...prev,
                  max_evolution_instances: e.target.value === '' ? null : parseInt(e.target.value) || null,
                }))}
              />
              {evoStatus.status === 'exceeded' && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Limite de instâncias Evolution excedido! A organização não pode criar novas instâncias.
                  </AlertDescription>
                </Alert>
              )}
              {evoStatus.status === 'warning' && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Aproximando-se do limite de instâncias ({Math.round((currentCounts.evolutionInstances / (limits.max_evolution_instances || 1)) * 100)}%).
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </div>

          <Separator />

          {/* Funcionalidades */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Funcionalidades Habilitadas</h3>
              <Badge variant="outline">
                {limits.enabled_features?.length || 0} / {AVAILABLE_FEATURES.length}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Selecione as funcionalidades que esta organização pode utilizar. 
              Se nenhuma for selecionada, todas estarão disponíveis (compatibilidade).
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {AVAILABLE_FEATURES.map((feature) => {
                const isEnabled = limits.enabled_features?.includes(feature.value);
                return (
                  <div
                    key={feature.value}
                    className="flex items-start space-x-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                  >
                    <Checkbox
                      id={feature.value}
                      checked={isEnabled}
                      onCheckedChange={() => toggleFeature(feature.value)}
                    />
                    <div className="flex-1 space-y-1">
                      <Label
                        htmlFor={feature.value}
                        className="text-sm font-medium leading-none cursor-pointer"
                      >
                        {feature.label}
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        {feature.description}
                      </p>
                    </div>
                    {isEnabled && (
                      <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <Separator />

          {/* Notas */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notas</Label>
            <Textarea
              id="notes"
              placeholder="Adicione observações sobre esta configuração..."
              value={limits.notes || ''}
              onChange={(e) => setLimits(prev => ({ ...prev, notes: e.target.value }))}
              rows={3}
            />
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

