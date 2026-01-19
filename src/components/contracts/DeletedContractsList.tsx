import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useActiveOrganization } from '@/hooks/useActiveOrganization';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Trash2, User, Clock, FileText, Loader2, RotateCcw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface DeletedContract {
  id: string;
  contract_number: string;
  content: string;
  deleted_at: string;
  deleted_by: string;
  lead: {
    name: string;
    phone?: string;
  } | null;
  deleted_by_user: {
    email: string;
    full_name?: string;
  } | null;
}

export function DeletedContractsList() {
  const { activeOrgId } = useActiveOrganization();
  const { toast } = useToast();
  const [deletedContracts, setDeletedContracts] = useState<DeletedContract[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (activeOrgId) {
      fetchDeletedContracts();
    }
  }, [activeOrgId]);

  const fetchDeletedContracts = async () => {
    if (!activeOrgId) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('contracts')
        .select(`
          id,
          contract_number,
          content,
          deleted_at,
          deleted_by,
          lead:leads(id, name, phone)
        `)
        .eq('organization_id', activeOrgId)
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false })
        .limit(100);

      // Buscar informações dos usuários que excluíram separadamente
      if (data && data.length > 0) {
        const userIds = [...new Set(data.map(c => c.deleted_by).filter(Boolean))];
        const { data: users } = await supabase
          .from('profiles')
          .select('id, email, full_name')
          .in('id', userIds);

        // Combinar dados
        const contractsWithUsers = data.map(contract => ({
          ...contract,
          deleted_by_user: users?.find(u => u.id === contract.deleted_by) || null,
        }));

        setDeletedContracts(contractsWithUsers as DeletedContract[]);
      } else {
        setDeletedContracts([]);
      }

      if (error) throw error;
    } catch (error: any) {
      console.error('Erro ao buscar contratos excluídos:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao carregar histórico de exclusões',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const restoreContract = async (contractId: string) => {
    if (!activeOrgId) return;

    if (!confirm('Tem certeza que deseja recuperar este contrato?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('contracts')
        .update({
          deleted_at: null,
          deleted_by: null,
        })
        .eq('id', contractId)
        .eq('organization_id', activeOrgId);

      if (error) throw error;

      toast({
        title: 'Contrato recuperado',
        description: 'O contrato foi recuperado com sucesso.',
      });

      // Recarregar lista
      await fetchDeletedContracts();
    } catch (error: any) {
      console.error('Erro ao recuperar contrato:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao recuperar contrato',
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trash2 className="w-5 h-5" />
            Contratos Excluídos
          </CardTitle>
          <CardDescription>Carregando histórico...</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (deletedContracts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trash2 className="w-5 h-5" />
            Contratos Excluídos
          </CardTitle>
          <CardDescription>Nenhum contrato foi excluído ainda</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trash2 className="w-5 h-5" />
          Contratos Excluídos
        </CardTitle>
        <CardDescription>
          Histórico de {deletedContracts.length} contrato(s) excluído(s)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[500px]">
          <div className="space-y-4">
            {deletedContracts.map((contract) => (
              <div
                key={contract.id}
                className="border rounded-lg p-4 bg-red-50/50 hover:bg-red-50 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-muted-foreground" />
                      <span className="font-semibold">
                        Contrato {contract.contract_number || 'Sem número'}
                      </span>
                      <Badge variant="destructive" className="text-xs">
                        Excluído
                      </Badge>
                    </div>

                    {contract.lead && (
                      <div className="text-sm text-muted-foreground">
                        Cliente: <span className="font-medium">{contract.lead.name}</span>
                        {contract.lead.phone && (
                          <span className="ml-2">({contract.lead.phone})</span>
                        )}
                      </div>
                    )}

                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>
                          Excluído em:{' '}
                          {format(new Date(contract.deleted_at), "dd/MM/yyyy 'às' HH:mm", {
                            locale: ptBR,
                          })}
                        </span>
                      </div>

                      {contract.deleted_by_user && (
                        <div className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          <span>
                            Por:{' '}
                            {contract.deleted_by_user.full_name ||
                              contract.deleted_by_user.email ||
                              'Usuário desconhecido'}
                          </span>
                        </div>
                      )}
                    </div>

                    {contract.content && (
                      <div className="text-xs text-muted-foreground mt-2 line-clamp-2">
                        {contract.content.substring(0, 150)}
                        {contract.content.length > 150 && '...'}
                      </div>
                    )}
                  </div>
                  <div className="flex-shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => restoreContract(contract.id)}
                      className="gap-2"
                    >
                      <RotateCcw className="w-4 h-4" />
                      Recuperar
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

