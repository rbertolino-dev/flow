import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save, AlertCircle, Users, Smartphone, Settings, Package, Calendar, Sparkles, ToggleLeft, ToggleRight, MessageSquare } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { AVAILABLE_FEATURES } from "@/hooks/useOrganizationFeatures";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
  enabled_features?: string[];
  disabled_features?: string[];
  trial_ends_at?: string | null;
  features_override_mode?: string;
}

interface OrganizationLimitsPanelProps {
  organizationId: string;
  organizationName: string;
  onUpdate?: () => void;
}

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
    enabled_features: [],
    disabled_features: [],
    trial_ends_at: null,
    features_override_mode: 'inherit',
  });
  const [currentCounts, setCurrentCounts] = useState({
    leads: 0,
    instances: 0,
    users: 0,
  });
  const [planName, setPlanName] = useState<string | null>(null);
  const [planFeatures, setPlanFeatures] = useState<string[]>([]);
  const [evolutionProviders, setEvolutionProviders] = useState<Array<{ id: string; name: string; api_url: string }>>([]);
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);
  const [loadingProviders, setLoadingProviders] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchLimits();
    fetchEvolutionProviders();
    fetchOrganizationProvider();
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
          enabled_features: (limitsData as any).enabled_features || [],
          disabled_features: (limitsData as any).disabled_features || [],
          trial_ends_at: (limitsData as any).trial_ends_at,
          features_override_mode: (limitsData as any).features_override_mode || 'inherit',
        });
        
        setCurrentCounts({
          leads: limitsData.current_leads_count || 0,
          instances: limitsData.current_instances_count || 0,
          users: limitsData.current_users_count || 0,
        });

        // Buscar dados do plano se existir
        if (limitsData.plan_id) {
          const { data: planData } = await supabase
            .from('plans')
            .select('name, features')
            .eq('id', limitsData.plan_id)
            .single();
          setPlanName(planData?.name || null);
          setPlanFeatures((planData?.features as string[]) || []);
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

  const fetchEvolutionProviders = async () => {
    try {
      setLoadingProviders(true);
      const { data, error } = await supabase
        .from('evolution_providers')
        .select('id, name, api_url')
        .eq('is_active', true)
        .order('name', { ascending: true });

      if (error) throw error;
      setEvolutionProviders(data || []);
    } catch (error: any) {
      console.error('Erro ao carregar providers:', error);
      toast({
        title: "Erro ao carregar providers",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoadingProviders(false);
    }
  };

  const fetchOrganizationProvider = async () => {
    try {
      const { data, error } = await supabase
        .from('organization_evolution_provider')
        .select('evolution_provider_id')
        .eq('organization_id', organizationId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;
      setSelectedProviderId(data?.evolution_provider_id || null);
    } catch (error: any) {
      console.error('Erro ao carregar provider da organização:', error);
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
        enabled_features: limits.enabled_features || [],
        disabled_features: limits.disabled_features || [],
        trial_ends_at: limits.trial_ends_at,
        features_override_mode: limits.features_override_mode,
      };

      const { error: limitsError } = await supabase
        .from('organization_limits')
        .upsert(limitsToSave as any, {
          onConflict: 'organization_id',
        });

      if (limitsError) throw limitsError;

      // Salvar ou atualizar provider Evolution
      if (selectedProviderId) {
        const { data: { user } } = await supabase.auth.getUser();
        const { error: providerError } = await supabase
          .from('organization_evolution_provider')
          .upsert({
            organization_id: organizationId,
            evolution_provider_id: selectedProviderId,
            created_by: user?.id || null,
          }, {
            onConflict: 'organization_id',
          });

        if (providerError) throw providerError;
      } else {
        // Remover provider se nenhum foi selecionado
        const { error: deleteError } = await supabase
          .from('organization_evolution_provider')
          .delete()
          .eq('organization_id', organizationId);

        if (deleteError && deleteError.code !== 'PGRST116') throw deleteError;
      }

      toast({
        title: "Sucesso!",
        description: "Configurações atualizadas com sucesso",
      });

      if (onUpdate) {
        onUpdate();
      }
      
      await fetchLimits();
      await fetchOrganizationProvider();
    } catch (error: any) {
      console.error('Erro ao salvar:', error);
      toast({
        title: "Erro ao salvar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const toggleEnabledFeature = (feature: string) => {
    const currentEnabled = limits.enabled_features || [];
    const currentDisabled = limits.disabled_features || [];
    
    if (currentEnabled.includes(feature)) {
      // Remove de enabled
      setLimits(prev => ({
        ...prev,
        enabled_features: currentEnabled.filter(f => f !== feature),
      }));
    } else {
      // Adiciona em enabled e remove de disabled
      setLimits(prev => ({
        ...prev,
        enabled_features: [...currentEnabled, feature],
        disabled_features: currentDisabled.filter(f => f !== feature),
      }));
    }
  };

  const toggleDisabledFeature = (feature: string) => {
    const currentEnabled = limits.enabled_features || [];
    const currentDisabled = limits.disabled_features || [];
    
    if (currentDisabled.includes(feature)) {
      // Remove de disabled
      setLimits(prev => ({
        ...prev,
        disabled_features: currentDisabled.filter(f => f !== feature),
      }));
    } else {
      // Adiciona em disabled e remove de enabled
      setLimits(prev => ({
        ...prev,
        disabled_features: [...currentDisabled, feature],
        enabled_features: currentEnabled.filter(f => f !== feature),
      }));
    }
  };

  const getFeatureStatus = (feature: string): 'enabled' | 'disabled' | 'inherit' => {
    if ((limits.enabled_features || []).includes(feature)) return 'enabled';
    if ((limits.disabled_features || []).includes(feature)) return 'disabled';
    return 'inherit';
  };

  const isFeatureFromPlan = (feature: string): boolean => {
    return planFeatures.includes(feature);
  };

  const isInTrial = limits.trial_ends_at && new Date(limits.trial_ends_at) > new Date();

  const getLimitStatus = (current: number, max: number | null): { status: string; color: "default" | "destructive" | "secondary" | "outline" } => {
    if (max === null) return { status: 'unlimited', color: 'default' };
    const percentage = (current / max) * 100;
    if (percentage >= 100) return { status: 'exceeded', color: 'destructive' };
    if (percentage >= 80) return { status: 'warning', color: 'default' };
    return { status: 'ok', color: 'secondary' };
  };

  const extendTrial = (days: number) => {
    const newDate = new Date();
    newDate.setDate(newDate.getDate() + days);
    setLimits(prev => ({
      ...prev,
      trial_ends_at: newDate.toISOString(),
    }));
  };

  const endTrial = () => {
    setLimits(prev => ({
      ...prev,
      trial_ends_at: null,
    }));
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
      {/* Status do Trial */}
      <Card className={isInTrial ? "border-amber-500/50 bg-amber-50/10" : ""}>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Sparkles className={`h-5 w-5 ${isInTrial ? 'text-amber-500' : 'text-muted-foreground'}`} />
            <CardTitle className="text-base">Período Trial</CardTitle>
            {isInTrial && (
              <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-300">
                Ativo
              </Badge>
            )}
          </div>
          <CardDescription>
            Durante o trial, a organização tem acesso a todas as funcionalidades.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isInTrial ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4" />
                <span>Expira em: <strong>{format(new Date(limits.trial_ends_at!), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</strong></span>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button variant="outline" size="sm" onClick={() => extendTrial(7)}>+7 dias</Button>
                <Button variant="outline" size="sm" onClick={() => extendTrial(30)}>+30 dias</Button>
                <Button variant="destructive" size="sm" onClick={endTrial}>Encerrar Trial</Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Sem trial ativo. Funcionalidades são baseadas no plano atribuído.</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => extendTrial(7)}>Ativar Trial (7 dias)</Button>
                <Button variant="outline" size="sm" onClick={() => extendTrial(30)}>Ativar Trial (30 dias)</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Informações do Plano */}
      {planName && (
        <Alert>
          <Package className="h-4 w-4" />
          <AlertDescription>
            <strong>Plano Atual:</strong> {planName} ({planFeatures.length} funcionalidades)
          </AlertDescription>
        </Alert>
      )}

      {/* Configuração Evolution Provider */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            <CardTitle>Provider Evolution (WhatsApp)</CardTitle>
          </div>
          <CardDescription>
            Selecione qual Evolution esta organização poderá usar para criar instâncias WhatsApp. 
            O usuário só precisará informar o nome da instância, o link e API key serão preenchidos automaticamente.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="evolution_provider">Provider Evolution</Label>
            <Select
              value={selectedProviderId || 'none'}
              onValueChange={(value) => setSelectedProviderId(value === 'none' ? null : value)}
              disabled={loadingProviders || saving}
            >
              <SelectTrigger id="evolution_provider">
                <SelectValue placeholder="Selecione um provider" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum (usuário informa manualmente)</SelectItem>
                {evolutionProviders.map((provider) => (
                  <SelectItem key={provider.id} value={provider.id}>
                    {provider.name} ({provider.api_url})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedProviderId && (
              <p className="text-xs text-muted-foreground">
                Ao criar uma instância, o usuário verá automaticamente o link e API key deste provider.
              </p>
            )}
            {evolutionProviders.length === 0 && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Nenhum provider Evolution ativo encontrado. Crie providers no painel de administração.
                </AlertDescription>
              </Alert>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Gerenciamento de Funcionalidades */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ToggleRight className="h-5 w-5 text-primary" />
            <CardTitle>Funcionalidades</CardTitle>
          </div>
          <CardDescription>
            Override manual de funcionalidades. Verde = habilitado, Vermelho = desabilitado, Cinza = herda do plano.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {AVAILABLE_FEATURES.map((feature) => {
              const status = getFeatureStatus(feature.value);
              const fromPlan = isFeatureFromPlan(feature.value);
              
              return (
                <div 
                  key={feature.value}
                  className={`p-3 rounded-lg border transition-colors ${
                    status === 'enabled' 
                      ? 'bg-green-50 border-green-300 dark:bg-green-950/20 dark:border-green-800' 
                      : status === 'disabled'
                      ? 'bg-red-50 border-red-300 dark:bg-red-950/20 dark:border-red-800'
                      : 'bg-muted/30 border-border'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{feature.label}</span>
                        {fromPlan && status === 'inherit' && (
                          <Badge variant="outline" className="text-[10px] h-4 px-1">do plano</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{feature.description}</p>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        size="icon"
                        variant={status === 'enabled' ? 'default' : 'ghost'}
                        className={`h-6 w-6 ${status === 'enabled' ? 'bg-green-600 hover:bg-green-700' : ''}`}
                        onClick={() => toggleEnabledFeature(feature.value)}
                        title="Habilitar"
                      >
                        <ToggleRight className="h-3 w-3" />
                      </Button>
                      <Button
                        size="icon"
                        variant={status === 'disabled' ? 'default' : 'ghost'}
                        className={`h-6 w-6 ${status === 'disabled' ? 'bg-red-600 hover:bg-red-700' : ''}`}
                        onClick={() => toggleDisabledFeature(feature.value)}
                        title="Desabilitar"
                      >
                        <ToggleLeft className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Limites Numéricos */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary" />
            <CardTitle>Limites Numéricos</CardTitle>
          </div>
          <CardDescription>
            Configure limites de uso para {organizationName}. 
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                placeholder="Ilimitado"
                value={limits.max_leads ?? ''}
                onChange={(e) => setLimits(prev => ({
                  ...prev,
                  max_leads: e.target.value === '' ? null : parseInt(e.target.value) || null,
                }))}
              />
            </div>

            {/* Limite de Instâncias */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="max_instances" className="flex items-center gap-2">
                  <Smartphone className="h-4 w-4" />
                  Limite Instâncias WhatsApp
                </Label>
                <Badge variant={instancesStatus.color}>
                  {currentCounts.instances} / {limits.max_instances ?? '∞'}
                </Badge>
              </div>
              <Input
                id="max_instances"
                type="number"
                min="0"
                placeholder="Ilimitado"
                value={limits.max_instances ?? ''}
                onChange={(e) => setLimits(prev => ({
                  ...prev,
                  max_instances: e.target.value === '' ? null : parseInt(e.target.value) || null,
                }))}
              />
            </div>

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
                placeholder="Ilimitado"
                value={limits.max_users ?? ''}
                onChange={(e) => setLimits(prev => ({
                  ...prev,
                  max_users: e.target.value === '' ? null : parseInt(e.target.value) || null,
                }))}
              />
            </div>

            {/* Limite de Broadcasts */}
            <div className="space-y-2">
              <Label htmlFor="max_broadcasts">Disparos por Mês</Label>
              <Input
                id="max_broadcasts"
                type="number"
                min="0"
                placeholder="Ilimitado"
                value={limits.max_broadcasts_per_month ?? ''}
                onChange={(e) => setLimits(prev => ({
                  ...prev,
                  max_broadcasts_per_month: e.target.value === '' ? null : parseInt(e.target.value) || null,
                }))}
              />
            </div>

            {/* Limite de Mensagens Agendadas */}
            <div className="space-y-2">
              <Label htmlFor="max_scheduled">Mensagens Agendadas/Mês</Label>
              <Input
                id="max_scheduled"
                type="number"
                min="0"
                placeholder="Ilimitado"
                value={limits.max_scheduled_messages_per_month ?? ''}
                onChange={(e) => setLimits(prev => ({
                  ...prev,
                  max_scheduled_messages_per_month: e.target.value === '' ? null : parseInt(e.target.value) || null,
                }))}
              />
            </div>

            {/* Limite de Storage */}
            <div className="space-y-2">
              <Label htmlFor="max_storage">Armazenamento (GB)</Label>
              <Input
                id="max_storage"
                type="number"
                min="0"
                step="0.1"
                placeholder="Ilimitado"
                value={limits.max_storage_gb ?? ''}
                onChange={(e) => setLimits(prev => ({
                  ...prev,
                  max_storage_gb: e.target.value === '' ? null : parseFloat(e.target.value) || null,
                }))}
              />
            </div>
          </div>

          {leadsStatus.status === 'exceeded' && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Limite de leads excedido! A organização não pode criar novos leads.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Botão Salvar */}
      <div className="flex justify-end gap-2">
        <Button
          onClick={handleSave}
          disabled={saving}
          className="min-w-[150px]"
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
    </div>
  );
}
