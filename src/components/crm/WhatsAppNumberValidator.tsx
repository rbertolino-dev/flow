import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, CheckCircle2, XCircle, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { EvolutionConfig } from "@/hooks/useEvolutionConfigs";

interface WhatsAppNumberValidatorProps {
  configs: EvolutionConfig[];
}

export function WhatsAppNumberValidator({ configs }: WhatsAppNumberValidatorProps) {
  const [phone, setPhone] = useState("");
  const [selectedInstance, setSelectedInstance] = useState("");
  const [validating, setValidating] = useState(false);
  const [result, setResult] = useState<{ hasWhatsApp: boolean; phone: string } | null>(null);
  const { toast } = useToast();

  const handleValidate = async () => {
    if (!phone.trim() || !selectedInstance) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha o número e selecione uma instância",
        variant: "destructive",
      });
      return;
    }

    setValidating(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('validate-whatsapp-number', {
        body: {
          instanceId: selectedInstance,
          phone: phone,
        },
      });

      if (error) throw error;

      setResult(data);
      
      toast({
        title: data.hasWhatsApp ? "✅ Número válido" : "❌ Número inválido",
        description: data.hasWhatsApp 
          ? `${data.phone} tem WhatsApp ativo`
          : `${data.phone} não possui WhatsApp`,
        variant: data.hasWhatsApp ? "default" : "destructive",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao validar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setValidating(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Search className="h-5 w-5" />
          Validador de Números WhatsApp
        </CardTitle>
        <CardDescription>
          Verifique se um número possui WhatsApp ativo sem salvar dados
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="validator-instance">Instância Evolution</Label>
          <Select value={selectedInstance} onValueChange={setSelectedInstance}>
            <SelectTrigger id="validator-instance">
              <SelectValue placeholder="Selecione uma instância" />
            </SelectTrigger>
            <SelectContent>
              {configs.map((config) => (
                <SelectItem key={config.id} value={config.id}>
                  {config.instance_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="validator-phone">Número de Telefone</Label>
          <Input
            id="validator-phone"
            placeholder="(11) 99999-9999"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleValidate()}
          />
        </div>

        <Button 
          onClick={handleValidate} 
          disabled={validating || !phone.trim() || !selectedInstance}
          className="w-full"
        >
          {validating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Validando...
            </>
          ) : (
            <>
              <Search className="mr-2 h-4 w-4" />
              Validar Número
            </>
          )}
        </Button>

        {result && (
          <div className={`p-4 rounded-lg border ${result.hasWhatsApp ? 'bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800' : 'bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800'}`}>
            <div className="flex items-center gap-2">
              {result.hasWhatsApp ? (
                <>
                  <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                  <div>
                    <p className="font-medium text-green-900 dark:text-green-100">WhatsApp Ativo</p>
                    <p className="text-sm text-green-700 dark:text-green-300">{result.phone}</p>
                  </div>
                </>
              ) : (
                <>
                  <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                  <div>
                    <p className="font-medium text-red-900 dark:text-red-100">WhatsApp Não Encontrado</p>
                    <p className="text-sm text-red-700 dark:text-red-300">{result.phone}</p>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
