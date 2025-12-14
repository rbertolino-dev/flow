import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save, DollarSign, MessageSquare, Database, Activity } from "lucide-react";
import { Separator } from "@/components/ui/separator";

interface CostConfig {
  cost_per_database_read: number;
  cost_per_database_write: number;
  cost_per_storage_gb: number;
  cost_per_edge_function_call: number;
  cost_per_realtime_message: number;
  cost_per_auth_user: number;
  cost_per_incoming_message: number;
  cost_per_broadcast_message: number;
  cost_per_scheduled_message: number;
  cost_per_lead_storage: number;
  cost_per_workflow_execution: number;
  cost_per_form_submission: number;
  cost_per_agent_ai_call: number;
  notes: string | null;
}

export function CloudCostConfiguration() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<CostConfig | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('cloud_cost_config')
        .select('*')
        .single();

      if (error) throw error;

      if (data) {
        const extendedData = data as Record<string, any>;
        setConfig({
          cost_per_database_read: Number(data.cost_per_database_read),
          cost_per_database_write: Number(data.cost_per_database_write),
          cost_per_storage_gb: Number(data.cost_per_storage_gb),
          cost_per_edge_function_call: Number(data.cost_per_edge_function_call),
          cost_per_realtime_message: Number(data.cost_per_realtime_message),
          cost_per_auth_user: Number(data.cost_per_auth_user),
          cost_per_incoming_message: Number(data.cost_per_incoming_message),
          cost_per_broadcast_message: Number(data.cost_per_broadcast_message),
          cost_per_scheduled_message: Number(data.cost_per_scheduled_message),
          cost_per_lead_storage: Number(data.cost_per_lead_storage),
          cost_per_workflow_execution: Number(extendedData.cost_per_workflow_execution || 0.0001),
          cost_per_form_submission: Number(extendedData.cost_per_form_submission || 0.0001),
          cost_per_agent_ai_call: Number(extendedData.cost_per_agent_ai_call || 0.001),
          notes: data.notes
        });
      }
    } catch (error: any) {
      console.error('Error fetching config:', error);
      toast({
        title: "Erro ao carregar configuração",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!config) return;

    try {
      setSaving(true);
      const { error } = await supabase
        .from('cloud_cost_config')
        .update({
          ...config,
          updated_by: (await supabase.auth.getUser()).data.user?.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', '00000000-0000-0000-0000-000000000001');

      if (error) throw error;

      toast({
        title: "Configuração salva",
        description: "Os custos foram atualizados com sucesso.",
      });
    } catch (error: any) {
      console.error('Error saving config:', error);
      toast({
        title: "Erro ao salvar",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const updateField = (field: keyof CostConfig, value: string | number) => {
    if (!config) return;
    setConfig({
      ...config,
      [field]: field === 'notes' ? value : Number(value)
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!config) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Configuração não encontrada</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Configuração de Custos</h2>
          <p className="text-muted-foreground">
            Configure os custos por operação do Lovable Cloud (em dólares)
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Salvando...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Salvar
            </>
          )}
        </Button>
      </div>

      {/* Custos de Mensagens WhatsApp */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Mensagens WhatsApp
          </CardTitle>
          <CardDescription>
            Custos relacionados ao envio e recebimento de mensagens
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="cost_incoming">Mensagem Recebida (webhook)</Label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="cost_incoming"
                type="number"
                step="0.000001"
                value={config.cost_per_incoming_message}
                onChange={(e) => updateField('cost_per_incoming_message', e.target.value)}
                className="pl-9"
                placeholder="0.0001"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="cost_broadcast">Disparo em Massa</Label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="cost_broadcast"
                type="number"
                step="0.000001"
                value={config.cost_per_broadcast_message}
                onChange={(e) => updateField('cost_per_broadcast_message', e.target.value)}
                className="pl-9"
                placeholder="0.0002"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="cost_scheduled">Mensagem Agendada</Label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="cost_scheduled"
                type="number"
                step="0.000001"
                value={config.cost_per_scheduled_message}
                onChange={(e) => updateField('cost_per_scheduled_message', e.target.value)}
                className="pl-9"
                placeholder="0.0001"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Custos de Infraestrutura */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Infraestrutura Lovable Cloud
          </CardTitle>
          <CardDescription>
            Custos base de banco de dados, storage e processamento
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="cost_db_read">Leitura no Banco (por operação)</Label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="cost_db_read"
                type="number"
                step="0.000001"
                value={config.cost_per_database_read}
                onChange={(e) => updateField('cost_per_database_read', e.target.value)}
                className="pl-9"
                placeholder="0.000001"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="cost_db_write">Escrita no Banco (por operação)</Label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="cost_db_write"
                type="number"
                step="0.000001"
                value={config.cost_per_database_write}
                onChange={(e) => updateField('cost_per_database_write', e.target.value)}
                className="pl-9"
                placeholder="0.000001"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="cost_storage">Storage (por GB/mês)</Label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="cost_storage"
                type="number"
                step="0.000001"
                value={config.cost_per_storage_gb}
                onChange={(e) => updateField('cost_per_storage_gb', e.target.value)}
                className="pl-9"
                placeholder="0.021"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="cost_edge">Edge Function (por chamada)</Label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="cost_edge"
                type="number"
                step="0.000001"
                value={config.cost_per_edge_function_call}
                onChange={(e) => updateField('cost_per_edge_function_call', e.target.value)}
                className="pl-9"
                placeholder="0.0000002"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="cost_realtime">Realtime (por mensagem)</Label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="cost_realtime"
                type="number"
                step="0.000001"
                value={config.cost_per_realtime_message}
                onChange={(e) => updateField('cost_per_realtime_message', e.target.value)}
                className="pl-9"
                placeholder="0.0000025"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="cost_auth">Autenticação (por usuário/mês)</Label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="cost_auth"
                type="number"
                step="0.000001"
                value={config.cost_per_auth_user}
                onChange={(e) => updateField('cost_per_auth_user', e.target.value)}
                className="pl-9"
                placeholder="0.00325"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Custos de Dados */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Armazenamento de Dados
          </CardTitle>
          <CardDescription>
            Custos por item armazenado
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="cost_lead">Lead (por lead/mês)</Label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="cost_lead"
                type="number"
                step="0.000001"
                value={config.cost_per_lead_storage}
                onChange={(e) => updateField('cost_per_lead_storage', e.target.value)}
                className="pl-9"
                placeholder="0.00001"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Custos de Operações e Funcionalidades */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Operações e Funcionalidades
          </CardTitle>
          <CardDescription>
            Custos por operação específica
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="cost_workflow_execution">Execução de Workflow</Label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="cost_workflow_execution"
                type="number"
                step="0.000001"
                value={config.cost_per_workflow_execution}
                onChange={(e) => updateField('cost_per_workflow_execution', e.target.value)}
                className="pl-9"
                placeholder="0.0001"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Por execução de workflow periódico
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="cost_form_submission">Submissão de Formulário</Label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="cost_form_submission"
                type="number"
                step="0.000001"
                value={config.cost_per_form_submission}
                onChange={(e) => updateField('cost_per_form_submission', e.target.value)}
                className="pl-9"
                placeholder="0.0001"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Por submissão de formulário
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="cost_agent_ai_call">Chamada de Assistente IA</Label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="cost_agent_ai_call"
                type="number"
                step="0.000001"
                value={config.cost_per_agent_ai_call}
                onChange={(e) => updateField('cost_per_agent_ai_call', e.target.value)}
                className="pl-9"
                placeholder="0.001"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Por chamada de assistente IA
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Notas */}
      <Card>
        <CardHeader>
          <CardTitle>Notas e Observações</CardTitle>
          <CardDescription>
            Adicione notas sobre a origem desses custos ou atualizações
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={config.notes || ''}
            onChange={(e) => updateField('notes', e.target.value)}
            placeholder="Ex: Valores atualizados conforme billing de Janeiro/2025..."
            rows={4}
          />
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} size="lg">
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Salvando...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Salvar Configuração
            </>
          )}
        </Button>
      </div>
    </div>
  );
}