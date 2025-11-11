import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, DollarSign, Activity, Database, Users } from "lucide-react";
import { OrganizationCostBreakdown } from "./OrganizationCostBreakdown";
import { FunctionalityCostBreakdown } from "./FunctionalityCostBreakdown";
import { CloudCostConfiguration } from "./CloudCostConfiguration";
import { DailyCostChart } from "./DailyCostChart";
import { OrganizationCostComparison } from "./OrganizationCostComparison";
import { CostAlertsPanel } from "./CostAlertsPanel";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface UsageMetrics {
  totalOrganizations: number;
  totalUsers: number;
  totalLeads: number;
  totalMessages: number;
  totalBroadcasts: number;
  totalScheduledMessages: number;
  totalEdgeFunctionCalls: number;
  // Detalhamento de mensagens
  incomingMessages: number;
  broadcastMessages: number;
  scheduledMessagesSent: number;
}

export function CostsDashboard() {
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isPubdigital, setIsPubdigital] = useState(false);
  const [metrics, setMetrics] = useState<UsageMetrics | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    checkPermissions();
  }, []);

  const checkPermissions = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      // Check admin role
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .maybeSingle();

      const adminStatus = !!roleData;
      setIsAdmin(adminStatus);

      // Check pubdigital
      const { data: pubdigData } = await supabase.rpc('is_pubdigital_user', { 
        _user_id: user.id 
      });
      
      const pubdigStatus = !!pubdigData;
      setIsPubdigital(pubdigStatus);

      if (adminStatus || pubdigStatus) {
        await fetchMetrics();
      }
    } catch (error) {
      console.error('Error checking permissions:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMetrics = async () => {
    try {
      // Fetch all metrics in parallel
      const [
        { count: orgCount },
        { count: userCount },
        { count: leadCount },
        { count: messageCount },
        { count: broadcastCount },
        { count: scheduledCount },
        // Detalhamento de mensagens
        { count: incomingCount },
        { count: broadcastSentCount },
        { count: scheduledSentCount }
      ] = await Promise.all([
        supabase.from('organizations').select('*', { count: 'exact', head: true }),
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('leads').select('*', { count: 'exact', head: true }).is('deleted_at', null),
        supabase.from('whatsapp_messages').select('*', { count: 'exact', head: true }),
        supabase.from('broadcast_campaigns').select('*', { count: 'exact', head: true }),
        supabase.from('scheduled_messages').select('*', { count: 'exact', head: true }),
        // Mensagens recebidas via webhook
        supabase.from('whatsapp_messages').select('*', { count: 'exact', head: true }).eq('direction', 'incoming'),
        // Mensagens enviadas por disparos em massa
        supabase.from('broadcast_queue').select('*', { count: 'exact', head: true }).eq('status', 'sent'),
        // Mensagens agendadas que foram enviadas
        supabase.from('scheduled_messages').select('*', { count: 'exact', head: true }).eq('status', 'sent')
      ]);

      setMetrics({
        totalOrganizations: orgCount || 0,
        totalUsers: userCount || 0,
        totalLeads: leadCount || 0,
        totalMessages: messageCount || 0,
        totalBroadcasts: broadcastCount || 0,
        totalScheduledMessages: scheduledCount || 0,
        totalEdgeFunctionCalls: 0, // Will be calculated from logs
        // Detalhamento
        incomingMessages: incomingCount || 0,
        broadcastMessages: broadcastSentCount || 0,
        scheduledMessagesSent: scheduledSentCount || 0
      });
    } catch (error) {
      console.error('Error fetching metrics:', error);
      toast({
        title: "Erro ao carregar métricas",
        description: "Não foi possível carregar as métricas de uso.",
        variant: "destructive"
      });
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin && !isPubdigital) {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="text-destructive">Acesso Negado</CardTitle>
            <CardDescription>
              Você precisa ser um super administrador para acessar este painel.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto p-4 lg:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Painel de Custos</h1>
          <p className="text-muted-foreground">
            Monitore os gastos e uso do Lovable Cloud por organização e funcionalidade
          </p>
        </div>
        <Button onClick={fetchMetrics} variant="outline">
          <Activity className="mr-2 h-4 w-4" />
          Atualizar
        </Button>
      </div>

      {/* Daily Cost Chart */}
      <DailyCostChart />

      {/* Cost Alerts */}
      <CostAlertsPanel />

      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Organizações</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.totalOrganizations || 0}</div>
            <p className="text-xs text-muted-foreground">Total de organizações ativas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Usuários</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.totalUsers || 0}</div>
            <p className="text-xs text-muted-foreground">Total de usuários cadastrados</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Leads</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.totalLeads || 0}</div>
            <p className="text-xs text-muted-foreground">Total de leads ativos</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Mensagens</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.totalMessages || 0}</div>
            <p className="text-xs text-muted-foreground">Total de mensagens enviadas</p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Breakdown */}
      <Tabs defaultValue="organizations" className="space-y-4">
        <TabsList>
          <TabsTrigger value="organizations">Por Organização</TabsTrigger>
          <TabsTrigger value="functionalities">Por Funcionalidade</TabsTrigger>
          <TabsTrigger value="comparison">Comparação Mensal</TabsTrigger>
          <TabsTrigger value="configuration">Configurar Custos</TabsTrigger>
        </TabsList>

        <TabsContent value="organizations" className="space-y-4">
          <OrganizationCostBreakdown />
        </TabsContent>

        <TabsContent value="functionalities" className="space-y-4">
          <FunctionalityCostBreakdown metrics={metrics} />
        </TabsContent>

        <TabsContent value="comparison" className="space-y-4">
          <OrganizationCostComparison />
        </TabsContent>

        <TabsContent value="configuration" className="space-y-4">
          <CloudCostConfiguration />
        </TabsContent>
      </Tabs>
    </div>
  );
}
