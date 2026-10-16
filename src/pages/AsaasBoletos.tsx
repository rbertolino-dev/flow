import { AuthGuard } from "@/components/auth/AuthGuard";
import { CRMLayout } from "@/components/crm/CRMLayout";
import { CobrancasPage } from "@/components/asaas/CobrancasPage";
import { useOrganizationFeatures } from "@/hooks/useOrganizationFeatures";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2 } from "lucide-react";

export default function AsaasBoletos() {
  const { hasFeature, loading } = useOrganizationFeatures();
  const canAccess = hasFeature("asaas_boleto") || hasFeature("payment_integration");

  return (
    <AuthGuard>
      <CRMLayout activeView="asaas-boletos" onViewChange={() => {}}>
        <div className="flex-1 overflow-auto p-4 sm:p-6">
          <div className="max-w-7xl mx-auto">
            {loading ? (
              <div className="flex items-center justify-center py-16 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin mr-2" />
                Carregando...
              </div>
            ) : !canAccess ? (
              <Alert>
                <AlertDescription>
                  O módulo de Cobranças (Boletos Asaas) não está liberado para esta organização.
                  Solicite ao administrador a habilitação da funcionalidade{" "}
                  <strong>Boletos Asaas</strong>.
                </AlertDescription>
              </Alert>
            ) : (
              <CobrancasPage />
            )}
          </div>
        </div>
      </CRMLayout>
    </AuthGuard>
  );
}
