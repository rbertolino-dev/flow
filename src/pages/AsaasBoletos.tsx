import { AuthGuard } from "@/components/auth/AuthGuard";
import { CRMLayout } from "@/components/crm/CRMLayout";
import { AsaasIntegrationPanel } from "@/components/crm/AsaasIntegrationPanel";
import { BoletoManagement } from "@/components/whatsapp/workflows/BoletoManagement";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useOrganizationFeatures } from "@/hooks/useOrganizationFeatures";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2 } from "lucide-react";

export default function AsaasBoletos() {
  const { hasFeature, loading } = useOrganizationFeatures();
  const canAccess = hasFeature("asaas_boleto") || hasFeature("payment_integration");

  return (
    <AuthGuard>
      <CRMLayout activeView="asaas-boletos" onViewChange={() => {}}>
        <div className="flex-1 overflow-auto p-6">
          <div className="max-w-7xl mx-auto space-y-6">
            <div>
              <h1 className="text-3xl font-bold">Boletos Asaas</h1>
              <p className="text-muted-foreground mt-2">
                Gere, acompanhe e configure boletos e cobranças pelo banco Asaas
              </p>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-16 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin mr-2" />
                Carregando...
              </div>
            ) : !canAccess ? (
              <Alert>
                <AlertDescription>
                  O módulo de Boletos Asaas não está liberado para esta organização.
                  Solicite ao administrador a habilitação da funcionalidade{" "}
                  <strong>Boletos Asaas</strong>.
                </AlertDescription>
              </Alert>
            ) : (
              <Tabs defaultValue="boletos" className="w-full">
                <TabsList>
                  <TabsTrigger value="boletos">Gestão de Boletos</TabsTrigger>
                  <TabsTrigger value="config">Integração Asaas</TabsTrigger>
                </TabsList>
                <TabsContent value="boletos" className="mt-6">
                  <BoletoManagement />
                </TabsContent>
                <TabsContent value="config" className="mt-6">
                  <AsaasIntegrationPanel />
                </TabsContent>
              </Tabs>
            )}
          </div>
        </div>
      </CRMLayout>
    </AuthGuard>
  );
}
