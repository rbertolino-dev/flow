import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveOrganization } from "@/hooks/useActiveOrganization";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Link as LinkIcon, Copy, Check } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";

export function BookingConfigPanel() {
  const { activeOrgId } = useActiveOrganization();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publicSlug, setPublicSlug] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [defaultDuration, setDefaultDuration] = useState(60);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (activeOrgId) {
      loadConfig();
    }
  }, [activeOrgId]);

  const loadConfig = async () => {
    if (!activeOrgId) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('organization_booking_configs')
        .select('*')
        .eq('organization_id', activeOrgId)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = not found
        throw error;
      }

      if (data) {
        setPublicSlug(data.public_slug || '');
        setIsActive(data.is_active ?? true);
        setDefaultDuration(data.default_duration_minutes || 60);
      } else {
        // Criar configuração padrão
        const slug = generateSlug();
        setPublicSlug(slug);
        setIsActive(true);
        setDefaultDuration(60);
      }
    } catch (error: any) {
      console.error('Erro ao carregar configuração:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar configuração de agendamento",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const generateSlug = () => {
    // Gerar slug baseado no nome da organização ou aleatório
    return `org-${activeOrgId?.slice(0, 8)}-${Math.random().toString(36).substr(2, 6)}`;
  };

  const handleSave = async () => {
    if (!activeOrgId || !publicSlug) {
      toast({
        title: "Erro",
        description: "Slug público é obrigatório",
        variant: "destructive",
      });
      return;
    }

    try {
      setSaving(true);

      // Verificar se slug já existe em outra organização
      const { data: existing, error: checkError } = await supabase
        .from('organization_booking_configs')
        .select('id, organization_id')
        .eq('public_slug', publicSlug)
        .single();

      if (existing && existing.organization_id !== activeOrgId) {
        toast({
          title: "Erro",
          description: "Este slug já está em uso por outra organização",
          variant: "destructive",
        });
        return;
      }

      // Upsert configuração
      const { error } = await supabase
        .from('organization_booking_configs')
        .upsert({
          organization_id: activeOrgId,
          public_slug: publicSlug,
          is_active: isActive,
          default_duration_minutes: defaultDuration,
        }, {
          onConflict: 'organization_id',
        });

      if (error) throw error;

      toast({
        title: "Salvo!",
        description: "Configuração de agendamento atualizada com sucesso",
      });
    } catch (error: any) {
      console.error('Erro ao salvar:', error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao salvar configuração",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const copyPublicLink = () => {
    const link = `${window.location.origin}/book/${publicSlug}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({
      title: "Copiado!",
      description: "Link público copiado para a área de transferência",
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const publicLink = `${window.location.origin}/book/${publicSlug}`;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <LinkIcon className="h-5 w-5" />
          Configuração de Agendamento Público
        </CardTitle>
        <CardDescription>
          Configure o link público para que clientes possam agendar reuniões
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="publicSlug">Slug Público</Label>
          <Input
            id="publicSlug"
            value={publicSlug}
            onChange={(e) => setPublicSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
            placeholder="minha-empresa"
          />
          <p className="text-xs text-gray-500">
            Use apenas letras minúsculas, números e hífens. Ex: minha-empresa
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="defaultDuration">Duração Padrão (minutos)</Label>
          <Input
            id="defaultDuration"
            type="number"
            min="15"
            max="480"
            step="15"
            value={defaultDuration}
            onChange={(e) => setDefaultDuration(parseInt(e.target.value) || 60)}
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>Agendamento Ativo</Label>
            <p className="text-sm text-gray-500">
              Quando desativado, o link público não funcionará
            </p>
          </div>
          <Switch
            checked={isActive}
            onCheckedChange={setIsActive}
          />
        </div>

        {publicSlug && (
          <Alert>
            <LinkIcon className="h-4 w-4" />
            <AlertDescription>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold mb-1">Link Público:</p>
                  <code className="text-xs bg-gray-100 px-2 py-1 rounded break-all">
                    {publicLink}
                  </code>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={copyPublicLink}
                  className="ml-4"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        <Button onClick={handleSave} disabled={saving} className="w-full">
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Salvando...
            </>
          ) : (
            "Salvar Configuração"
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

