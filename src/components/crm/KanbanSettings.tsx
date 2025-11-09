import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Settings2 } from "lucide-react";
import { ColumnWidth } from "@/hooks/useKanbanSettings";

interface KanbanSettingsProps {
  columnWidth: ColumnWidth;
  onColumnWidthChange: (width: ColumnWidth) => void;
}

export function KanbanSettings({ columnWidth, onColumnWidthChange }: KanbanSettingsProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 text-xs sm:text-sm">
          <Settings2 className="h-3 w-3 sm:h-4 sm:w-4" />
          <span className="hidden sm:inline">Configurações</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-4">
          <div className="space-y-2">
            <h4 className="font-medium text-sm">Largura das Colunas</h4>
            <RadioGroup
              value={columnWidth}
              onValueChange={(value) => onColumnWidthChange(value as ColumnWidth)}
              className="space-y-2"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="narrow" id="narrow" />
                <Label htmlFor="narrow" className="cursor-pointer flex-1">
                  Estreita (256px)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="default" id="default" />
                <Label htmlFor="default" className="cursor-pointer flex-1">
                  Padrão (320px)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="wide" id="wide" />
                <Label htmlFor="wide" className="cursor-pointer flex-1">
                  Larga (384px)
                </Label>
              </div>
            </RadioGroup>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
