import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { StorageUsageService } from '@/services/contractStorage/StorageUsageService';
import { BillingService } from '@/services/contractStorage/BillingService';
import { Loader2, Database, DollarSign, TrendingUp, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';

export function ContractStorageStats() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string>('');
  const [usage, setUsage] = useState<any>(null);
  const [billing, setBilling] = useState<any[]>([]);
  const [totalUsage, setTotalUsage] = useState({ totalGB: 0, totalFiles: 0, totalCost: 0 });

  useEffect(() => {
    fetchOrganizations();
  }, []);

  useEffect(() => {
    if (selectedOrgId) {
      fetchStats();
    }
  }, [selectedOrgId]);

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
    }
  };

  const fetchStats = async () => {
    if (!selectedOrgId) return;

    try {
      setLoading(true);

      // Buscar uso atual
      const usageData = await StorageUsageService.getUsage(selectedOrgId, 'monthly');
      if (usageData && usageData.length > 0) {
        setUsage(usageData[0]);
      } else {
        // Atualizar uso se não existir
        await StorageUsageService.updateUsage(selectedOrgId);
        const updatedUsage = await StorageUsageService.getUsage(selectedOrgId, 'monthly');
        if (updatedUsage && updatedUsage.length > 0) {
          setUsage(updatedUsage[0]);
        }
      }

      // Buscar cobranças
      const billingData = await BillingService.getBillings(selectedOrgId, 6);
      setBilling(billingData);

      // Calcular totais
      const totalGB = usageData?.reduce((sum, u) => sum + (u.totalGB || 0), 0) || 0;
      const totalFiles = usageData?.reduce((sum, u) => sum + (u.total_files || 0), 0) || 0;
      const totalCost = billingData?.reduce((sum, b) => sum + (b.total_cost || 0), 0) || 0;

      setTotalUsage({ totalGB, totalFiles, totalCost });
    } catch (error: any) {
      console.error('Erro ao buscar estatísticas:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao buscar estatísticas',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    if (!selectedOrgId) return;

    setRefreshing(true);
    try {
      await StorageUsageService.updateUsage(selectedOrgId);
      await fetchStats();
      toast({
        title: 'Atualizado',
        description: 'Estatísticas atualizadas com sucesso',
      });
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: 'Erro ao atualizar estatísticas',
        variant: 'destructive',
      });
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Estatísticas de Armazenamento</CardTitle>
          <CardDescription>
            Visualize o uso de armazenamento e custos por organização
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Organização</label>
            <select
              value={selectedOrgId}
              onChange={(e) => setSelectedOrgId(e.target.value)}
              className="w-full p-2 border rounded-md"
              disabled={loading}
            >
              <option value="">Selecione uma organização</option>
              {organizations.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </select>
          </div>

          {selectedOrgId && (
            <>
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRefresh}
                  disabled={refreshing || loading}
                >
                  {refreshing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Atualizando...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Atualizar
                    </>
                  )}
                </Button>
              </div>

              {loading ? (
                <div className="flex items-center justify-center p-8">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
              ) : usage ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2">
                        <Database className="w-5 h-5 text-blue-500" />
                        <div>
                          <p className="text-sm text-muted-foreground">Armazenamento Usado</p>
                          <p className="text-2xl font-bold">{usage.totalGB?.toFixed(4) || '0.0000'} GB</p>
                          <p className="text-xs text-muted-foreground">{usage.total_files || 0} arquivos</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2">
                        <DollarSign className="w-5 h-5 text-green-500" />
                        <div>
                          <p className="text-sm text-muted-foreground">Custo Mensal Estimado</p>
                          <p className="text-2xl font-bold">
                            ${((usage.totalGB || 0) * 0.021).toFixed(4)}
                          </p>
                          <p className="text-xs text-muted-foreground">@ $0.021/GB</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-purple-500" />
                        <div>
                          <p className="text-sm text-muted-foreground">Período</p>
                          <p className="text-lg font-semibold">
                            {format(new Date(usage.period_start), 'MMM/yyyy')}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(usage.period_start), 'dd/MM')} - {format(new Date(usage.period_end), 'dd/MM')}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center p-4">
                  Nenhum dado de uso encontrado. Clique em "Atualizar" para calcular.
                </p>
              )}

              {billing.length > 0 && (
                <div className="mt-4">
                  <h3 className="text-sm font-medium mb-2">Histórico de Cobranças</h3>
                  <div className="space-y-2">
                    {billing.map((bill) => (
                      <div
                        key={bill.id}
                        className="flex items-center justify-between p-3 border rounded-md"
                      >
                        <div>
                          <p className="text-sm font-medium">
                            {format(new Date(bill.period_start), 'MMM/yyyy')}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {bill.total_gb?.toFixed(4)} GB × ${bill.price_per_gb}/GB
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold">${bill.total_cost?.toFixed(2)}</p>
                          <p className="text-xs text-muted-foreground capitalize">{bill.status}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

