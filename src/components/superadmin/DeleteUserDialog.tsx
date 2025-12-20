import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, Trash2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { broadcastRefreshEvent } from "@/utils/forceRefreshAfterMutation";

interface DeleteUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  userId: string;
  userName: string;
  organizationId: string;
}

export function DeleteUserDialog({ 
  open, 
  onOpenChange, 
  onSuccess, 
  userId, 
  userName,
  organizationId 
}: DeleteUserDialogProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleDelete = async () => {
    setLoading(true);

    try {
      // Chamar a função do banco que transfere dados e exclui o usuário
      const { error } = await supabase.rpc('delete_user_from_organization', {
        _user_id: userId,
        _org_id: organizationId,
      });

      if (error) throw error;

      toast({
        title: "Usuário excluído",
        description: "O usuário foi removido da organização e seus dados foram transferidos para um administrador dessa mesma organização.",
      });

      onOpenChange(false);
      
      // Forçar recarregamento completo do navegador após excluir usuário
      setTimeout(() => {
        onSuccess();
        window.location.reload();
      }, 500);
    } catch (error: any) {
      console.error("Erro ao excluir usuário:", error);
      toast({
        title: "Erro ao excluir usuário",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Excluir Usuário
          </DialogTitle>
          <DialogDescription>
            Esta ação é irreversível e removerá o usuário da organização.
          </DialogDescription>
        </DialogHeader>

        <Alert className="border-amber-500/50 bg-amber-500/10">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-sm">
            <strong className="block mb-2">O que acontecerá:</strong>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>O usuário <strong>{userName}</strong> será removido da organização</li>
              <li>Todos os leads, campanhas e dados do usuário serão transferidos para o administrador</li>
              <li>Se o usuário não pertencer a nenhuma outra organização, sua conta será excluída permanentemente</li>
            </ul>
          </AlertDescription>
        </Alert>

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleDelete}
            disabled={loading}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            {loading ? "Excluindo..." : "Confirmar Exclusão"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
