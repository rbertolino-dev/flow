import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ChatwootMacrosPanelProps {
  organizationId: string | null;
  selectedConversations: number[];
  onMacroComplete: () => void;
}

export const ChatwootMacrosPanel = ({ 
  organizationId, 
  selectedConversations,
  onMacroComplete 
}: ChatwootMacrosPanelProps) => {
  const [action, setAction] = useState('');
  const { toast } = useToast();

  const handleExecuteMacro = async () => {
    if (!organizationId || selectedConversations.length === 0 || !action) return;

    try {
      const { data, error } = await supabase.functions.invoke('chatwoot-execute-macro', {
        body: { 
          organizationId, 
          conversationIds: selectedConversations,
          action 
        },
      });

      if (error || data?.error) {
        throw new Error(data?.error || error?.message);
      }

      toast({ title: `Macro executada em ${selectedConversations.length} conversas` });
      onMacroComplete();
      setAction('');
    } catch (error: any) {
      toast({
        title: "Erro ao executar macro",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-4 p-4 border rounded-lg bg-background">
      <div className="flex items-center gap-2">
        <Zap className="h-4 w-4" />
        <h3 className="font-medium">Macros (Ações em Lote)</h3>
      </div>

      <div className="text-sm text-muted-foreground">
        {selectedConversations.length} conversa(s) selecionada(s)
      </div>

      <div className="space-y-2">
        <Select value={action} onValueChange={setAction}>
          <SelectTrigger>
            <SelectValue placeholder="Selecione uma ação" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="resolve">Resolver conversas</SelectItem>
            <SelectItem value="open">Reabrir conversas</SelectItem>
            <SelectItem value="assign_agent">Atribuir a agente</SelectItem>
            <SelectItem value="add_label">Adicionar label</SelectItem>
            <SelectItem value="mute">Silenciar</SelectItem>
          </SelectContent>
        </Select>

        <Button 
          onClick={handleExecuteMacro}
          disabled={!action || selectedConversations.length === 0}
          className="w-full"
        >
          Executar Macro
        </Button>
      </div>
    </div>
  );
};
