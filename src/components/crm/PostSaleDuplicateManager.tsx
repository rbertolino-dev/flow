import { useState, useEffect } from "react";
import { PostSaleLead } from "@/types/postSaleLead";
import { usePostSaleLeads } from "@/hooks/usePostSaleLeads";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Users, Merge, Trash2, CheckCircle2, XCircle, Search } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { getUserOrganizationId } from "@/lib/organizationUtils";

interface DuplicateGroup {
  key: string;
  leads: PostSaleLead[];
  matchType: 'phone' | 'email' | 'name_company';
}

export function PostSaleDuplicateManager() {
  const [duplicates, setDuplicates] = useState<DuplicateGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [merging, setMerging] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<DuplicateGroup | null>(null);
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);
  const { leads, refetch } = usePostSaleLeads();
  const { toast } = useToast();

  // Normalizar telefone para comparação
  const normalizePhone = (phone: string): string => {
    return phone.replace(/\D/g, '').replace(/^55/, '');
  };

  // Normalizar email para comparação
  const normalizeEmail = (email?: string): string => {
    if (!email) return '';
    return email.toLowerCase().trim();
  };

  // Buscar duplicados
  const findDuplicates = async () => {
    setLoading(true);
    try {
      const organizationId = await getUserOrganizationId();
      if (!organizationId) {
        toast({
          title: "Erro",
          description: "Organização não encontrada",
          variant: "destructive",
        });
        return;
      }

      // Buscar todos os leads da organização
      const { data: allLeads, error } = await supabase
        .from('post_sale_leads')
        .select('*')
        .eq('organization_id', organizationId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Agrupar por telefone
      const phoneGroups = new Map<string, PostSaleLead[]>();
      const emailGroups = new Map<string, PostSaleLead[]>();
      const nameCompanyGroups = new Map<string, PostSaleLead[]>();

      allLeads?.forEach((lead: any) => {
        const mappedLead: PostSaleLead = {
          id: lead.id,
          name: lead.name,
          phone: lead.phone,
          email: lead.email || undefined,
          company: lead.company || undefined,
          value: lead.value || undefined,
          status: lead.status || 'new',
          source: lead.source || 'manual',
          assignedTo: lead.assigned_to || 'Não atribuído',
          lastContact: lead.last_contact ? new Date(lead.last_contact) : new Date(),
          createdAt: new Date(lead.created_at),
          notes: lead.notes || undefined,
          stageId: lead.stage_id || undefined,
          originalLeadId: lead.original_lead_id || undefined,
          transferredAt: lead.transferred_at ? new Date(lead.transferred_at) : undefined,
          transferredBy: lead.transferred_by || undefined,
          activities: [],
          tags: [],
        };

        // Agrupar por telefone normalizado
        const normalizedPhone = normalizePhone(lead.phone);
        if (normalizedPhone.length >= 10) {
          if (!phoneGroups.has(normalizedPhone)) {
            phoneGroups.set(normalizedPhone, []);
          }
          phoneGroups.get(normalizedPhone)!.push(mappedLead);
        }

        // Agrupar por email
        if (lead.email) {
          const normalizedEmail = normalizeEmail(lead.email);
          if (normalizedEmail) {
            if (!emailGroups.has(normalizedEmail)) {
              emailGroups.set(normalizedEmail, []);
            }
            emailGroups.get(normalizedEmail)!.push(mappedLead);
          }
        }

        // Agrupar por nome + empresa
        if (lead.name && lead.company) {
          const key = `${lead.name.toLowerCase().trim()}_${lead.company.toLowerCase().trim()}`;
          if (!nameCompanyGroups.has(key)) {
            nameCompanyGroups.set(key, []);
          }
          nameCompanyGroups.get(key)!.push(mappedLead);
        }
      });

      // Filtrar apenas grupos com mais de 1 lead
      const duplicateGroups: DuplicateGroup[] = [];

      phoneGroups.forEach((groupLeads, phone) => {
        if (groupLeads.length > 1) {
          duplicateGroups.push({
            key: `phone_${phone}`,
            leads: groupLeads,
            matchType: 'phone',
          });
        }
      });

      emailGroups.forEach((groupLeads, email) => {
        if (groupLeads.length > 1) {
          // Evitar duplicar se já está no grupo de telefone
          const alreadyInPhoneGroup = duplicateGroups.some(g => 
            g.matchType === 'phone' && 
            g.leads.some(l => l.id === groupLeads[0].id)
          );
          if (!alreadyInPhoneGroup) {
            duplicateGroups.push({
              key: `email_${email}`,
              leads: groupLeads,
              matchType: 'email',
            });
          }
        }
      });

      nameCompanyGroups.forEach((groupLeads, key) => {
        if (groupLeads.length > 1) {
          // Evitar duplicar se já está em outro grupo
          const alreadyInGroup = duplicateGroups.some(g => 
            g.leads.some(l => l.id === groupLeads[0].id)
          );
          if (!alreadyInGroup) {
            duplicateGroups.push({
              key: `name_company_${key}`,
              leads: groupLeads,
              matchType: 'name_company',
            });
          }
        }
      });

      setDuplicates(duplicateGroups);
    } catch (error: any) {
      console.error('Erro ao buscar duplicados:', error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao buscar duplicados",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Mesclar leads
  const handleMerge = async () => {
    if (!selectedGroup || selectedLeads.size < 2) {
      toast({
        title: "Selecione pelo menos 2 leads",
        description: "É necessário selecionar pelo menos 2 leads para mesclar",
        variant: "destructive",
      });
      return;
    }

    setMerging(true);
    try {
      const leadsToMerge = selectedGroup.leads.filter(l => selectedLeads.has(l.id));
      if (leadsToMerge.length < 2) {
        toast({
          title: "Erro",
          description: "Selecione pelo menos 2 leads para mesclar",
          variant: "destructive",
        });
        return;
      }

      // Ordenar por data de criação (mais antigo primeiro)
      leadsToMerge.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      const mainLead = leadsToMerge[0];
      const leadsToDelete = leadsToMerge.slice(1);

      // Mesclar dados: manter o mais completo de cada campo
      const mergedData: any = {
        name: mainLead.name || leadsToDelete.find(l => l.name)?.name || '',
        phone: mainLead.phone || leadsToDelete.find(l => l.phone)?.phone || '',
        email: mainLead.email || leadsToDelete.find(l => l.email)?.email || null,
        company: mainLead.company || leadsToDelete.find(l => l.company)?.company || null,
        value: mainLead.value || leadsToDelete.find(l => l.value)?.value || null,
        notes: [mainLead.notes, ...leadsToDelete.map(l => l.notes)]
          .filter(Boolean)
          .join('\n\n---\n\n') || null,
        // Manter o stage mais avançado (ou o do lead principal)
        stageId: mainLead.stageId || leadsToDelete.find(l => l.stageId)?.stageId || null,
        // Manter o último contato mais recente
        lastContact: [...leadsToMerge].sort((a, b) => 
          b.lastContact.getTime() - a.lastContact.getTime()
        )[0].lastContact.toISOString(),
      };

      // Atualizar lead principal com dados mesclados
      const { error: updateError } = await supabase
        .from('post_sale_leads')
        .update(mergedData)
        .eq('id', mainLead.id);

      if (updateError) throw updateError;

      // Mover atividades dos leads deletados para o lead principal
      for (const leadToDelete of leadsToDelete) {
        // Buscar atividades do lead a ser deletado
        const { data: activities } = await supabase
          .from('post_sale_activities')
          .select('*')
          .eq('post_sale_lead_id', leadToDelete.id);

        if (activities && activities.length > 0) {
          // Atualizar atividades para apontar para o lead principal
          await supabase
            .from('post_sale_activities')
            .update({ post_sale_lead_id: mainLead.id })
            .eq('post_sale_lead_id', leadToDelete.id);
        }

        // Mover tags
        const { data: tags } = await supabase
          .from('post_sale_lead_tags')
          .select('tag_id')
          .eq('post_sale_lead_id', leadToDelete.id);

        if (tags && tags.length > 0) {
          for (const tag of tags) {
            // Verificar se tag já existe no lead principal
            const { data: existingTag } = await supabase
              .from('post_sale_lead_tags')
              .select('id')
              .eq('post_sale_lead_id', mainLead.id)
              .eq('tag_id', tag.tag_id)
              .maybeSingle();

            if (!existingTag) {
              // Mover tag
              await supabase
                .from('post_sale_lead_tags')
                .update({ post_sale_lead_id: mainLead.id })
                .eq('post_sale_lead_id', leadToDelete.id)
                .eq('tag_id', tag.tag_id)
                .limit(1);
            } else {
              // Remover tag duplicada
              await supabase
                .from('post_sale_lead_tags')
                .delete()
                .eq('post_sale_lead_id', leadToDelete.id)
                .eq('tag_id', tag.tag_id);
            }
          }
        }

        // Deletar lead (soft delete)
        await supabase
          .from('post_sale_leads')
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', leadToDelete.id);
      }

      toast({
        title: "Leads mesclados",
        description: `${leadsToDelete.length} lead(s) mesclado(s) com sucesso`,
      });

      setMergeDialogOpen(false);
      setSelectedGroup(null);
      setSelectedLeads(new Set());
      await refetch();
      await findDuplicates();
    } catch (error: any) {
      console.error('Erro ao mesclar leads:', error);
      toast({
        title: "Erro ao mesclar",
        description: error.message || "Erro ao mesclar leads",
        variant: "destructive",
      });
    } finally {
      setMerging(false);
    }
  };

  // Excluir leads selecionados
  const handleDeleteSelected = async () => {
    if (!selectedGroup || selectedLeads.size === 0) {
      toast({
        title: "Selecione leads",
        description: "Selecione pelo menos 1 lead para excluir",
        variant: "destructive",
      });
      return;
    }

    const leadsToDelete = selectedGroup.leads.filter(l => selectedLeads.has(l.id));
    
    setMerging(true);
    try {
      for (const lead of leadsToDelete) {
        await supabase
          .from('post_sale_leads')
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', lead.id);
      }

      toast({
        title: "Leads excluídos",
        description: `${leadsToDelete.length} lead(s) excluído(s) com sucesso`,
      });

      setMergeDialogOpen(false);
      setSelectedGroup(null);
      setSelectedLeads(new Set());
      await refetch();
      await findDuplicates();
    } catch (error: any) {
      console.error('Erro ao excluir leads:', error);
      toast({
        title: "Erro ao excluir",
        description: error.message || "Erro ao excluir leads",
        variant: "destructive",
      });
    } finally {
      setMerging(false);
    }
  };

  useEffect(() => {
    findDuplicates();
  }, []);

  const getMatchTypeLabel = (type: string) => {
    switch (type) {
      case 'phone':
        return 'Telefone';
      case 'email':
        return 'Email';
      case 'name_company':
        return 'Nome + Empresa';
      default:
        return type;
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Gerenciar Duplicados</CardTitle>
              <CardDescription>
                Encontre e resolva clientes duplicados no pós-venda
              </CardDescription>
            </div>
            <Button onClick={findDuplicates} disabled={loading} variant="outline">
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Buscando...
                </>
              ) : (
                <>
                  <Search className="h-4 w-4 mr-2" />
                  Buscar Duplicados
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : duplicates.length === 0 ? (
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>
                Nenhum duplicado encontrado. Todos os clientes são únicos.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-4">
              <Alert>
                <Users className="h-4 w-4" />
                <AlertDescription>
                  Encontrados {duplicates.length} grupo(s) de duplicados com {duplicates.reduce((sum, g) => sum + g.leads.length, 0)} cliente(s) no total.
                </AlertDescription>
              </Alert>

              {duplicates.map((group) => (
                <Card key={group.key} className="border-l-4 border-l-yellow-500">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">
                          {getMatchTypeLabel(group.matchType)}
                        </Badge>
                        <span className="text-sm font-medium">
                          {group.leads.length} cliente(s) duplicado(s)
                        </span>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedGroup(group);
                          setSelectedLeads(new Set(group.leads.map(l => l.id)));
                          setMergeDialogOpen(true);
                        }}
                      >
                        <Merge className="h-4 w-4 mr-2" />
                        Gerenciar
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {group.leads.slice(0, 3).map((lead) => (
                        <div key={lead.id} className="flex items-center gap-2 p-2 bg-muted/50 rounded">
                          <div className="flex-1">
                            <div className="font-medium">{lead.name}</div>
                            <div className="text-sm text-muted-foreground">
                              {lead.company || '[Sem empresa]'} • {lead.phone}
                              {lead.email && ` • ${lead.email}`}
                            </div>
                          </div>
                          <Badge variant="secondary" className="text-xs">
                            {lead.stageId ? 'Com etapa' : 'Sem etapa'}
                          </Badge>
                        </div>
                      ))}
                      {group.leads.length > 3 && (
                        <div className="text-sm text-muted-foreground text-center py-2">
                          +{group.leads.length - 3} mais...
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog de Mesclar/Excluir */}
      <Dialog open={mergeDialogOpen} onOpenChange={setMergeDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Gerenciar Duplicados</DialogTitle>
            <DialogDescription>
              Selecione os leads que deseja mesclar ou excluir. O primeiro lead selecionado será mantido.
            </DialogDescription>
          </DialogHeader>

          {selectedGroup && (
            <div className="space-y-4">
              <div className="space-y-2">
                {selectedGroup.leads.map((lead, index) => (
                  <div
                    key={lead.id}
                    className="flex items-start gap-3 p-3 border rounded-lg"
                  >
                    <Checkbox
                      checked={selectedLeads.has(lead.id)}
                      onCheckedChange={(checked) => {
                        const newSelected = new Set(selectedLeads);
                        if (checked) {
                          newSelected.add(lead.id);
                        } else {
                          newSelected.delete(lead.id);
                        }
                        setSelectedLeads(newSelected);
                      }}
                    />
                    <div className="flex-1">
                      <div className="font-medium">{lead.name}</div>
                      <div className="text-sm text-muted-foreground space-y-1">
                        <div>Empresa: {lead.company || '[Sem empresa]'}</div>
                        <div>Telefone: {lead.phone}</div>
                        {lead.email && <div>Email: {lead.email}</div>}
                        <div>Valor: {lead.value ? `R$ ${lead.value.toFixed(2)}` : '[Sem valor]'}</div>
                        <div>Etapa: {lead.stageId ? 'Com etapa' : 'Sem etapa'}</div>
                        <div>Criado em: {lead.createdAt.toLocaleDateString('pt-BR')}</div>
                        {lead.notes && (
                          <div className="mt-2 p-2 bg-muted rounded text-xs">
                            {lead.notes}
                          </div>
                        )}
                      </div>
                    </div>
                    {index === 0 && (
                      <Badge variant="default" className="text-xs">
                        Principal
                      </Badge>
                    )}
                  </div>
                ))}
              </div>

              <Alert>
                <AlertDescription>
                  <strong>Mesclar:</strong> Os dados dos leads selecionados serão combinados no primeiro lead (principal). Os outros serão excluídos.
                  <br />
                  <strong>Excluir:</strong> Os leads selecionados serão excluídos permanentemente.
                </AlertDescription>
              </Alert>
            </div>
          )}

          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setMergeDialogOpen(false);
                setSelectedGroup(null);
                setSelectedLeads(new Set());
              }}
              disabled={merging}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteSelected}
              disabled={merging || selectedLeads.size === 0}
            >
              {merging ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Excluindo...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Excluir Selecionados ({selectedLeads.size})
                </>
              )}
            </Button>
            <Button
              onClick={handleMerge}
              disabled={merging || selectedLeads.size < 2}
            >
              {merging ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Mesclando...
                </>
              ) : (
                <>
                  <Merge className="h-4 w-4 mr-2" />
                  Mesclar Selecionados ({selectedLeads.size})
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

