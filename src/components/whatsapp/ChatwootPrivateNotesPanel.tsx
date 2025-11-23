import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ChatwootPrivateNotesPanelProps {
  organizationId: string | null;
  conversationId: number | null;
}

export const ChatwootPrivateNotesPanel = ({ 
  organizationId, 
  conversationId 
}: ChatwootPrivateNotesPanelProps) => {
  const [note, setNote] = useState('');
  const [notes, setNotes] = useState<any[]>([]);
  const { toast } = useToast();

  const handleAddNote = async () => {
    if (!organizationId || !conversationId || !note.trim()) return;

    try {
      const { data, error } = await supabase.functions.invoke('chatwoot-add-private-note', {
        body: { organizationId, conversationId, content: note },
      });

      if (error || data?.error) {
        throw new Error(data?.error || error?.message);
      }

      toast({ title: "Nota privada adicionada" });
      setNote('');
      setNotes([...notes, data.note]);
    } catch (error: any) {
      toast({
        title: "Erro ao adicionar nota",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-4 p-4 border rounded-lg bg-background">
      <div className="flex items-center gap-2">
        <Lock className="h-4 w-4" />
        <h3 className="font-medium">Notas Privadas</h3>
      </div>

      <div className="space-y-2">
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Adicionar nota interna (visível apenas para agentes)"
          rows={3}
          disabled={!conversationId}
        />
        <Button 
          onClick={handleAddNote} 
          size="sm"
          disabled={!conversationId || !note.trim()}
        >
          Adicionar Nota
        </Button>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <ScrollArea className="h-[200px]">
          <div className="space-y-2 p-3">
            {notes.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma nota adicionada</p>
            ) : (
              notes.map((n: any, idx: number) => (
                <div key={idx} className="p-3 border rounded bg-muted/50 text-sm break-words whitespace-pre-wrap">
                  {n.content}
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
};
