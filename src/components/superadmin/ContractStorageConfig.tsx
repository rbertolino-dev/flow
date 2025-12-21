import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { StorageType, type ContractStorageConfig } from '@/types/contract';
import { Loader2 } from 'lucide-react';
import { ContractStorageStats } from './ContractStorageStats';
import { ContractMigrationDialog } from './ContractMigrationDialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export function ContractStorageConfig() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<ContractStorageConfig | null>(null);
  const [migrationDialogOpen, setMigrationDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    storage_type: 'supabase' as StorageType, // Não usado mais (sempre Supabase)
    config: {} as Record<string, any>, // Não usado mais (sempre Supabase)
    is_active: true, // Não usado mais (sempre Supabase)
    backup_storage_type: undefined as StorageType | undefined,
    backup_config: {} as Record<string, any>,
    backup_is_active: false,
  });

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      // Buscar configuração global (organization_id null)
      const { data, error } = await supabase
        .from('contract_storage_config' as any)
        .select('*')
        .is('organization_id', null)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setConfig(data as any as ContractStorageConfig);
        const configData = data as any;
        setFormData({
          storage_type: 'supabase' as StorageType, // Sempre Supabase
          config: {}, // Não usado
          is_active: true, // Não usado
          backup_storage_type: configData.backup_storage_type as StorageType | undefined,
          backup_config: configData.backup_config || {},
          backup_is_active: configData.backup_is_active || false,
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
        storage_type: 'supabase' as StorageType, // Sempre Supabase (não muda)
        config: {}, // Não usado (sempre Supabase)
        is_active: true, // Sempre ativo (sempre Supabase)
        backup_storage_type: formData.backup_storage_type || null,
        backup_config: formData.backup_config || {},
        backup_is_active: formData.backup_is_active,
      };

      if (config) {
        // Atualizar
        const { error } = await supabase
          .from('contract_storage_config' as any)
          .update(configData)
          .eq('id', config.id);

        if (error) throw error;
      } else {
        // Criar
        const { error } = await supabase
          .from('contract_storage_config' as any)
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

  const renderBackupStorageConfigFields = () => {
    if (!formData.backup_storage_type) {
      return (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Selecione um tipo de storage para backup acima.
          </p>
        </div>
      );
    }

    switch (formData.backup_storage_type) {
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
              <Label htmlFor="backup-firebase-project-id">Project ID</Label>
              <Input
                id="backup-firebase-project-id"
                value={formData.backup_config.project_id || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    backup_config: { ...formData.backup_config, project_id: e.target.value },
                  })
                }
                placeholder="seu-projeto-firebase"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="backup-firebase-bucket">Bucket Name</Label>
              <Input
                id="backup-firebase-bucket"
                value={formData.backup_config.bucket || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    backup_config: { ...formData.backup_config, bucket: e.target.value },
                  })
                }
                placeholder="seu-bucket.appspot.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="backup-firebase-credentials">Service Account JSON</Label>
              <Textarea
                id="backup-firebase-credentials"
                value={formData.backup_config.credentials || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    backup_config: { ...formData.backup_config, credentials: e.target.value },
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
              <Label htmlFor="backup-s3-bucket">Bucket Name</Label>
              <Input
                id="backup-s3-bucket"
                value={formData.backup_config.bucket || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    backup_config: { ...formData.backup_config, bucket: e.target.value },
                  })
                }
                placeholder="meu-bucket"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="backup-s3-region">Region</Label>
              <Input
                id="backup-s3-region"
                value={formData.backup_config.region || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    backup_config: { ...formData.backup_config, region: e.target.value },
                  })
                }
                placeholder="us-east-1"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="backup-s3-access-key">Access Key ID</Label>
              <Input
                id="backup-s3-access-key"
                type="password"
                value={formData.backup_config.access_key_id || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    backup_config: { ...formData.backup_config, access_key_id: e.target.value },
                  })
                }
                placeholder="AKIAIOSFODNN7EXAMPLE"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="backup-s3-secret-key">Secret Access Key</Label>
              <Input
                id="backup-s3-secret-key"
                type="password"
                value={formData.backup_config.secret_access_key || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    backup_config: { ...formData.backup_config, secret_access_key: e.target.value },
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
            <Label htmlFor="backup-custom-config">Configuração JSON</Label>
            <Textarea
              id="backup-custom-config"
              value={JSON.stringify(formData.backup_config, null, 2)}
              onChange={(e) => {
                try {
                  const parsed = JSON.parse(e.target.value);
                  setFormData({ ...formData, backup_config: parsed });
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
    <div className="space-y-4">
      <Tabs defaultValue="config" className="w-full">
        <TabsList>
          <TabsTrigger value="config">Configuração</TabsTrigger>
          <TabsTrigger value="stats">Estatísticas</TabsTrigger>
        </TabsList>

        <TabsContent value="config">
          <Card>
            <CardHeader>
              <CardTitle>Configuração de Armazenamento de Contratos</CardTitle>
              <CardDescription>
                O storage principal sempre é Supabase. Configure um storage adicional para backup (opcional).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Storage Principal - Sempre Supabase */}
                <div className="space-y-2 p-4 bg-muted rounded-lg">
                  <Label className="text-base font-semibold">Storage Principal</Label>
                  <p className="text-sm text-muted-foreground">
                    Os contratos são sempre salvos no Supabase Storage. Esta configuração não pode ser alterada.
                  </p>
                </div>

                {/* Separador */}
                <div className="border-t pt-6">
                  <h3 className="text-lg font-semibold mb-4">Configuração de Backup Storage (Opcional)</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Configure um storage adicional para fazer backup automático dos contratos. 
                    Isso garante redundância e segurança dos dados.
                  </p>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="backup-storage-type">Tipo de Storage para Backup</Label>
                      <Select
                        value={formData.backup_storage_type || ''}
                        onValueChange={(value) =>
                          setFormData({
                            ...formData,
                            backup_storage_type: value as StorageType,
                            backup_config: {}, // Reset config ao mudar tipo
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione um storage para backup (opcional)" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="supabase">Supabase Storage</SelectItem>
                          <SelectItem value="firebase">Firebase Storage</SelectItem>
                          <SelectItem value="s3">Amazon S3</SelectItem>
                          <SelectItem value="custom">Custom (JSON)</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Deixe em branco para desabilitar backup automático
                      </p>
                    </div>

                    {formData.backup_storage_type && renderBackupStorageConfigFields()}

                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="backup-is-active"
                        checked={formData.backup_is_active}
                        onChange={(e) =>
                          setFormData({ ...formData, backup_is_active: e.target.checked })
                        }
                        className="rounded border-gray-300"
                        disabled={!formData.backup_storage_type}
                      />
                      <Label htmlFor="backup-is-active" className="cursor-pointer">
                        Ativar backup automático
                      </Label>
                    </div>
                    {formData.backup_storage_type && !formData.backup_is_active && (
                      <p className="text-xs text-muted-foreground">
                        O backup storage está configurado mas não está ativo. Ative a opção acima para habilitar backups automáticos.
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex justify-between items-center">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setMigrationDialogOpen(true)}
                    disabled={saving}
                  >
                    Migrar Contratos
                  </Button>
                  <div className="flex gap-2">
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
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stats">
          <ContractStorageStats />
        </TabsContent>
      </Tabs>

      <ContractMigrationDialog
        open={migrationDialogOpen}
        onOpenChange={setMigrationDialogOpen}
      />
    </div>
  );
}


