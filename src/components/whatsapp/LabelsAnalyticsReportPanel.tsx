import { useState } from "react";
import { LabelsAnalyticsReport } from "./LabelsAnalyticsReport";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, BarChart3 } from "lucide-react";

export const LabelsAnalyticsReportPanel = () => {
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
              <h3 className="font-bold text-lg">Visão Geral das Etiquetas</h3>
              <p className="text-sm text-muted-foreground">Análise detalhada de conversas e mensagens por etiqueta</p>
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
            <LabelsAnalyticsReport />
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
};
