import { useState } from "react";
import { LabelsReport } from "./LabelsReport";
import { Button } from "@/components/ui/button";
import { BarChart3, ChevronDown, ChevronUp } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

export const LabelsReportPanel = () => {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
      <div className="bg-card">
        <div className="flex items-center justify-between p-5 border-b">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <BarChart3 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-bold text-lg">Relatório de Etiquetas</h3>
              <p className="text-sm text-muted-foreground">Leads organizados por etiquetas do Chatwoot</p>
            </div>
          </div>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm">
              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </CollapsibleTrigger>
        </div>
        <CollapsibleContent>
          <div className="p-6">
            <LabelsReport />
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
};
