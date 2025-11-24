import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, CheckCircle2, XCircle, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface DiagnosticResult {
  endpoint: string;
  method: string;
  status: number;
  statusText: string;
  available: boolean;
  errorMessage?: string;
  responsePreview?: string;
}

export const EvolutionApiDiagnostics = () => {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<DiagnosticResult[]>([]);
  const { toast } = useToast();

  const runDiagnostics = async () => {
    setLoading(true);
    setResults([]);

    try {
      // Buscar primeira instância Evolution
      const { data: configs } = await supabase
        .from('evolution_config')
        .select('*')
        .limit(1)
        .single();

      if (!configs) {
        toast({
          title: "Erro",
          description: "Nenhuma instância Evolution encontrada",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      const diagnosticTests: DiagnosticResult[] = [];

      // Teste 1: Endpoint de validação WhatsApp
      try {
        const whatsappCheckUrl = `${configs.api_url}/chat/whatsappNumbers/${configs.instance_name}`;
        const response = await fetch(whatsappCheckUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': configs.api_key,
          },
          body: JSON.stringify({
            numbers: ['5521999999999'] // número teste
          }),
        });

        const responseText = await response.text();
        
        diagnosticTests.push({
          endpoint: '/chat/whatsappNumbers',
          method: 'POST',
          status: response.status,
          statusText: response.statusText,
          available: response.ok,
          errorMessage: !response.ok ? responseText : undefined,
          responsePreview: responseText.substring(0, 200),
        });
      } catch (error: any) {
        diagnosticTests.push({
          endpoint: '/chat/whatsappNumbers',
          method: 'POST',
          status: 0,
          statusText: 'Network Error',
          available: false,
          errorMessage: error.message,
        });
      }

      // Teste 2: Status da instância
      try {
        const statusUrl = `${configs.api_url}/instance/connectionState/${configs.instance_name}`;
        const response = await fetch(statusUrl, {
          method: 'GET',
          headers: {
            'apikey': configs.api_key,
          },
        });

        const responseText = await response.text();
        
        diagnosticTests.push({
          endpoint: '/instance/connectionState',
          method: 'GET',
          status: response.status,
          statusText: response.statusText,
          available: response.ok,
          responsePreview: responseText.substring(0, 200),
        });
      } catch (error: any) {
        diagnosticTests.push({
          endpoint: '/instance/connectionState',
          method: 'GET',
          status: 0,
          statusText: 'Network Error',
          available: false,
          errorMessage: error.message,
        });
      }

      // Teste 3: Informações da instância
      try {
        const infoUrl = `${configs.api_url}/instance/fetchInstances?instanceName=${configs.instance_name}`;
        const response = await fetch(infoUrl, {
          method: 'GET',
          headers: {
            'apikey': configs.api_key,
          },
        });

        const responseText = await response.text();
        
        diagnosticTests.push({
          endpoint: '/instance/fetchInstances',
          method: 'GET',
          status: response.status,
          statusText: response.statusText,
          available: response.ok,
          responsePreview: responseText.substring(0, 200),
        });
      } catch (error: any) {
        diagnosticTests.push({
          endpoint: '/instance/fetchInstances',
          method: 'GET',
          status: 0,
          statusText: 'Network Error',
          available: false,
          errorMessage: error.message,
        });
      }

      setResults(diagnosticTests);

    } catch (error: any) {
      toast({
        title: "Erro ao executar diagnóstico",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Diagnóstico Evolution API</CardTitle>
        <CardDescription>
          Testa a disponibilidade dos endpoints da Evolution API
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button 
          onClick={runDiagnostics} 
          disabled={loading}
          className="w-full"
        >
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Executar Diagnóstico
        </Button>

        {results.length > 0 && (
          <div className="space-y-4">
            {results.map((result, index) => (
              <Alert key={index} variant={result.available ? "default" : "destructive"}>
                <div className="flex items-start gap-2">
                  {result.available ? (
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-500" />
                  )}
                  <div className="flex-1">
                    <div className="font-semibold">
                      {result.method} {result.endpoint}
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      Status: {result.status} {result.statusText}
                    </div>
                    {result.errorMessage && (
                      <AlertDescription className="mt-2">
                        <div className="font-semibold text-red-600">Erro:</div>
                        <pre className="text-xs mt-1 overflow-auto max-h-32 bg-muted p-2 rounded">
                          {result.errorMessage}
                        </pre>
                      </AlertDescription>
                    )}
                    {result.responsePreview && result.available && (
                      <AlertDescription className="mt-2">
                        <div className="font-semibold">Resposta:</div>
                        <pre className="text-xs mt-1 overflow-auto max-h-32 bg-muted p-2 rounded">
                          {result.responsePreview}
                        </pre>
                      </AlertDescription>
                    )}
                  </div>
                </div>
              </Alert>
            ))}

            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                <div className="font-semibold mb-2">Interpretação dos Resultados:</div>
                <ul className="text-sm space-y-1 list-disc list-inside">
                  <li><strong>Status 400 "Method not available"</strong>: O endpoint não está disponível neste tipo de canal Evolution (provavelmente WhatsApp Web/Baileys)</li>
                  <li><strong>Status 200</strong>: Endpoint funcional e disponível</li>
                  <li><strong>Status 401</strong>: Problema de autenticação (API key inválida)</li>
                  <li><strong>Status 404</strong>: Endpoint não existe nesta versão da Evolution API</li>
                </ul>
              </AlertDescription>
            </Alert>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
