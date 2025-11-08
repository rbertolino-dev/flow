import { Building2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useActiveOrganization } from "@/hooks/useActiveOrganization";
import { Badge } from "@/components/ui/badge";

export function OrganizationSwitcher() {
  const { organizations, activeOrganization, setActiveOrganization, hasMultipleOrgs } = useActiveOrganization();

  if (!hasMultipleOrgs) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="gap-2 border-border/50 hover:border-border">
          <Building2 className="h-4 w-4" />
          <span className="hidden md:inline-block">{activeOrganization?.name || 'Selecionar'}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          Trocar de Organização
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {organizations.map((org) => (
          <DropdownMenuItem
            key={org.id}
            onClick={() => setActiveOrganization(org.id)}
            className="flex items-center justify-between cursor-pointer"
          >
            <div className="flex flex-col gap-1">
              <span className="font-medium">{org.name}</span>
              <Badge variant="secondary" className="w-fit text-xs">
                {org.role === 'owner' ? 'Proprietário' : org.role === 'admin' ? 'Admin' : 'Membro'}
              </Badge>
            </div>
            {activeOrganization?.id === org.id && (
              <Check className="h-4 w-4 text-primary" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
