import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save, Plus, Edit, Trash2, MessageSquare, CheckCircle2, XCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface EvolutionProvider {
  id: string;
  name: string;
  api_url: string;
  api_key: string;
  is_active: boolean;
  description: string | null;
  created_at: string;
  updated_at: string;
}

interface ProviderFormData {
  name: string;
  api_url: string;
  api_key: string;
  description: string;
  is_active: boolean;
}

export function EvolutionProvidersPanel() {
  const [providers, setProviders] = useState<EvolutionProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingProvider, setEditingProvider] = useState<EvolutionProvider | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [providerToDelete, setProviderToDelete] = useState<EvolutionProvider | null>(null);
  const [formData, setFormData] = useState<ProviderFormData>({
    name: '',
    api_url: '',
    api_key: '',
    description: '',
    is_active: true,
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchProviders();
  }, []);

  const fetchProviders = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('evolution_providers')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      setProviders(data || []);
    } catch (error: any) {
      console.error('Erro ao carregar providers:', error);
      toast({
        title: "Erro ao carregar providers",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (provider?: EvolutionProvider) => {
    if (provider) {
      setEditingProvider(provider);
      setFormData({
        name: provider.name,
        api_url: provider.api_url,
        api_key: provider.api_key,
        description: provider.description || '',
        is_active: provider.is_active,
      });
    } else {
      setEditingProvider(null);
      setFormData({
        name: '',
        api_url: '',
        api_key: '',
        description: '',
        is_active: true,
      });
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingProvider(null);
    setFormData({
      name: '',
      api_url: '',
      api_key: '',
      description: '',
      is_active: true,
    });
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      if (editingProvider) {
        // Atualizar
        const { error } = await supabase
          .from('evolution_providers')
          .update({
            name: formData.name,
            api_url: formData.api_url,
            api_key: formData.api_key,
            description: formData.description || null,
            is_active: formData.is_active,
          })
          .eq('id', editingProvider.id);

        if (error) throw error;

        toast({
          title: "Sucesso!",
          description: "Provider atualizado com sucesso",
        });
      } else {
        // Criar novo
        const { error } = await supabase
          .from('evolution_providers')
          .insert({
            name: formData.name,
            api_url: formData.api_url,
            api_key: formData.api_key,
            description: formData.description || null,
            is_active: formData.is_active,
            created_by: user.id,
          });

        if (error) throw error;

        toast({
          title: "Sucesso!",
          description: "Provider criado com sucesso",
        });
      }

      handleCloseDialog();
      await fetchProviders();
    } catch (error: any) {
      console.error('Erro ao salvar provider:', error);
      toast({
        title: "Erro ao salvar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteClick = (provider: EvolutionProvider) => {
    setProviderToDelete(provider);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!providerToDelete) return;

    try {
      const { error } = await supabase
        .from('evolution_providers')
        .delete()
        .eq('id', providerToDelete.id);

      if (error) throw error;

      toast({
        title: "Sucesso!",
        description: "Provider excluído com sucesso",
      });

      setDeleteDialogOpen(false);
      setProviderToDelete(null);
      await fetchProviders();
    } catch (error: any) {
      console.error('Erro ao excluir provider:', error);
      toast({
        title: "Erro ao excluir",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const toggleActive = async (provider: EvolutionProvider) => {
    try {
      const { error } = await supabase
        .from('evolution_providers')
        .update({ is_active: !provider.is_active })
        .eq('id', provider.id);

      if (error) throw error;

      toast({
        title: "Sucesso!",
        description: `Provider ${!provider.is_active ? 'ativado' : 'desativado'} com sucesso`,
      });

      await fetchProviders();
    } catch (error: any) {
      console.error('Erro ao alterar status:', error);
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <MessageSquare className="h-6 w-6" />
            Gerenciar Providers Evolution
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure os providers Evolution que estarão disponíveis para as organizações
          </p>
        </div>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Provider
        </Button>
      </div>

      {providers.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">Nenhum provider cadastrado</p>
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="h-4 w-4 mr-2" />
              Criar primeiro provider
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {providers.map((provider) => (
            <Card key={provider.id} className={provider.is_active ? '' : 'opacity-60'}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-lg">{provider.name}</CardTitle>
                      {provider.is_active ? (
                        <Badge variant="default" className="bg-green-600">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Ativo
                        </Badge>
                      ) : (
                        <Badge variant="secondary">
                          <XCircle className="h-3 w-3 mr-1" />
                          Inativo
                        </Badge>
                      )}
                    </div>
                    <CardDescription className="mt-2">
                      <div className="space-y-1">
                        <p className="font-mono text-xs break-all">{provider.api_url}</p>
                        {provider.description && (
                          <p className="text-sm">{provider.description}</p>
                        )}
                      </div>
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <Switch
                      checked={provider.is_active}
                      onCheckedChange={() => toggleActive(provider)}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenDialog(provider)}
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Editar
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDeleteClick(provider)}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Excluir
                    </Button>
                  </div>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog de criação/edição */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>
              {editingProvider ? 'Editar Provider' : 'Novo Provider Evolution'}
            </DialogTitle>
            <DialogDescription>
              {editingProvider
                ? 'Atualize as informações do provider Evolution'
                : 'Configure um novo provider Evolution que estará disponível para as organizações'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome do Provider *</Label>
              <Input
                id="name"
                placeholder="Ex: Evolution Principal, Evolution Backup"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="api_url">URL da API *</Label>
              <Input
                id="api_url"
                placeholder="https://api.evolution.com"
                value={formData.api_url}
                onChange={(e) => setFormData({ ...formData, api_url: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="api_key">API Key *</Label>
              <Input
                id="api_key"
                type="password"
                placeholder="Sua API Key"
                value={formData.api_key}
                onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descrição (opcional)</Label>
              <Textarea
                id="description"
                placeholder="Descrição do provider..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
              />
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
              <Label htmlFor="is_active" className="cursor-pointer">
                Provider ativo (disponível para organizações)
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving || !formData.name || !formData.api_url || !formData.api_key}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  {editingProvider ? 'Salvar' : 'Criar'}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de confirmação de exclusão */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Provider?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o provider <strong>{providerToDelete?.name}</strong>?
              Esta ação não pode ser desfeita. Organizações que usam este provider precisarão ter um novo provider atribuído.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}


