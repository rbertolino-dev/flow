import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { StorageType, ContractStorageConfig } from '@/types/contract';
import { Loader2 } from 'lucide-react';

export function ContractStorageConfig() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<ContractStorageConfig | null>(null);
  const [formData, setFormData] = useState({
    storage_type: 'supabase' as StorageType,
    config: {} as Record<string, any>,
    is_active: true,
  });

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      // Buscar configuração global (organization_id null)
      const { data, error } = await supabase
        .from('contract_storage_config')
        .select('*')
        .is('organization_id', null)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setConfig(data as ContractStorageConfig);
        setFormData({
          storage_type: data.storage_type as StorageType,
          config: data.config || {},
          is_active: data.is_active,
        });
      }
    } catch (error: any) {
      console.error('Erro ao carregar configuração:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao carregar configuração',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const configData = {
        organization_id: null, // Configuração global
        storage_type: formData.storage_type,
        config: formData.config,
        is_active: formData.is_active,
      };

      if (config) {
        // Atualizar
        const { error } = await supabase
          .from('contract_storage_config')
          .update(configData)
          .eq('id', config.id);

        if (error) throw error;
      } else {
        // Criar
        const { error } = await supabase
          .from('contract_storage_config')
          .insert(configData);

        if (error) throw error;
      }

      toast({
        title: 'Configuração salva',
        description: 'Configuração de armazenamento salva com sucesso',
      });

      await fetchConfig();
    } catch (error: any) {
      console.error('Erro ao salvar configuração:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao salvar configuração',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const renderStorageConfigFields = () => {
    switch (formData.storage_type) {
      case 'supabase':
        return (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Supabase Storage está configurado automaticamente. Nenhuma configuração adicional necessária.
            </p>
          </div>
        );

      case 'firebase':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="firebase-project-id">Project ID</Label>
              <Input
                id="firebase-project-id"
                value={formData.config.project_id || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    config: { ...formData.config, project_id: e.target.value },
                  })
                }
                placeholder="seu-projeto-firebase"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="firebase-bucket">Bucket Name</Label>
              <Input
                id="firebase-bucket"
                value={formData.config.bucket || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    config: { ...formData.config, bucket: e.target.value },
                  })
                }
                placeholder="seu-bucket.appspot.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="firebase-credentials">Service Account JSON</Label>
              <Textarea
                id="firebase-credentials"
                value={formData.config.credentials || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    config: { ...formData.config, credentials: e.target.value },
                  })
                }
                placeholder="Cole o JSON da service account"
                rows={5}
              />
            </div>
          </div>
        );

      case 's3':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="s3-bucket">Bucket Name</Label>
              <Input
                id="s3-bucket"
                value={formData.config.bucket || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    config: { ...formData.config, bucket: e.target.value },
                  })
                }
                placeholder="meu-bucket"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="s3-region">Region</Label>
              <Input
                id="s3-region"
                value={formData.config.region || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    config: { ...formData.config, region: e.target.value },
                  })
                }
                placeholder="us-east-1"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="s3-access-key">Access Key ID</Label>
              <Input
                id="s3-access-key"
                type="password"
                value={formData.config.access_key_id || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    config: { ...formData.config, access_key_id: e.target.value },
                  })
                }
                placeholder="AKIAIOSFODNN7EXAMPLE"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="s3-secret-key">Secret Access Key</Label>
              <Input
                id="s3-secret-key"
                type="password"
                value={formData.config.secret_access_key || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    config: { ...formData.config, secret_access_key: e.target.value },
                  })
                }
                placeholder="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
              />
            </div>
          </div>
        );

      case 'custom':
        return (
          <div className="space-y-2">
            <Label htmlFor="custom-config">Configuração JSON</Label>
            <Textarea
              id="custom-config"
              value={JSON.stringify(formData.config, null, 2)}
              onChange={(e) => {
                try {
                  const parsed = JSON.parse(e.target.value);
                  setFormData({ ...formData, config: parsed });
                } catch {
                  // Ignorar erros de parsing enquanto digita
                }
              }}
              placeholder='{"endpoint": "https://...", "api_key": "..."}'
              rows={8}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Digite a configuração em formato JSON
            </p>
          </div>
        );

      default:
        return null;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Configuração de Armazenamento de Contratos</CardTitle>
        <CardDescription>
          Configure onde os PDFs dos contratos serão armazenados. Por padrão, usa Supabase Storage.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="storage-type">Tipo de Armazenamento</Label>
            <Select
              value={formData.storage_type}
              onValueChange={(value) =>
                setFormData({
                  ...formData,
                  storage_type: value as StorageType,
                  config: {}, // Reset config ao mudar tipo
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="supabase">Supabase Storage (Padrão)</SelectItem>
                <SelectItem value="firebase">Firebase Storage</SelectItem>
                <SelectItem value="s3">Amazon S3</SelectItem>
                <SelectItem value="custom">Custom (JSON)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {renderStorageConfigFields()}

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="is-active"
              checked={formData.is_active}
              onChange={(e) =>
                setFormData({ ...formData, is_active: e.target.checked })
              }
              className="rounded border-gray-300"
            />
            <Label htmlFor="is-active" className="cursor-pointer">
              Configuração ativa
            </Label>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={fetchConfig}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                'Salvar Configuração'
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}


