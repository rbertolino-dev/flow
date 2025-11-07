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
  onAddTag: (tagId: string) => void;
  onRemoveTag: (tagId: string) => void;
}

export function CallQueueTagManager({
  open,
  onOpenChange,
  currentTags,
  onAddTag,
  onRemoveTag,
}: CallQueueTagManagerProps) {
  const { tags } = useTags();
  const [searchQuery, setSearchQuery] = useState("");

  const currentTagIds = new Set(currentTags.map((t) => t.id));
  const availableTags = tags.filter((tag) => !currentTagIds.has(tag.id));

  const filteredAvailableTags = availableTags.filter((tag) =>
    tag.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Gerenciar Etiquetas da Ligação</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Etiquetas atuais */}
          <div>
            <h3 className="text-sm font-medium mb-2">Etiquetas Atuais</h3>
            {currentTags.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma etiqueta adicionada</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {currentTags.map((tag) => (
                  <Badge
                    key={tag.id}
                    variant="outline"
                    style={{
                      backgroundColor: `${tag.color}20`,
                      borderColor: tag.color,
                      color: tag.color,
                    }}
                    className="gap-1"
                  >
                    {tag.name}
                    <button
                      onClick={() => onRemoveTag(tag.id)}
                      className="ml-1 hover:opacity-70"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Adicionar etiquetas */}
          <div>
            <h3 className="text-sm font-medium mb-2">Adicionar Etiquetas</h3>
            <ScrollArea className="h-[200px] border rounded-md p-3">
              {filteredAvailableTags.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {availableTags.length === 0
                    ? "Todas as etiquetas já foram adicionadas"
                    : "Nenhuma etiqueta encontrada"}
                </p>
              ) : (
                <div className="space-y-2">
                  {filteredAvailableTags.map((tag) => (
                    <div
                      key={tag.id}
                      className="flex items-center justify-between p-2 rounded-md hover:bg-muted"
                    >
                      <Badge
                        variant="outline"
                        style={{
                          backgroundColor: `${tag.color}20`,
                          borderColor: tag.color,
                          color: tag.color,
                        }}
                      >
                        {tag.name}
                      </Badge>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onAddTag(tag.id)}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
