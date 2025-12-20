import { CRMLayout } from '@/components/crm/CRMLayout';
import { DigitalContractForm } from '@/components/digital-contracts/DigitalContractForm';
import { useOrganizationFeatures } from '@/hooks/useOrganizationFeatures';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Lock } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';

export default function DigitalContractsNew() {
  const { hasFeature, loading: featuresLoading } = useOrganizationFeatures();
  const [searchParams] = useSearchParams();
  const defaultLeadId = searchParams.get('leadId') || undefined;

  // Verificar feature flag
  const canAccess = hasFeature('digital_contracts');
  if (!featuresLoading && !canAccess) {
    return (
      <CRMLayout activeView="digital-contracts" onViewChange={() => {}}>
        <div className="flex items-center justify-center min-h-[400px] p-6">
          <Card className="max-w-md">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Lock className="h-5 w-5 text-muted-foreground" />
                <CardTitle>Acesso Restrito</CardTitle>
              </div>
              <CardDescription>
                Esta funcionalidade não está disponível para sua organização.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Entre em contato com o administrador do sistema para solicitar acesso ao módulo de
                Contrato Digital.
              </p>
            </CardContent>
          </Card>
        </div>
      </CRMLayout>
    );
  }

  return (
    <CRMLayout activeView="digital-contracts" onViewChange={() => {}}>
      <DigitalContractForm defaultLeadId={defaultLeadId} />
    </CRMLayout>
  );
}

