import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useTags } from "@/hooks/useTags";
import { Tag } from "@/types/lead";
import { Plus, X } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface CallQueueTagManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentTags: Tag[];
  onToggleTag: (tagId: string, isCurrentlySelected: boolean) => void;
}

export function CallQueueTagManager({
  open,
  onOpenChange,
  currentTags,
  onToggleTag,
}: CallQueueTagManagerProps) {
  const { tags } = useTags();
  const [searchQuery, setSearchQuery] = useState("");

  const currentTagIds = new Set(currentTags.map((t) => t.id));

  const filteredTags = tags.filter((tag) =>
    tag.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Gerenciar Etiquetas da Ligação</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Todas as etiquetas com toggle */}
          <div>
            <h3 className="text-sm font-medium mb-2">Etiquetas Disponíveis</h3>
            <p className="text-xs text-muted-foreground mb-3">
              Clique nas etiquetas para selecionar ou desselecionar
            </p>
            <ScrollArea className="h-[300px] border rounded-md p-3">
              {filteredTags.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhuma etiqueta encontrada
                </p>
              ) : (
                <div className="space-y-2">
                  {filteredTags.map((tag) => {
                    const isSelected = currentTagIds.has(tag.id);
                    return (
                      <button
                        key={tag.id}
                        onClick={() => onToggleTag(tag.id, isSelected)}
                        className="w-full flex items-center justify-between p-2 rounded-md hover:bg-muted transition-colors"
                      >
                        <Badge
                          variant="outline"
                          style={{
                            backgroundColor: isSelected ? tag.color : `${tag.color}20`,
                            borderColor: tag.color,
                            color: isSelected ? '#fff' : tag.color,
                          }}
                        >
                          {tag.name}
                        </Badge>
                        {isSelected ? (
                          <Badge variant="secondary" className="text-xs">
                            Selecionada
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs">
                            Clique para adicionar
                          </Badge>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
