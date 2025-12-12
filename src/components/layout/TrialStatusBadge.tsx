import { useOrganizationFeatures } from "@/hooks/useOrganizationFeatures";
import { Badge } from "@/components/ui/badge";
import { Sparkles } from "lucide-react";
import { differenceInDays } from "date-fns";

export function TrialStatusBadge() {
  const { data, loading } = useOrganizationFeatures();

  if (loading || !data) return null;
  
  if (!data.isInTrial) return null;

  const daysRemaining = data.trialEndsAt 
    ? differenceInDays(data.trialEndsAt, new Date())
    : 0;

  if (daysRemaining <= 0) return null;

  return (
    <Badge 
      variant="outline" 
      className="bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700 text-xs flex items-center gap-1"
    >
      <Sparkles className="h-3 w-3" />
      Trial: {daysRemaining}d
    </Badge>
  );
}
