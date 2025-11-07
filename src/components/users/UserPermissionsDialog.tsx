import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Settings2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

interface UserPermissionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userName: string;
}

interface Permission {
  value: string;
  label: string;
  description: string;
  category: string;
}

const PERMISSIONS: Permission[] = [
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

const CATEGORIES = Array.from(new Set(PERMISSIONS.map(p => p.category)));

export function UserPermissionsDialog({ open, onOpenChange, userId, userName }: UserPermissionsDialogProps) {
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      fetchUserPermissions();
    }
  }, [open, userId]);

  const fetchUserPermissions = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('user_permissions')
        .select('permission')
        .eq('user_id', userId);

      if (error) throw error;

      setSelectedPermissions(data.map(p => p.permission));
    } catch (error: any) {
      console.error('Error fetching permissions:', error);
      toast({
        title: "Erro ao carregar permissões",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTogglePermission = (permission: string) => {
    setSelectedPermissions(prev => 
      prev.includes(permission)
        ? prev.filter(p => p !== permission)
        : [...prev, permission]
    );
  };

  const handleSelectAll = (category: string) => {
    const categoryPermissions = PERMISSIONS
      .filter(p => p.category === category)
      .map(p => p.value);
    
    const allSelected = categoryPermissions.every(p => selectedPermissions.includes(p));
    
    if (allSelected) {
      setSelectedPermissions(prev => prev.filter(p => !categoryPermissions.includes(p)));
    } else {
      setSelectedPermissions(prev => {
        const newPerms = [...prev];
        categoryPermissions.forEach(p => {
          if (!newPerms.includes(p)) {
            newPerms.push(p);
          }
        });
        return newPerms;
      });
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      // Primeiro, remover todas as permissões existentes
      const { error: deleteError } = await supabase
        .from('user_permissions')
        .delete()
        .eq('user_id', userId);

      if (deleteError) throw deleteError;

      // Depois, inserir as novas permissões selecionadas
      if (selectedPermissions.length > 0) {
        const { error: insertError } = await supabase
          .from('user_permissions')
          .insert(
            selectedPermissions.map(permission => ({
              user_id: userId,
              permission: permission as any,
            }))
          );

        if (insertError) throw insertError;
      }

      toast({
        title: "Permissões atualizadas",
        description: `As permissões de ${userName} foram atualizadas com sucesso`,
      });

      onOpenChange(false);
    } catch (error: any) {
      console.error('Error saving permissions:', error);
      toast({
        title: "Erro ao salvar permissões",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            Gerenciar Permissões - {userName}
          </DialogTitle>
          <DialogDescription>
            Selecione as funcionalidades que este usuário pode acessar
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-6">
              {CATEGORIES.map(category => {
                const categoryPerms = PERMISSIONS.filter(p => p.category === category);
                const allSelected = categoryPerms.every(p => selectedPermissions.includes(p.value));
                
                return (
                  <div key={category} className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-foreground">{category}</h3>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSelectAll(category)}
                        className="h-7 text-xs"
                      >
                        {allSelected ? 'Desmarcar Todos' : 'Marcar Todos'}
                      </Button>
                    </div>
                    
                    <div className="space-y-2 pl-1">
                      {categoryPerms.map(permission => (
                        <div key={permission.value} className="flex items-start space-x-3">
                          <Checkbox
                            id={permission.value}
                            checked={selectedPermissions.includes(permission.value)}
                            onCheckedChange={() => handleTogglePermission(permission.value)}
                          />
                          <div className="flex-1">
                            <Label
                              htmlFor={permission.value}
                              className="text-sm font-medium cursor-pointer"
                            >
                              {permission.label}
                            </Label>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {permission.description}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    {category !== CATEGORIES[CATEGORIES.length - 1] && (
                      <Separator className="mt-4" />
                    )}
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving || loading}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Salvar Permissões
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
