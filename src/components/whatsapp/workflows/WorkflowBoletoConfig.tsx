import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { 
  AlertCircle, 
  CheckCircle2, 
  ExternalLink, 
  CreditCard,
  Building2,
} from "lucide-react";
import { useAsaasConfig } from "@/hooks/useAsaasConfig";
import { useMercadoPago } from "@/hooks/useMercadoPago";
import { useActiveOrganization } from "@/hooks/useActiveOrganization";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

interface BoletoConfig {
  enabled: boolean;
  valor: string;
  vencimento: string;
  descricao: string;
  tipo?: "link" | "boleto"; // Apenas para Mercado Pago
}

interface WorkflowBoletoConfigProps {
  recipientMode: "list" | "single" | "group";
  recipientCount: number;
  recipientName?: string;
  asaasConfig: BoletoConfig;
  mercadoPagoConfig: BoletoConfig;
  onAsaasConfigChange: (config: BoletoConfig) => void;
  onMercadoPagoConfigChange: (config: BoletoConfig) => void;
}

export function WorkflowBoletoConfig({
  recipientMode,
  recipientCount,
  recipientName,
  asaasConfig,
  mercadoPagoConfig,
  onAsaasConfigChange,
  onMercadoPagoConfigChange,
}: WorkflowBoletoConfigProps) {
  const { config: asaasConfigData, loading: loadingAsaas } = useAsaasConfig();
  const { config: mercadoPagoConfigData, isLoadingConfig: loadingMercadoPago } = useMercadoPago();
  const { activeOrgId } = useActiveOrganization();
  const navigate = useNavigate();

  const handleAsaasToggle = (enabled: boolean) => {
    if (enabled && !asaasConfigData && !loadingAsaas) {
      // Não permitir ativar se não estiver configurado
      return;
    }
    onAsaasConfigChange({ ...asaasConfig, enabled });
  };

  const handleMercadoPagoToggle = (enabled: boolean) => {
    if (enabled && !mercadoPagoConfigData && !loadingMercadoPago) {
      // Não permitir ativar se não estiver configurado
      return;
    }
    onMercadoPagoConfigChange({ ...mercadoPagoConfig, enabled });
  };

  const getRecipientInfo = () => {
    if (recipientMode === "single") {
      return {
        count: 1,
        text: recipientName || "1 cliente",
      };
    }
    if (recipientMode === "group") {
      return {
        count: recipientCount,
        text: `${recipientCount} membros do grupo`,
      };
    }
    return {
      count: recipientCount,
      text: `${recipientCount} cliente(s) da lista`,
    };
  };

  const recipientInfo = getRecipientInfo();
  const totalBoletos = 
    (asaasConfig.enabled ? recipientInfo.count : 0) +
    (mercadoPagoConfig.enabled ? recipientInfo.count : 0);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">Configuração de Boletos</h3>
        <p className="text-sm text-muted-foreground">
          Configure a geração automática de boletos para cada destinatário
        </p>
        {totalBoletos > 0 && (
          <div className="flex items-center gap-2 mt-2">
            <Badge variant="secondary" className="text-sm">
              {totalBoletos} boleto(s) serão gerados
            </Badge>
            <span className="text-xs text-muted-foreground">
              ({recipientInfo.text})
            </span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Coluna Asaas */}
        <Card className={cn(
          "border-2 transition-all",
          asaasConfig.enabled 
            ? "border-orange-300 bg-orange-50/50 dark:bg-orange-950/10" 
            : "border-border"
        )}>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900/30">
                  <Building2 className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                </div>
                <div>
                  <CardTitle className="text-base">Asaas</CardTitle>
                  <CardDescription className="text-xs">
                    Boletos bancários
                  </CardDescription>
                </div>
              </div>
              <Switch
                checked={asaasConfig.enabled}
                onCheckedChange={handleAsaasToggle}
                disabled={!asaasConfigData && !loadingAsaas}
              />
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {!asaasConfigData && !loadingAsaas ? (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle className="text-sm">Integração não configurada</AlertTitle>
                <AlertDescription className="text-xs">
                  Configure a integração Asaas para gerar boletos automaticamente.
                </AlertDescription>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2 w-full"
                  onClick={() => {
                    navigate("/workflows");
                    // Scroll para aba de integração Asaas
                    setTimeout(() => {
                      const element = document.querySelector('[value="asaas"]');
                      if (element) {
                        (element as HTMLElement).click();
                      }
                    }, 100);
                  }}
                >
                  <ExternalLink className="h-3 w-3 mr-2" />
                  Configurar Asaas
                </Button>
              </Alert>
            ) : asaasConfigData ? (
              <div className="flex items-center gap-2 text-xs text-green-600 dark:text-green-400 mb-2">
                <CheckCircle2 className="h-4 w-4" />
                <span>Integração configurada</span>
              </div>
            ) : null}

            {asaasConfig.enabled && asaasConfigData && (
              <div className="space-y-4 pt-2 border-t">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="asaas-valor" className="text-sm">
                      Valor (R$) *
                    </Label>
                    <Input
                      id="asaas-valor"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={asaasConfig.valor}
                      onChange={(e) =>
                        onAsaasConfigChange({
                          ...asaasConfig,
                          valor: e.target.value,
                        })
                      }
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="asaas-vencimento" className="text-sm">
                      Vencimento *
                    </Label>
                    <Input
                      id="asaas-vencimento"
                      type="date"
                      value={asaasConfig.vencimento}
                      onChange={(e) =>
                        onAsaasConfigChange({
                          ...asaasConfig,
                          vencimento: e.target.value,
                        })
                      }
                      min={new Date().toISOString().split("T")[0]}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="asaas-descricao" className="text-sm">
                    Descrição
                  </Label>
                  <Textarea
                    id="asaas-descricao"
                    rows={2}
                    placeholder="Ex: Cobrança referente ao mês de Janeiro/2025"
                    value={asaasConfig.descricao}
                    onChange={(e) =>
                      onAsaasConfigChange({
                        ...asaasConfig,
                        descricao: e.target.value,
                      })
                    }
                  />
                </div>

                <div className="p-2 bg-muted rounded text-xs text-muted-foreground">
                  <strong>Será gerado:</strong> {recipientInfo.count} boleto(s) via Asaas
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Coluna Mercado Pago */}
        <Card className={cn(
          "border-2 transition-all",
          mercadoPagoConfig.enabled 
            ? "border-blue-300 bg-blue-50/50 dark:bg-blue-950/10" 
            : "border-border"
        )}>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                  <CreditCard className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <CardTitle className="text-base">Mercado Pago</CardTitle>
                  <CardDescription className="text-xs">
                    Links e boletos
                  </CardDescription>
                </div>
              </div>
              <Switch
                checked={mercadoPagoConfig.enabled}
                onCheckedChange={handleMercadoPagoToggle}
                disabled={!mercadoPagoConfigData && !loadingMercadoPago}
              />
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {!mercadoPagoConfigData && !loadingMercadoPago ? (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle className="text-sm">Integração não configurada</AlertTitle>
                <AlertDescription className="text-xs">
                  Configure a integração Mercado Pago para gerar cobranças automaticamente.
                </AlertDescription>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2 w-full"
                  onClick={() => {
                    navigate("/workflows");
                    // Scroll para aba de integração Mercado Pago
                    setTimeout(() => {
                      const element = document.querySelector('[value="mercado-pago"]');
                      if (element) {
                        (element as HTMLElement).click();
                      }
                    }, 100);
                  }}
                >
                  <ExternalLink className="h-3 w-3 mr-2" />
                  Configurar Mercado Pago
                </Button>
              </Alert>
            ) : mercadoPagoConfigData ? (
              <div className="flex items-center gap-2 text-xs text-green-600 dark:text-green-400 mb-2">
                <CheckCircle2 className="h-4 w-4" />
                <span>Integração configurada</span>
              </div>
            ) : null}

            {mercadoPagoConfig.enabled && mercadoPagoConfigData && (
              <div className="space-y-4 pt-2 border-t">
                <div className="space-y-2">
                  <Label className="text-sm">Tipo de Cobrança</Label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant={mercadoPagoConfig.tipo === "link" ? "default" : "outline"}
                      size="sm"
                      className="flex-1"
                      onClick={() =>
                        onMercadoPagoConfigChange({
                          ...mercadoPagoConfig,
                          tipo: "link",
                        })
                      }
                    >
                      Link de Pagamento
                    </Button>
                    <Button
                      type="button"
                      variant={mercadoPagoConfig.tipo === "boleto" ? "default" : "outline"}
                      size="sm"
                      className="flex-1"
                      onClick={() =>
                        onMercadoPagoConfigChange({
                          ...mercadoPagoConfig,
                          tipo: "boleto",
                        })
                      }
                    >
                      Boleto Bancário
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="mp-valor" className="text-sm">
                      Valor (R$) *
                    </Label>
                    <Input
                      id="mp-valor"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={mercadoPagoConfig.valor}
                      onChange={(e) =>
                        onMercadoPagoConfigChange({
                          ...mercadoPagoConfig,
                          valor: e.target.value,
                        })
                      }
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="mp-vencimento" className="text-sm">
                      Vencimento *
                    </Label>
                    <Input
                      id="mp-vencimento"
                      type="date"
                      value={mercadoPagoConfig.vencimento}
                      onChange={(e) =>
                        onMercadoPagoConfigChange({
                          ...mercadoPagoConfig,
                          vencimento: e.target.value,
                        })
                      }
                      min={new Date().toISOString().split("T")[0]}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="mp-descricao" className="text-sm">
                    Descrição
                  </Label>
                  <Textarea
                    id="mp-descricao"
                    rows={2}
                    placeholder="Ex: Cobrança referente ao mês de Janeiro/2025"
                    value={mercadoPagoConfig.descricao}
                    onChange={(e) =>
                      onMercadoPagoConfigChange({
                        ...mercadoPagoConfig,
                        descricao: e.target.value,
                      })
                    }
                  />
                </div>

                <div className="p-2 bg-muted rounded text-xs text-muted-foreground">
                  <strong>Será gerado:</strong> {recipientInfo.count} cobrança(s) via Mercado Pago
                  {mercadoPagoConfig.tipo && ` (${mercadoPagoConfig.tipo === "link" ? "Link" : "Boleto"})`}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {totalBoletos > 0 && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle className="text-sm">Atenção</AlertTitle>
          <AlertDescription className="text-xs">
            Todos os destinatários precisam ter CPF/CNPJ cadastrado para gerar boletos.
            {recipientMode === "list" && " Verifique os dados antes de continuar."}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

