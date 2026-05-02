import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Key, Loader2, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useActiveOrganization } from '@/hooks/useActiveOrganization';
import { useToast } from '@/hooks/use-toast';

interface OpenAIConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function OpenAIConfigDialog({ open, onOpenChange }: OpenAIConfigDialogProps) {
  const { activeOrgId } = useActiveOrganization();
  const { toast } = useToast();
  const [apiKey, setApiKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isConfigured, setIsConfigured] = useState(false);

  const fetchConfig = useCallback(async () => {
    if (!activeOrgId) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('openai_configs')
        .select('api_key')
        .eq('organization_id', activeOrgId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Erro ao buscar config:', error);
        if (error.code === '42P01' || error.message?.includes('does not exist')) {
          toast({
            title: 'Tabela OpenAI em falta',
            description:
              'Aplique a migration openai_configs no Supabase (SQL Editor ou supabase db push) e tente de novo.',
            variant: 'destructive',
          });
        }
      }

      if (data?.api_key) {
        // Não mostrar a chave completa por segurança, mas permitir edição
        setApiKey('');
        setIsConfigured(true);
      } else {
        setApiKey('');
        setIsConfigured(false);
      }
    } catch (error) {
      console.error('Erro ao buscar configuração:', error);
    } finally {
      setLoading(false);
    }
  }, [activeOrgId, toast]);

  useEffect(() => {
    if (open && activeOrgId) {
      void fetchConfig();
    }
  }, [open, activeOrgId, fetchConfig]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOrgId || !apiKey.trim()) {
      toast({
        title: 'Erro',
        description: 'Por favor, insira uma API key válida.',
        variant: 'destructive',
      });
      return;
    }

    const trimmed = apiKey.trim();
    // OpenAI: sk-..., sk-proj-..., etc.
    if (!trimmed.startsWith('sk-')) {
      toast({
        title: 'Erro',
        description: 'A API key deve começar com "sk-" (formato OpenAI).',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      const { data: existingRows, error: fetchErr } = await supabase
        .from('openai_configs')
        .select('id')
        .eq('organization_id', activeOrgId)
        .order('updated_at', { ascending: false })
        .limit(1);

      if (fetchErr) throw fetchErr;

      const existingId = existingRows?.[0]?.id;
      const { error } = existingId
        ? await supabase.from('openai_configs').update({ api_key: trimmed }).eq('id', existingId)
        : await supabase
            .from('openai_configs')
            .insert({ organization_id: activeOrgId, api_key: trimmed });

      if (error) {
        const msg = (error as { message?: string }).message || '';
        if (msg.includes('unique') || msg.includes('duplicate') || msg.includes('on conflict')) {
          throw new Error(
            'Conflito ao guardar: há várias linhas para esta organização. Peça ao admin para aplicar a migration openai_configs (dedupe + UNIQUE).',
          );
        }
        if (msg.includes('does not exist') || (error as { code?: string }).code === '42P01') {
          throw new Error(
            'Tabela openai_configs não existe na base. Aplique as migrations do projeto no Supabase.',
          );
        }
        throw error;
      }

      toast({
        title: 'Sucesso!',
        description: 'API key configurada com sucesso.',
      });

      setIsConfigured(true);
      // Limpar o campo após salvar por segurança
      setApiKey('');
      onOpenChange(false);
    } catch (error: unknown) {
      console.error('Erro ao salvar config:', error);
      const message = error instanceof Error ? error.message : 'Falha ao salvar a configuração.';
      toast({
        title: 'Erro',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setApiKey(e.target.value);
    setIsConfigured(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg space-y-4">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Configurar API Key OpenAI
          </DialogTitle>
          <DialogDescription>
            Configure a API key da OpenAI para sua organização. A chave será armazenada de forma segura.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSave} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="openai-api-key">API Key OpenAI</Label>
            <Input
              id="openai-api-key"
              type="password"
              placeholder={isConfigured ? "Digite uma nova API key para atualizar" : "sk-..."}
              value={apiKey}
              onChange={handleInputChange}
              disabled={loading || saving}
              required
            />
            {isConfigured && !apiKey && (
              <div className="flex items-center gap-2 text-sm text-green-600">
                <CheckCircle2 className="h-4 w-4" />
                <span>API key já configurada. Digite uma nova para atualizar.</span>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              A chave será armazenada por organização. Não compartilhe com terceiros.
            </p>
          </div>

          <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 space-y-2 text-sm text-yellow-900">
            <p className="font-medium">Importante</p>
            <ul className="list-disc list-inside space-y-1">
              <li>A chave é única por organização.</li>
              <li>Nunca compartilhe a chave em chats, tickets ou commits.</li>
              <li>Para gerar uma nova chave, visite <a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer" className="underline">platform.openai.com/api-keys</a></li>
            </ul>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading || saving || !apiKey.trim()}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                'Salvar'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
