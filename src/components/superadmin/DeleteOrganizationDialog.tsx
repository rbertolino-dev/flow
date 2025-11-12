import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, Trash2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface DeleteOrganizationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  organizationId: string;
  organizationName: string;
}

export function DeleteOrganizationDialog({ 
  open, 
  onOpenChange, 
  onSuccess, 
  organizationId, 
  organizationName 
}: DeleteOrganizationDialogProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleDelete = async () => {
    setLoading(true);

    try {
      const { error } = await supabase
        .from('organizations')
        .delete()
        .eq('id', organizationId);

      if (error) throw error;

      toast({
        title: "Organização excluída",
        description: `${organizationName} foi removida com sucesso.`,
      });

      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      console.error("Erro ao excluir organização:", error);
      toast({
        title: "Erro ao excluir organização",
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
            Excluir Organização
          </DialogTitle>
          <DialogDescription>
            Esta ação é irreversível e removerá permanentemente a organização.
          </DialogDescription>
        </DialogHeader>

        <Alert className="border-amber-500/50 bg-amber-500/10">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-sm">
            <strong className="block mb-2">O que acontecerá:</strong>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>A organização <strong>{organizationName}</strong> será removida</li>
              <li>Todos os usuários associados perderão acesso</li>
              <li>Todos os dados (leads, campanhas, mensagens) serão excluídos</li>
              <li>Esta ação não pode ser desfeita</li>
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
