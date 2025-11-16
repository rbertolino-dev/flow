import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, CheckCircle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function FixRecipientType() {
  const { toast } = useToast();
  const [isApplying, setIsApplying] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const applyFix = async () => {
    setIsApplying(true);
    setResult(null);

    try {
      // Verificar se a coluna já existe
      const { data: checkData, error: checkError } = await supabase
        .from("whatsapp_workflows")
        .select("recipient_type")
        .limit(1);

      // Se não der erro, a coluna já existe
      if (!checkError && checkData !== null) {
        setResult({
          success: true,
          message: "A coluna recipient_type já existe! Tudo está correto.",
        });
        setIsApplying(false);
        return;
      }

      // Se der erro de coluna não encontrada, aplicar correção
      // Como não podemos executar ALTER TABLE diretamente do frontend,
      // vamos usar uma abordagem diferente: verificar via query e orientar

      // Tentar inserir um valor temporário para testar
      const testQuery = await supabase
        .from("whatsapp_workflows")
        .select("id, recipient_mode")
        .limit(1);

      if (testQuery.error) {
        throw new Error("Erro ao acessar tabela: " + testQuery.error.message);
      }

      // Se chegou aqui, a tabela existe mas a coluna não
      // Vamos mostrar instruções
      setResult({
        success: false,
        message: "A coluna recipient_type não existe. É necessário aplicar a migração SQL. Veja as instruções abaixo.",
      });

      toast({
        title: "Migração necessária",
        description: "A coluna precisa ser criada via SQL. Veja o arquivo fix-recipient-type.sql",
        variant: "destructive",
      });

    } catch (error: any) {
      setResult({
        success: false,
        message: `Erro: ${error.message}`,
      });
      toast({
        title: "Erro ao verificar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-6 w-6 text-orange-500" />
            Correção: Coluna recipient_type
          </CardTitle>
          <CardDescription>
            Esta página ajuda a corrigir o erro de coluna faltante no banco de dados
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-sm text-yellow-800">
              <strong>⚠️ Aviso:</strong> Como você está usando Lovable Cloud integrado, 
              a melhor forma de aplicar esta correção é através do próprio Lovable.
            </p>
          </div>

          <div className="space-y-4">
            <h3 className="font-semibold">Opção 1: Via Lovable (Recomendado)</h3>
            <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
              <li>No Lovable, vá em <strong>Database</strong> ou <strong>Migrations</strong></li>
              <li>Procure pela migração: <code>20251117000000_fix_recipient_type_column.sql</code></li>
              <li>O Lovable deve aplicar automaticamente quando você fizer commit/push</li>
              <li>Ou execute manualmente se houver opção no painel do Lovable</li>
            </ol>
          </div>

          <div className="space-y-4">
            <h3 className="font-semibold">Opção 2: Via Código (Temporário)</h3>
            <p className="text-sm text-muted-foreground">
              Como workaround temporário, podemos modificar o código para não usar 
              <code>recipient_type</code> até a migração ser aplicada. Mas isso não é ideal.
            </p>
          </div>

          <div className="space-y-4">
            <h3 className="font-semibold">Opção 3: Verificar Status</h3>
            <Button onClick={applyFix} disabled={isApplying} className="w-full">
              {isApplying ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verificando...
                </>
              ) : (
                "Verificar se a coluna existe"
              )}
            </Button>

            {result && (
              <div
                className={`p-4 rounded-lg border ${
                  result.success
                    ? "bg-green-50 border-green-200"
                    : "bg-red-50 border-red-200"
                }`}
              >
                <div className="flex items-start gap-2">
                  {result.success ? (
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
                  )}
                  <p className="text-sm">{result.message}</p>
                </div>
              </div>
            )}
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-semibold text-blue-900 mb-2">SQL para aplicar:</h4>
            <p className="text-xs text-blue-800 mb-2">
              Se você conseguir acesso ao SQL Editor (mesmo que temporário), execute:
            </p>
            <pre className="bg-white p-3 rounded text-xs overflow-x-auto">
              <code>{`ALTER TABLE public.whatsapp_workflows
  ADD COLUMN IF NOT EXISTS recipient_type text DEFAULT 'list'
    CHECK (recipient_type IN ('list', 'single', 'group'));

UPDATE public.whatsapp_workflows
SET recipient_type = CASE 
  WHEN recipient_mode = 'single' THEN 'single'
  ELSE 'list'
END
WHERE recipient_type IS NULL;

ALTER TABLE public.whatsapp_workflows
  ALTER COLUMN recipient_type SET NOT NULL,
  ALTER COLUMN recipient_type SET DEFAULT 'list';`}</code>
            </pre>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

