import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { ConditionConfig, ConditionOperator } from "@/types/automationFlow";
import { useTags } from "@/hooks/useTags";
import { usePipelineStages } from "@/hooks/usePipelineStages";

interface ConditionNodeConfigProps {
  config: ConditionConfig;
  onConfigChange: (config: ConditionConfig) => void;
}

export function ConditionNodeConfig({ config, onConfigChange }: ConditionNodeConfigProps) {
  const { tags } = useTags();
  const { stages } = usePipelineStages();

  const updateConfig = (updates: Partial<ConditionConfig>) => {
    onConfigChange({ ...config, ...updates });
  };

  const conditionType = config.field ? 'field' : config.tag_id ? 'tag' : config.stage_id ? 'stage' : 'field';

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Tipo de Condição *</Label>
        <Select
          value={conditionType}
          onValueChange={(value) => {
            // Limpar configurações anteriores
            const newConfig: ConditionConfig = { operator: config.operator || 'equals' };
            if (value === 'field') {
              newConfig.field = 'value';
            } else if (value === 'tag') {
              newConfig.tag_id = tags[0]?.id || '';
            } else if (value === 'stage') {
              newConfig.stage_id = stages[0]?.id || '';
            }
            onConfigChange(newConfig);
          }}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="field">Campo do Lead</SelectItem>
            <SelectItem value="tag">Tag</SelectItem>
            <SelectItem value="stage">Estágio</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {conditionType === 'field' && (
        <>
          <div className="space-y-2">
            <Label>Campo *</Label>
            <Select
              value={config.field || ""}
              onValueChange={(value) => updateConfig({ field: value, tag_id: undefined, stage_id: undefined })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o campo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="value">Valor</SelectItem>
                <SelectItem value="source">Origem</SelectItem>
                <SelectItem value="assigned_to">Responsável</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="phone">Telefone</SelectItem>
                <SelectItem value="company">Empresa</SelectItem>
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
                <SelectItem value="contains">Contém</SelectItem>
                <SelectItem value="not_contains">Não contém</SelectItem>
                <SelectItem value="exists">Existe</SelectItem>
                <SelectItem value="not_exists">Não existe</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {!['exists', 'not_exists'].includes(config.operator || 'equals') && (
            <div className="space-y-2">
              <Label>Valor *</Label>
              <Input
                value={config.value || ""}
                onChange={(e) => updateConfig({ value: e.target.value })}
                placeholder="Valor para comparar"
              />
            </div>
          )}
        </>
      )}

      {conditionType === 'tag' && (
        <div className="space-y-2">
          <Label>Tag *</Label>
          <Select
            value={config.tag_id || ""}
            onValueChange={(value) => updateConfig({ tag_id: value, field: undefined, stage_id: undefined })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione a tag" />
            </SelectTrigger>
            <SelectContent>
              {tags.map((tag) => (
                <SelectItem key={tag.id} value={tag.id}>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: tag.color }} />
                    {tag.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="space-y-2">
            <Label>Operador *</Label>
            <Select
              value={config.operator || "exists"}
              onValueChange={(value) => updateConfig({ operator: value as ConditionOperator })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="exists">Tem a tag</SelectItem>
                <SelectItem value="not_exists">Não tem a tag</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {conditionType === 'stage' && (
        <div className="space-y-2">
          <Label>Estágio *</Label>
          <Select
            value={config.stage_id || ""}
            onValueChange={(value) => updateConfig({ stage_id: value, field: undefined, tag_id: undefined })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione o estágio" />
            </SelectTrigger>
            <SelectContent>
              {stages.map((stage) => (
                <SelectItem key={stage.id} value={stage.id}>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: stage.color }} />
                    {stage.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
                <SelectItem value="equals">Está neste estágio</SelectItem>
                <SelectItem value="not_equals">Não está neste estágio</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      <div className="p-3 bg-muted rounded-md text-sm text-muted-foreground">
        💡 Se a condição for verdadeira, o fluxo seguirá pelo caminho "Sim". Caso contrário, seguirá pelo caminho "Não".
      </div>
    </div>
  );
}

