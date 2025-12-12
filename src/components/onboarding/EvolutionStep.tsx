import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useOnboarding } from "@/hooks/useOnboarding";
import { useEvolutionConfigs } from "@/hooks/useEvolutionConfigs";
import { EvolutionInstanceDialog } from "@/components/crm/EvolutionInstanceDialog";
import { getUserOrganizationId } from "@/lib/organizationUtils";
import { supabase } from "@/integrations/supabase/client";
import { MessageSquare, SkipForward, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface EvolutionStepProps {
  onComplete: () => void;
  onSkip: () => void;
}

export function EvolutionStep({ onComplete, onSkip }: EvolutionStepProps) {
  const { toast } = useToast();
  const { markStepAsComplete } = useOnboarding();
  const { configs, refetch } = useEvolutionConfigs();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkingLimit, setCheckingLimit] = useState(false);
  const [canCreateInstance, setCanCreateInstance] = useState(true);
  const [limitInfo, setLimitInfo] = useState<{ current: number; max: number | null } | null>(null);

  useEffect(() => {
    checkInstanceLimit();
  }, []);

  const checkInstanceLimit = async () => {
    setCheckingLimit(true);
    try {
      const organizationId = await getUserOrganizationId();
      if (!organizationId) return;

      // Buscar limite da organização
      const { data: limits } = await supabase
        .from('organization_limits' as any)
        .select('max_instances')
        .eq('organization_id', organizationId)
        .single();

      const maxInstances = (limits as any)?.max_instances;
      const currentInstances = configs?.length || 0;

      setLimitInfo({
        current: currentInstances,
        max: maxInstances,
      });

      if (maxInstances !== null && currentInstances >= maxInstances) {
        setCanCreateInstance(false);
        toast({
          title: "Limite atingido",
          description: `Você atingiu o limite de ${maxInstances} instância(s) WhatsApp`,
          variant: "destructive",
        });
      } else {
        setCanCreateInstance(true);
      }
    } catch (error: any) {
      console.error('Erro ao verificar limite:', error);
    } finally {
      setCheckingLimit(false);
    }
  };

  const handleSave = async (data: { api_url: string; api_key: string; instance_name: string }) => {
    try {
      const organizationId = await getUserOrganizationId();
      if (!organizationId) throw new Error("Organização não encontrada");

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { error } = await supabase
        .from('evolution_config')
        .insert({
          organization_id: organizationId,
          user_id: user.id,
          api_url: data.api_url,
          api_key: data.api_key,
          instance_name: data.instance_name,
          webhook_enabled: true,
        });

      if (error) throw error;

      await refetch();
      await checkInstanceLimit();

      toast({
        title: "Instância criada!",
        description: "A instância WhatsApp foi configurada com sucesso",
      });

      setDialogOpen(false);
      return true;
    } catch (error: any) {
      toast({
        title: "Erro ao criar instância",
        description: error.message || "Erro desconhecido",
        variant: "destructive",
      });
      return false;
    }
  };

  const handleContinue = async () => {
    if (configs && configs.length > 0) {
      setLoading(true);
      try {
        await markStepAsComplete('evolution');
        toast({
          title: "Evolution configurado!",
          description: `${configs.length} instância(s) configurada(s)`,
        });
        onComplete();
      } catch (error: any) {
        toast({
          title: "Erro",
          description: error.message || "Erro ao salvar",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    } else {
      toast({
        title: "Nenhuma instância",
        description: "Configure uma instância ou pule esta etapa",
        variant: "destructive",
      });
    }
  };

  const handleSkip = async () => {
    await markStepAsComplete('evolution');
    onSkip();
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="space-y-2">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Integração com WhatsApp
        </h3>
        <p className="text-sm text-muted-foreground">
          Configure sua instância WhatsApp. Esta etapa é opcional.
        </p>
      </div>

      {limitInfo && (
        <Card className="border-muted">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Instâncias WhatsApp</p>
                <p className="text-xs text-muted-foreground">
                  {limitInfo.current} de {limitInfo.max === null ? '∞' : limitInfo.max} utilizadas
                </p>
              </div>
              {limitInfo.max !== null && (
                <div className="text-right">
                  <p className="text-sm font-medium">
                    {limitInfo.max - limitInfo.current} disponíveis
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {configs && configs.length > 0 && (
        <Card className="border-green-200 bg-green-50 dark:bg-green-950/20">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              Instâncias Configuradas ({configs.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {configs.map((config) => (
                <div
                  key={config.id}
                  className="flex items-center justify-between p-3 border rounded-lg bg-background"
                >
                  <div>
                    <p className="font-medium">{config.instance_name}</p>
                    <p className="text-sm text-muted-foreground">
                      {config.api_url}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {config.is_connected ? (
                      <span className="text-xs text-green-600 font-medium">Conectado</span>
                    ) : (
                      <span className="text-xs text-yellow-600 font-medium">Desconectado</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {canCreateInstance && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Nova Instância</CardTitle>
            <CardDescription>
              Configure uma nova instância WhatsApp
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              type="button"
              onClick={() => setDialogOpen(true)}
              className="w-full"
            >
              <MessageSquare className="h-4 w-4 mr-2" />
              Configurar Instância WhatsApp
            </Button>
          </CardContent>
        </Card>
      )}

      <EvolutionInstanceDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSave={handleSave}
        onRefetch={async () => {
          await refetch();
          await checkInstanceLimit();
        }}
      />

      {/* Botões de ação */}
      <div className="flex justify-between gap-3 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={handleSkip}
          disabled={loading}
          className="flex items-center gap-2"
        >
          <SkipForward className="h-4 w-4" />
          Pular e Avançar
        </Button>
        <Button
          type="button"
          onClick={handleContinue}
          disabled={loading || !configs || configs.length === 0}
          className="min-w-[120px]"
        >
          {loading ? "Salvando..." : "Continuar"}
        </Button>
      </div>
    </div>
  );
}

