import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { MigrationService } from '@/services/contractStorage/MigrationService';
import { Loader2, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface ContractMigrationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId?: string; // Se fornecido, migra apenas esta organização; se não, migra todas
}

export function ContractMigrationDialog({ open, onOpenChange, organizationId }: ContractMigrationDialogProps) {
  const { toast } = useToast();
  const [migrating, setMigrating] = useState(false);
  const [progress, setProgress] = useState<{ success: number; failed: number; errors: string[] } | null>(null);
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string>(organizationId || '');

  useEffect(() => {
    if (open && !organizationId) {
      fetchOrganizations();
    } else if (organizationId) {
      setSelectedOrgId(organizationId);
    }
  }, [open, organizationId]);

  const fetchOrganizations = async () => {
    try {
      const { data, error } = await supabase
        .from('organizations')
        .select('id, name')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setOrganizations(data || []);
    } catch (error: any) {
      console.error('Erro ao buscar organizações:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao buscar organizações',
        variant: 'destructive',
      });
    }
  };

  const handleMigrate = async () => {
    if (!selectedOrgId) {
      toast({
        title: 'Erro',
        description: 'Selecione uma organização',
        variant: 'destructive',
      });
      return;
    }

    setMigrating(true);
    setProgress(null);

    try {
      const result = await MigrationService.migrateAllContracts(selectedOrgId);
      setProgress(result);

      if (result.success > 0) {
        toast({
          title: 'Migração concluída',
          description: `${result.success} contratos migrados com sucesso${result.failed > 0 ? `, ${result.failed} falharam` : ''}`,
        });
      } else {
        toast({
          title: 'Migração falhou',
          description: result.errors[0] || 'Nenhum contrato foi migrado',
          variant: 'destructive',
        });
      }
    } catch (error: any) {
      console.error('Erro ao migrar:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao migrar contratos',
        variant: 'destructive',
      });
    } finally {
      setMigrating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Migrar Contratos entre Storages</DialogTitle>
          <DialogDescription>
            Migra todos os contratos de uma organização para o storage configurado atualmente.
            Esta operação pode demorar alguns minutos dependendo da quantidade de contratos.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!organizationId && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Organização</label>
              <select
                value={selectedOrgId}
                onChange={(e) => setSelectedOrgId(e.target.value)}
                className="w-full p-2 border rounded-md"
                disabled={migrating}
              >
                <option value="">Selecione uma organização</option>
                {organizations.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {progress && (
            <div className="space-y-2 p-4 bg-muted rounded-md">
              <div className="flex items-center gap-2">
                {progress.failed === 0 ? (
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-yellow-500" />
                )}
                <span className="font-medium">
                  {progress.success} contratos migrados com sucesso
                  {progress.failed > 0 && `, ${progress.failed} falharam`}
                </span>
              </div>
              {progress.errors.length > 0 && (
                <div className="mt-2 space-y-1">
                  <p className="text-sm font-medium text-destructive">Erros:</p>
                  <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                    {progress.errors.slice(0, 5).map((error, index) => (
                      <li key={index}>{error}</li>
                    ))}
                    {progress.errors.length > 5 && (
                      <li>... e mais {progress.errors.length - 5} erros</li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={migrating}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleMigrate}
              disabled={migrating || !selectedOrgId}
            >
              {migrating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Migrando...
                </>
              ) : (
                'Iniciar Migração'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

