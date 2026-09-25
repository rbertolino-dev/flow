import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FeaturePermissionGrid } from "@/components/users/FeaturePermissionGrid";
import { useActiveOrganization } from "@/hooks/useActiveOrganization";
import { Settings2 } from "lucide-react";

interface UserPermissionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userName: string;
  organizationId?: string;
}

export function UserPermissionsDialog({
  open,
  onOpenChange,
  userId,
  userName,
  organizationId,
}: UserPermissionsDialogProps) {
  const { activeOrgId } = useActiveOrganization();
  const orgId = organizationId || activeOrgId;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            Gerenciar Permissões - {userName}
          </DialogTitle>
          <DialogDescription>
            Marque ler, editar e excluir apenas nos módulos já liberados para esta organização.
          </DialogDescription>
        </DialogHeader>

        {orgId ? (
          <ScrollArea className="h-[460px] pr-4">
            <FeaturePermissionGrid
              key={`${orgId}-${userId}-${open ? "open" : "closed"}`}
              organizationId={orgId}
              userId={userId}
              onSaved={() => onOpenChange(false)}
            />
          </ScrollArea>
        ) : (
          <p className="text-sm text-muted-foreground">Selecione uma organização ativa para definir permissões.</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
