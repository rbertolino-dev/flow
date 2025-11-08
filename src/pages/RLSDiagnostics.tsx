import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { getUserOrganizationId } from "@/lib/organizationUtils";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";

interface TestResult {
  name: string;
  status: 'success' | 'error' | 'pending';
  message: string;
  details?: any;
}

export default function RLSDiagnostics() {
  const [results, setResults] = useState<TestResult[]>([]);
  const [testing, setTesting] = useState(false);
  const { toast } = useToast();

  const runTests = async () => {
    setTesting(true);
    setResults([]);
    const testResults: TestResult[] = [];

    try {
      // Test 1: Verificar autenticação
      const { data: { session } } = await supabase.auth.getSession();
      testResults.push({
        name: "Autenticação",
        status: session ? 'success' : 'error',
        message: session ? `Usuário autenticado: ${session.user.email}` : 'Nenhum usuário autenticado',
        details: session?.user.id
      });

      if (!session) {
        setResults(testResults);
        setTesting(false);
        return;
      }

      // Test 2: Verificar organização
      const orgId = await getUserOrganizationId();
      testResults.push({
        name: "Organização",
        status: orgId ? 'success' : 'error',
        message: orgId ? `Organização encontrada: ${orgId}` : 'Nenhuma organização encontrada',
        details: orgId
      });

      if (!orgId) {
        setResults(testResults);
        setTesting(false);
        return;
      }

      // Test 3: Listar leads (SELECT)
      const { data: leads, error: leadsError } = await supabase
        .from('leads')
        .select('*')
        .eq('organization_id', orgId)
        .is('deleted_at', null)
        .limit(5);

      testResults.push({
        name: "SELECT Leads",
        status: leadsError ? 'error' : 'success',
        message: leadsError 
          ? `Erro: ${leadsError.message}` 
          : `${leads?.length || 0} leads encontrados`,
        details: leadsError || leads
      });

      // Test 4: Verificar pipeline stages
      const { data: stages, error: stagesError } = await supabase
        .from('pipeline_stages')
        .select('*')
        .eq('organization_id', orgId)
        .order('position');

      testResults.push({
        name: "SELECT Pipeline Stages",
        status: stagesError ? 'error' : 'success',
        message: stagesError 
          ? `Erro: ${stagesError.message}` 
          : `${stages?.length || 0} etapas encontradas`,
        details: stagesError || stages
      });

      // Test 5: Tentar UPDATE em um lead existente (se houver)
      if (leads && leads.length > 0) {
        const testLead = leads[0];
        const newStageId = stages?.[1]?.id || stages?.[0]?.id;
        
        if (newStageId) {
          const { error: updateError } = await supabase
            .from('leads')
            .update({ 
              stage_id: newStageId,
              last_contact: new Date().toISOString()
            })
            .eq('id', testLead.id);

          testResults.push({
            name: "UPDATE Lead (mudar etapa)",
            status: updateError ? 'error' : 'success',
            message: updateError 
              ? `Erro: ${updateError.message}` 
              : `Lead ${testLead.name} atualizado com sucesso`,
            details: updateError || { leadId: testLead.id, newStageId }
          });
        }
      }

      // Test 6: Tentar INSERT em activities
      if (leads && leads.length > 0) {
        const testLead = leads[0];
        const { error: activityError } = await supabase
          .from('activities')
          .insert({
            lead_id: testLead.id,
            organization_id: orgId,
            type: 'note',
            content: 'Teste de diagnóstico RLS',
            user_name: session.user.email || 'Sistema'
          });

        testResults.push({
          name: "INSERT Activity",
          status: activityError ? 'error' : 'success',
          message: activityError 
            ? `Erro: ${activityError.message}` 
            : 'Atividade criada com sucesso',
          details: activityError || { leadId: testLead.id }
        });
      }

      // Test 7: Listar atividades recentes
      if (leads && leads.length > 0) {
        const { data: activities, error: activitiesError } = await supabase
          .from('activities')
          .select('*')
          .eq('lead_id', leads[0].id)
          .order('created_at', { ascending: false })
          .limit(5);

        testResults.push({
          name: "SELECT Activities",
          status: activitiesError ? 'error' : 'success',
          message: activitiesError 
            ? `Erro: ${activitiesError.message}` 
            : `${activities?.length || 0} atividades encontradas`,
          details: activitiesError || activities
        });
      }

    } catch (error: any) {
      testResults.push({
        name: "Erro Geral",
        status: 'error',
        message: error.message,
        details: error
      });
    }

    setResults(testResults);
    setTesting(false);

    const failedTests = testResults.filter(t => t.status === 'error');
    if (failedTests.length === 0) {
      toast({
        title: "✅ Todos os testes passaram!",
        description: "As políticas RLS estão funcionando corretamente."
      });
    } else {
      toast({
        title: `⚠️ ${failedTests.length} teste(s) falharam`,
        description: "Verifique os detalhes abaixo.",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Diagnóstico RLS</h1>
          <p className="text-muted-foreground mt-2">
            Testes de integração para políticas de Row Level Security
          </p>
        </div>
        <Button 
          onClick={runTests} 
          disabled={testing}
          size="lg"
        >
          {testing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Executando Testes...
            </>
          ) : (
            'Executar Testes'
          )}
        </Button>
      </div>

      <div className="grid gap-4">
        {results.map((result, index) => (
          <Card key={index} className={
            result.status === 'success' ? 'border-green-500/50' : 
            result.status === 'error' ? 'border-destructive/50' : ''
          }>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    {result.status === 'success' && (
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    )}
                    {result.status === 'error' && (
                      <XCircle className="h-5 w-5 text-destructive" />
                    )}
                    {result.name}
                  </CardTitle>
                  <CardDescription className="mt-2">
                    {result.message}
                  </CardDescription>
                </div>
                <Badge variant={result.status === 'success' ? 'default' : 'destructive'}>
                  {result.status === 'success' ? 'PASSOU' : 'FALHOU'}
                </Badge>
              </div>
            </CardHeader>
            {result.details && (
              <CardContent>
                <details className="text-xs">
                  <summary className="cursor-pointer font-medium mb-2">
                    Ver detalhes
                  </summary>
                  <pre className="bg-muted p-4 rounded-md overflow-auto max-h-64">
                    {JSON.stringify(result.details, null, 2)}
                  </pre>
                </details>
              </CardContent>
            )}
          </Card>
        ))}
      </div>

      {results.length === 0 && !testing && (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <p className="text-muted-foreground">
              Clique em "Executar Testes" para começar o diagnóstico
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
