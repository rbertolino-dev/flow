import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useOpenAIConfig } from '@/hooks/useOpenAIConfig';
import { Loader2, Key } from 'lucide-react';

interface OpenAIConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function OpenAIConfigDialog({ open, onOpenChange }: OpenAIConfigDialogProps) {
  const { config, loading, saveConfig, deleteConfig } = useOpenAIConfig();
  const [apiKey, setApiKey] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!apiKey.trim()) return;
    
    setSaving(true);
    await saveConfig(apiKey);
    setSaving(false);
    setApiKey('');
    onOpenChange(false);
  };

  const handleDelete = async () => {
    if (!confirm('Tem certeza que deseja remover a configuração OpenAI?')) return;
    await deleteConfig();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Configuração OpenAI
          </DialogTitle>
          <DialogDescription>
            Configure a API key da OpenAI para sua organização. Esta chave será usada para sincronizar agentes com a OpenAI.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            {config ? (
              <div className="space-y-4">
                <div className="rounded-lg border border-green-200 bg-green-50 p-4">
                  <p className="text-sm text-green-900">
                    ✓ API key configurada
                  </p>
                  <p className="text-xs text-green-700 mt-1">
                    Última atualização: {new Date(config.updated_at).toLocaleDateString('pt-BR')}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="new-api-key">Nova API Key (opcional)</Label>
                  <Input
                    id="new-api-key"
                    type="password"
                    placeholder="sk-..."
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                  />
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={handleSave}
                    disabled={!apiKey.trim() || saving}
                    className="flex-1"
                  >
                    {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Atualizar
                  </Button>
                  <Button
                    onClick={handleDelete}
                    variant="destructive"
                    disabled={saving}
                  >
                    Remover
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
                  <p className="text-sm text-yellow-900">
                    ⚠ Nenhuma API key configurada
                  </p>
                  <p className="text-xs text-yellow-700 mt-1">
                    Configure uma API key para sincronizar agentes com a OpenAI.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="api-key">API Key da OpenAI</Label>
                  <Input
                    id="api-key"
                    type="password"
                    placeholder="sk-..."
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Obtenha sua API key em{' '}
                    <a
                      href="https://platform.openai.com/api-keys"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      platform.openai.com/api-keys
                    </a>
                  </p>
                </div>

                <Button
                  onClick={handleSave}
                  disabled={!apiKey.trim() || saving}
                  className="w-full"
                >
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Salvar Configuração
                </Button>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
