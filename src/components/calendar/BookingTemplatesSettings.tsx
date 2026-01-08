import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveOrganization } from "@/hooks/useActiveOrganization";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2, FileText, Copy } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface BookingTemplate {
  id?: string;
  template_type: 'approval' | 'confirmation' | 'reminder';
  template_text: string;
  is_active: boolean;
}

const TEMPLATE_TYPES = [
  { value: 'approval', label: 'Mensagem de Aprovação', description: 'Enviada quando solicitação é aprovada' },
  { value: 'confirmation', label: 'Confirmação', description: 'Enviada após aprovação (padrão)' },
  { value: 'reminder', label: 'Lembrete', description: 'Enviada antes do evento' },
];

const DEFAULT_TEMPLATES = {
  approval: 'Olá {nome}! Sua solicitação de agendamento foi aprovada!\n\n📅 Data: {data}\n🕐 Hora: {hora}\n⏱️ Duração: {duracao} minutos\n\n{link_meet}\n\n{observacoes}',
  confirmation: 'Olá {nome}! Confirmação do seu agendamento:\n\n📅 Data: {data}\n🕐 Hora: {hora}\n⏱️ Duração: {duracao} minutos\n\n{link_meet}\n\n{observacoes}',
  reminder: 'Olá {nome}! Lembrete: Você tem uma reunião agendada para {data} às {hora}. {link_meet}',
};

const VARIABLES = [
  { name: '{nome}', description: 'Nome do cliente' },
  { name: '{data}', description: 'Data formatada (ex: segunda-feira, 1 de janeiro de 2024)' },
  { name: '{hora}', description: 'Hora formatada (ex: 14:30)' },
  { name: '{duracao}', description: 'Duração em minutos' },
  { name: '{link_meet}', description: 'Link do Google Meet (se disponível)' },
  { name: '{observacoes}', description: 'Observações do cliente' },
];

export function BookingTemplatesSettings() {
  const { activeOrgId } = useActiveOrganization();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [templates, setTemplates] = useState<BookingTemplate[]>([]);

  useEffect(() => {
    if (activeOrgId) {
      loadTemplates();
    }
  }, [activeOrgId]);

  const loadTemplates = async () => {
    if (!activeOrgId) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('booking_templates')
        .select('*')
        .eq('organization_id', activeOrgId)
        .order('template_type', { ascending: true });

      if (error) throw error;

      // Criar templates padrão se não existirem
      const existingTypes = (data || []).map(t => t.template_type);
      const defaultTemplates: BookingTemplate[] = TEMPLATE_TYPES.map(type => {
        const existing = (data || []).find(t => t.template_type === type.value);
        return existing || {
          template_type: type.value as any,
          template_text: DEFAULT_TEMPLATES[type.value as keyof typeof DEFAULT_TEMPLATES],
          is_active: true,
        };
      });

      setTemplates(defaultTemplates);
    } catch (error: any) {
      console.error('Erro ao carregar templates:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar templates de mensagem",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const updateTemplate = (type: string, field: keyof BookingTemplate, value: any) => {
    setTemplates(templates.map(t => 
      t.template_type === type ? { ...t, [field]: value } : t
    ));
  };

  const handleSave = async () => {
    if (!activeOrgId) return;

    try {
      setSaving(true);

      for (const template of templates) {
        if (template.id) {
          // Atualizar existente
          const { error } = await supabase
            .from('booking_templates')
            .update({
              template_text: template.template_text,
              is_active: template.is_active,
            })
            .eq('id', template.id);

          if (error) throw error;
        } else {
          // Criar novo
          const { error } = await supabase
            .from('booking_templates')
            .insert({
              organization_id: activeOrgId,
              template_type: template.template_type,
              template_text: template.template_text,
              is_active: template.is_active,
            });

          if (error) throw error;
        }
      }

      toast({
        title: "Salvo!",
        description: "Templates de mensagem atualizados com sucesso",
      });

      await loadTemplates();
    } catch (error: any) {
      console.error('Erro ao salvar:', error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao salvar templates",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copiado!",
      description: "Variável copiada para a área de transferência",
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Templates de Mensagem WhatsApp
          </CardTitle>
          <CardDescription>
            Configure as mensagens que serão enviadas aos clientes via WhatsApp
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <Alert>
              <AlertDescription>
                <p className="font-semibold mb-2">Variáveis disponíveis:</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {VARIABLES.map((variable) => (
                    <div key={variable.name} className="flex items-center gap-2">
                      <code className="text-xs bg-gray-100 px-2 py-1 rounded">{variable.name}</code>
                      <span className="text-xs text-gray-600">{variable.description}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => copyToClipboard(variable.name)}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </AlertDescription>
            </Alert>

            {templates.map((template) => {
              const typeInfo = TEMPLATE_TYPES.find(t => t.value === template.template_type);
              return (
                <Card key={template.template_type}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-lg">{typeInfo?.label}</CardTitle>
                        <CardDescription>{typeInfo?.description}</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>Template</Label>
                      <Textarea
                        value={template.template_text}
                        onChange={(e) => updateTemplate(template.template_type, 'template_text', e.target.value)}
                        rows={6}
                        placeholder="Digite o template da mensagem..."
                      />
                    </div>
                  </CardContent>
                </Card>
              );
            })}

            <Button onClick={handleSave} disabled={saving} className="w-full">
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                "Salvar Templates"
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

