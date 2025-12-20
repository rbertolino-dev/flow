import { useState } from "react";
import { CRMLayout } from "@/components/crm/CRMLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useGoogleBusinessPosts } from "@/hooks/useGoogleBusinessPosts";
import { useGoogleBusinessConfigs } from "@/hooks/useGoogleBusinessConfigs";
import { GoogleBusinessIntegrationPanel } from "@/components/crm/GoogleBusinessIntegrationPanel";
import { CreateGoogleBusinessPostDialog } from "@/components/crm/CreateGoogleBusinessPostDialog";
import { 
  Store, 
  Plus, 
  Calendar, 
  CheckCircle2, 
  Clock, 
  XCircle, 
  Trash2, 
  Loader2,
  Settings,
  BarChart3,
  Filter
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function GoogleBusinessPosts() {
  const [activeTab, setActiveTab] = useState("posts");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [configFilter, setConfigFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");

  const { posts, isLoading, deletePost, cancelPost } = useGoogleBusinessPosts({
    status: statusFilter || undefined,
    post_type: typeFilter || undefined,
    config_id: configFilter || undefined,
  });
  const { configs } = useGoogleBusinessConfigs();

  const filteredPosts = posts.filter(post => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      post.summary.toLowerCase().includes(query) ||
      post.description?.toLowerCase().includes(query) ||
      post.google_business_config_id.toLowerCase().includes(query)
    );
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'published':
        return <Badge className="bg-green-500"><CheckCircle2 className="h-3 w-3 mr-1" />Publicada</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-500"><Clock className="h-3 w-3 mr-1" />Agendada</Badge>;
      case 'failed':
        return <Badge className="bg-red-500"><XCircle className="h-3 w-3 mr-1" />Falhou</Badge>;
      case 'cancelled':
        return <Badge variant="secondary">Cancelada</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'UPDATE': return 'Atualização';
      case 'EVENT': return 'Evento';
      case 'OFFER': return 'Oferta';
      case 'PRODUCT': return 'Produto';
      default: return type;
    }
  };

  const getConfigName = (configId: string) => {
    const config = configs.find(c => c.id === configId);
    return config ? `${config.account_name}${config.location_name ? ` - ${config.location_name}` : ''}` : configId;
  };

  // Estatísticas
  const stats = {
    total: posts.length,
    published: posts.filter(p => p.status === 'published').length,
    pending: posts.filter(p => p.status === 'pending').length,
    failed: posts.filter(p => p.status === 'failed').length,
  };

  const handleDelete = (postId: string) => {
    if (confirm("Tem certeza que deseja remover esta postagem?")) {
      deletePost(postId);
    }
  };

  const handleCancel = (postId: string) => {
    if (confirm("Tem certeza que deseja cancelar esta postagem agendada?")) {
      cancelPost(postId);
    }
  };

  return (
    <CRMLayout activeView="crm" onViewChange={() => {}}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Store className="h-8 w-8" />
              Google Meu Negócio
            </h1>
            <p className="text-muted-foreground mt-1">
              Gerencie e agende postagens no Google Meu Negócio
            </p>
          </div>
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Postagem
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="posts">
              <Calendar className="h-4 w-4 mr-2" />
              Postagens
            </TabsTrigger>
            <TabsTrigger value="settings">
              <Settings className="h-4 w-4 mr-2" />
              Configurações
            </TabsTrigger>
            <TabsTrigger value="reports">
              <BarChart3 className="h-4 w-4 mr-2" />
              Relatórios
            </TabsTrigger>
          </TabsList>

          <TabsContent value="posts" className="space-y-4">
            {/* Filtros */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Filter className="h-4 w-4" />
                  Filtros
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Buscar</label>
                    <Input
                      placeholder="Buscar por título ou descrição..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Status</label>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger>
                        <SelectValue placeholder="Todos" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all-status">Todos</SelectItem>
                        <SelectItem value="pending">Agendadas</SelectItem>
                        <SelectItem value="published">Publicadas</SelectItem>
                        <SelectItem value="failed">Falhas</SelectItem>
                        <SelectItem value="cancelled">Canceladas</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Tipo</label>
                    <Select value={typeFilter} onValueChange={setTypeFilter}>
                      <SelectTrigger>
                        <SelectValue placeholder="Todos" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all-visibility">Todos</SelectItem>
                        <SelectItem value="UPDATE">Atualização</SelectItem>
                        <SelectItem value="EVENT">Evento</SelectItem>
                        <SelectItem value="OFFER">Oferta</SelectItem>
                        <SelectItem value="PRODUCT">Produto</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Conta</label>
                    <Select value={configFilter} onValueChange={setConfigFilter}>
                      <SelectTrigger>
                        <SelectValue placeholder="Todas" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all-categories">Todas</SelectItem>
                        {configs.map((config) => (
                          <SelectItem key={config.id} value={config.id}>
                            {config.account_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Lista de Postagens */}
            {isLoading ? (
              <Card>
                <CardContent className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </CardContent>
              </Card>
            ) : filteredPosts.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Store className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Nenhuma postagem encontrada</p>
                  <Button className="mt-4" onClick={() => setCreateDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Criar Primeira Postagem
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {filteredPosts.map((post) => (
                  <Card key={post.id}>
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-lg">{post.summary}</h3>
                            {getStatusBadge(post.status)}
                            <Badge variant="outline">{getTypeLabel(post.post_type)}</Badge>
                          </div>
                          {post.description && (
                            <p className="text-sm text-muted-foreground">{post.description}</p>
                          )}
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span>Conta: {getConfigName(post.google_business_config_id)}</span>
                            {post.status === 'pending' && (
                              <span>
                                Agendada para: {format(new Date(post.scheduled_for), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                              </span>
                            )}
                            {post.status === 'published' && post.published_at && (
                              <span>
                                Publicada em: {format(new Date(post.published_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                              </span>
                            )}
                            {post.status === 'failed' && post.error_message && (
                              <span className="text-red-500">Erro: {post.error_message.substring(0, 100)}</span>
                            )}
                          </div>
                          {post.media_urls && post.media_urls.length > 0 && (
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span>{post.media_urls.length} imagem(ns)</span>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {post.status === 'pending' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleCancel(post.id)}
                            >
                              Cancelar
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDelete(post.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="settings">
            <GoogleBusinessIntegrationPanel />
          </TabsContent>

          <TabsContent value="reports">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Total</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.total}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Publicadas</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-500">{stats.published}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Agendadas</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-yellow-500">{stats.pending}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Falhas</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-500">{stats.failed}</div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        <CreateGoogleBusinessPostDialog
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
        />
      </div>
    </CRMLayout>
  );
}

