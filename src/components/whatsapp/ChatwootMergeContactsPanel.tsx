import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ChatwootMergeContactsPanelProps {
  organizationId: string | null;
}

export const ChatwootMergeContactsPanel = ({ organizationId }: ChatwootMergeContactsPanelProps) => {
  const [primaryContactId, setPrimaryContactId] = useState('');
  const [childContactId, setChildContactId] = useState('');
  const { toast } = useToast();

  const handleMergeContacts = async () => {
    if (!organizationId || !primaryContactId || !childContactId) return;

    try {
      const { data, error } = await supabase.functions.invoke('chatwoot-merge-contacts', {
        body: { 
          organizationId, 
          primaryContactId: parseInt(primaryContactId),
          childContactId: parseInt(childContactId)
        },
      });

      if (error || data?.error) {
        throw new Error(data?.error || error?.message);
      }

      toast({ title: "Contatos mesclados com sucesso" });
      setPrimaryContactId('');
      setChildContactId('');
    } catch (error: any) {
      toast({
        title: "Erro ao mesclar contatos",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-4 p-4 border rounded-lg bg-background">
      <div className="flex items-center gap-2">
        <Users className="h-4 w-4" />
        <h3 className="font-medium">Mesclar Contatos</h3>
      </div>

      <div className="space-y-3">
        <div>
          <Label htmlFor="primary-contact">ID do Contato Principal</Label>
          <Input
            id="primary-contact"
            type="number"
            value={primaryContactId}
            onChange={(e) => setPrimaryContactId(e.target.value)}
            placeholder="123"
          />
        </div>

        <div>
          <Label htmlFor="child-contact">ID do Contato Duplicado</Label>
          <Input
            id="child-contact"
            type="number"
            value={childContactId}
            onChange={(e) => setChildContactId(e.target.value)}
            placeholder="456"
          />
        </div>

        <Button 
          onClick={handleMergeContacts}
          disabled={!primaryContactId || !childContactId}
          className="w-full"
        >
          Mesclar Contatos
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        Todas as conversas e dados do contato duplicado serão transferidos para o contato principal.
      </p>
    </div>
  );
};
