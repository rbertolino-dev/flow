import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save, Users, Shield, CheckCircle2, Package } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Member {
  user_id: string;
  role: string;
  created_at: string;
  profiles: {
    email: string;
    full_name: string | null;
  };
  user_roles: Array<{
    role: string;
  }>;
}

interface Permission {
  value: string;
  label: string;
  description: string;
  category: string;
}

interface OrganizationPermissionsPanelProps {
  organizationId: string;
  organizationName: string;
  members: Member[];
  onUpdate?: () => void;
}

const ALL_PERMISSIONS: Permission[] = [
  // Leads
  { value: 'view_leads', label: 'Visualizar Leads', description: 'Ver lista de leads', category: 'Leads' },
  { value: 'create_leads', label: 'Criar Leads', description: 'Adicionar novos leads', category: 'Leads' },
  { value: 'edit_leads', label: 'Editar Leads', description: 'Modificar informações dos leads', category: 'Leads' },
  { value: 'delete_leads', label: 'Excluir Leads', description: 'Remover leads do sistema', category: 'Leads' },
  
  // Fila de Chamadas
  { value: 'view_call_queue', label: 'Visualizar Fila de Chamadas', description: 'Ver fila de ligações', category: 'Chamadas' },
  { value: 'manage_call_queue', label: 'Gerenciar Fila de Chamadas', description: 'Adicionar e editar chamadas', category: 'Chamadas' },
  
  // Disparos
  { value: 'view_broadcast', label: 'Visualizar Disparos', description: 'Ver campanhas de disparo', category: 'Disparos' },
  { value: 'create_broadcast', label: 'Criar Disparos', description: 'Criar novas campanhas', category: 'Disparos' },
  
  // WhatsApp
  { value: 'view_whatsapp', label: 'Visualizar WhatsApp', description: 'Ver conversas do WhatsApp', category: 'WhatsApp' },
  { value: 'send_whatsapp', label: 'Enviar WhatsApp', description: 'Enviar mensagens pelo WhatsApp', category: 'WhatsApp' },
  
  // Templates
  { value: 'view_templates', label: 'Visualizar Templates', description: 'Ver templates de mensagens', category: 'Templates' },
  { value: 'manage_templates', label: 'Gerenciar Templates', description: 'Criar e editar templates', category: 'Templates' },
  
  // Pipeline
  { value: 'view_pipeline', label: 'Visualizar Pipeline', description: 'Ver funil de vendas', category: 'Pipeline' },
  { value: 'manage_pipeline', label: 'Gerenciar Pipeline', description: 'Editar estágios do funil', category: 'Pipeline' },
  
  // Configurações
  { value: 'view_settings', label: 'Visualizar Configurações', description: 'Ver configurações do sistema', category: 'Configurações' },
  { value: 'manage_settings', label: 'Gerenciar Configurações', description: 'Alterar configurações', category: 'Configurações' },
  
  // Usuários
  { value: 'manage_users', label: 'Gerenciar Usuários', description: 'Criar e editar usuários', category: 'Usuários' },
  
  // Relatórios
  { value: 'view_reports', label: 'Visualizar Relatórios', description: 'Ver relatórios e estatísticas', category: 'Relatórios' },
];

const CATEGORIES = Array.from(new Set(ALL_PERMISSIONS.map(p => p.category)));

