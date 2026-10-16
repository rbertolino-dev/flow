import { Settings2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useOrganizationCrmSettings } from "@/hooks/useOrganizationCrmSettings";
import { useIsActiveOrgAdmin } from "@/hooks/useOrgUserPermissions";

export function CrmSettingsCard() {
  const { isOrgAdmin, loading: adminLoading } = useIsActiveOrgAdmin();
  const {
    allowDuplicatePhones,
    loading,
    saving,
    setAllowDuplicatePhones,
  } = useOrganizationCrmSettings();

  const disabled = adminLoading || loading || saving || !isOrgAdmin;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Settings2 className="h-5 w-5" />
          <CardTitle>Configurações do CRM</CardTitle>
        </div>
        <CardDescription>
          Políticas de cadastro de leads desta organização
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1 flex-1">
            <Label htmlFor="allow-duplicate-phones" className="text-sm font-medium">
              Permitir leads com o mesmo telefone
            </Label>
            <p className="text-sm text-muted-foreground">
              Desligado (padrão): um telefone ativo por organização. Ligado: permite
              cadastrar mais de um lead com o mesmo número.
            </p>
          </div>
          <Switch
            id="allow-duplicate-phones"
            checked={allowDuplicatePhones}
            disabled={disabled}
            onCheckedChange={(checked) => {
              void setAllowDuplicatePhones(checked);
            }}
          />
        </div>

        {allowDuplicatePhones && (
          <Alert>
            <AlertDescription className="text-sm">
              Com esta opção ligada, o WhatsApp e outros canais automáticos continuam
              reutilizando o lead existente do mesmo número (não criam um segundo lead
              sozinhos). Duplicatas só ocorrem em cadastro ou importação intencionais.
              Para desligar de novo, é preciso não haver dois leads ativos com o mesmo
              telefone.
            </AlertDescription>
          </Alert>
        )}

        {!isOrgAdmin && !adminLoading && (
          <p className="text-xs text-muted-foreground">
            Apenas administradores da organização podem alterar esta opção.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
