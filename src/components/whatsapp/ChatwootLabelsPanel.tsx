import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Plus, Tag, ChevronDown } from "lucide-react";
import { useChatwootLabels } from "@/hooks/useChatwootLabels";

interface ChatwootLabelsPanelProps {
  organizationId: string | null;
  conversationId: number | null;
}

export const ChatwootLabelsPanel = ({ organizationId, conversationId }: ChatwootLabelsPanelProps) => {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newLabel, setNewLabel] = useState({ title: '', color: '#3b82f6' });
  const [isOpen, setIsOpen] = useState(true);
  
  const { labels, isLoading, createLabel, applyLabel } = useChatwootLabels(organizationId);

  const handleCreateLabel = () => {
    if (!newLabel.title.trim()) return;
    createLabel(newLabel);
    setNewLabel({ title: '', color: '#3b82f6' });
    setShowCreateForm(false);
  };

  const handleApplyLabel = (labelId: number) => {
    if (!conversationId) return;
    applyLabel({ conversationId, labelId });
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="space-y-4 p-4 border rounded-lg bg-background">
      <div className="flex items-center justify-between">
        <CollapsibleTrigger className="flex items-center gap-2 hover:opacity-80">
          <Tag className="h-4 w-4" />
          <h3 className="font-medium">Labels</h3>
          <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </CollapsibleTrigger>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setShowCreateForm(!showCreateForm)}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <CollapsibleContent className="space-y-4">

      {showCreateForm && (
        <div className="space-y-3 p-3 border rounded bg-muted/50">
          <div>
            <Label htmlFor="label-title">Nome</Label>
            <Input
              id="label-title"
              value={newLabel.title}
              onChange={(e) => setNewLabel({ ...newLabel, title: e.target.value })}
              placeholder="Nome da label"
            />
          </div>
          <div>
            <Label htmlFor="label-color">Cor</Label>
            <div className="flex gap-2">
              <Input
                id="label-color"
                type="color"
                value={newLabel.color}
                onChange={(e) => setNewLabel({ ...newLabel, color: e.target.value })}
                className="w-20"
              />
              <Input
                value={newLabel.color}
                onChange={(e) => setNewLabel({ ...newLabel, color: e.target.value })}
                placeholder="#3b82f6"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleCreateLabel} size="sm">Criar</Button>
            <Button onClick={() => setShowCreateForm(false)} size="sm" variant="outline">
              Cancelar
            </Button>
          </div>
        </div>
      )}

      <div className="border rounded-lg overflow-hidden">
        <ScrollArea className="h-[200px]">
          <div className="flex flex-wrap gap-2 p-3">
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Carregando...</p>
            ) : labels.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma label criada</p>
            ) : (
              labels.map((label: any) => (
                <Badge
                  key={label.id}
                  style={{ backgroundColor: label.color }}
                  className="cursor-pointer hover:opacity-80 px-3 py-1.5 text-xs"
                  onClick={() => handleApplyLabel(label.id)}
                >
                  {label.title}
                </Badge>
              ))
            )}
          </div>
        </ScrollArea>
      </div>
      </CollapsibleContent>
    </Collapsible>
  );
};
