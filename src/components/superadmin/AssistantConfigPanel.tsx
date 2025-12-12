import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Save, Sparkles } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface AssistantConfig {
  id?: string;
  organization_id?: string | null;
  system_prompt?: string | null;
  tone_of_voice?: string | null;
  rules?: string | null;
  restrictions?: string | null;
  examples?: string | null;
  temperature?: number;
  max_tokens?: number;
  model?: string;
  is_active?: boolean;
  is_global?: boolean;
}

interface AssistantConfigPanelProps {
  organizationId?: string;
  organizationName?: string;
}

export function AssistantConfigPanel({ organizationId, organizationName }: AssistantConfigPanelProps) {
  const [config, setConfig] = useState<AssistantConfig>({
    system_prompt: "",
    tone_of_voice: "profissional",
    rules: "",
    restrictions: "",
    examples: "",
    temperature: 0.7,
    max_tokens: 2000,
    model: "deepseek-chat",
    is_active: true,
    is_global: false,
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadConfig();
  }, [organizationId]);

  const loadConfig = async () => {
    setLoading(true);
    try {
      let query = (supabase
        .from("assistant_config") as any)
        .select("*");

      if (organizationId) {
        query = query.eq("organization_id", organizationId);
      } else {
        // Carregar configuração global
        query = query.is("organization_id", null).eq("is_global", true);
      }

      const { data, error } = await query.maybeSingle();

      if (error && error.code !== "PGRST116") {
        throw error;
      }

      if (data) {
        setConfig(data);
      }
    } catch (error: any) {
      console.error("Erro ao carregar configuração:", error);
      toast({
        title: "Erro",
        description: "Erro ao carregar configuração",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const configData: any = {
        system_prompt: config.system_prompt || null,
        tone_of_voice: config.tone_of_voice || null,
        rules: config.rules || null,
        restrictions: config.restrictions || null,
        examples: config.examples || null,
        temperature: config.temperature || 0.7,
        max_tokens: config.max_tokens || 2000,
        model: config.model || "deepseek-chat",
        is_active: config.is_active ?? true,
        is_global: organizationId ? false : (config.is_global ?? false),
      };

      if (organizationId) {
        configData.organization_id = organizationId;
      }

      if (config.id) {
        // Atualizar
        const { error } = await (supabase
          .from("assistant_config") as any)
          .update(configData)
          .eq("id", config.id);

        if (error) throw error;
      } else {
        // Criar
        const { error } = await (supabase
          .from("assistant_config") as any)
          .insert(configData);

        if (error) throw error;
      }

      toast({
        title: "Sucesso",
        description: "Configuração salva com sucesso",
      });

      await loadConfig();
    } catch (error: any) {
      console.error("Erro ao salvar configuração:", error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao salvar configuração",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <div>
              <CardTitle>Configurações do Assistente IA</CardTitle>
              <CardDescription>
                {organizationId
                  ? `Configuração para: ${organizationName || organizationId}`
                  : "Configuração Global (aplica a todas as organizações)"}
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="is-active">Ativo</Label>
              <Switch
                id="is-active"
                checked={config.is_active ?? true}
                onCheckedChange={(checked) =>
                  setConfig({ ...config, is_active: checked })
                }
              />
            </div>
            {!organizationId && (
              <div className="flex items-center gap-2">
                <Label htmlFor="is-global">Global</Label>
                <Switch
                  id="is-global"
                  checked={config.is_global ?? false}
                  onCheckedChange={(checked) =>
                    setConfig({ ...config, is_global: checked })
                  }
                />
              </div>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="prompt" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="prompt">Instruções</TabsTrigger>
            <TabsTrigger value="rules">Regras</TabsTrigger>
            <TabsTrigger value="restrictions">Restrições</TabsTrigger>
            <TabsTrigger value="advanced">Avançado</TabsTrigger>
          </TabsList>

          <TabsContent value="prompt" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="system-prompt">
                Instruções Gerais (System Prompt)
              </Label>
              <Textarea
                id="system-prompt"
                value={config.system_prompt || ""}
                onChange={(e) =>
                  setConfig({ ...config, system_prompt: e.target.value })
                }
                placeholder="Ex: Você é um assistente de CRM especializado em vendas. Seja sempre profissional, objetivo e prestativo..."
                className="min-h-[200px]"
              />
              <p className="text-xs text-muted-foreground">
                Instruções gerais de como o assistente deve se comportar e responder
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tone-of-voice">Tom de Voz</Label>
              <Select
                value={config.tone_of_voice || "profissional"}
                onValueChange={(value) =>
                  setConfig({ ...config, tone_of_voice: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="profissional">Profissional</SelectItem>
                  <SelectItem value="amigável">Amigável</SelectItem>
                  <SelectItem value="formal">Formal</SelectItem>
                  <SelectItem value="casual">Casual</SelectItem>
                  <SelectItem value="técnico">Técnico</SelectItem>
                  <SelectItem value="vendedor">Vendedor</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Define o tom de voz das respostas do assistente
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="examples">Exemplos de Boas Respostas</Label>
              <Textarea
                id="examples"
                value={config.examples || ""}
                onChange={(e) =>
                  setConfig({ ...config, examples: e.target.value })
                }
                placeholder="Exemplo 1: Quando o usuário pede para criar um lead, responda: 'Vou criar o lead agora. Qual o nome e telefone?'&#10;Exemplo 2: Quando buscar leads, apresente os resultados de forma organizada..."
                className="min-h-[150px]"
              />
              <p className="text-xs text-muted-foreground">
                Exemplos de como o assistente deve responder em situações específicas
              </p>
            </div>
          </TabsContent>

          <TabsContent value="rules" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="rules">Regras de Comportamento</Label>
              <Textarea
                id="rules"
                value={config.rules || ""}
                onChange={(e) =>
                  setConfig({ ...config, rules: e.target.value })
                }
                placeholder="1. Sempre confirme ações importantes antes de executar&#10;2. Use as funções disponíveis para realizar ações no sistema&#10;3. Quando buscar leads, apresente os resultados de forma organizada&#10;4. Sempre informe o ID do lead quando criar ou atualizar..."
                className="min-h-[300px]"
              />
              <p className="text-xs text-muted-foreground">
                Regras específicas de como o assistente deve se comportar
              </p>
            </div>
          </TabsContent>

          <TabsContent value="restrictions" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="restrictions">Restrições e Limitações</Label>
              <Textarea
                id="restrictions"
                value={config.restrictions || ""}
                onChange={(e) =>
                  setConfig({ ...config, restrictions: e.target.value })
                }
                placeholder="NÃO faça:&#10;- Não forneça informações financeiras sensíveis&#10;- Não delete dados sem confirmação explícita&#10;- Não envie mensagens sem autorização&#10;- Não acesse dados de outras organizações..."
                className="min-h-[300px]"
              />
              <p className="text-xs text-muted-foreground">
                O que o assistente NÃO deve fazer ou responder
              </p>
            </div>
          </TabsContent>

          <TabsContent value="advanced" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="temperature">Temperatura (0.0 - 2.0)</Label>
                <Input
                  id="temperature"
                  type="number"
                  min="0"
                  max="2"
                  step="0.1"
                  value={config.temperature || 0.7}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      temperature: parseFloat(e.target.value) || 0.7,
                    })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Controla a criatividade (0.0 = determinístico, 2.0 = muito criativo)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="max-tokens">Máximo de Tokens</Label>
                <Input
                  id="max-tokens"
                  type="number"
                  min="100"
                  max="4000"
                  value={config.max_tokens || 2000}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      max_tokens: parseInt(e.target.value) || 2000,
                    })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Limite máximo de tokens na resposta
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="model">Modelo</Label>
              <Select
                value={config.model || "deepseek-chat"}
                onValueChange={(value) =>
                  setConfig({ ...config, model: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="deepseek-chat">deepseek-chat</SelectItem>
                  <SelectItem value="deepseek-coder">deepseek-coder</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Modelo do DeepSeek a ser usado
              </p>
            </div>
          </TabsContent>
        </Tabs>

        <div className="mt-6 flex justify-end">
          <Button onClick={handleSave} disabled={saving}>
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
      </CardContent>
    </Card>
  );
}



