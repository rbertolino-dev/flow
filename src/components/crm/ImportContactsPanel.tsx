import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Download, Loader2, Calendar, CheckCircle2, AlertCircle } from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";

export function ImportContactsPanel() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [importProgress, setImportProgress] = useState<{
    stage: 'idle' | 'fetching' | 'processing' | 'saving' | 'complete' | 'error';
    message: string;
    total?: number;
    imported?: number;
    percentage?: number;
  }>({ stage: 'idle', message: '' });
  const [filterType, setFilterType] = useState<"all" | "month" | "range">("month");
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();

  const handleImport = async () => {
    setLoading(true);
    setImportProgress({ stage: 'fetching', message: 'Conectando à Evolution API...', percentage: 10 });

    try {
      // Verificar autenticação primeiro
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        setImportProgress({ stage: 'error', message: 'Erro de autenticação' });
        toast({
          title: "Erro de autenticação",
          description: "Você precisa estar logado para importar contatos",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      let requestData: any = {};

      if (filterType === "month") {
        const start = startOfMonth(selectedMonth);
        const end = endOfMonth(selectedMonth);
        requestData = {
          startDate: format(start, "yyyy-MM-dd"),
          endDate: format(end, "yyyy-MM-dd"),
        };
      } else if (filterType === "range" && startDate && endDate) {
        requestData = {
          startDate: format(startDate, "yyyy-MM-dd"),
          endDate: format(endDate, "yyyy-MM-dd"),
        };
      }

      setImportProgress({ stage: 'fetching', message: 'Buscando contatos da Evolution API...', percentage: 30 });

      // Obter token de autenticação
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      
      const { data, error } = await supabase.functions.invoke('import-contacts', {
        body: requestData,
        headers: {
          Authorization: `Bearer ${currentSession?.access_token}`,
        },
      });

      if (error) throw error;

      setImportProgress({ 
        stage: 'processing', 
        message: `${data.total} contatos encontrados, processando...`, 
        total: data.total,
        percentage: 60 
      });

      // Simular o processamento
      await new Promise(resolve => setTimeout(resolve, 500));

      setImportProgress({ 
        stage: 'saving', 
        message: `Salvando ${data.imported} contatos no funil...`, 
        total: data.total,
        imported: data.imported,
        percentage: 80 
      });

      // Simular o salvamento
      await new Promise(resolve => setTimeout(resolve, 500));

      setImportProgress({ 
        stage: 'complete', 
        message: `${data.imported} de ${data.total} contatos importados com sucesso!`, 
        total: data.total,
        imported: data.imported,
        percentage: 100 
      });

      toast({
        title: "Importação concluída",
        description: data.message || `${data.imported} contatos importados com sucesso`,
      });

      // Aguardar um momento para mostrar o progresso completo
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Recarregar a página para mostrar os novos leads
      window.location.reload();
    } catch (error: any) {
      console.group('[ImportContacts] Error');
      console.error('Current filters:', { filterType, selectedMonth, startDate, endDate });
      console.error('Import error object:', error);
      console.groupEnd();
      setImportProgress({ stage: 'error', message: error?.message || 'Erro ao importar contatos' });
      toast({
        title: 'Erro na importação',
        description: error?.message || 'Não foi possível importar os contatos. Verifique suas credenciais da Evolution API em Configurações.',
        variant: 'destructive',
      });
    } finally {
      setTimeout(() => {
        setLoading(false);
        if (importProgress.stage !== 'complete') {
          setImportProgress({ stage: 'idle', message: '' });
        }
      }, 2000);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Download className="h-5 w-5" />
          Importar Contatos
        </CardTitle>
        <CardDescription>
          Importe contatos da Evolution API para o funil de vendas
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Filtrar por Data</Label>
          <Select value={filterType} onValueChange={(value: any) => setFilterType(value)}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione o tipo de filtro" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os contatos</SelectItem>
              <SelectItem value="month">Por mês específico</SelectItem>
              <SelectItem value="range">Por intervalo de datas</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {filterType === "month" && (
          <div className="space-y-2">
            <Label>Mês</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !selectedMonth && "text-muted-foreground"
                  )}
                >
                  <Calendar className="mr-2 h-4 w-4" />
                  {selectedMonth ? format(selectedMonth, "MMMM 'de' yyyy", { locale: ptBR }) : "Selecione o mês"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent
                  mode="single"
                  selected={selectedMonth}
                  onSelect={(date) => date && setSelectedMonth(date)}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
            <p className="text-sm text-muted-foreground">
              Importar contatos de {format(startOfMonth(selectedMonth), "dd/MM/yyyy")} até {format(endOfMonth(selectedMonth), "dd/MM/yyyy")}
            </p>
          </div>
        )}

        {filterType === "range" && (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Data Inicial</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !startDate && "text-muted-foreground"
                    )}
                  >
                    <Calendar className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, "dd/MM/yyyy") : "Selecione"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={startDate}
                    onSelect={setStartDate}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>Data Final</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !endDate && "text-muted-foreground"
                    )}
                  >
                    <Calendar className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, "dd/MM/yyyy") : "Selecione"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={endDate}
                    onSelect={setEndDate}
                    disabled={(date) => startDate ? date < startDate : false}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        )}

        {importProgress.stage !== 'idle' && (
          <div className="space-y-3 p-4 bg-muted rounded-lg border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {importProgress.stage === 'complete' ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                ) : importProgress.stage === 'error' ? (
                  <AlertCircle className="h-5 w-5 text-destructive" />
                ) : (
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                )}
                <span className="text-sm font-medium">{importProgress.message}</span>
              </div>
              {importProgress.imported !== undefined && importProgress.total !== undefined && (
                <span className="text-sm text-muted-foreground">
                  {importProgress.imported}/{importProgress.total}
                </span>
              )}
            </div>
            {importProgress.percentage !== undefined && (
              <Progress value={importProgress.percentage} className="h-2" />
            )}
          </div>
        )}

        <div className="pt-4">
          <Button 
            onClick={handleImport} 
            disabled={loading || (filterType === "range" && (!startDate || !endDate))}
            className="w-full"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Importando...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Importar Contatos
              </>
            )}
          </Button>
        </div>

        <div className="text-sm text-muted-foreground bg-muted p-4 rounded-md">
          <p className="font-medium mb-2">ℹ️ Informações importantes:</p>
          <ul className="space-y-1 ml-4 list-disc">
            <li>Contatos duplicados serão ignorados automaticamente</li>
            <li>Apenas contatos individuais serão importados (grupos são excluídos)</li>
            <li>Os contatos serão adicionados ao primeiro estágio do funil</li>
            <li>A fonte será marcada como "whatsapp_import"</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
