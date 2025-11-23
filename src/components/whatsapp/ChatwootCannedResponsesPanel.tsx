import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, MessageSquare } from "lucide-react";
import { useChatwootCannedResponses } from "@/hooks/useChatwootCannedResponses";

interface ChatwootCannedResponsesPanelProps {
  organizationId: string | null;
  onSelectResponse: (content: string) => void;
}

export const ChatwootCannedResponsesPanel = ({ 
  organizationId, 
  onSelectResponse 
}: ChatwootCannedResponsesPanelProps) => {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newResponse, setNewResponse] = useState({ shortCode: '', content: '' });
  
  const { cannedResponses, isLoading, createCannedResponse } = useChatwootCannedResponses(organizationId);

  const handleCreateResponse = () => {
    if (!newResponse.shortCode.trim() || !newResponse.content.trim()) return;
    createCannedResponse(newResponse);
    setNewResponse({ shortCode: '', content: '' });
    setShowCreateForm(false);
  };

  return (
    <div className="space-y-4 p-4 border rounded-lg bg-background overflow-hidden">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4" />
          <h3 className="font-medium">Respostas Prontas</h3>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setShowCreateForm(!showCreateForm)}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {showCreateForm && (
        <div className="space-y-3 p-3 border rounded bg-muted/50">
          <div>
            <Label htmlFor="response-code">Código (ex: /ola)</Label>
            <Input
              id="response-code"
              value={newResponse.shortCode}
              onChange={(e) => setNewResponse({ ...newResponse, shortCode: e.target.value })}
              placeholder="/ola"
            />
          </div>
          <div>
            <Label htmlFor="response-content">Mensagem</Label>
            <Textarea
              id="response-content"
              value={newResponse.content}
              onChange={(e) => setNewResponse({ ...newResponse, content: e.target.value })}
              placeholder="Olá! Como posso ajudar?"
              rows={3}
            />
          </div>
          <div className="flex gap-2">
            <Button onClick={handleCreateResponse} size="sm">Criar</Button>
            <Button onClick={() => setShowCreateForm(false)} size="sm" variant="outline">
              Cancelar
            </Button>
          </div>
        </div>
      )}

      <div className="border rounded-lg overflow-hidden">
        <ScrollArea className="h-[280px]">
          <div className="space-y-2 p-3">
            {isLoading ? (
              <p className="text-sm text-muted-foreground p-2">Carregando...</p>
            ) : cannedResponses.length === 0 ? (
              <p className="text-sm text-muted-foreground p-2">Nenhuma resposta criada</p>
            ) : (
              cannedResponses.map((response: any) => (
                <div
                  key={response.id}
                  className="p-3 border rounded hover:bg-muted cursor-pointer transition-colors"
                  onClick={() => onSelectResponse(response.content)}
                >
                  <div className="font-medium text-sm mb-1 break-words">{response.short_code}</div>
                  <div className="text-xs text-muted-foreground break-words whitespace-pre-wrap">
                    {response.content}
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
};
