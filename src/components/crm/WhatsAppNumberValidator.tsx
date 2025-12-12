import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, CheckCircle2, XCircle, Search, Download, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { EvolutionConfig } from "@/hooks/useEvolutionConfigs";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";

interface WhatsAppNumberValidatorProps {
  configs: EvolutionConfig[];
}

interface ValidationResult {
  phone: string;
  hasWhatsApp: boolean;
  jid?: string;
  error?: string;
}

export function WhatsAppNumberValidator({ configs }: WhatsAppNumberValidatorProps) {
  const [phoneList, setPhoneList] = useState("");
  const [selectedInstance, setSelectedInstance] = useState("");
  const [batchSize, setBatchSize] = useState("5");
  const [delayBetweenBatches, setDelayBetweenBatches] = useState("3000");
  const [validating, setValidating] = useState(false);
  const [results, setResults] = useState<ValidationResult[]>([]);
  const [summary, setSummary] = useState<{ total: number; valid: number; invalid: number; errors: number } | null>(null);
  const [progress, setProgress] = useState(0);
  const { toast } = useToast();

  const parsePhoneList = (text: string): string[] => {
    // Dividir por quebras de linha, vírgulas ou ponto-e-vírgula
    return text
      .split(/[\n,;]/)
      .map(phone => phone.trim())
      .filter(phone => phone.length > 0)
      .filter(phone => /\d/.test(phone)); // Apenas strings com pelo menos um dígito
  };

  const handleValidate = async () => {
    const phones = parsePhoneList(phoneList);
    
    if (phones.length === 0) {
      toast({
        title: "Nenhum número encontrado",
        description: "Cole uma lista de números válida",
        variant: "destructive",
      });
      return;
    }

    if (!selectedInstance) {
      toast({
        title: "Instância obrigatória",
        description: "Selecione uma instância WhatsApp",
        variant: "destructive",
      });
      return;
    }

    setValidating(true);
    setResults([]);
    setSummary(null);
    setProgress(0);

    try {
      const { data, error } = await supabase.functions.invoke('validate-whatsapp-number', {
        body: {
          instanceId: selectedInstance,
          phones: phones,
          batchSize: parseInt(batchSize),
          delayBetweenBatches: parseInt(delayBetweenBatches),
        },
      });

      if (error) throw error;

      setResults(data.results);
      setSummary(data.summary);
      setProgress(100);
      
      toast({
        title: "✅ Validação concluída",
        description: `${data.summary.valid} números válidos de ${data.summary.total} verificados`,
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

  const handleExport = () => {
    if (results.length === 0) return;

    const csvContent = [
      ['Número', 'Tem WhatsApp', 'JID', 'Erro'].join(','),
      ...results.map(r => [
        r.phone,
        r.hasWhatsApp ? 'Sim' : 'Não',
        r.jid || '',
        r.error || ''
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `validacao-whatsapp-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();

    toast({
      title: "✅ Exportado",
      description: "Resultados exportados para CSV",
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Search className="h-5 w-5" />
          Validador em Massa de Números WhatsApp
        </CardTitle>
        <CardDescription>
          Verifique múltiplos números com processamento em lotes para segurança
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-sm">
            <strong>Proteção anti-bloqueio:</strong> Os números são validados em lotes com delays entre eles para evitar bloqueios da API.
          </AlertDescription>
        </Alert>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="validator-instance">Instância WhatsApp</Label>
            <Select value={selectedInstance} onValueChange={setSelectedInstance}>
              <SelectTrigger id="validator-instance">
                <SelectValue placeholder="Selecione" />
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
            <Label htmlFor="batch-size">Números por Lote</Label>
            <Input
              id="batch-size"
              type="number"
              min="1"
              max="20"
              value={batchSize}
              onChange={(e) => setBatchSize(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="delay">Delay entre Lotes (ms)</Label>
            <Input
              id="delay"
              type="number"
              min="1000"
              max="10000"
              step="500"
              value={delayBetweenBatches}
              onChange={(e) => setDelayBetweenBatches(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="validator-phones">Lista de Números</Label>
          <Textarea
            id="validator-phones"
            placeholder="Cole os números aqui (um por linha, separados por vírgula ou ponto-e-vírgula)&#10;&#10;Exemplo:&#10;(11) 99999-9999&#10;21987654321&#10;5511988887777"
            value={phoneList}
            onChange={(e) => setPhoneList(e.target.value)}
            rows={8}
            disabled={validating}
          />
          <p className="text-xs text-muted-foreground">
            {parsePhoneList(phoneList).length} número(s) detectado(s)
          </p>
        </div>

        {validating && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Processando...</span>
              <span>{progress}%</span>
            </div>
            <Progress value={progress} className="w-full" />
          </div>
        )}

        <div className="flex gap-2">
          <Button 
            onClick={handleValidate} 
            disabled={validating || parsePhoneList(phoneList).length === 0 || !selectedInstance}
            className="flex-1"
          >
            {validating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Validando...
              </>
            ) : (
              <>
                <Search className="mr-2 h-4 w-4" />
                Validar Números
              </>
            )}
          </Button>

          {results.length > 0 && (
            <Button onClick={handleExport} variant="outline">
              <Download className="mr-2 h-4 w-4" />
              Exportar CSV
            </Button>
          )}
        </div>

        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-xs text-muted-foreground">Total</p>
              <p className="text-2xl font-bold">{summary.total}</p>
            </div>
            <div className="p-3 bg-green-50 dark:bg-green-950 rounded-lg">
              <p className="text-xs text-green-700 dark:text-green-300">Válidos</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">{summary.valid}</p>
            </div>
            <div className="p-3 bg-red-50 dark:bg-red-950 rounded-lg">
              <p className="text-xs text-red-700 dark:text-red-300">Inválidos</p>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">{summary.invalid}</p>
            </div>
            <div className="p-3 bg-orange-50 dark:bg-orange-950 rounded-lg">
              <p className="text-xs text-orange-700 dark:text-orange-300">Erros</p>
              <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">{summary.errors}</p>
            </div>
          </div>
        )}

        {results.length > 0 && (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            <Label>Resultados ({results.length})</Label>
            <div className="space-y-1">
              {results.map((result, index) => (
                <div
                  key={index}
                  className={`flex items-center justify-between p-2 rounded text-sm ${
                    result.error
                      ? 'bg-orange-50 dark:bg-orange-950 border border-orange-200 dark:border-orange-800'
                      : result.hasWhatsApp
                      ? 'bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800'
                      : 'bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {result.error ? (
                      <AlertCircle className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                    ) : result.hasWhatsApp ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                    )}
                    <span className="font-mono">{result.phone}</span>
                  </div>
                  <span className="text-xs">
                    {result.error || (result.hasWhatsApp ? 'WhatsApp ativo' : 'Sem WhatsApp')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
