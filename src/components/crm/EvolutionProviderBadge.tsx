import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  evolutionProviderBadgeClass,
  evolutionProviderLabel,
  type EvolutionProviderInfo,
} from "@/lib/evolutionProvider";

interface EvolutionProviderBadgeProps {
  apiUrl?: string | null;
  providers: EvolutionProviderInfo[];
  providerName?: string | null;
  className?: string;
}

export function EvolutionProviderBadge({
  apiUrl,
  providers,
  providerName,
  className,
}: EvolutionProviderBadgeProps) {
  const label = evolutionProviderLabel(apiUrl, providers, providerName);
  if (!label) return null;

  return (
    <Badge
      variant="outline"
      title={`Servidor Evolution: ${label}`}
      className={cn(
        "text-[10px] px-1.5 py-0 font-medium shrink-0 max-w-[11rem] truncate",
        evolutionProviderBadgeClass(label),
        className,
      )}
    >
      {label}
    </Badge>
  );
}