export function OrganizationPermissionsPanel({
  organizationId,
  organizationName,
  members,
  onUpdate
}: OrganizationPermissionsPanelProps) {
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [userPermissions, setUserPermissions] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (selectedUser && organizationId) {
      fetchUserPermissions(selectedUser);
    }
  }, [selectedUser, organizationId]);

  const fetchUserPermissions = async (userId: string) => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('user_permissions')
        .select('permission')
        .eq('user_id', userId)
        .eq('organization_id', organizationId);

      if (error) throw error;

      setUserPermissions(prev => ({
        ...prev,
        [userId]: data.map(p => p.permission),
      }));
    } catch (error: any) {
      console.error('Erro ao buscar permissões do usuário:', error);
      toast({
        title: "Erro ao carregar permissões",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTogglePermission = (userId: string, permission: string) => {
    setUserPermissions(prev => {
      const current = prev[userId] || [];
      const updated = current.includes(permission)
        ? current.filter(p => p !== permission)
        : [...current, permission];
      
      return {
        ...prev,
        [userId]: updated,
      };
    });
  };

  const handleSavePermissions = async (userId: string) => {
    if (!organizationId || !userId) {
      toast({
        title: "Erro",
        description: "Organização ou usuário não identificado",
        variant: "destructive",
      });
      return;
    }

    try {
      setSaving(true);

      const permissions = userPermissions[userId] || [];

      // Remover permissões existentes desta organização
      const { error: deleteError } = await supabase
        .from('user_permissions')
        .delete()
        .eq('user_id', userId)
        .eq('organization_id', organizationId);

      if (deleteError) throw deleteError;

      // Inserir novas permissões
      if (permissions.length > 0) {
        const { error: insertError } = await supabase
          .from('user_permissions')
          .insert(
            permissions.map(permission => ({
              user_id: userId,
              permission: permission as any,
              organization_id: organizationId,
            }))
          );

        if (insertError) throw insertError;
      }

      toast({
        title: "Sucesso!",
        description: "Permissões atualizadas com sucesso",
      });

      // Recarregar permissões do usuário
      await fetchUserPermissions(userId);

      if (onUpdate) {
        onUpdate();
      }
    } catch (error: any) {
      console.error('Erro ao salvar permissões:', error);
      toast({
        title: "Erro ao salvar",
        description: error.message || "Erro desconhecido ao salvar permissões",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const selectedMember = members.find(m => m.user_id === selectedUser);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <CardTitle>Gerenciar Permissões por Usuário</CardTitle>
          </div>
          <CardDescription>
            Configure as permissões de acesso para cada membro da organização
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Seletor de Usuário */}
          <div className="space-y-2">
            <Label>Selecione um usuário</Label>
            <Select value={selectedUser || ''} onValueChange={setSelectedUser}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um usuário para gerenciar permissões" />
              </SelectTrigger>
              <SelectContent>
                {members.map((member) => (
                  <SelectItem key={member.user_id} value={member.user_id}>
                    <div className="flex items-center gap-2">
                      <span>{member.profiles.full_name || member.profiles.email}</span>
                      <Badge variant="outline" className="text-xs">
                        {member.role}
                      </Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedUser && selectedMember && (
            <>
              <Separator />
              
              {/* Informações do Usuário Selecionado */}
              <div className="p-4 bg-muted/50 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">
                      {selectedMember.profiles.full_name || selectedMember.profiles.email}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {selectedMember.profiles.email}
                    </p>
                  </div>
                  <Badge variant={selectedMember.role === 'owner' ? 'default' : 'secondary'}>
                    {selectedMember.role}
                  </Badge>
                </div>
              </div>

              {/* Permissões */}
              <ScrollArea className="h-[500px] pr-4">
                <div className="space-y-6">
                  {CATEGORIES.map(category => {
                    const categoryPerms = ALL_PERMISSIONS.filter(p => p.category === category);
                    const userPerms = userPermissions[selectedUser] || [];
                    const allSelected = categoryPerms.every(p => userPerms.includes(p.value));

                    return (
                      <div key={category} className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-semibold">{category}</h3>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              if (allSelected) {
                                setUserPermissions(prev => ({
                                  ...prev,
                                  [selectedUser]: userPerms.filter(p => !categoryPerms.some(cp => cp.value === p)),
                                }));
                              } else {
                                setUserPermissions(prev => ({
                                  ...prev,
                                  [selectedUser]: [...new Set([...userPerms, ...categoryPerms.map(cp => cp.value)])],
                                }));
                              }
                            }}
                            className="h-7 text-xs"
                          >
                            {allSelected ? 'Desmarcar Todos' : 'Marcar Todos'}
                          </Button>
                        </div>

                        <div className="space-y-2 pl-1">
                          {categoryPerms.map(permission => {
                            const isSelected = userPerms.includes(permission.value);
                            return (
                              <div key={permission.value} className="flex items-start space-x-3">
                                <Checkbox
                                  id={`${selectedUser}-${permission.value}`}
                                  checked={isSelected}
                                  onCheckedChange={() => handleTogglePermission(selectedUser, permission.value)}
                                />
                                <div className="flex-1">
                                  <Label
                                    htmlFor={`${selectedUser}-${permission.value}`}
                                    className="text-sm font-medium cursor-pointer"
                                  >
                                    {permission.label}
                                  </Label>
                                  <p className="text-xs text-muted-foreground mt-0.5">
                                    {permission.description}
                                  </p>
                                </div>
                                {isSelected && (
                                  <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                                )}
                              </div>
                            );
                          })}
                        </div>

                        {category !== CATEGORIES[CATEGORIES.length - 1] && (
                          <Separator className="mt-4" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>

              {/* Botão Salvar */}
              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button
                  onClick={() => handleSavePermissions(selectedUser)}
                  disabled={saving}
                  className="min-w-[120px]"
                >
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Salvar Permissões
                    </>
                  )}
                </Button>
              </div>
            </>
          )}

          {!selectedUser && (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Selecione um usuário para gerenciar suas permissões</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
