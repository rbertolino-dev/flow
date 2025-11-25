import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { WaitConfig, WaitType, ConditionOperator } from "@/types/automationFlow";

interface WaitNodeConfigProps {
  config: WaitConfig;
  onConfigChange: (config: WaitConfig) => void;
}

export function WaitNodeConfig({ config, onConfigChange }: WaitNodeConfigProps) {
  const updateConfig = (updates: Partial<WaitConfig>) => {
    onConfigChange({ ...config, ...updates });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Tipo de Espera *</Label>
        <Select
          value={config.waitType || "delay"}
          onValueChange={(value) => updateConfig({ waitType: value as WaitType })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="delay">Aguardar X Tempo</SelectItem>
            <SelectItem value="until_date">Aguardar até Data</SelectItem>
            <SelectItem value="until_field">Aguardar até Campo Mudar</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {config.waitType === 'delay' && (
        <div className="space-y-3">
          <div className="flex gap-2">
            <div className="flex-1 space-y-2">
              <Label>Quantidade *</Label>
              <Input
                type="number"
                min="1"
                value={config.delay_value || ""}
                onChange={(e) => updateConfig({ delay_value: parseInt(e.target.value) || 1 })}
                placeholder="1"
              />
            </div>
            <div className="flex-1 space-y-2">
              <Label>Unidade *</Label>
              <Select
                value={config.delay_unit || "hours"}
                onValueChange={(value) => updateConfig({ delay_unit: value as 'minutes' | 'hours' | 'days' })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="minutes">Minutos</SelectItem>
                  <SelectItem value="hours">Horas</SelectItem>
                  <SelectItem value="days">Dias</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-md text-sm">
            ⏱️ As próximas ações serão executadas após este tempo
          </div>
        </div>
      )}

      {config.waitType === 'until_date' && (
        <div className="space-y-2">
          <Label>Data/Hora *</Label>
          <Input
            type="datetime-local"
            value={config.date ? new Date(config.date).toISOString().slice(0, 16) : ""}
            onChange={(e) => updateConfig({ date: new Date(e.target.value).toISOString() })}
          />
          <p className="text-xs text-muted-foreground">
            O fluxo aguardará até esta data/hora antes de continuar
          </p>
        </div>
      )}

      {config.waitType === 'until_field' && (
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Campo *</Label>
            <Select
              value={config.field || ""}
              onValueChange={(value) => updateConfig({ field: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o campo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="value">Valor</SelectItem>
                <SelectItem value="stage_id">Estágio</SelectItem>
                <SelectItem value="assigned_to">Responsável</SelectItem>
                <SelectItem value="last_contact">Último Contato</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Operador *</Label>
            <Select
              value={config.operator || "equals"}
              onValueChange={(value) => updateConfig({ operator: value as ConditionOperator })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="equals">Igual a</SelectItem>
                <SelectItem value="not_equals">Diferente de</SelectItem>
                <SelectItem value="greater_than">Maior que</SelectItem>
                <SelectItem value="less_than">Menor que</SelectItem>
                <SelectItem value="exists">Existe</SelectItem>
                <SelectItem value="not_exists">Não existe</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Valor (opcional)</Label>
            <Input
              value={config.value || ""}
              onChange={(e) => updateConfig({ value: e.target.value })}
              placeholder="Valor esperado"
            />
          </div>
          <div className="p-3 bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-md text-sm">
            ⚠️ O fluxo verificará periodicamente se a condição foi atendida
          </div>
        </div>
      )}
    </div>
  );
}

