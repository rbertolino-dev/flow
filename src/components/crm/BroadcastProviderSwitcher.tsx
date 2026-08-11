import { RadioTower, Send } from "lucide-react";

import { Button } from "@/components/ui/button";

type BroadcastProviderSwitcherProps = {
  provider: "evolution" | "waha";
  onChange: (provider: "evolution" | "waha") => void;
};

export function BroadcastProviderSwitcher({
  provider,
  onChange,
}: BroadcastProviderSwitcherProps) {
  return (
    <div className="mb-4 rounded-lg border bg-card p-3">
      <p className="mb-2 text-sm font-medium">Escolha o motor de disparo</p>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant={provider === "evolution" ? "default" : "outline"}
          onClick={() => onChange("evolution")}
        >
          <Send className="mr-2 h-4 w-4" />
          Criar campanha Evolution
        </Button>
        <Button
          type="button"
          variant={provider === "waha" ? "default" : "outline"}
          onClick={() => onChange("waha")}
        >
          <RadioTower className="mr-2 h-4 w-4" />
          Criar campanha WAHA
        </Button>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Os dois motores usam configurações, campanhas e filas independentes.
      </p>
    </div>
  );
}
